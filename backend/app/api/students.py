"""
Student API endpoints for managing student data, groups, and face embeddings
"""
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
from app.models.student import Student
from app.models.group import Group
from app import db
from app.services.face_service import FaceService
from app.services.drive_service import DriveService
from app.utils.auth import admin_required
import os
import uuid
import tempfile
import io
import csv
import cv2
import numpy as np
from sqlalchemy.exc import SQLAlchemyError

student_bp = Blueprint('students', __name__)
face_service = FaceService()
drive_service = DriveService()

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in {'png', 'jpg', 'jpeg'}
           
def allowed_bulk_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in {'csv'}

# Get all students
@student_bp.route('/', methods=['GET'])
@admin_required()
def get_all_students():
    """Get all students"""
    try:
        students = Student.query.all()
        return jsonify({"students": [student.to_dict() for student in students]}), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching all students: {str(e)}")
        return jsonify({"error": "An unexpected error occurred"}), 500

# Register a new student (legacy API)
@student_bp.route('/register', methods=['POST'])
@admin_required()
def register_student():
    """Register a new student with photo"""
    try:
        # Check if the request has the required fields
        if 'student_id' not in request.form or 'name' not in request.form:
            return jsonify({"error": "Missing required fields"}), 400
            
        student_id = request.form['student_id']
        name = request.form['name']
        
        # Check if student already exists
        existing_student = Student.query.filter_by(student_id=student_id).first()
        if existing_student:
            return jsonify({"error": f"Student with ID {student_id} already exists"}), 409
            
        # Create new student with basic info first
        new_student = Student(
            student_id=student_id,
            name=name,
            group_id=None,  # No group for direct registration
            photo_path=None
        )
        
        # Handle image file if present
        if 'image' in request.files:
            file = request.files['image']
            if file and allowed_file(file.filename):
                # Generate a unique filename with UUID
                filename = f"{student_id}_{str(uuid.uuid4())}.jpg"
                filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
                
                # Save the file
                file.save(filepath)
                
                # Update photo path
                new_student.photo_path = filepath
                
                # Process face embedding
                try:
                    # Read the image
                    img = cv2.imread(filepath)
                    if img is None:
                        current_app.logger.warning(f"Failed to read image file for student {student_id}")
                    else:
                        # Detect face and get embedding
                        bbox, embedding = face_service.detect_and_embed_face(img)
                        
                        if embedding is None:
                            current_app.logger.warning(f"No face detected in image for student {student_id}")
                        else:
                            # Store the embedding with the student
                            new_student.set_embedding(embedding)
                except Exception as e:
                    current_app.logger.error(f"Error processing face: {str(e)}")
                    # Continue without embedding - it's nullable now
        
        # Handle Drive link if present
        elif 'drive_link' in request.form and request.form['drive_link']:
            drive_link = request.form['drive_link']
            
            try:
                # Download image from drive and process
                temp_filepath = drive_service.download_file(drive_link)
                
                # Generate a unique filename with UUID
                filename = f"{student_id}_{str(uuid.uuid4())}.jpg"
                filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
                
                # Copy the temp file to uploads
                import shutil
                shutil.copy(temp_filepath, filepath)
                
                # Clean up temp file
                os.remove(temp_filepath)
                
                # Update photo path
                new_student.photo_path = filepath
                
                # Process face embedding
                try:
                    # Read the image
                    img = cv2.imread(filepath)
                    if img is None:
                        current_app.logger.warning(f"Failed to read image file from Drive for student {student_id}")
                    else:
                        # Detect face and get embedding
                        bbox, embedding = face_service.detect_and_embed_face(img)
                        
                        if embedding is None:
                            current_app.logger.warning(f"No face detected in image from Drive for student {student_id}")
                        else:
                            # Store the embedding with the student
                            new_student.set_embedding(embedding)
                except Exception as e:
                    current_app.logger.error(f"Error processing face from Drive: {str(e)}")
                    # Continue without embedding - it's nullable now
            except Exception as e:
                current_app.logger.error(f"Error downloading from drive: {str(e)}")
                return jsonify({"error": "Could not process image from Drive link"}), 400
        
        # Save the student to the database
        db.session.add(new_student)
        db.session.commit()
        
        return jsonify({"message": "Student registered successfully", "student": new_student.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error registering student: {str(e)}")
        import traceback
        tb = traceback.format_exc()
        current_app.logger.error(tb)
        
        # Provide more specific error messages based on the exception
        if 'duplicate key' in str(e).lower():
            return jsonify({"error": f"Student with ID {student_id} already exists"}), 409
        elif 'drive' in str(e).lower() or 'google' in str(e).lower():
            return jsonify({"error": f"Google Drive error: {str(e)}. Try uploading a local image instead."}), 400
        elif 'permission' in str(e).lower():
            return jsonify({"error": "Permission error with Google Drive. Make sure the file is shared with the service account."}), 403
        elif 'not found' in str(e).lower() or '404' in str(e):
            return jsonify({"error": "File not found on Google Drive. Check the link and try again."}), 404
        elif 'file' in str(e).lower() or 'directory' in str(e).lower():
            return jsonify({"error": f"File system error: {str(e)}. Check if uploads directory exists and is writable."}), 500
        else:
            return jsonify({
                "error": "An unexpected error occurred",
                "details": str(e)
            }), 500

# Delete a student
@student_bp.route('/<string:student_id>', methods=['DELETE'])
@admin_required()
def delete_student(student_id):
    """Delete a student by ID"""
    try:
        # Log the request
        current_app.logger.info(f"Deleting student with ID: {student_id}")
        
        # Find the student
        student = Student.query.get(student_id)
        if not student:
            current_app.logger.warning(f"Student with ID {student_id} not found")
            return jsonify({"error": f"Student with ID {student_id} not found"}), 404
        
        # Delete the student's photo if it exists
        if student.photo_path and os.path.exists(student.photo_path):
            try:
                os.remove(student.photo_path)
                current_app.logger.info(f"Deleted photo file: {student.photo_path}")
            except Exception as e:
                current_app.logger.warning(f"Could not delete photo file: {str(e)}")
                # Continue with deletion even if photo can't be removed
        
        # Delete the student from the database
        db.session.delete(student)
        db.session.commit()
        
        current_app.logger.info(f"Successfully deleted student with ID: {student_id}")
        return jsonify({"message": f"Student with ID {student_id} has been deleted"}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting student: {str(e)}")
        import traceback
        tb = traceback.format_exc()
        current_app.logger.error(tb)
        return jsonify({"error": "An unexpected error occurred", "details": str(e)}), 500

# Bulk delete students
@student_bp.route('/bulk-delete', methods=['POST'])
@admin_required()
def bulk_delete_students():
    """Delete multiple students at once"""
    try:
        # Get the list of student IDs from the request
        data = request.json
        if not data or 'ids' not in data or not isinstance(data['ids'], list):
            return jsonify({"error": "Invalid request format. 'ids' array is required"}), 400
            
        student_ids = data['ids']
        
        # Initialize tracking lists
        deleted_ids = []
        failed_ids = []
        
        # Process deletion in batches to avoid large transactions
        batch_size = 50  # Adjust based on your expected load
        
        for i in range(0, len(student_ids), batch_size):
            batch_ids = student_ids[i:i+batch_size]
            
            # Start a nested transaction for this batch
            try:
                # Find all students in this batch
                students = Student.query.filter(Student.student_id.in_(batch_ids)).all()
                
                # Track which IDs we found
                found_ids = [student.student_id for student in students]
                
                # Delete photo files for found students
                for student in students:
                    if student.photo_path and os.path.exists(student.photo_path):
                        try:
                            os.remove(student.photo_path)
                            current_app.logger.info(f"Deleted photo file: {student.photo_path}")
                        except Exception as e:
                            current_app.logger.warning(f"Could not delete photo file for {student.student_id}: {str(e)}")
                            # Continue with deletion even if photo can't be removed
                    
                    # Delete the student from the database
                    db.session.delete(student)
                
                # Add successfully found IDs to deleted list
                deleted_ids.extend(found_ids)
                
                # Add not found IDs to failed list
                not_found_ids = [sid for sid in batch_ids if sid not in found_ids]
                for sid in not_found_ids:
                    failed_ids.append({"id": sid, "reason": "not_found"})
                
                # Commit this batch
                db.session.commit()
                
            except SQLAlchemyError as e:
                # If anything goes wrong with this batch, roll it back
                db.session.rollback()
                current_app.logger.error(f"Error deleting batch of students: {str(e)}")
                
                # Add all IDs in this batch to failed
                for sid in batch_ids:
                    if sid not in deleted_ids:  # Only add if not already successfully deleted
                        failed_ids.append({"id": sid, "reason": "database_error"})
        
        current_app.logger.info(f"Bulk delete completed. Deleted: {len(deleted_ids)}, Failed: {len(failed_ids)}")
        return jsonify({
            "deleted": deleted_ids,
            "failed": failed_ids
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error in bulk delete: {str(e)}")
        import traceback
        tb = traceback.format_exc()
        current_app.logger.error(tb)
        return jsonify({"error": "An unexpected error occurred", "details": str(e)}), 500

# Bulk import students
@student_bp.route('/bulk-import', methods=['POST'])
@admin_required()
def bulk_import_all_students():
    """Import multiple students at once from CSV/XLSX file"""
    try:
        # Check if the request has the required file
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
            
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
            
        if not file.filename.endswith(('.csv', '.xlsx')):
            return jsonify({"error": "Invalid file type. Only CSV and XLSX files are supported"}), 400
        
        # Check if dry_run parameter is provided
        dry_run = request.form.get('dry_run', 'false').lower() == 'true'
        
        # Get group_id if provided
        group_id = request.form.get('group_id')
        if group_id:
            try:
                group_id = int(group_id)
                # Verify group exists
                group = Group.query.get(group_id)
                if not group:
                    return jsonify({"error": f"Group with ID {group_id} not found"}), 404
            except ValueError:
                return jsonify({"error": "Invalid group ID format"}), 400
        
        # Parse the CSV file
        file_content = file.stream.read().decode('utf-8-sig')  # Handle BOM if present
        csv_reader = csv.reader(io.StringIO(file_content))
        
        # Extract header and normalize to lowercase
        headers = [h.lower().strip() for h in next(csv_reader)]
        
        # Validate required headers
        required_fields = ['student_id', 'name']
        missing_fields = [field for field in required_fields if not any(h == field or h.replace('_', '') == field for h in headers)]
        if missing_fields:
            return jsonify({
                "error": f"Missing required fields: {', '.join(missing_fields)}",
                "headers_found": headers
            }), 400
        
        # Map header variations to standard names
        header_map = {}
        for i, h in enumerate(headers):
            if h == 'student_id' or h == 'studentid' or h == 'id':
                header_map['student_id'] = i
            elif h == 'name' or h == 'fullname' or h == 'full_name':
                header_map['name'] = i
            elif h == 'drive_link' or h == 'drivelink' or h == 'photo' or h == 'image':
                header_map['drive_link'] = i
            elif h == 'email':
                header_map['email'] = i
            elif h == 'first_name' or h == 'firstname':
                header_map['first_name'] = i
            elif h == 'last_name' or h == 'lastname':
                header_map['last_name'] = i
        
        # If first_name and last_name are present but name is not, we'll combine them
        has_name_parts = 'first_name' in header_map and 'last_name' in header_map
        
        # Read all rows first for validation
        rows = list(csv_reader)
        total_rows = len(rows)
        
        # Check if we're within the allowed number of rows
        max_allowed_rows = current_app.config.get('MAX_IMPORT_ROWS', 5000)
        if total_rows > max_allowed_rows:
            return jsonify({
                "error": f"Too many rows. Maximum allowed is {max_allowed_rows}, got {total_rows}"
            }), 400
        
        current_app.logger.info(f"Processing {total_rows} rows for import (dry_run: {dry_run})")
        
        # Initialize result tracking
        created = []
        updated = []
        failed = []
        errors = []
        
        # Process in batches for better performance
        batch_size = current_app.config.get('BULK_IMPORT_BATCH_SIZE', 50)
        
        # Process each batch
        for batch_start in range(0, total_rows, batch_size):
            batch_end = min(batch_start + batch_size, total_rows)
            batch = rows[batch_start:batch_end]
            
            if dry_run:
                # In dry run mode, just validate the data without making changes
                for row_idx, row in enumerate(batch, batch_start + 1):
                    try:
                        # Basic validation for row length
                        if len(row) < max(header_map.values()) + 1:
                            error_msg = "Row has fewer columns than required"
                            failed.append({
                                "row": row_idx,
                                "student_id": "",
                                "reason_code": "invalid_format",
                                "message": error_msg
                            })
                            errors.append({
                                "row": row_idx,
                                "message": error_msg
                            })
                            continue
                        
                        # Extract data from row using header map
                        student_id = row[header_map['student_id']].strip() if 'student_id' in header_map else ""
                        
                        # Handle name from parts if necessary
                        if 'name' in header_map:
                            name = row[header_map['name']].strip()
                        elif has_name_parts:
                            first_name = row[header_map['first_name']].strip()
                            last_name = row[header_map['last_name']].strip()
                            name = f"{first_name} {last_name}".strip()
                        else:
                            name = ""
                        
                        # Check for empty required fields
                        if not student_id:
                            error_msg = "Student ID is required"
                            failed.append({
                                "row": row_idx,
                                "student_id": "",
                                "reason_code": "missing_id",
                                "message": error_msg
                            })
                            errors.append({
                                "row": row_idx,
                                "message": error_msg
                            })
                            continue
                        
                        if not name:
                            error_msg = "Name is required"
                            failed.append({
                                "row": row_idx,
                                "student_id": student_id,
                                "reason_code": "missing_name",
                                "message": error_msg
                            })
                            errors.append({
                                "row": row_idx,
                                "message": error_msg
                            })
                            continue
                        
                        # Check if student already exists
                        existing_student = Student.query.filter_by(student_id=student_id).first()
                        if existing_student:
                            updated.append({
                                "row": row_idx,
                                "student_id": student_id,
                                "name": name
                            })
                        else:
                            created.append({
                                "row": row_idx,
                                "student_id": student_id,
                                "name": name
                            })
                        
                    except Exception as e:
                        current_app.logger.error(f"Error validating row {row_idx}: {str(e)}")
                        error_msg = str(e)
                        failed.append({
                            "row": row_idx,
                            "student_id": row[header_map['student_id']] if 'student_id' in header_map and len(row) > header_map['student_id'] else "",
                            "reason_code": "validation_error",
                            "message": error_msg
                        })
                        errors.append({
                            "row": row_idx,
                            "message": error_msg
                        })
            else:
                # In real import mode, make actual database changes in a transaction
                try:
                    for row_idx, row in enumerate(batch, batch_start + 1):
                        try:
                            # Skip rows with insufficient columns
                            if len(row) < max(header_map.values()) + 1:
                                error_msg = "Row has fewer columns than required"
                                failed.append({
                                    "row": row_idx,
                                    "student_id": "",
                                    "reason_code": "invalid_format",
                                    "message": error_msg
                                })
                                continue
                            
                            # Extract data from row using header map
                            student_id = row[header_map['student_id']].strip() if 'student_id' in header_map else ""
                            
                            # Handle name from parts if necessary
                            if 'name' in header_map:
                                name = row[header_map['name']].strip()
                            elif has_name_parts:
                                first_name = row[header_map['first_name']].strip()
                                last_name = row[header_map['last_name']].strip()
                                name = f"{first_name} {last_name}".strip()
                            else:
                                name = ""
                                
                            # Get optional drive link
                            drive_link = row[header_map['drive_link']].strip() if 'drive_link' in header_map and len(row) > header_map['drive_link'] else None
                            
                            # Check for empty required fields
                            if not student_id:
                                error_msg = "Student ID is required"
                                failed.append({
                                    "row": row_idx,
                                    "student_id": "",
                                    "reason_code": "missing_id",
                                    "message": error_msg
                                })
                                continue
                            
                            if not name:
                                error_msg = "Name is required"
                                failed.append({
                                    "row": row_idx,
                                    "student_id": student_id,
                                    "reason_code": "missing_name",
                                    "message": error_msg
                                })
                                continue
                            
                            # Check if student already exists
                            existing_student = Student.query.filter_by(student_id=student_id).first()
                            
                            if existing_student:
                                # Update existing student
                                existing_student.name = name
                                
                                # Set group if provided
                                if group_id is not None:
                                    existing_student.group_id = group_id
                                
                                # Handle Drive link if present
                                if drive_link:
                                    try:
                                        # Download image from drive and process
                                        temp_filepath = drive_service.download_file(drive_link)
                                        
                                        # Generate a unique filename with UUID
                                        filename = f"{student_id}_{str(uuid.uuid4())}.jpg"
                                        filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
                                        
                                        # Copy the temp file to uploads
                                        import shutil
                                        shutil.copy(temp_filepath, filepath)
                                        
                                        # Clean up temp file
                                        os.remove(temp_filepath)
                                        
                                        # Delete old photo if exists
                                        if existing_student.photo_path and os.path.exists(existing_student.photo_path):
                                            try:
                                                os.remove(existing_student.photo_path)
                                            except Exception as e:
                                                current_app.logger.warning(f"Could not delete old photo: {str(e)}")
                                        
                                        # Update photo path
                                        existing_student.photo_path = filepath
                                        
                                        # Process face embedding
                                        try:
                                            # Read the image
                                            img = cv2.imread(filepath)
                                            if img is None:
                                                current_app.logger.warning(f"Failed to read image file from Drive for student {student_id}")
                                            else:
                                                # Detect face and get embedding
                                                bbox, embedding = face_service.detect_and_embed_face(img)
                                                
                                                if embedding is None:
                                                    current_app.logger.warning(f"No face detected in image from Drive for student {student_id}")
                                                else:
                                                    # Store the embedding with the student
                                                    existing_student.set_embedding(embedding)
                                        except Exception as e:
                                            current_app.logger.error(f"Error processing face from Drive: {str(e)}")
                                            # Continue without embedding - it's nullable now
                                    except Exception as e:
                                        current_app.logger.error(f"Error downloading from drive: {str(e)}")
                                        error_msg = f"Could not process image from Drive link: {str(e)}"
                                        failed.append({
                                            "row": row_idx,
                                            "student_id": student_id,
                                            "reason_code": "drive_error",
                                            "message": error_msg
                                        })
                                        continue
                                
                                db.session.add(existing_student)
                                updated.append({
                                    "row": row_idx,
                                    "student_id": student_id,
                                    "name": name
                                })
                            else:
                                # Create new student
                                new_student = Student(
                                    student_id=student_id,
                                    name=name,
                                    group_id=group_id,  # Set group if provided
                                    photo_path=None
                                )
                                
                                # Handle Drive link if present
                                if drive_link:
                                    try:
                                        # Download image from drive and process
                                        temp_filepath = drive_service.download_file(drive_link)
                                        
                                        # Generate a unique filename with UUID
                                        filename = f"{student_id}_{str(uuid.uuid4())}.jpg"
                                        filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
                                        
                                        # Copy the temp file to uploads
                                        import shutil
                                        shutil.copy(temp_filepath, filepath)
                                        
                                        # Clean up temp file
                                        os.remove(temp_filepath)
                                        
                                        # Update photo path
                                        new_student.photo_path = filepath
                                        
                                        # Process face embedding
                                        try:
                                            # Read the image
                                            img = cv2.imread(filepath)
                                            if img is None:
                                                current_app.logger.warning(f"Failed to read image file from Drive for student {student_id}")
                                            else:
                                                # Detect face and get embedding
                                                bbox, embedding = face_service.detect_and_embed_face(img)
                                                
                                                if embedding is None:
                                                    current_app.logger.warning(f"No face detected in image from Drive for student {student_id}")
                                                else:
                                                    # Store the embedding with the student
                                                    new_student.set_embedding(embedding)
                                        except Exception as e:
                                            current_app.logger.error(f"Error processing face from Drive: {str(e)}")
                                            # Continue without embedding - it's nullable now
                                    except Exception as e:
                                        current_app.logger.error(f"Error downloading from drive: {str(e)}")
                                        error_msg = f"Could not process image from Drive link: {str(e)}"
                                        failed.append({
                                            "row": row_idx,
                                            "student_id": student_id,
                                            "reason_code": "drive_error",
                                            "message": error_msg
                                        })
                                        continue
                                
                                db.session.add(new_student)
                                created.append({
                                    "row": row_idx,
                                    "student_id": student_id,
                                    "name": name
                                })
                                
                        except Exception as e:
                            current_app.logger.error(f"Error processing row {row_idx}: {str(e)}")
                            error_msg = str(e)
                            failed.append({
                                "row": row_idx,
                                "student_id": row[header_map['student_id']] if 'student_id' in header_map and len(row) > header_map['student_id'] else "",
                                "reason_code": "processing_error",
                                "message": error_msg
                            })
                    
                    # Commit the batch
                    db.session.commit()
                
                except Exception as e:
                    # If batch processing fails, roll back and mark all rows as failed
                    db.session.rollback()
                    current_app.logger.error(f"Error processing batch {batch_start}-{batch_end}: {str(e)}")
                    
                    for row_idx, row in enumerate(batch, batch_start + 1):
                        student_id = row[header_map['student_id']] if 'student_id' in header_map and len(row) > header_map['student_id'] else ""
                        # Only add to failed if not already processed successfully
                        if not any(c["row"] == row_idx for c in created) and not any(u["row"] == row_idx for u in updated):
                            error_msg = f"Batch processing error: {str(e)}"
                            failed.append({
                                "row": row_idx,
                                "student_id": student_id,
                                "reason_code": "batch_error",
                                "message": error_msg
                            })
        
        # Return summary
        return jsonify({
            "successes": created + updated,
            "failures": failed,
            "errors": errors,
            "dry_run": dry_run,
            "total_rows": total_rows,
            "success_count": len(created) + len(updated),
            "error_count": len(failed),
            "summary": {
                "total_rows": total_rows,
                "created": len(created),
                "updated": len(updated),
                "failed": len(failed)
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error in bulk import: {str(e)}")
        import traceback
        tb = traceback.format_exc()
        current_app.logger.error(tb)
        return jsonify({"error": "An unexpected error occurred", "details": str(e)}), 500

# Bulk import students - legacy endpoint alias
@student_bp.route('/import', methods=['POST'])
@admin_required()
def bulk_import_students():
    """Alias for bulk_import_all_students for backward compatibility"""
    return bulk_import_all_students()