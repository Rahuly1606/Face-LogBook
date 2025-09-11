from datetime import datetime, date, timedelta
from app import db
from app.models.attendance import Attendance
from app.models.student import Student
from flask import current_app

class AttendanceService:
    @staticmethod
    def process_attendance(student_id):
        """Process attendance for a student, handling check-in/check-out logic"""
        today = date.today()
        now = datetime.utcnow()
        debounce_seconds = current_app.config.get('DEBOUNCE_SECONDS', 30)
        
        # Get today's attendance record for the student
        attendance = Attendance.query.filter_by(
            student_id=student_id,
            date=today
        ).first()
        
        # Determine action (check-in or check-out)
        if not attendance:
            # First check-in of the day
            attendance = Attendance(
                student_id=student_id,
                date=today,
                in_time=now,
                status='present'
            )
            db.session.add(attendance)
            action = "checkin"
        elif attendance.in_time and not attendance.out_time:
            # Already checked in, so this is a check-out
            # But only if enough time has passed (debounce)
            time_diff = now - attendance.in_time
            if time_diff.total_seconds() > debounce_seconds:
                attendance.out_time = now
                action = "checkout"
            else:
                # Too soon for checkout
                action = "debounced"
        elif attendance.out_time:
            # Check if we need to update the checkout time
            time_diff = now - attendance.out_time
            if time_diff.total_seconds() > debounce_seconds:
                attendance.out_time = now
                action = "checkout_update"
            else:
                action = "debounced"
        
        db.session.commit()
        return action
    
    @staticmethod
    def get_today_attendance():
        """Get all attendance records for today"""
        today = date.today()
        
        # Join with students to get names
        attendance_records = db.session.query(
            Attendance, Student.name
        ).join(
            Student, Attendance.student_id == Student.student_id
        ).filter(
            Attendance.date == today
        ).all()
        
        result = []
        for record, name in attendance_records:
            result.append({
                "student_id": record.student_id,
                "name": name,
                "in_time": record.in_time.isoformat() if record.in_time else None,
                "out_time": record.out_time.isoformat() if record.out_time else None,
                "status": record.status
            })
        
        return {
            "date": today.isoformat(),
            "attendance": result
        }
    
    @staticmethod
    def get_attendance_by_date(target_date):
        """Get all attendance records for a specific date"""
        # Parse the date if it's a string
        if isinstance(target_date, str):
            try:
                target_date = date.fromisoformat(target_date)
            except ValueError:
                raise ValueError("Date must be in ISO format (YYYY-MM-DD)")
        
        # Join with students to get names
        attendance_records = db.session.query(
            Attendance, Student.name
        ).join(
            Student, Attendance.student_id == Student.student_id
        ).filter(
            Attendance.date == target_date
        ).all()
        
        result = []
        for record, name in attendance_records:
            result.append({
                "id": record.id,
                "student_id": record.student_id,
                "name": name,
                "in_time": record.in_time.isoformat() if record.in_time else None,
                "out_time": record.out_time.isoformat() if record.out_time else None,
                "date": record.date.isoformat(),
                "status": record.status
            })
        
        return {
            "date": target_date.isoformat(),
            "attendance": result
        }
    
    @staticmethod
    def get_student_attendance_history(student_id):
        """Get attendance history for a specific student"""
        # Verify student exists
        student = Student.query.get_or_404(student_id)
        
        # Get all attendance records
        attendance_records = Attendance.query.filter_by(
            student_id=student_id
        ).order_by(
            Attendance.date.desc()
        ).all()
        
        history = []
        for record in attendance_records:
            history.append({
                "date": record.date.isoformat(),
                "in_time": record.in_time.isoformat() if record.in_time else None,
                "out_time": record.out_time.isoformat() if record.out_time else None,
                "status": record.status
            })
        
        return {
            "student_id": student_id,
            "name": student.name,
            "history": history
        }