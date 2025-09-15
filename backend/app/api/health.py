from flask import Blueprint, jsonify, current_app, request
from app.services.face_service import FaceService
from app.models.student import Student
from app.utils.auth import admin_required, verify_admin_token
import time
import sys
import os
import cv2
import numpy as np

health_bp = Blueprint('health', __name__)
face_service = FaceService()

@health_bp.route('/health', methods=['GET'])
def health_check():
    """Check if the application is running and services are available"""
    # Check face recognition service
    face_service_status = check_face_service()
    
    # Check database connection
    db_status = check_database()
    
    # Get system info
    system_info = {
        "python_version": sys.version,
        "platform": sys.platform,
        "memory_usage_mb": get_memory_usage(),
        "uptime_seconds": get_uptime(),
    }
    
    return jsonify({
        "status": "ok" if face_service_status["status"] == "ok" and db_status["status"] == "ok" else "degraded",
        "message": "Backend service is running",
        "services": {
            "face_service": face_service_status,
            "database": db_status
        },
        "system_info": system_info
    }), 200

def check_face_service():
    """Check if face recognition service is running properly"""
    start_time = time.time()
    try:
        model_loaded = face_service.initialized
        if not model_loaded:
            # Try to initialize model
            model_loaded = face_service.initialize()
        
        end_time = time.time()
        latency = round((end_time - start_time) * 1000)  # Convert to milliseconds
        
        if model_loaded:
            return {
                "status": "ok",
                "message": "Face recognition model loaded successfully",
                "latency": latency
            }
        else:
            return {
                "status": "error",
                "message": "Face recognition model failed to load",
                "latency": latency
            }
    except Exception as e:
        end_time = time.time()
        latency = round((end_time - start_time) * 1000)
        return {
            "status": "error",
            "message": f"Error in face service: {str(e)}",
            "latency": latency
        }

def check_database():
    """Check if database is accessible"""
    start_time = time.time()
    try:
        # Get student count to check DB connection
        student_count = Student.query.count()
        
        end_time = time.time()
        latency = round((end_time - start_time) * 1000)  # Convert to milliseconds
        
        return {
            "status": "ok",
            "message": f"Database connected, {student_count} students found",
            "latency": latency
        }
    except Exception as e:
        end_time = time.time()
        latency = round((end_time - start_time) * 1000)
        return {
            "status": "error",
            "message": f"Database error: {str(e)}",
            "latency": latency
        }

def get_memory_usage():
    """Get current memory usage in MB"""
    try:
        import psutil
        process = psutil.Process(os.getpid())
        memory_info = process.memory_info()
        return round(memory_info.rss / (1024 * 1024), 2)  # Convert to MB
    except ImportError:
        # If psutil is not available
        return None
    except Exception:
        return None

@health_bp.route('/debug/test-image-processing', methods=['POST'])
@admin_required()
def test_image_processing():
    """Test image processing capabilities of the backend"""
    if 'image' not in request.files:
        return jsonify({"success": False, "message": "No image file provided"}), 400
    
    file = request.files['image']
    if not file.filename:
        return jsonify({"success": False, "message": "Empty file provided"}), 400
    
    # Read image bytes
    image_bytes = file.read()
    
    # Convert to OpenCV format
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            return jsonify({"success": False, "message": "Could not decode image"}), 400
        
        # Get image info
        height, width = image.shape[:2]
        channels = 1 if len(image.shape) == 2 else image.shape[2]
        size_bytes = len(image_bytes)
        size_mb = size_bytes / (1024 * 1024)
        
        # Test face detection - but don't return actual faces for privacy
        face_count = 0
        face_detection_time = 0
        
        try:
            start_time = time.time()
            # Only run face detection if service is initialized
            if face_service.initialized:
                faces = face_service.detector.detect(image)
                face_count = len(faces)
            end_time = time.time()
            face_detection_time = round((end_time - start_time) * 1000)  # ms
        except Exception as e:
            return jsonify({
                "success": False, 
                "message": f"Error in face detection: {str(e)}"
            }), 500
        
        return jsonify({
            "success": True,
            "message": "Image processed successfully",
            "image_info": {
                "width": width,
                "height": height,
                "channels": channels,
                "size_bytes": size_bytes,
                "size_mb": round(size_mb, 2)
            },
            "face_detection": {
                "face_count": face_count,
                "processing_time_ms": face_detection_time,
                "model_loaded": face_service.initialized
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Error processing image: {str(e)}"
        }), 500

def get_uptime():
    """Get application uptime in seconds"""
    try:
        if hasattr(current_app, 'start_time'):
            return int(time.time() - current_app.start_time)
        else:
            # If start_time is not set, set it now
            current_app.start_time = time.time()
            return 0
    except Exception:
        return None

@health_bp.route('/debug/token-check', methods=['GET'])
def debug_token_check():
    """Debug endpoint to check if admin token is valid"""
    try:
        # Get the token from the request headers
        token = request.headers.get('X-ADMIN-TOKEN')
        
        if not token:
            return jsonify({
                "match": False,
                "message": "No admin token provided",
                "expected_token": current_app.config.get('ADMIN_TOKEN', 'admin_secret_token')
            }), 401
        
        # Verify the token
        is_valid = verify_admin_token(token)
        
        return jsonify({
            "match": is_valid,
            "message": "Token is valid" if is_valid else "Token is invalid",
            "expected_token": current_app.config.get('ADMIN_TOKEN', 'admin_secret_token'),
            "provided_token": token[:5] + "..." if len(token) > 5 else token
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error in token check: {str(e)}")
        return jsonify({
            "match": False,
            "message": f"Error checking token: {str(e)}",
            "expected_token": current_app.config.get('ADMIN_TOKEN', 'admin_secret_token')
        }), 500