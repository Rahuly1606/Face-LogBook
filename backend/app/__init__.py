from flask import Flask, jsonify, request, make_response
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
import os
from .config import config_by_name

db = SQLAlchemy()
migrate = Migrate()

def create_app(config_name='dev'):
    app = Flask(__name__)
    app.config.from_object(config_by_name[config_name])
    
    # Set open attendance endpoints in development
    if config_name == 'dev':
        app.config['OPEN_ATTENDANCE_ENDPOINTS'] = True
    
    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    
    # Configure CORS with explicit settings to avoid duplicate headers
    CORS(app, 
         resources={r"/api/*": {"origins": "*"}},
         supports_credentials=False)
    
    # Register blueprints
    from .api.students import student_bp
    from .api.attendance import attendance_bp
    from .api.health import health_bp
    
    app.register_blueprint(student_bp, url_prefix='/api/v1/students')
    app.register_blueprint(attendance_bp, url_prefix='/api/v1/attendance')
    app.register_blueprint(health_bp, url_prefix='/api/v1')
    
    # Initialize the face recognition service at app startup
    with app.app_context():
        from app.services.face_service import FaceService
        from app.services.attendance_service import AttendanceService
        
        # Initialize face service
        face_service = FaceService()
        face_service.initialize()
        
        # Start daily attendance reset scheduler
        AttendanceService.start_daily_reset_scheduler()
    
    return app