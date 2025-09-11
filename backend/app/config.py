import os
from datetime import timedelta

class Config:
    """Base configuration class. Contains default settings."""
    SECRET_KEY = os.getenv('SECRET_KEY', 'a_very_secret_dev_key')
    ADMIN_TOKEN = os.getenv('ADMIN_TOKEN', 'admin_secret_token')
    DEBUG = False
    TESTING = False
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Face recognition settings
    FACE_MATCH_THRESHOLD = float(os.getenv('FACE_MATCH_THRESHOLD', 0.60))
    FACE_DETECTOR_BACKEND = os.getenv('FACE_DETECTOR_BACKEND', 'retinaface')
    FACE_MODEL_PATH = os.getenv('FACE_MODEL_PATH', 'models')
    MAX_IMAGE_SIZE = int(os.getenv('MAX_IMAGE_SIZE', 800))
    
    # Attendance settings
    DEBOUNCE_SECONDS = int(os.getenv('DEBOUNCE_SECONDS', 30))
    
    # Upload settings
    UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max upload

class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True
    # Use a specific environment variable for the development database
    SQLALCHEMY_DATABASE_URI = os.getenv(
        'DEV_DATABASE_URL', 
        'mysql+pymysql://root:password@localhost/attendance_dev'
    )

class TestingConfig(Config):
    """Testing configuration."""
    TESTING = True
    DEBUG = True
    # Use a specific environment variable for the testing database
    SQLALCHEMY_DATABASE_URI = os.getenv(
        'TEST_DATABASE_URL', 
        'mysql+pymysql://root:password@localhost/attendance_test'
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