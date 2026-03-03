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
from app import db, limiter
import pytz

attendance_bp = Blueprint('attendance', __name__)
face_service = FaceService()

@attendance_bp.route('/window-status', methods=['GET'])
@admin_required()
def get_window_status():
    """Return the current attendance window status (on_time, late, early, rejected, closed)"""
    group_id = request.args.get('group_id', type=int)
    window_check = AttendanceService.check_attendance_window(group_id=group_id)
    return jsonify(window_check), 200

@attendance_bp.route('/live', methods=['POST'])
@limiter.limit("20 per minute")
@admin_required()
def process_live_attendance():
    """Process a single frame for attendance with section-based validation"""
    
    # ── Extract group_id early for per-group window lookup ─────────
    _live_group_id = None
    if request.content_type and request.content_type.startswith('multipart/form-data'):
        _live_group_id = request.form.get('group_id', type=int)
    else:
        _peek = request.get_json(silent=True) or {}
        _live_group_id = _peek.get('group_id')
    
    # ── Time-window gate ──────────────────────────────────────────
    window_check = AttendanceService.check_attendance_window(group_id=_live_group_id)
    if not window_check['allowed']:
        return jsonify({
            "success": False,
            "message": window_check['message'],
            "window_status": window_check['status'],
            "window": window_check['window'],
            "detected_faces": [],
            "total_detected": 0,
        }), 403
    window_status = window_check['status']  # 'on_time' or 'late'
    # ──────────────────────────────────────────────────────────────
    
    # Get image data and section/group ID
    selected_group_id = None
    
    if request.content_type and request.content_type.startswith('multipart/form-data'):
        if 'image' not in request.files:
            return jsonify({"success": False, "message": "No image file provided"}), 400
        
        file = request.files['image']
        image_data = file.read()
        selected_group_id = request.form.get('group_id', type=int)
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
            selected_group_id = data.get('group_id', type=int)
        except Exception as e:
            return jsonify({"success": False, "message": f"Invalid base64 image: {str(e)}"}), 400
    
    # Validate that a section is selected
    if not selected_group_id:
        return jsonify({
            "success": False,
            "message": "Please select a section before taking attendance",
            "detected_faces": [],
            "total_detected": 0
        }), 400
    
    # Check if face service is initialized
    if not face_service.initialized or face_service.model is None:
        current_app.logger.error("Face service not initialized for live attendance")
        return jsonify({
            "success": False,
            "message": "Face recognition service is not available. Please check server logs.",
            "detected_faces": [],
            "total_detected": 0,
            "recognized": [],
            "unrecognized_count": 0
        }), 503
    
    # Process the image
    result = face_service.process_image_for_attendance(image_data)
    
    # Check if there was an error in processing
    if result.get('error'):
        current_app.logger.error(f"Error processing image: {result.get('error_message')}")
        return jsonify({
            "success": False,
            "message": result.get('error_message', 'Failed to process image'),
            "detected_faces": [],
            "total_detected": 0,
            "recognized": [],
            "unrecognized_count": 0
        }), 500
    
    # Process attendance for recognized faces with section-based validation
    detected_faces = []
    wrong_section_students = []
    
    for i, person in enumerate(result['recognized']):
        # Get the student record with group info
        student = Student.query.get(person['student_id'])
        if not student:
            continue
            
        student_name = student.name
        group_name = student.group.name if student.group else "No Section"
        
        # Check if student belongs to selected section (check both legacy group_id AND junction table)
        in_selected_group = (
            student.group_id == selected_group_id or
            db.session.execute(
                db.text("SELECT 1 FROM student_groups WHERE student_id = :sid AND group_id = :gid"),
                {"sid": person['student_id'], "gid": selected_group_id}
            ).fetchone() is not None
        )
        
        if in_selected_group:
            # ✅ Student belongs to selected section - mark attendance
            action = AttendanceService.process_attendance(person['student_id'], window_status=window_status)
            
            # Get current group name for display
            selected_group = Group.query.get(selected_group_id)
            display_group_name = selected_group.name if selected_group else group_name
            
            # Create detected face object
            face_data = {
                'student_id': person['student_id'],
                'name': student_name,
                'confidence': person['score'],
                'group_name': display_group_name,
                'status': 'correct_section',
                'attendance_status': window_status,  # on_time or late
            }
            detected_faces.append(face_data)
            
            # Set appropriate greeting message based on action
            if action == "checkin":
                result['recognized'][i]['action'] = "checkin"
                if window_status == 'late':
                    result['recognized'][i]['greeting_message'] = f"Welcome, {student_name}! (Marked LATE)"
                else:
                    result['recognized'][i]['greeting_message'] = f"Welcome, {student_name}!"
            elif action == "checkout" or action == "checkout_update":
                result['recognized'][i]['action'] = "checkout"
                result['recognized'][i]['goodbye_message'] = f"Goodbye, {student_name}!"
        else:
            # ⚠️ Student not registered in this section - don't mark attendance
            face_data = {
                'student_id': person['student_id'],
                'name': student_name,
                'confidence': person['score'],
                'group_name': group_name,
                'status': 'wrong_section',
                'message': f"Student not registered in selected section"
            }
            wrong_section_students.append(face_data)
    
    # Add frontend-compatible fields with section validation info
    result['success'] = True
    result['detected_faces'] = detected_faces
    result['wrong_section_students'] = wrong_section_students
    result['unrecognized_count'] = result.get('unrecognized_count', 0)
    result['unrecognized_faces'] = result.get('unrecognized_faces', [])
    result['total_detected'] = len(detected_faces) + len(wrong_section_students) + result['unrecognized_count']
    result['window_status'] = window_status
    result['window'] = window_check['window']
    
    # Build message
    messages = []
    if detected_faces:
        messages.append(f"{len(detected_faces)} from selected section")
    if wrong_section_students:
        messages.append(f"{len(wrong_section_students)} from other sections")
    if result['unrecognized_count'] > 0:
        messages.append(f"{result['unrecognized_count']} unrecognized")
    
    result['message'] = f"Detected {result['total_detected']} face(s): " + ", ".join(messages) if messages else "No faces detected"
    
    return jsonify(result), 200

