from datetime import datetime, date, timedelta, time as dtime
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
    def check_attendance_window(group_id=None):
        """
        Check if current IST time falls within the attendance window.
        
        Reads settings from the database first (via Setting model),
        falling back to Flask config / .env values.
        
        Returns a dict:
          - allowed: bool  (True if attendance can be recorded)
          - status:  str   ('on_time' | 'late' | 'early' | 'rejected' | 'closed')
          - message: str   (human-readable description)
          - window:  dict  (start, end, late_end times for the frontend)
        """
        from app.models.setting import Setting
        
        now_ist = AttendanceService.get_ist_now()
        current_time = now_ist.time()
        
        # Read from DB → config → hardcoded defaults (group-specific if group_id given)
        settings = Setting.get_attendance_window_settings(group_id=group_id)
        window_start_str = settings['window_start']
        window_end_str   = settings['window_end']
        late_end_str     = settings['late_end']
        late_policy      = settings['late_policy']
        
        # Parse HH:MM strings into time objects
        try:
            window_start = dtime(*map(int, window_start_str.split(':')))
            window_end   = dtime(*map(int, window_end_str.split(':')))
            late_end     = dtime(*map(int, late_end_str.split(':')))
        except (ValueError, TypeError):
            current_app.logger.error("Invalid attendance window config, defaulting to 09:00-09:10-09:30")
            window_start = dtime(9, 0)
            window_end   = dtime(9, 10)
            late_end     = dtime(9, 30)
        
        window_info = {
            'window_start': window_start_str,
            'window_end': window_end_str,
            'late_end': late_end_str,
            'late_policy': late_policy,
            'current_time': current_time.strftime('%H:%M:%S'),
        }
        
        # Before window opens
        if current_time < window_start:
            return {
                'allowed': False,
                'status': 'early',
                'message': f'Attendance window has not opened yet. It opens at {window_start_str} IST.',
                'window': window_info,
            }
        
        # Within on-time window  (start <= now < end)
        if window_start <= current_time < window_end:
            return {
                'allowed': True,
                'status': 'on_time',
                'message': 'Attendance window is open.',
                'window': window_info,
            }
        
        # Within late window  (end <= now < late_end)
        if window_end <= current_time < late_end:
            if late_policy == 'rejected':
                return {
                    'allowed': False,
                    'status': 'rejected',
                    'message': f'On-time window closed at {window_end_str} IST. Late entries are not allowed.',
                    'window': window_info,
                }
            else:
                # late_policy == 'late' (default)
                return {
                    'allowed': True,
                    'status': 'late',
                    'message': f'You are marking attendance after {window_end_str} IST. It will be recorded as LATE.',
                    'window': window_info,
                }
        
        # After late window closes
        return {
            'allowed': False,
            'status': 'closed',
            'message': f'Attendance window closed at {late_end_str} IST. No more entries accepted today.',
            'window': window_info,
        }
    
    @staticmethod
    def format_datetime_ist(dt):
        """Format datetime to IST string for API responses"""
        if dt is None:
            return None
            
        # Check if the timestamp is between 1970 and 2050
        # If not in this range, something is wrong with the data
        if dt.year < 1970 or dt.year > 2050:
            current_app.logger.warning(f"Suspicious timestamp detected: {dt}")
            # Return None for invalid timestamps
            return None
            
        # If it's a naive datetime, we need to determine if it's UTC or IST
        if dt.tzinfo is None:
            # Calculate the hour in UTC and IST to see which makes more sense
            current_hour_utc = datetime.now(pytz.UTC).hour
            current_hour_ist = datetime.now(pytz.timezone('Asia/Kolkata')).hour
            
            # If the hour is close to the current IST hour, it's likely an IST timestamp
            # otherwise assume it's UTC
            if abs(dt.hour - current_hour_ist) < abs(dt.hour - current_hour_utc):
                # It's likely an IST timestamp, so localize it as IST
                ist = pytz.timezone('Asia/Kolkata')
                dt = ist.localize(dt)
            else:
                # It's likely a UTC timestamp
                dt = pytz.UTC.localize(dt)
            
        # Convert to IST and format with timezone info
        ist = pytz.timezone('Asia/Kolkata')
        return dt.astimezone(ist).isoformat()
    
    @staticmethod
    def make_timezone_aware(dt):
        """Convert naive datetime to timezone-aware datetime"""
        if dt is None:
            return None
            
        if dt.tzinfo is None:
            # Check if the timestamp is between 1970 and 2050
            # If not in this range, something is wrong with the data
            if dt.year < 1970 or dt.year > 2050:
                current_app.logger.warning(f"Suspicious timestamp detected: {dt}")
                # Return original naive datetime for invalid timestamps
                return dt
                
            # Calculate the hour in UTC and IST to see which makes more sense
            current_hour_utc = datetime.now(pytz.UTC).hour
            current_hour_ist = datetime.now(pytz.timezone('Asia/Kolkata')).hour
            
            # If the hour is close to the current IST hour, it's likely an IST timestamp
            # otherwise assume it's UTC
            if abs(dt.hour - current_hour_ist) < abs(dt.hour - current_hour_utc):
                # It's likely an IST timestamp, so localize it as IST
                ist = pytz.timezone('Asia/Kolkata')
                return ist.localize(dt)
            else:
                # It's likely a UTC timestamp
                return pytz.UTC.localize(dt)
                
        # If it's already timezone-aware, return it as is
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
    def process_attendance(student_id, window_status='on_time'):
        """Process attendance for a student, handling check-in/check-out logic.
        
        Args:
            student_id: The student's ID
            window_status: 'on_time' or 'late' — determines the attendance status recorded
        """
        # Get current time in UTC for storage consistency with camera events
        now_utc = datetime.now(pytz.timezone('UTC'))
        # But still use IST for date-based lookups
        today = now_utc.astimezone(pytz.timezone('Asia/Kolkata')).date()
        debounce_seconds = current_app.config.get('DEBOUNCE_SECONDS', 30)
        
        # Decide the status label based on window_status
        attendance_status = 'late' if window_status == 'late' else 'present'
        
        # Get the student to get their group_id
        student = Student.query.get(student_id)
        if not student:
            return "not_found"
            
        group_id = student.group_id
        
        # Record camera event (in/out alternating detection)
        try:
            from app.services.camera_event_service import CameraEventService
            event_type, event = CameraEventService.process_camera_detection(student_id)
            if event_type == "debounced":
                # Skip further processing if event was debounced
                return "debounced"
        except Exception as e:
            current_app.logger.error(f"Error processing camera event: {str(e)}")
            # Continue with regular attendance processing even if event logging fails
        
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
                in_time=now_utc,
                status=attendance_status
            )
            db.session.add(attendance)
            action = "checkin"
        elif attendance.status == 'absent':
            # Student was marked absent but is now present
            attendance.status = attendance_status
            attendance.in_time = now_utc
            action = "checkin"
        elif attendance.in_time and not attendance.out_time:
            # Already checked in, so this is a check-out
            # But only if enough time has passed (debounce)
            try:
                # Make sure both datetimes are timezone-aware for comparison
                in_time_aware = AttendanceService.make_timezone_aware(attendance.in_time)
                # now_utc is already timezone-aware
                time_diff = now_utc - in_time_aware
                if time_diff.total_seconds() > debounce_seconds:
                    attendance.out_time = now_utc
                    action = "checkout"
                else:
                    # Too soon for checkout, but still track that they're checked in
                    action = "debounced"
            except Exception as e:
                current_app.logger.error(f"Error calculating time difference: {str(e)}")
                # In case of an error, still update the out_time as a fallback
                attendance.out_time = now_utc
                action = "checkout"
        elif attendance.out_time:
            # Check if we need to update the checkout time
            try:
                # Make sure both datetimes are timezone-aware for comparison
                out_time_aware = AttendanceService.make_timezone_aware(attendance.out_time)
                # now_utc is already timezone-aware
                time_diff = now_utc - out_time_aware
                if time_diff.total_seconds() > debounce_seconds:
                    attendance.out_time = now_utc
                    action = "checkout_update"
                else:
                    action = "debounced"
            except Exception as e:
                current_app.logger.error(f"Error calculating time difference: {str(e)}")
                # In case of an error, still update the out_time as a fallback
                attendance.out_time = now_utc
                action = "checkout_update"
        
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
            
            # Get group name if student has a group
            group_name = None
            if student.group_id:
                from app.models.group import Group
                group = Group.query.get(student.group_id)
                if group:
                    group_name = group.name
            
            if attendance:
                # Use existing record
                result.append({
                    "id": attendance.id,
                    "student_id": attendance.student_id,
                    "name": student.name,
                    "group_name": group_name,
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
                    "group_name": group_name,
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
            
            # Get group name if student has a group
            group_name = None
            if student.group_id:
                from app.models.group import Group
                group = Group.query.get(student.group_id)
                if group:
                    group_name = group.name
            
            if attendance:
                # Use existing record
                result.append({
                    "id": attendance.id,
                    "student_id": attendance.student_id,
                    "name": student.name,
                    "group_name": group_name,
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
                    "group_name": group_name,
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
            
            # Get group name if student has a group
            group_name = None
            if student.group_id:
                from app.models.group import Group
                group = Group.query.get(student.group_id)
                if group:
                    group_name = group.name
            
            if attendance:
                # Use existing record
                result.append({
                    "id": attendance.id,
                    "student_id": attendance.student_id,
                    "name": student.name,
                    "group_name": group_name,
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
                    "group_name": group_name,
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
