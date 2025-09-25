from flask import Blueprint, request, jsonify, current_app
from datetime import datetime, date, timedelta
from app.services.camera_event_service import CameraEventService
from app.models.camera_event import CameraEvent
from app.models.student import Student
from app.utils.auth import admin_required
from app import db
import pytz

camera_events_bp = Blueprint('camera_events', __name__)

@camera_events_bp.route('/student/<student_id>/date/<date_str>', methods=['GET'])
@admin_required()
def get_student_events(student_id, date_str):
    """
    Get all camera events for a student on a specific date
    Returns events in chronological order
    """
    try:
        # Validate student exists
        student = Student.query.get(student_id)
        if not student:
            return jsonify({
                "success": False, 
                "message": f"Student with ID {student_id} not found"
            }), 404
        
        # Parse date
        try:
            target_date = date.fromisoformat(date_str)
        except ValueError:
            return jsonify({
                "success": False, 
                "message": "Invalid date format. Use YYYY-MM-DD"
            }), 400
        
        # Get events
        events = CameraEventService.get_student_events_by_date(student_id, target_date)
        
        return jsonify({
            "success": True,
            "student_id": student_id,
            "student_name": student.name,
            "date": date_str,
            "events": [event.to_dict() for event in events]
        }), 200
    except Exception as e:
        current_app.logger.error(f"Error retrieving camera events: {str(e)}")
        return jsonify({"success": False, "message": str(e)}), 500

@camera_events_bp.route('/student/<student_id>/date/<date_str>/pairs', methods=['GET'])
@admin_required()
def get_student_event_pairs(student_id, date_str):
    """
    Get in/out event pairs for a student on a specific date
    """
    try:
        # Validate student exists
        student = Student.query.get(student_id)
        if not student:
            return jsonify({
                "success": False, 
                "message": f"Student with ID {student_id} not found"
            }), 404
        
        # Parse date
        try:
            target_date = date.fromisoformat(date_str)
        except ValueError:
            return jsonify({
                "success": False, 
                "message": "Invalid date format. Use YYYY-MM-DD"
            }), 400
        
        # Get event pairs
        pairs = CameraEventService.get_student_event_pairs_by_date(student_id, target_date)
        
        # Format the response
        formatted_pairs = []
        for in_event, out_event in pairs:
            pair = {
                "in_event": in_event.to_dict() if in_event else None,
                "out_event": out_event.to_dict() if out_event else None
            }
            formatted_pairs.append(pair)
        
        return jsonify({
            "success": True,
            "student_id": student_id,
            "student_name": student.name,
            "date": date_str,
            "event_pairs": formatted_pairs
        }), 200
    except Exception as e:
        current_app.logger.error(f"Error retrieving camera event pairs: {str(e)}")
        return jsonify({"success": False, "message": str(e)}), 500

@camera_events_bp.route('/event', methods=['POST'])
@admin_required()
def create_event():
    """
    Create a new camera event (admin function for corrections)
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "No data provided"}), 400
            
        # Validate required fields
        required_fields = ['student_id', 'timestamp', 'event_type']
        for field in required_fields:
            if field not in data:
                return jsonify({"success": False, "message": f"Missing required field: {field}"}), 400
        
        # Validate student exists
        student = Student.query.get(data['student_id'])
        if not student:
            return jsonify({
                "success": False, 
                "message": f"Student with ID {data['student_id']} not found"
            }), 404
            
        # Validate event type
        if data['event_type'] not in ['in', 'out']:
            return jsonify({
                "success": False, 
                "message": "Event type must be 'in' or 'out'"
            }), 400
        
        # Parse timestamp
        try:
            timestamp = datetime.fromisoformat(data['timestamp'].replace('Z', '+00:00'))
        except ValueError:
            return jsonify({
                "success": False, 
                "message": "Invalid timestamp format. Use ISO format"
            }), 400
        
        # Create event
        event = CameraEventService.create_or_update_event(
            student_id=data['student_id'],
            timestamp=timestamp,
            event_type=data['event_type'],
            modified_by=data.get('modified_by'),
            modification_reason=data.get('reason', 'Admin correction')
        )
        
        return jsonify({
            "success": True,
            "message": "Event created successfully",
            "event": event.to_dict()
        }), 201
    except Exception as e:
        current_app.logger.error(f"Error creating camera event: {str(e)}")
        return jsonify({"success": False, "message": str(e)}), 500

@camera_events_bp.route('/event/<int:event_id>', methods=['DELETE'])
@admin_required()
def delete_event(event_id):
    """
    Delete a camera event (admin function for corrections)
    """
    try:
        data = request.get_json() or {}
        
        success, message = CameraEventService.delete_event(
            event_id=event_id,
            modified_by=data.get('modified_by'),
            modification_reason=data.get('reason', 'Admin deletion')
        )
        
        if success:
            return jsonify({
                "success": True,
                "message": message
            }), 200
        else:
            return jsonify({
                "success": False,
                "message": message
            }), 400
    except Exception as e:
        current_app.logger.error(f"Error deleting camera event: {str(e)}")
        return jsonify({"success": False, "message": str(e)}), 500