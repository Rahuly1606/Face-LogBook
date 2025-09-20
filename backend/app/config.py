import os
from datetime import timedelta
import pytz

class Config:
    """Base configuration class. Contains default settings."""
    SECRET_KEY = os.getenv('SECRET_KEY', 'a_very_secret_dev_key')
    ADMIN_TOKEN = os.getenv('ADMIN_TOKEN', 'admin_secret_token')  # For legacy auth
    DEBUG = False
    TESTING = False
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # JWT Settings
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'jwt_secret_dev_key')
    JWT_ACCESS_TOKEN_EXPIRES = int(os.getenv('JWT_ACCESS_EXPIRES', 3600))  # 1 hour default
    
    # Face recognition settings
    FACE_MATCH_THRESHOLD = float(os.getenv('MATCH_THRESHOLD', 0.60))
    FACE_DETECTOR_BACKEND = os.getenv('FACE_DETECTOR_BACKEND', 'retinaface')
    FACE_MODEL_PATH = os.getenv('INSIGHTFACE_MODEL_ROOT', 'models')
    MAX_IMAGE_SIZE = int(os.getenv('MAX_IMAGE_SIZE', 1024))  # Increased from 800 to 1024
    
    # Attendance settings
    DEBOUNCE_SECONDS = int(os.getenv('DEBOUNCE_SECONDS', 30))
    
    # Timezone settings
    TIMEZONE = pytz.timezone('Asia/Kolkata')  # Indian Standard Time
    
    # Upload settings
    UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'uploads')
    MAX_CONTENT_LENGTH = 32 * 1024 * 1024  # Increased from 16MB to 32MB max upload
    
    # CORS settings
    ALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', 'http://localhost:8080,http://127.0.0.1:8080,http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,https://face-log-book.vercel.app')
    
    # Google Drive settings
    GOOGLE_SERVICE_ACCOUNT_JSON = os.getenv('GOOGLE_SERVICE_ACCOUNT_JSON', None)
    
    # Bulk import settings
    BULK_IMPORT_BATCH_SIZE = int(os.getenv('BULK_IMPORT_BATCH_SIZE', 50))  # Increased from 20 to 50
    BULK_IMPORT_TIMEOUT = int(os.getenv('BULK_IMPORT_TIMEOUT', 1200))  # Increased to 20 minutes
    MAX_IMPORT_ROWS = int(os.getenv('MAX_IMPORT_ROWS', 5000))  # Increased from 1000 to 5000

class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True
    # Use a specific environment variable for the development database
    SQLALCHEMY_DATABASE_URI = os.getenv(
        'DEV_DATABASE_URL', 
        'mysql+pymysql://root:Rahul%401606@localhost/face-logbook'
    )

class TestingConfig(Config):
    """Testing configuration."""
    TESTING = True
    DEBUG = True
    # Use a specific environment variable for the testing database
    SQLALCHEMY_DATABASE_URI = os.getenv(
        'TEST_DATABASE_URL', 
        'mysql+pymysql://root:Rishi%404617@localhost/face_logbook_test'
    )
    # Use a predictable admin token for tests
    ADMIN_TOKEN = 'test_token'

class ProductionConfig(Config):
    """Production configuration."""
    # In production, DATABASE_URL must be set
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL')
    # Ensure SECRET_KEY and ADMIN_TOKEN are set in production
    SECRET_KEY = os.getenv('SECRET_KEY')
    ADMIN_TOKEN = os.getenv('ADMIN_TOKEN')


# Dictionary to map environment names to configuration classes
config_by_name = {
    'dev': DevelopmentConfig,
    'development': DevelopmentConfig,  # Alias for development
    'test': TestingConfig,
    'testing': TestingConfig,          # Alias for testing
    'prod': ProductionConfig,
    'production': ProductionConfig     # Alias for production
}