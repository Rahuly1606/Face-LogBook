from flask import Flask
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
    
    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    CORS(app)
    
    # Register blueprints
    from .api.students import student_bp
    from .api.attendance import attendance_bp
    from .api.health import health_bp
    
    app.register_blueprint(student_bp, url_prefix='/api/v1/students')
    app.register_blueprint(attendance_bp, url_prefix='/api/v1/attendance')
    app.register_blueprint(health_bp, url_prefix='/api/v1')
    
    return app