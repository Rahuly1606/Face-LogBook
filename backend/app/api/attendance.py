import base64
import numpy as np
import cv2
from flask import Blueprint, request, jsonify, current_app
from app.services.face_service import FaceService
from app.services.attendance_service import AttendanceService
from app.utils.auth import require_admin, check_auth_optional

attendance_bp = Blueprint('attendance', __name__)
face_service = FaceService()

@attendance_bp.route('/live', methods=['POST'])
@check_auth_optional
def process_live_attendance():
    """Process a single frame for attendance"""
    
    # Get image data (either form data or base64 JSON)
    if request.content_type and request.content_type.startswith('multipart/form-data'):
        if 'image' not in request.files:
            return jsonify({"success": False, "message": "No image file provided"}), 400
        
        file = request.files['image']
        image_data = file.read()
    else:
        # Expect JSON with base64 image
        data = request.get_json()
        if not data or 'image_base64' not in data:
            return jsonify({"success": False, "message": "No image data provided"}), 400
        
        try:
            image_base64 = data['image_base64']
            # Remove data URL prefix if present
            if 'base64,' in image_base64:
                image_base64 = image_base64.split('base64,')[1]
            
            image_data = base64.b64decode(image_base64)
        except Exception as e:
            return jsonify({"success": False, "message": f"Invalid base64 image: {str(e)}"}), 400
    
    # Process the image
    result = face_service.process_image_for_attendance(image_data)
    
    # Process attendance for recognized faces
    for i, person in enumerate(result['recognized']):
        action = AttendanceService.process_attendance(person['student_id'])
        result['recognized'][i]['action'] = action
    
    return jsonify(result), 200

@attendance_bp.route('/upload', methods=['POST'])
@require_admin
def process_group_photo():
    """Process a group photo for attendance"""
    if 'image' not in request.files:
        return jsonify({"success": False, "message": "No image file provided"}), 400
    
    file = request.files['image']
    image_data = file.read()
    
    # Process the image
    result = face_service.process_image_for_attendance(image_data)
    
    # Process attendance for recognized faces
    for i, person in enumerate(result['recognized']):
        action = AttendanceService.process_attendance(person['student_id'])
        result['recognized'][i]['action'] = action
    
    return jsonify(result), 200

@attendance_bp.route('/today', methods=['GET'])
@require_admin
def get_today_attendance():
    """Get all attendance records for today"""
    result = AttendanceService.get_today_attendance()
    return jsonify(result), 200

@attendance_bp.route('/date/<date_str>', methods=['GET'])
@require_admin
def get_attendance_by_date(date_str):
    """Get all attendance records for a specific date"""
    try:
        result = AttendanceService.get_attendance_by_date(date_str)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"success": False, "message": str(e)}), 400

@attendance_bp.route('/<student_id>', methods=['GET'])
@require_admin
def get_student_attendance(student_id):
    """Get attendance history for a specific student"""
    result = AttendanceService.get_student_attendance_history(student_id)
    return jsonify(result), 200

@attendance_bp.route('/status/all', methods=['GET'])
@require_admin
def get_all_students_status():
    """Get current attendance status for all students"""
    result = AttendanceService.get_all_students_status()
    return jsonify(result), 200

@attendance_bp.route('/reset/daily', methods=['POST'])
@require_admin
def reset_daily_attendance():
    """Manually reset attendance status for all students"""
    count = AttendanceService.reset_daily_attendance()
    return jsonify({
        "success": True,
        "message": f"Reset attendance status for {count} students",
        "count": count
    }), 200