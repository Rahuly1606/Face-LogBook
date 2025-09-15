from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import create_access_token, get_jwt, get_jwt_identity, jwt_required
from datetime import datetime, timezone, timedelta
import os
from app.models.user import User
from app import db

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    """Login endpoint to get JWT token using database credentials only"""
    data = request.get_json()
    
    if not data:
        return jsonify({"success": False, "message": "Missing request body"}), 400
    
    username = data.get('username', '')
    password = data.get('password', '')
    
    # Authenticate against database users only
    user = User.query.filter_by(username=username).first()
    
    if user and user.password == password:
        # Create access token with appropriate role
        role = "admin" if user.is_admin else "user"
        
        # Create the access token with role
        expires_delta = timedelta(seconds=current_app.config.get('JWT_ACCESS_TOKEN_EXPIRES'))
        access_token = create_access_token(
            identity=username,
            additional_claims={"role": role},
            expires_delta=expires_delta
        )
        
        # Calculate expiry time for client side
        expires_at = datetime.now(timezone.utc) + expires_delta
        
        return jsonify({
            "success": True,
            "access_token": access_token,
            "expires_at": expires_at.isoformat()
        }), 200
    
    return jsonify({"success": False, "message": "Invalid credentials"}), 401

@auth_bp.route('/refresh', methods=['POST'])
@jwt_required()  # Changed from jwt_required(refresh=True) to use access token
def refresh():
    """Refresh token endpoint using access token instead of refresh token"""
    # Get the identity from the access token
    current_user = get_jwt_identity()
    # Get the additional claims from the access token
    claims = get_jwt()
    
    # Create a new access token
    expires_delta = timedelta(seconds=current_app.config.get('JWT_ACCESS_TOKEN_EXPIRES'))
    access_token = create_access_token(
        identity=current_user,
        additional_claims={"role": claims.get("role", "")},
        expires_delta=expires_delta
    )
    
    # Calculate expiry time for client side
    expires_at = datetime.now(timezone.utc) + expires_delta
    
    return jsonify({
        "success": True,
        "access_token": access_token,
        "expires_at": expires_at.isoformat()
    }), 200