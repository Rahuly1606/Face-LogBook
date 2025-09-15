import base64
import numpy as np
import cv2
from flask import Blueprint, request, jsonify, current_app
from datetime import datetime, date
from app.services.face_service import FaceService
from app.services.attendance_service import AttendanceService
from app.utils.auth import require_admin, admin_required
from app.models.group import Group
from app.models.attendance import Attendance
from app.models.student import Student
from app import db
import pytz

attendance_bp = Blueprint('attendance', __name__)
face_service = FaceService()

@attendance_bp.route('/live', methods=['POST'])
@admin_required()
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
        # If already checked in (debounced), show goodbye message
        if action == "debounced":
            # Get student name
            student = Student.query.get(person['student_id'])
            if student:
                result['recognized'][i]['goodbye_message'] = f"Goodbye, {student.name}!"
            else:
                result['recognized'][i]['goodbye_message'] = "Goodbye!"
    
    return jsonify(result), 200

@attendance_bp.route('/upload', methods=['POST'])
@admin_required()
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
@admin_required()
def get_today_attendance():
    """Get all attendance records for today, ensuring all students are listed with absent as default"""
    result = AttendanceService.get_today_attendance()
    return jsonify(result), 200

@attendance_bp.route('/date/<date_str>', methods=['GET'])
@admin_required()
def get_attendance_by_date(date_str):
    """Get all attendance records for a specific date, ensuring all students are listed with absent as default"""
    try:
        result = AttendanceService.get_attendance_by_date(date_str)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"success": False, "message": str(e)}), 400

@attendance_bp.route('/<student_id>', methods=['GET'])
@admin_required()
def get_student_attendance(student_id):
    """Get attendance history for a specific student"""
    result = AttendanceService.get_student_attendance_history(student_id)
    return jsonify(result), 200

@attendance_bp.route('/status/all', methods=['GET'])
@admin_required()
def get_all_students_status():
    """Get current attendance status for all students"""
    result = AttendanceService.get_all_students_status()
    return jsonify(result), 200

@attendance_bp.route('/logs', methods=['GET'])
@admin_required()
def get_attendance_logs():
    """Get attendance logs for a specific date, ensuring all students are listed with absent as default"""
    date_str = request.args.get('date')
    
    if not date_str:
        # Default to today if no date provided
        from datetime import date
        date_str = date.today().isoformat()
    
    try:
        result = AttendanceService.get_attendance_logs_for_date(date_str)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"success": False, "message": str(e)}), 400

@attendance_bp.route('/reset/daily', methods=['POST'])
@admin_required()
def reset_daily_attendance():
    """Manually reset attendance status for all students"""
    count = AttendanceService.reset_daily_attendance()
    return jsonify({
        "success": True,
        "message": f"Reset attendance status for {count} students",
        "count": count
    }), 200

@attendance_bp.route('/logs/<int:group_id>', methods=['GET'])
@admin_required()
def get_attendance_logs_by_group(group_id):
    """Get attendance logs for a specific group with date range and student filtering"""
    # Check if group exists
    group = Group.query.get_or_404(group_id)
    
    # Get query parameters - use IST for default dates
    ist_today = datetime.now(pytz.timezone('Asia/Kolkata')).date()
    date_from = request.args.get('date_from', str(ist_today))
    date_to = request.args.get('date_to', str(ist_today))
    student_id = request.args.get('student_id')
    
    try:
        # Parse dates
        from_date = datetime.strptime(date_from, '%Y-%m-%d').date()
        to_date = datetime.strptime(date_to, '%Y-%m-%d').date()
        
        # Build the query
        query = db.session.query(
            Attendance, Student.name
        ).join(
            Student, Attendance.student_id == Student.student_id
        ).filter(
            Attendance.group_id == group_id,
            Attendance.date >= from_date,
            Attendance.date <= to_date
        )
        
        # Add student filter if provided
        if student_id:
            query = query.filter(Attendance.student_id == student_id)
        
        # Execute query
        attendance_records = query.order_by(
            Attendance.date.desc(),
            Student.name
        ).all()
        
        # Format results
        result = []
        for record, name in attendance_records:
            result.append({
                "id": record.id,
                "student_id": record.student_id,
                "name": name,
                "date": record.date.isoformat(),
                "in_time": AttendanceService.format_datetime_ist(record.in_time),
                "out_time": AttendanceService.format_datetime_ist(record.out_time),
                "status": record.status
            })
        
        return jsonify({
            "group_id": group_id,
            "group_name": group.name,
            "date_from": from_date.isoformat(),
            "date_to": to_date.isoformat(),
            "attendance": result
        }), 200
        
    except ValueError as e:
        return jsonify({"success": False, "message": f"Invalid date format: {str(e)}"}), 400

@attendance_bp.route('/logs/<int:group_id>/date', methods=['GET'])
@admin_required()
def get_group_attendance_logs_by_date(group_id):
    """Get attendance logs for a specific group and date, ensuring all students in the group are listed with absent as default"""
    # Check if group exists
    group = Group.query.get_or_404(group_id)
    
    date_str = request.args.get('date')
    
    if not date_str:
        # Default to today if no date provided
        from datetime import date
        date_str = date.today().isoformat()
    
    try:
        result = AttendanceService.get_group_attendance_logs_for_date(group_id, date_str)
        result['group_name'] = group.name
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"success": False, "message": str(e)}), 400

@attendance_bp.route('/debug/embeddings/<student_id>', methods=['GET'])
@admin_required()
def debug_student_embedding(student_id):
    """Debug endpoint to check if a student has a valid embedding"""
    # Check if student exists
    student = Student.query.get_or_404(student_id)
    
    # Check embedding
    embedding = student.get_embedding()
    
    if embedding is None:
        return jsonify({
            "student_id": student_id,
            "exists": False,
            "message": "No embedding found"
        }), 200
    
    return jsonify({
        "student_id": student_id,
        "exists": True,
        "shape": embedding.shape,
        "dtype": str(embedding.dtype)
    }), 200

@attendance_bp.route('/debug/group/<int:group_id>', methods=['GET'])
@admin_required()
def debug_group_students(group_id):
    """Debug endpoint to check all students in a group and their attendance records"""
    from datetime import date
    
    # Check if group exists
    group = Group.query.get_or_404(group_id)
    
    # Get all students in the group
    all_students = Student.query.filter(Student.group_id == group_id).all()
    
    # Get today's date for testing
    today = date.today()
    
    # Get attendance records for today
    attendance_records = db.session.query(
        Attendance, Student.name
    ).join(
        Student, Attendance.student_id == Student.student_id
    ).filter(
        Attendance.group_id == group_id,
        Attendance.date == today
    ).all()
    
    # Create lookup for attendance records
    attendance_lookup = {record.student_id: record for record, _ in attendance_records}
    
    # Prepare debug data
    debug_data = {
        "group_id": group_id,
        "group_name": group.name,
        "date": today.isoformat(),
        "total_students_in_group": len(all_students),
        "students": []
    }
    
    for student in all_students:
        attendance = attendance_lookup.get(student.student_id)
        student_data = {
            "student_id": student.student_id,
            "name": student.name,
            "group_id": student.group_id,
            "created_at": student.created_at.isoformat() if student.created_at else None,
            "has_attendance_record": attendance is not None,
            "attendance_status": attendance.status if attendance else "no_record"
        }
        debug_data["students"].append(student_data)
    
    return jsonify(debug_data), 200