@attendance_bp.route('/upload', methods=['POST'])
@admin_required()
def process_group_photo():
    """Process a group photo for attendance with section-based validation"""
    
    # ── Extract group_id early for per-group window lookup ─────────
    _upload_group_id = request.form.get('group_id', type=int) if request.content_type and request.content_type.startswith('multipart/form-data') else None
    
    # ── Time-window gate ──────────────────────────────────────────
    window_check = AttendanceService.check_attendance_window(group_id=_upload_group_id)
    if not window_check['allowed']:
        return jsonify({
            "success": False,
            "message": window_check['message'],
            "window_status": window_check['status'],
            "window": window_check['window'],
        }), 403
    window_status = window_check['status']  # 'on_time' or 'late'
    # ──────────────────────────────────────────────────────────────
    
    if 'image' not in request.files:
        return jsonify({"success": False, "message": "No image file provided"}), 400
    
    file = request.files['image']
    image_data = file.read()
    
    # Get selected group/section ID
    selected_group_id = request.form.get('group_id', type=int)
    
    # Validate that a section is selected
    if not selected_group_id:
        return jsonify({
            "success": False,
            "message": "Please select a section before uploading attendance photo"
        }), 400
    
    # Process the image
    result = face_service.process_image_for_attendance(image_data)
    
    # Process attendance for recognized faces with section-based validation
    correct_section_students = []
    wrong_section_students = []
    
    for i, person in enumerate(result['recognized']):
        # Get the student record
        student = Student.query.get(person['student_id'])
        if not student:
            continue
            
        student_name = student.name
        group_name = student.group.name if student.group else "No Section"
        
        # Check if student belongs to selected section (check both legacy group_id AND junction table)
        in_selected_group = (
            student.group_id == selected_group_id or
            db.session.execute(
                db.text("SELECT 1 FROM student_groups WHERE student_id = :sid AND group_id = :gid"),
                {"sid": person['student_id'], "gid": selected_group_id}
            ).fetchone() is not None
        )
        
        if in_selected_group:
            # ✅ Student belongs to selected section - mark attendance
            action = AttendanceService.process_attendance(person['student_id'], window_status=window_status)
            
            # Get current group name for display
            selected_group = Group.query.get(selected_group_id)
            display_group_name = selected_group.name if selected_group else group_name
            
            correct_section_students.append({
                'student_id': person['student_id'],
                'name': student_name,
                'confidence': person['score'],
                'group_name': display_group_name,
                'status': 'correct_section',
                'attendance_status': window_status,
            })
        else:
            # ⚠️ Student not registered in this section - don't mark attendance
            wrong_section_students.append({
                'student_id': person['student_id'],
                'name': student_name,
                'confidence': person['score'],
                'group_name': group_name,
                'status': 'wrong_section',
                'message': f"Student not registered in selected section"
            })
    
    # Transform response to match frontend expected format
    students = []
    for person in correct_section_students:
        students.append({
            'student_id': person['student_id'],
            'name': person['name'],
            'confidence': person.get('confidence', 0.0)
        })
    
    # Build detailed message
    messages = []
    if correct_section_students:
        messages.append(f"{len(correct_section_students)} from selected section")
    if wrong_section_students:
        messages.append(f"{len(wrong_section_students)} from other sections")
    if result.get('unrecognized_count', 0) > 0:
        messages.append(f"{result['unrecognized_count']} unrecognized")
    
    response = {
        'success': True,
        'message': "Detected: " + ", ".join(messages) if messages else "No students detected",
        'detected_count': len(students),
        'students': students,
        'wrong_section_students': wrong_section_students,
        'unrecognized_count': result.get('unrecognized_count', 0),
        'processing_time_ms': result.get('processing_time_ms', 0)
    }
    
    return jsonify(response), 200

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
    """Get attendance logs for a date or date range.

    Query params:
      - date:      single date (YYYY-MM-DD).  Used when date_from/date_to absent.
      - date_from:  start of range (YYYY-MM-DD)
      - date_to:    end of range   (YYYY-MM-DD)
    """
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    date_str = request.args.get('date')

    if date_from and date_to:
        # Date range query
        try:
            from_date = date.fromisoformat(date_from)
            to_date = date.fromisoformat(date_to)
            all_attendance = []
            current = from_date
            seen_ids = set()
            while current <= to_date:
                day_result = AttendanceService.get_attendance_logs_for_date(current.isoformat())
                for rec in day_result.get('attendance', []):
                    key = (rec['student_id'], rec['date'])
                    if key not in seen_ids:
                        seen_ids.add(key)
                        all_attendance.append(rec)
                current += __import__('datetime').timedelta(days=1)
            return jsonify({'attendance': all_attendance}), 200
        except ValueError as e:
            return jsonify({"success": False, "message": str(e)}), 400
    else:
        if not date_str:
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
                "group_name": group.name,  # Add group name to each record
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