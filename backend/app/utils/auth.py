from functools import wraps
from flask import request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt, verify_jwt_in_request


def _has_admin_jwt() -> bool:
    """Return True if request has a valid JWT with role=admin."""
    try:
        verify_jwt_in_request(optional=True)
        claims = get_jwt()
        if not claims:
            return False
        role = claims.get("role")
        return role == "admin"
    except Exception:
        return False


def _has_legacy_admin_token() -> bool:
    """Return True if request has legacy X-ADMIN-TOKEN matching configured token."""
    expected_token = current_app.config.get("ADMIN_TOKEN")
    received = request.headers.get("X-ADMIN-TOKEN")
    return bool(expected_token) and received == expected_token


def require_admin(f):
    """Decorator to require admin via JWT role or legacy admin token."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if _has_admin_jwt() or _has_legacy_admin_token():
            return f(*args, **kwargs)
        return jsonify({"success": False, "message": "Unauthorized"}), 401
    return decorated_function


def check_auth_optional(f):
    """Decorator kept for compatibility; now enforces admin like require_admin."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if _has_admin_jwt() or _has_legacy_admin_token():
            return f(*args, **kwargs)
        return jsonify({"success": False, "message": "Unauthorized"}), 401
    return decorated_function


def admin_required():
    """Decorator factory requiring admin via JWT role or legacy token."""
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            if _has_admin_jwt() or _has_legacy_admin_token():
                return fn(*args, **kwargs)
            return jsonify({"success": False, "message": "Unauthorized"}), 401
        return decorator
    return wrapper


def verify_admin_token(token):
    """Verify if the provided admin token is valid (legacy support)."""
    admin_token = current_app.config.get('ADMIN_TOKEN', 'admin_secret_token')
    return token == admin_token