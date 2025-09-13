from datetime import datetime, date, timedelta
from app import db
from app.models.attendance import Attendance
from app.models.student import Student
from flask import current_app
import threading
import time

class AttendanceService:
    _daily_reset_thread = None
    
    @classmethod
    def start_daily_reset_scheduler(cls):
        """Start a background thread to reset attendance status daily"""
        if cls._daily_reset_thread is None or not cls._daily_reset_thread.is_alive():
            cls._daily_reset_thread = threading.Thread(target=cls._daily_reset_scheduler, daemon=True)
            cls._daily_reset_thread.start()
            current_app.logger.info("Daily attendance reset scheduler started")
    
    @classmethod
    def _daily_reset_scheduler(cls):
        """Background thread that resets attendance status at midnight"""
        while True:
            # Get current time
            now = datetime.now()
            
            # Calculate time until next midnight (00:00)
            tomorrow = now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
            seconds_until_midnight = (tomorrow - now).total_seconds()
            
            # Sleep until next midnight
            time.sleep(seconds_until_midnight)
            
            # Reset attendance status
            with current_app.app_context():
                try:
                    current_app.logger.info("Performing daily attendance reset")
                    cls.reset_daily_attendance()
                except Exception as e:
                    current_app.logger.error(f"Error in daily attendance reset: {str(e)}")
    
    @staticmethod
    def reset_daily_attendance():
        """Reset all students' attendance status to 'absent' for today"""
        today = date.today()
        
        # Get all students
        students = Student.query.all()
        
        for student in students:
            # Check if attendance record exists for today
            attendance = Attendance.query.filter_by(
                student_id=student.student_id,
                date=today
            ).first()
            
            if attendance:
                # Update existing record to absent
                attendance.status = 'absent'
                attendance.in_time = None
                attendance.out_time = None
            else:
                # Create new record for today with absent status
                attendance = Attendance(
                    student_id=student.student_id,
                    group_id=student.group_id,
                    date=today,
                    status='absent'
                )
                db.session.add(attendance)
        
        db.session.commit()
        current_app.logger.info(f"Reset attendance status to 'absent' for {len(students)} students")
        return len(students)
    @staticmethod
    def process_attendance(student_id):
        """Process attendance for a student, handling check-in/check-out logic"""
        today = date.today()
        now = datetime.utcnow()
        debounce_seconds = current_app.config.get('DEBOUNCE_SECONDS', 30)
        
        # Get the student to get their group_id
        student = Student.query.get(student_id)
        if not student:
            return "not_found"
            
        group_id = student.group_id
        
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
                group_id=group_id,
                date=today,
                in_time=now,
                status='present'
            )
            db.session.add(attendance)
            action = "checkin"
        elif attendance.status == 'absent':
            # Student was marked absent but is now present
            attendance.status = 'present'
            attendance.in_time = now
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
        
    @staticmethod
    def get_all_students_status():
        """Get all students with their current attendance status for today"""
        today = date.today()
        
        # First get all students
        all_students = Student.query.all()
        
        # Create a lookup of student_id to attendance status
        today_attendance = Attendance.query.filter_by(date=today).all()
        attendance_lookup = {a.student_id: a for a in today_attendance}
        
        result = []
        for student in all_students:
            attendance = attendance_lookup.get(student.student_id)
            
            # If no attendance record exists for today, student is 'absent'
            if not attendance:
                # Create a new record
                attendance = Attendance(
                    student_id=student.student_id,
                    date=today,
                    status='absent'
                )
                db.session.add(attendance)
                db.session.commit()
                
                result.append({
                    "student_id": student.student_id,
                    "name": student.name,
                    "in_time": None,
                    "out_time": None,
                    "status": 'absent',
                    "date": today.isoformat()
                })
            else:
                result.append({
                    "student_id": student.student_id,
                    "name": student.name,
                    "in_time": attendance.in_time.isoformat() if attendance.in_time else None,
                    "out_time": attendance.out_time.isoformat() if attendance.out_time else None,
                    "status": attendance.status,
                    "date": attendance.date.isoformat()
                })
        
        return {
            "date": today.isoformat(),
            "students": result
        }