from flask import Blueprint, jsonify
from app.services.face_service import FaceService

health_bp = Blueprint('health', __name__)
face_service = FaceService()

@health_bp.route('/health', methods=['GET'])
def health_check():
    """Check if the application is running and model is loaded"""
    model_loaded = face_service.initialized
    if not model_loaded:
        # Try to initialize model
        model_loaded = face_service.initialize()
    
    return jsonify({
        "status": "ok",
        "model_loaded": model_loaded
    }), 200