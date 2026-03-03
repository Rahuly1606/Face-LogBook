from flask import Flask, jsonify, request, make_response, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import os
import time
from .config import config_by_name
from .utils.aiven_ssl import setup_aiven_ssl
from .utils.logging_config import configure_logging

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
limiter = Limiter(key_func=get_remote_address, default_limits=["500 per day", "120 per minute"])

def create_app(config_name='dev'):
    # Set up Aiven SSL if configured
    setup_aiven_ssl()
    
    app = Flask(__name__)
    app.config.from_object(config_by_name[config_name])
    
    # Configure logging
    configure_logging(app)
    
    # Set application start time for uptime tracking
    app.start_time = time.time()
    
    # Create uploads directory if it doesn't exist
    upload_folder = app.config.get('UPLOAD_FOLDER', 'uploads')
    if not os.path.isabs(upload_folder):
        upload_folder = os.path.join(app.root_path, '..', upload_folder)
    os.makedirs(upload_folder, exist_ok=True)
    app.config['UPLOAD_FOLDER'] = upload_folder  # persist the resolved absolute path
    app.logger.info(f"Upload folder ensured at: {upload_folder}")
    
    # Set open attendance endpoints in development
    if config_name == 'dev':
        app.config['OPEN_ATTENDANCE_ENDPOINTS'] = True
    
    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    limiter.init_app(app)
    
    # Configure CORS - allowing specific origins from config
    allowed_origins = app.config.get('ALLOWED_ORIGINS', 'http://localhost:8080')
    if isinstance(allowed_origins, str):
        allowed_origins = [o.strip() for o in allowed_origins.split(',')]
    
    CORS(app, 
         resources={
             r"/api/*": {"origins": allowed_origins},
             r"/public/*": {"origins": "*"},   # public self-registration — no auth required
         },
         supports_credentials=True,
         allow_headers=["Content-Type", "Authorization", "X-ADMIN-TOKEN"],
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
    
    # Add error handler for CORS preflight requests
    @app.after_request
    def after_request(response):
        # Ensure CORS headers are added even to error responses
        origin = request.headers.get('Origin')
        # /public/* routes are open to any origin (student self-registration)
        if request.path.startswith('/public/'):
            response.headers.set('Access-Control-Allow-Origin', origin or '*')
            response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
            response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        elif origin and origin in allowed_origins:
            response.headers.set('Access-Control-Allow-Origin', origin)
            response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-ADMIN-TOKEN')
            response.headers.set('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS')
            response.headers.set('Access-Control-Allow-Credentials', 'true')
            
            # Prevent redirects for preflight requests
            if request.method == 'OPTIONS' and response.status_code >= 300 and response.status_code < 400:
                return make_response('', 200)
        
        return response
        
    # Handle OPTIONS requests explicitly for preflight
    @app.route('/', defaults={'path': ''}, methods=['OPTIONS'])
    @app.route('/<path:path>', methods=['OPTIONS'])
    def options_handler(path):
        response = make_response()
        origin = request.headers.get('Origin')
        full_path = '/' + path
        if full_path.startswith('/public/'):
            # Public self-registration endpoints — open CORS
            response.headers.set('Access-Control-Allow-Origin', origin or '*')
            response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
            response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        elif origin and origin in allowed_origins:
            response.headers.set('Access-Control-Allow-Origin', origin)
            response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-ADMIN-TOKEN')
            response.headers.set('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS')
            response.headers.set('Access-Control-Allow-Credentials', 'true')
        return response, 200

    @app.route('/uploads/<path:filename>')
    def serve_upload(filename):
        """Serve files from the uploads directory (e.g. unrecognized face crops)."""
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

    # Register blueprints
    from .api.students import student_bp
    from .api.attendance import attendance_bp
    from .api.health import health_bp
    from .api.auth import auth_bp
    from .api.groups import groups_bp
    from .api.camera_events import camera_events_bp
    from .api.settings import settings_bp
    from .api.public_register import public_bp
    from .api.metrics import metrics_bp
    
    app.register_blueprint(student_bp, url_prefix='/api/v1/students')
    app.register_blueprint(attendance_bp, url_prefix='/api/v1/attendance')
    app.register_blueprint(health_bp, url_prefix='/api/v1')
    app.register_blueprint(auth_bp, url_prefix='/api/v1/auth')
    app.register_blueprint(groups_bp, url_prefix='/api/v1/groups')
    app.register_blueprint(camera_events_bp, url_prefix='/api/v1/camera-events')
    app.register_blueprint(settings_bp, url_prefix='/api/v1/settings')
    app.register_blueprint(public_bp, url_prefix='/public')
    app.register_blueprint(metrics_bp, url_prefix='/api/v1/metrics')
    
    # Global error handler
    @app.errorhandler(Exception)
    def handle_exception(e):
        # Log the error
        app.logger.error(f"Unhandled exception: {str(e)}")
        
        # Return JSON response
        return jsonify({
            "success": False,
            "message": "An unexpected error occurred",
            "error": str(e)
        }), 500
    
    # Initialize the face recognition service at app startup
    with app.app_context():
        from app.services.face_service import FaceService
        from app.services.attendance_service import AttendanceService
        
        # Initialize face service - but handle initialization failures gracefully
        try:
            face_service = FaceService()
            if not face_service.initialize():
                app.logger.warning("Face service initialization failed, but app will continue running with limited functionality")
        except Exception as e:
            app.logger.error(f"Exception during face service initialization: {str(e)}")
            app.logger.warning("Continuing without face recognition functionality")
        
        # Start daily attendance reset scheduler
        try:
            AttendanceService.start_daily_reset_scheduler()
        except Exception as e:
            app.logger.error(f"Failed to start attendance scheduler: {str(e)}")
            app.logger.warning("Attendance reset scheduler not started")
        
        # Create settings table and seed defaults
        try:
            from app.models.setting import Setting
            db.create_all()  # ensures the settings table exists
            Setting.seed_defaults()
        except Exception as e:
            app.logger.error(f"Failed to seed settings: {str(e)}")
    
    return app