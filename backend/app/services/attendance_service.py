from datetime import datetime, date, timedelta
from app import db
from app.models.attendance import Attendance
from app.models.student import Student
from flask import current_app
import threading
import time
import pytz

class AttendanceService:
    _daily_reset_thread = None
    
    @staticmethod
    def get_ist_now():
        """Get current datetime in Indian Standard Time"""
        return datetime.now(pytz.timezone('Asia/Kolkata'))
    
    @staticmethod
    def get_ist_today():
        """Get today's date in IST"""
        return datetime.now(pytz.timezone('Asia/Kolkata')).date()
    
    @staticmethod
    def format_datetime_ist(dt):
        """Format datetime to IST string for API responses"""
        if dt is None:
            return None
        if dt.tzinfo is None:
            # If datetime is naive, assume it's already in IST
            return dt.isoformat()
        # Convert to IST and format
        ist = pytz.timezone('Asia/Kolkata')
        return dt.astimezone(ist).isoformat()
    
    @staticmethod
    def make_timezone_aware(dt):
        """Convert naive datetime to IST timezone-aware datetime"""
        if dt is None:
            return None
        if dt.tzinfo is None:
            ist = pytz.timezone('Asia/Kolkata')
            return ist.localize(dt)
        return dt
    
    @classmethod
    def start_daily_reset_scheduler(cls):
        """Start a background thread to reset attendance status daily"""
        if cls._daily_reset_thread is None or not cls._daily_reset_thread.is_alive():
            cls._daily_reset_thread = threading.Thread(target=cls._daily_reset_scheduler, daemon=True)
            cls._daily_reset_thread.start()
            current_app.logger.info("Daily attendance reset scheduler started")
    
    @classmethod
    def _daily_reset_scheduler(cls):
        """Background thread that resets attendance status at midnight IST"""
        while True:
            # Get current time in IST
            now = cls.get_ist_now()
            
            # Calculate time until next midnight (00:00) IST
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
        today = AttendanceService.get_ist_today()
        
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
        today = AttendanceService.get_ist_today()
        now = AttendanceService.get_ist_now()
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
            # Make sure both datetimes are timezone-aware for comparison
            in_time_aware = AttendanceService.make_timezone_aware(attendance.in_time)
            time_diff = now - in_time_aware
            if time_diff.total_seconds() > debounce_seconds:
                attendance.out_time = now
                action = "checkout"
            else:
                # Too soon for checkout
                action = "debounced"
        elif attendance.out_time:
            # Check if we need to update the checkout time
            # Make sure both datetimes are timezone-aware for comparison
            out_time_aware = AttendanceService.make_timezone_aware(attendance.out_time)
            time_diff = now - out_time_aware
            if time_diff.total_seconds() > debounce_seconds:
                attendance.out_time = now
                action = "checkout_update"
            else:
                action = "debounced"
        
        db.session.commit()
        return action
    
    @staticmethod
    def get_today_attendance():
        """Get all attendance records for today, ensuring all students are listed with absent as default"""
        today = AttendanceService.get_ist_today()
        
        # Get all students first
        all_students = Student.query.all()
        
        # Get existing attendance records for today
        attendance_records = db.session.query(
            Attendance, Student.name
        ).join(
            Student, Attendance.student_id == Student.student_id
        ).filter(
            Attendance.date == today
        ).all()
        
        # Create a lookup for existing attendance records
        attendance_lookup = {record.student_id: record for record, _ in attendance_records}
        
        result = []
        for student in all_students:
            attendance = attendance_lookup.get(student.student_id)
            
            if attendance:
                # Use existing record
                result.append({
                    "id": attendance.id,
                    "student_id": attendance.student_id,
                    "name": student.name,
                    "in_time": AttendanceService.format_datetime_ist(attendance.in_time),
                    "out_time": AttendanceService.format_datetime_ist(attendance.out_time),
                    "status": attendance.status,
                    "date": attendance.date.isoformat()
                })
            else:
                # Create new absent record for student
                new_attendance = Attendance(
                    student_id=student.student_id,
                    group_id=student.group_id,
                    date=today,
                    status='absent'
                )
                db.session.add(new_attendance)
                db.session.flush()  # Get the ID without committing
                
                result.append({
                    "id": new_attendance.id,
                    "student_id": new_attendance.student_id,
                    "name": student.name,
                    "in_time": None,
                    "out_time": None,
                    "status": 'absent',
                    "date": today.isoformat()
                })
        
        db.session.commit()
        return {
            "date": today.isoformat(),
            "attendance": result
        }
    
    @staticmethod
    def get_attendance_by_date(target_date):
        """Get all attendance records for a specific date, ensuring all students are listed with absent as default"""
        # Parse the date if it's a string
        if isinstance(target_date, str):
            try:
                target_date = date.fromisoformat(target_date)
            except ValueError:
                raise ValueError("Date must be in ISO format (YYYY-MM-DD)")
        
        # Get all students who were registered on or before the target date
        target_datetime = datetime.combine(target_date, datetime.min.time())
        all_students = Student.query.filter(Student.created_at <= target_datetime).all()
        
        # Get existing attendance records for the target date
        attendance_records = db.session.query(
            Attendance, Student.name
        ).join(
            Student, Attendance.student_id == Student.student_id
        ).filter(
            Attendance.date == target_date
        ).all()
        
        # Create a lookup for existing attendance records
        attendance_lookup = {record.student_id: record for record, _ in attendance_records}
        
        result = []
        for student in all_students:
            attendance = attendance_lookup.get(student.student_id)
            
            if attendance:
                # Use existing record
                result.append({
                    "id": attendance.id,
                    "student_id": attendance.student_id,
                    "name": student.name,
                    "in_time": AttendanceService.format_datetime_ist(attendance.in_time),
                    "out_time": AttendanceService.format_datetime_ist(attendance.out_time),
                    "date": attendance.date.isoformat(),
                    "status": attendance.status
                })
            else:
                # Create new absent record for student
                new_attendance = Attendance(
                    student_id=student.student_id,
                    group_id=student.group_id,
                    date=target_date,
                    status='absent'
                )
                db.session.add(new_attendance)
                db.session.flush()  # Get the ID without committing
                
                result.append({
                    "id": new_attendance.id,
                    "student_id": new_attendance.student_id,
                    "name": student.name,
                    "in_time": None,
                    "out_time": None,
                    "date": target_date.isoformat(),
                    "status": 'absent'
                })
        
        db.session.commit()
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
                "in_time": AttendanceService.format_datetime_ist(record.in_time),
                "out_time": AttendanceService.format_datetime_ist(record.out_time),
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
        today = AttendanceService.get_ist_today()
        
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
                    group_id=student.group_id,
                    date=today,
                    status='absent'
                )
                db.session.add(attendance)
                db.session.flush()  # Get the ID without committing
                
                result.append({
                    "id": attendance.id,
                    "student_id": student.student_id,
                    "name": student.name,
                    "in_time": None,
                    "out_time": None,
                    "status": 'absent',
                    "date": today.isoformat()
                })
            else:
                result.append({
                    "id": attendance.id,
                    "student_id": student.student_id,
                    "name": student.name,
                    "in_time": AttendanceService.format_datetime_ist(attendance.in_time),
                    "out_time": AttendanceService.format_datetime_ist(attendance.out_time),
                    "status": attendance.status,
                    "date": attendance.date.isoformat()
                })
        
        db.session.commit()
        return {
            "date": today.isoformat(),
            "students": result
        }
    
    @staticmethod
    def get_attendance_logs_for_date(target_date):
        """Get attendance logs for a specific date, ensuring all students are listed with absent as default"""
        # Parse the date if it's a string
        if isinstance(target_date, str):
            try:
                target_date = date.fromisoformat(target_date)
            except ValueError:
                raise ValueError("Date must be in ISO format (YYYY-MM-DD)")
        
        # Get all students (remove date filtering to show all students)
        # The date filtering was causing issues where students registered after the target date
        # were not showing up in attendance logs
        all_students = Student.query.all()
        
        # Get existing attendance records for the target date
        attendance_records = db.session.query(
            Attendance, Student.name
        ).join(
            Student, Attendance.student_id == Student.student_id
        ).filter(
            Attendance.date == target_date
        ).all()
        
        # Create a lookup for existing attendance records
        attendance_lookup = {record.student_id: record for record, _ in attendance_records}
        
        result = []
        for student in all_students:
            attendance = attendance_lookup.get(student.student_id)
            
            if attendance:
                # Use existing record
                result.append({
                    "id": attendance.id,
                    "student_id": attendance.student_id,
                    "name": student.name,
                    "in_time": AttendanceService.format_datetime_ist(attendance.in_time),
                    "out_time": AttendanceService.format_datetime_ist(attendance.out_time),
                    "date": attendance.date.isoformat(),
                    "status": attendance.status
                })
            else:
                # Create new absent record for student
                new_attendance = Attendance(
                    student_id=student.student_id,
                    group_id=student.group_id,
                    date=target_date,
                    status='absent'
                )
                db.session.add(new_attendance)
                db.session.flush()  # Get the ID without committing
                
                result.append({
                    "id": new_attendance.id,
                    "student_id": new_attendance.student_id,
                    "name": student.name,
                    "in_time": None,
                    "out_time": None,
                    "date": target_date.isoformat(),
                    "status": 'absent'
                })
        
        db.session.commit()
        return {
            "date": target_date.isoformat(),
            "attendance": result
        }
    
    @staticmethod
    def get_group_attendance_logs_for_date(group_id, target_date):
        """Get attendance logs for a specific group and date, ensuring all students in the group are listed with absent as default"""
        # Parse the date if it's a string
        if isinstance(target_date, str):
            try:
                target_date = date.fromisoformat(target_date)
            except ValueError:
                raise ValueError("Date must be in ISO format (YYYY-MM-DD)")
        
        # Get all students in the group (remove date filtering to show all students)
        # The date filtering was causing issues where students registered after the target date
        # were not showing up in attendance logs
        all_students = Student.query.filter(
            Student.group_id == group_id
        ).all()
        
        # Get existing attendance records for the target date and group
        attendance_records = db.session.query(
            Attendance, Student.name
        ).join(
            Student, Attendance.student_id == Student.student_id
        ).filter(
            Attendance.group_id == group_id,
            Attendance.date == target_date
        ).all()
        
        # Create a lookup for existing attendance records
        attendance_lookup = {record.student_id: record for record, _ in attendance_records}
        
        result = []
        for student in all_students:
            attendance = attendance_lookup.get(student.student_id)
            
            if attendance:
                # Use existing record
                result.append({
                    "id": attendance.id,
                    "student_id": attendance.student_id,
                    "name": student.name,
                    "in_time": AttendanceService.format_datetime_ist(attendance.in_time),
                    "out_time": AttendanceService.format_datetime_ist(attendance.out_time),
                    "date": attendance.date.isoformat(),
                    "status": attendance.status
                })
            else:
                # Create new absent record for student
                new_attendance = Attendance(
                    student_id=student.student_id,
                    group_id=student.group_id,
                    date=target_date,
                    status='absent'
                )
                db.session.add(new_attendance)
                db.session.flush()  # Get the ID without committing
                
                result.append({
                    "id": new_attendance.id,
                    "student_id": new_attendance.student_id,
                    "name": student.name,
                    "in_time": None,
                    "out_time": None,
                    "date": target_date.isoformat(),
                    "status": 'absent'
                })
        
        db.session.commit()
        return {
            "group_id": group_id,
            "date": target_date.isoformat(),
            "attendance": result
        }
