"""Background task processor for import jobs"""
import threading
import io
import csv
import time
from flask import current_app
from app import db
from app.models.import_job import ImportJob
from app.models.student import Student
from app.services.face_service import FaceService
from app.services.drive_service import DriveService
import uuid
import cv2
import numpy as np
from datetime import datetime


class ImportJobProcessor:
    """Process bulk import jobs in the background"""
    
    @staticmethod
    def process_job_async(job_id, file_content, app):
        """Process a job asynchronously in a separate thread"""
        def _process():
            with app.app_context():
                ImportJobProcessor.process_job(job_id, file_content)
        
        thread = threading.Thread(target=_process)
        thread.daemon = True
        thread.start()
    
    @staticmethod
    def process_job(job_id, file_content):
        """Process a bulk import job"""
        job = ImportJob.query.get(job_id)
        if not job:
            current_app.logger.error(f"Job {job_id} not found")
            return
        
        try:
            # Update job status to processing
            job.status = 'processing'
            db.session.commit()
            
            # Initialize services
            face_service = FaceService()
            drive_service = DriveService()
            
            drive_service_initialized = drive_service.initialize()
            face_service_initialized = face_service.initialize()
            
            if not drive_service_initialized:
                job.mark_failed("Failed to initialize Google Drive service")
                db.session.commit()
                return
            
            # Parse CSV
            stream = io.StringIO(file_content, newline=None)
            csv_reader = csv.reader(stream)
            
            # Read header
            try:
                header = next(csv_reader)
            except StopIteration:
                job.mark_failed("CSV file is empty")
                db.session.commit()
                return
            
            # Normalize header
            header = [col.strip().lower() for col in header]
            
            # Define column variations
            student_id_variations = ['student_id', 'student id', 'studentid', 'id', 'your college id', 'college id', 'student-id']
            name_variations = ['name', 'full name', 'student name', 'your name', 'fullname', 'student-name']
            drive_link_variations = ['drive_link', 'drive link', 'drivelink', 'photo', 'image', 'upload your clear image', 
                                    'drive-link', 'google drive', 'google-drive', 'drive url', 'photo link', 'photo url']
            
            # Find matching columns
            student_id_col = next((col for col in student_id_variations if col in header), None)
            name_col = next((col for col in name_variations if col in header), None)
            drive_link_col = next((col for col in drive_link_variations if col in header), None)
            
            if not all([student_id_col, name_col, drive_link_col]):
                missing = []
                if not student_id_col:
                    missing.append('student_id')
                if not name_col:
                    missing.append('name')
                if not drive_link_col:
                    missing.append('drive_link')
                job.mark_failed(f"Missing required columns: {', '.join(missing)}")
                db.session.commit()
                return
            
            # Get column indices
            student_id_idx = header.index(student_id_col)
            name_idx = header.index(name_col)
            drive_link_idx = header.index(drive_link_col)
            
            # Process each row
            row_num = 1
            for row in csv_reader:
                row_num += 1
                
                # Skip empty rows
                if not row or len(row) < max(student_id_idx, name_idx, drive_link_idx) + 1:
                    continue
                
                try:
                    student_id = row[student_id_idx].strip()
                    name = row[name_idx].strip()
                    drive_link = row[drive_link_idx].strip()
                    
                    # Validate data
                    if not student_id or not name or not drive_link:
                        job.add_failure({
                            'row': row_num,
                            'student_id': student_id,
                            'name': name,
                            'message': 'Missing required field(s)'
                        })
                        db.session.commit()
                        continue
                    
                    # Check if student already exists
                    existing = Student.query.filter_by(student_id=student_id, group_id=job.group_id).first()
                    if existing:
                        job.add_failure({
                            'row': row_num,
                            'student_id': student_id,
                            'name': name,
                            'message': f'Student ID {student_id} already exists in this group'
                        })
                        db.session.commit()
                        continue
                    
                    # Also check if student exists in any group (for debugging)
                    existing_any_group = Student.query.filter_by(student_id=student_id).first()
                    if existing_any_group:
                        current_app.logger.warning(f"Student {student_id} already exists in group {existing_any_group.group_id}, trying to add to group {job.group_id}")
                        job.add_failure({
                            'row': row_num,
                            'student_id': student_id,
                            'name': name,
                            'message': f'Student ID {student_id} already exists in group {existing_any_group.group_id}. Each student ID must be unique across all groups.'
                        })
                        db.session.commit()
                        continue
                    
                    # Download image from Drive
                    temp_filepath = None
                    try:
                        temp_filepath = drive_service.download_file(drive_link)
                    except Exception as e:
                        job.add_failure({
                            'row': row_num,
                            'student_id': student_id,
                            'name': name,
                            'message': f'Failed to download image from Drive: {str(e)}'
                        })
                        db.session.commit()
                        continue
                    
                    # Read image with OpenCV (this releases the file immediately)
                    img = cv2.imread(temp_filepath)
                    
                    if img is None:
                        # Clean up temp file with retry logic
                        try:
                            import os
                            import time
                            # Give Windows time to release file handles
                            time.sleep(0.2)
                            os.remove(temp_filepath)
                        except Exception as cleanup_err:
                            current_app.logger.warning(f"Could not delete temp file: {str(cleanup_err)}")
                        job.add_failure({
                            'row': row_num,
                            'student_id': student_id,
                            'name': name,
                            'message': 'Invalid image format'
                        })
                        db.session.commit()
                        continue
                    
                    # Save image to permanent location
                    import os
                    import shutil
                    upload_folder = current_app.config.get('UPLOAD_FOLDER', 'uploads')
                    filename = f"{student_id}_{uuid.uuid4()}.jpg"
                    filepath = os.path.join(upload_folder, filename)
                    
                    # Copy temp file to permanent location
                    try:
                        shutil.copy(temp_filepath, filepath)
                    except Exception as copy_err:
                        current_app.logger.error(f"Error copying file: {str(copy_err)}")
                        # Clean up temp file before continuing
                        try:
                            import time
                            time.sleep(0.2)
                            if os.path.exists(temp_filepath):
                                os.remove(temp_filepath)
                        except:
                            pass
                        job.add_failure({
                            'row': row_num,
                            'student_id': student_id,
                            'name': name,
                            'message': f'Failed to save image: {str(copy_err)}'
                        })
                        db.session.commit()
                        continue
                    
                    # Clean up temp file with retry logic
                    import time
                    max_retries = 5
                    cleanup_delay = 0.3
                    for retry in range(max_retries):
                        try:
                            time.sleep(cleanup_delay)
                            if os.path.exists(temp_filepath):
                                os.remove(temp_filepath)
                            break
                        except PermissionError as cleanup_err:
                            if retry == max_retries - 1:
                                current_app.logger.warning(f"Could not delete temp file after {max_retries} attempts: {str(cleanup_err)}")
                            else:
                                cleanup_delay *= 1.5  # Exponential backoff
                        except Exception as cleanup_err:
                            current_app.logger.warning(f"Error deleting temp file: {str(cleanup_err)}")
                            break
                    
                    # Detect and encode face
                    if face_service_initialized:
                        bbox, embedding = face_service.detect_and_embed_face(img)
                        if embedding is None:
                            # Clean up the saved file
                            try:
                                os.remove(filepath)
                            except:
                                pass
                            job.add_failure({
                                'row': row_num,
                                'student_id': student_id,
                                'name': name,
                                'message': 'No face detected in image'
                            })
                            db.session.commit()
                            continue
                        
                        face_encoding = embedding
                    else:
                        face_encoding = None
                    
                    # Create student
                    current_app.logger.info(f"Creating student {student_id} in group {job.group_id}")
                    student = Student(
                        student_id=student_id,
                        name=name,
                        group_id=job.group_id,
                        photo_path=filepath
                    )
                    
                    # Set face embedding if available
                    if face_encoding is not None:
                        try:
                            student.set_embedding(face_encoding)
                            current_app.logger.info(f"Set embedding for student {student_id}")
                        except Exception as embed_error:
                            current_app.logger.error(f"Error setting embedding for {student_id}: {str(embed_error)}")
                    
                    try:
                        current_app.logger.info(f"Adding student {student_id} to database session")
                        db.session.add(student)
                        
                        current_app.logger.info(f"Committing student {student_id} to database")
                        db.session.commit()  # Commit to save the student
                        
                        current_app.logger.info(f"Student {student_id} committed successfully. Checking student_id field...")
                        
                        # For Student model, student_id is the primary key, not id
                        # So we use student.student_id instead of student.id
                        if not hasattr(student, 'student_id') or student.student_id is None:
                            current_app.logger.error(f"Student object missing student_id after commit: {student}")
                            raise Exception("Student ID not available after database commit")
                        
                        current_app.logger.info(f"Student {student_id} has valid student_id: {student.student_id}")
                        
                        # Add success (using student_id as the primary key)
                        job.add_success({
                            'student_id': student_id,
                            'name': name,
                            'id': student.student_id  # Use student_id as the ID for consistency with frontend
                        })
                        db.session.commit()  # Commit the job update
                        
                        current_app.logger.info(f"Successfully processed student {student_id}")
                        
                    except Exception as db_error:
                        current_app.logger.error(f"Database error for student {student_id}: {str(db_error)}")
                        current_app.logger.error(f"Student object state: {student.__dict__ if hasattr(student, '__dict__') else 'No __dict__'}")
                        # Rollback the student creation if there was an error
                        db.session.rollback()
                        # Clean up the saved file
                        try:
                            import os
                            os.remove(filepath)
                        except:
                            pass
                        job.add_failure({
                            'row': row_num,
                            'student_id': student_id,
                            'name': name,
                            'message': f'Database error: {str(db_error)}'
                        })
                        db.session.commit()
                        continue
                    
                    # Small delay to prevent overwhelming the system
                    time.sleep(0.1)
                    
                except Exception as e:
                    current_app.logger.error(f"Error processing row {row_num}: {str(e)}")
                    job.add_failure({
                        'row': row_num,
                        'student_id': row[student_id_idx] if len(row) > student_id_idx else '',
                        'name': row[name_idx] if len(row) > name_idx else '',
                        'message': str(e)
                    })
                    db.session.commit()
                    continue
            
            # Mark job as completed
            job.mark_completed()
            db.session.commit()
            
            current_app.logger.info(f"Job {job_id} completed: {job.successful_records} successful, {job.failed_records} failed")
            
        except Exception as e:
            current_app.logger.error(f"Fatal error processing job {job_id}: {str(e)}")
            job.mark_failed(str(e))
            db.session.commit()
