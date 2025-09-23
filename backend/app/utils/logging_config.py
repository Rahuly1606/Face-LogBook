"""
Logging configuration for Face-LogBook application.

This module configures the logging for the application, setting appropriate
log levels for different components.
"""

import logging
import os

def configure_logging(app):
    """
    Configure logging for the application.
    
    Args:
        app: The Flask application instance
    """
    # Set up root logger
    logging.basicConfig(
        level=logging.INFO,
        format='[%(asctime)s] %(levelname)s in %(module)s: %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Set specific log levels for noisy modules
    logging.getLogger('app.services.drive_service').setLevel(logging.WARNING)
    logging.getLogger('app.services.groups').setLevel(logging.INFO)
    
    # Set werkzeug (Flask's WSGI) to only show warnings
    logging.getLogger('werkzeug').setLevel(logging.WARNING)
    
    # Reduce SQLAlchemy logging
    logging.getLogger('sqlalchemy').setLevel(logging.WARNING)
    logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)
    
    # Reduce Google API related logging
    logging.getLogger('googleapiclient').setLevel(logging.WARNING)
    logging.getLogger('googleapiclient.discovery').setLevel(logging.WARNING)
    logging.getLogger('googleapiclient.http').setLevel(logging.WARNING)
    logging.getLogger('google.auth').setLevel(logging.WARNING)
    logging.getLogger('google.auth.transport').setLevel(logging.WARNING)
    logging.getLogger('google.oauth2').setLevel(logging.WARNING)
    logging.getLogger('oauth2client').setLevel(logging.WARNING)
    
    # Set Flask app logger
    app.logger.setLevel(logging.INFO)
    
    # If we're in debug mode, allow more detailed logs for development
    if app.debug:
        # Still limit drive service noise
        logging.getLogger('app.services.drive_service').setLevel(logging.WARNING)
    else:
        # In production, be more restrictive with logs
        app.logger.setLevel(logging.WARNING)
        logging.getLogger('werkzeug').setLevel(logging.ERROR)
    
    app.logger.info("Logging configured with drive_service and Google API at WARNING level")
    
    return app