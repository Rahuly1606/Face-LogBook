import os
import time
import re
import tempfile
import json  # --- MODIFIED: Added for parsing JSON content
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from googleapiclient.errors import HttpError
from PIL import Image
import io
from flask import current_app

class DriveService:
    def __init__(self):
        self.credentials = None
        self.service = None
        self.initialized = False

    def initialize(self):
        """Initialize the Google Drive API client"""
        if self.initialized:
            return True

        # --- MODIFIED: This variable now holds either a file path or the JSON content string
        service_account_config = current_app.config.get('GOOGLE_SERVICE_ACCOUNT_JSON')

        if not service_account_config:
            current_app.logger.error("Google Drive service account JSON file or content not found in config")
            return False

        try:
            # --- MODIFIED: This block now handles both deployment and local scenarios ---
            creds_info = None
            service_account_email = None

            try:
                # --- DEPLOYMENT SCENARIO: Try to load as JSON content first ---
                creds_info = json.loads(service_account_config)
                self.credentials = service_account.Credentials.from_service_account_info(
                    creds_info,
                    scopes=['https://www.googleapis.com/auth/drive.readonly']
                )
                service_account_email = self.credentials.service_account_email
                current_app.logger.info("Initialized Google Drive credentials from JSON content.")
            
            except json.JSONDecodeError:
                # --- LOCAL SCENARIO: If it's not JSON, treat it as a file path ---
                if not os.path.exists(service_account_config):
                    current_app.logger.error(f"Google Drive service account file path not found: {service_account_config}")
                    return False

                self.credentials = service_account.Credentials.from_service_account_file(
                    service_account_config,
                    scopes=['https://www.googleapis.com/auth/drive.readonly']
                )
                service_account_email = self.credentials.service_account_email
                current_app.logger.info("Initialized Google Drive credentials from file path.")
            
            # --- END OF MODIFIED BLOCK ---
            
            # Create Drive API client (this part is the same for both scenarios)
            self.service = build('drive', 'v3', credentials=self.credentials)
            self.initialized = True
            
            # Log service account email for sharing instructions
            current_app.logger.info(f"Google Drive API client initialized with service account: {service_account_email}")
            
            return True
        except Exception as e:
            current_app.logger.error(f"Failed to initialize Google Drive API client: {str(e)}")
            return False

    def extract_drive_file_id(self, url):
        """Extract file ID from Google Drive URL"""
        from flask import current_app
        
        if not url:
            current_app.logger.error("No Drive URL provided")
            return None
        
        # Patterns for various Google Drive URL formats
        patterns = [
            r'https://drive\.google\.com/file/d/([a-zA-Z0-9_-]+)',  # /file/d/{id}
            r'https://drive\.google\.com/open\?id=([a-zA-Z0-9_-]+)',  # /open?id={id}
            r'https://docs\.google\.com/[a-z]+/d/([a-zA-Z0-9_-]+)',  # /document/d/{id}
            r'id=([a-zA-Z0-9_-]+)',  # any URL with id={id}
            r'https://drive\.google\.com/drive/folders/([a-zA-Z0-9_-]+)',  # /drive/folders/{id}
            r'https://drive\.google\.com/uc\?id=([a-zA-Z0-9_-]+)',  # /uc?id={id}
            r'https://drive\.google\.com/drive/u/\d+/folders/([a-zA-Z0-9_-]+)',  # User-specific folder
            r'https://drive\.google\.com/file/d/([a-zA-Z0-9_-]+)/view',  # /file/d/{id}/view
            r'https://drive\.google\.com/drive/u/\d+/file/d/([a-zA-Z0-9_-]+)',  # User-specific file
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                file_id = match.group(1)
                return file_id
        
        if re.match(r'^[a-zA-Z0-9_-]{25,}$', url):
            return url
        
        current_app.logger.warning(f"Could not extract file ID from URL: {url}")
        return None

    def download_drive_file(self, file_id, dest_path=None, max_retries=3):
        """Download file from Google Drive with exponential backoff retry"""
        if not self.initialized:
            if not self.initialize():
                raise RuntimeError("Google Drive API client could not be initialized")
                
        if not file_id:
            raise ValueError("Invalid file ID")
        
        if not dest_path:
            # Create temp file and immediately close the file descriptor to avoid Windows locking issues
            fd, dest_path = tempfile.mkstemp(suffix='.jpg')
            os.close(fd)  # Close the file descriptor immediately
        
        retry_count = 0
        while retry_count < max_retries:
            try:
                request = self.service.files().get_media(fileId=file_id)
                
                with open(dest_path, 'wb') as f:
                    downloader = MediaIoBaseDownload(f, request)
                    done = False
                    while not done:
                        status, done = downloader.next_chunk()
                
                try:
                    with Image.open(dest_path) as img:
                        img.verify()
                    return dest_path
                except Exception as e:
                    if os.path.exists(dest_path):
                        try:
                            os.remove(dest_path)
                        except OSError:
                            pass  # Ignore if file can't be removed
                    raise ValueError(f"Downloaded file is not a valid image: {str(e)}")
            
            except HttpError as e:
                error_code = e.resp.status
                if error_code == 403:
                    raise PermissionError(f"Access denied to Google Drive file (ID: {file_id}). Make sure it's shared with the service account.")
                elif error_code == 404:
                    raise FileNotFoundError(f"Google Drive file not found (ID: {file_id}) or has been deleted.")
                elif error_code >= 500:
                    retry_count += 1
                    wait_time = (2 ** retry_count)
                    current_app.logger.warning(f"Google Drive server error {error_code}, retrying in {wait_time} seconds...")
                    time.sleep(wait_time)
                    continue
                else:
                    raise
            except Exception as e:
                current_app.logger.error(f"Error downloading file from Google Drive: {str(e)}")
                raise
                
            break
        
        if retry_count >= max_retries:
            raise RuntimeError(f"Failed to download file after {max_retries} retries")
        
        return dest_path
        
    def validate_image_file(self, file_path):
        """Validate that a file is a valid image"""
        from flask import current_app
        try:
            if not os.path.exists(file_path):
                current_app.logger.error(f"File does not exist: {file_path}")
                return False
                
            if os.path.getsize(file_path) == 0:
                current_app.logger.error(f"File is empty: {file_path}")
                return False
                
            with Image.open(file_path) as img:
                img.verify()
                return True
        except Exception as e:
            current_app.logger.error(f"Error validating image file {file_path}: {str(e)}")
            return False
    
    def get_service_account_email(self):
        """Get the email address of the service account for sharing instructions"""
        # --- MODIFIED: This method now also handles both scenarios to be consistent ---
        service_account_config = current_app.config.get('GOOGLE_SERVICE_ACCOUNT_JSON')
        if not service_account_config:
            return None
        
        try:
            # Try to load from JSON content first
            creds_info = json.loads(service_account_config)
            return creds_info.get('client_email')
        except json.JSONDecodeError:
            # Fallback to loading from file path
            try:
                if os.path.exists(service_account_config):
                    return service_account.Credentials.from_service_account_file(
                        service_account_config).service_account_email
            except Exception as e:
                current_app.logger.error(f"Error getting service account email from file: {str(e)}")
        except Exception as e:
             current_app.logger.error(f"Error getting service account email from JSON: {str(e)}")
        
        return None
        
    def download_file(self, drive_link):
        """Wrapper for download_drive_file that takes a URL instead of a file ID"""
        from flask import current_app
        
        if not self.initialized:
            current_app.logger.info("Drive service not initialized, initializing now...")
            if not self.initialize():
                error_msg = "Failed to initialize Google Drive service. Check credentials and configuration."
                current_app.logger.error(error_msg)
                raise RuntimeError(error_msg)
        
        file_id = self.extract_drive_file_id(drive_link)
        if not file_id:
            error_msg = f"Could not extract file ID from Drive link: {drive_link}"
            current_app.logger.error(error_msg)
            raise ValueError(error_msg)
        
        try:
            temp_path = self.download_drive_file(file_id)
            current_app.logger.debug("Successfully downloaded file from Google Drive")
            return temp_path
        except Exception as e:
            current_app.logger.error(f"Error downloading file from Drive: {str(e)}")
            raise