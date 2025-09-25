from datetime import datetime, date
import pytz
from app import db
from app.models.camera_event import CameraEvent
from flask import current_app
import threading
from sqlalchemy import func, and_

class CameraEventService:
    @staticmethod
    def get_ist_now():
        """Get current datetime in Indian Standard Time"""
        return datetime.now(pytz.timezone('Asia/Kolkata'))

    @staticmethod
    def get_ist_date(dt=None):
        """Get date in IST from a datetime, or current date if no datetime provided"""
        if dt is None:
            return datetime.now(pytz.timezone('Asia/Kolkata')).date()
        
        if dt.tzinfo is None:
            # Make timezone aware if it isn't already
            dt = pytz.UTC.localize(dt)
        return dt.astimezone(pytz.timezone('Asia/Kolkata')).date()
    
    @staticmethod
    def process_camera_detection(student_id):
        """
        Record a new camera detection event with proper event type (in/out)
        Uses database locking to ensure consistent parity (odd = in, even = out)
        Returns event type and created event
        """
        now_utc = datetime.now(pytz.timezone('UTC'))
        now_ist = now_utc.astimezone(pytz.timezone('Asia/Kolkata'))
        local_date = now_ist.date()
        
        # Get debounce window from config
        debounce_seconds = current_app.config.get('EVENT_DEBOUNCE_SECONDS', 30)
        
        try:
            # Use a transaction to prevent race conditions
            with db.session.begin_nested():
                # Lock for the student's events of the day to prevent concurrent modifications
                # This ensures consistent event parity (in/out alternation)
                latest_event = db.session.query(CameraEvent).filter(
                    CameraEvent.student_id == student_id,
                    CameraEvent.local_date == local_date
                ).with_for_update().order_by(CameraEvent.timestamp.desc()).first()
                
                # Check if we should debounce
                try:
                    # Ensure both timestamps have timezone info before comparing
                    if latest_event:
                        timestamp = latest_event.timestamp
                        # Make sure timestamp is timezone aware
                        if timestamp.tzinfo is None:
                            timestamp = pytz.UTC.localize(timestamp)
                        
                        # Calculate time difference
                        time_diff = (now_utc - timestamp).total_seconds()
                        if time_diff < debounce_seconds:
                            current_app.logger.info(f"Debounced camera event for student {student_id} - too soon after last event")
                            return "debounced", latest_event
                except Exception as e:
                    current_app.logger.error(f"Error calculating debounce time: {str(e)}")
                    # Continue processing in case of error
                
                # Count events for this student on this date to determine event type
                event_count = db.session.query(func.count(CameraEvent.id)).filter(
                    CameraEvent.student_id == student_id,
                    CameraEvent.local_date == local_date
                ).scalar()
                
                # Determine event type: odd=in, even=out
                # 0 events → first event is 'in'
                # 1 event → second event is 'out'
                # etc.
                event_type = "in" if event_count % 2 == 0 else "out"
                
                # Create and save the new event
                new_event = CameraEvent(
                    student_id=student_id,
                    timestamp=now_utc,
                    local_date=local_date,
                    event_type=event_type
                )
                db.session.add(new_event)
                
                # Commit at the end of the nested transaction
                
            # Final commit for the outer transaction
            db.session.commit()
            current_app.logger.info(f"Recorded {event_type} event for student {student_id}")
            return event_type, new_event
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error recording camera event: {str(e)}")
            raise
    
    @staticmethod
    def get_student_events_by_date(student_id, target_date):
        """
        Get all camera events for a student on a specific date, sorted by timestamp
        """
        if isinstance(target_date, str):
            try:
                target_date = date.fromisoformat(target_date)
            except ValueError:
                raise ValueError("Date must be in ISO format (YYYY-MM-DD)")
        
        events = CameraEvent.query.filter(
            CameraEvent.student_id == student_id,
            CameraEvent.local_date == target_date
        ).order_by(CameraEvent.timestamp).all()
        
        return events
    
    @staticmethod
    def get_student_event_pairs_by_date(student_id, target_date):
        """
        Get in/out event pairs for a student on a specific date
        Returns a list of pairs [in_event, out_event]
        If the last event is an 'in' without a corresponding 'out',
        the last pair will have None for the out_event
        """
        events = CameraEventService.get_student_events_by_date(student_id, target_date)
        pairs = []
        
        # Process events into pairs
        in_event = None
        for event in events:
            if event.event_type == 'in':
                # Start a new pair
                in_event = event
            elif event.event_type == 'out' and in_event is not None:
                # Complete the pair
                pairs.append([in_event, event])
                in_event = None
        
        # Handle unpaired in_event (last in without out)
        if in_event is not None:
            pairs.append([in_event, None])
        
        return pairs
    
    @staticmethod
    def create_or_update_event(student_id, timestamp, event_type, modified_by=None, modification_reason=None):
        """
        Create or update a camera event (used for admin corrections)
        """
        try:
            # Convert timestamp to UTC for storage
            if timestamp.tzinfo is None:
                timestamp = pytz.UTC.localize(timestamp)
            else:
                timestamp = timestamp.astimezone(pytz.UTC)
            
            # Calculate local date in IST
            local_date = timestamp.astimezone(pytz.timezone('Asia/Kolkata')).date()
            
            # Create new event or update existing one
            event = CameraEvent(
                student_id=student_id,
                timestamp=timestamp,
                local_date=local_date,
                event_type=event_type,
                modified_by=modified_by,
                modification_reason=modification_reason
            )
            db.session.add(event)
            db.session.commit()
            
            return event
        
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error creating/updating camera event: {str(e)}")
            raise
    
    @staticmethod
    def delete_event(event_id, modified_by=None, modification_reason=None):
        """
        Delete a camera event (with audit trail)
        """
        try:
            event = CameraEvent.query.get(event_id)
            if not event:
                return False, "Event not found"
            
            # Log the deletion for audit purposes
            current_app.logger.info(
                f"Deleting camera event: id={event.id}, student={event.student_id}, "
                f"date={event.local_date}, type={event.event_type}, by={modified_by}, reason={modification_reason}"
            )
            
            db.session.delete(event)
            db.session.commit()
            return True, "Event deleted successfully"
        
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error deleting camera event: {str(e)}")
            return False, str(e)