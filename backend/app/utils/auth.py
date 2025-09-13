from functools import wraps
from flask import request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt, verify_jwt_in_request

def require_admin(f):
    """Decorator to require admin token for access"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Check for admin token in header
        admin_token = current_app.config.get('ADMIN_TOKEN')
        token = request.headers.get('X-ADMIN-TOKEN')
        
        if not token or token != admin_token:
            return jsonify({"success": False, "message": "Unauthorized"}), 401
        
        return f(*args, **kwargs)
    return decorated_function

def check_auth_optional(f):
    """Decorator to check auth but allow endpoints to be open based on config"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Check if attendance endpoints should be open
        if current_app.config.get('OPEN_ATTENDANCE_ENDPOINTS', False):
            return f(*args, **kwargs)
            
        # Check for admin token in header
        admin_token = current_app.config.get('ADMIN_TOKEN')
        token = request.headers.get('X-ADMIN-TOKEN')
        
        if not token or token != admin_token:
            return jsonify({"success": False, "message": "Unauthorized"}), 401
        
        return f(*args, **kwargs)
    return decorated_function

def admin_required():
    """Decorator to require admin token for access, alias for require_admin"""
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            # Check for admin token in header
            admin_token = current_app.config.get('ADMIN_TOKEN')
            token = request.headers.get('X-ADMIN-TOKEN')
            
            if not token or token != admin_token:
                return jsonify({"success": False, "message": "Unauthorized"}), 401
            
            return fn(*args, **kwargs)
        return decorator
    return wrapper