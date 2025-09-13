from flask import Blueprint, request, jsonify, current_app
from app import db
from app.models.group import Group
from app.models.student import Student
from app.utils.auth import admin_required
import os

groups_bp = Blueprint('groups', __name__)

@groups_bp.route('', methods=['POST'])
@admin_required()
def create_group():
    """Create a new group"""
    data = request.get_json()
    
    if not data or 'name' not in data:
        return jsonify({"success": False, "message": "Group name is required"}), 400
    
    name = data['name']
    
    # Check if group with this name already exists
    existing_group = Group.query.filter_by(name=name).first()
    if existing_group:
        return jsonify({"success": False, "message": "Group with this name already exists"}), 400
    
    # Create new group
    group = Group(name=name)
    db.session.add(group)
    db.session.commit()
    
    return jsonify({
        "success": True,
        "id": group.id,
        "name": group.name
    }), 201

@groups_bp.route('', methods=['GET'])
@admin_required()
def get_all_groups():
    """Get all groups"""
    groups = Group.query.all()
    return jsonify({
        "groups": [group.to_dict() for group in groups]
    }), 200

@groups_bp.route('/<int:group_id>', methods=['GET'])
@admin_required()
def get_group(group_id):
    """Get a specific group"""
    group = Group.query.get_or_404(group_id)
    return jsonify({
        "group": group.to_dict()
    }), 200

@groups_bp.route('/<int:group_id>', methods=['DELETE'])
@admin_required()
def delete_group(group_id):
    """Delete a group and associated students"""
    group = Group.query.get_or_404(group_id)
    
    db.session.delete(group)
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": f"Group '{group.name}' has been deleted"
    }), 200

@groups_bp.route('/<int:group_id>/students', methods=['GET'])
@admin_required()
def get_students_by_group(group_id):
    """Get all students in a group"""
    try:
        # Log the request
        current_app.logger.info(f"Fetching students for group {group_id}")
        
        # Check if group exists
        group = Group.query.get(group_id)
        if not group:
            current_app.logger.warning(f"Group with ID {group_id} not found")
            return jsonify({"error": f"Group with ID {group_id} not found"}), 404
        
        # Skip face service initialization
        # This is where errors occur if the face recognition model has issues
        
        # Get students - log how many we found
        students = Student.query.filter_by(group_id=group_id).all()
        current_app.logger.info(f"Found {len(students)} students for group {group_id}")
        
        # Manually construct student dicts to avoid any potential errors
        student_dicts = []
        for student in students:
            try:
                student_dict = {
                    'student_id': student.student_id,
                    'name': student.name,
                    'group_id': student.group_id,
                    'created_at': student.created_at.isoformat() if student.created_at else None
                }
                
                # Safely add photo_url if it exists
                if hasattr(student, 'photo_path') and student.photo_path:
                    try:
                        student_dict['photo_url'] = f"/uploads/{os.path.basename(student.photo_path)}"
                    except Exception as e:
                        current_app.logger.error(f"Error processing photo path for student {student.student_id}: {str(e)}")
                        student_dict['photo_url'] = None
                else:
                    student_dict['photo_url'] = None
                
                student_dicts.append(student_dict)
            except Exception as e:
                current_app.logger.error(f"Error processing student {student.student_id}: {str(e)}")
                # Continue processing other students
                continue
        
        response_data = {
            "group": {
                'id': group.id,
                'name': group.name,
                'student_count': len(students)
            },
            "students": student_dicts
        }
        
        return jsonify(response_data), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching students for group {group_id}: {str(e)}")
        import traceback
        current_app.logger.error(traceback.format_exc())
        return jsonify({"error": "An unexpected error occurred", "details": str(e)}), 500

@groups_bp.route('/<int:group_id>/students', methods=['POST'])
@admin_required()
def add_student_to_group(group_id):
    """Add a student to a group"""
    try:
        # Log request information for debugging
        current_app.logger.info(f"Adding student to group {group_id}")
        current_app.logger.info(f"Form data: {request.form}")
        current_app.logger.info(f"Files: {request.files}")
        
        # Check if group exists
        group = Group.query.get(group_id)
        if not group:
            current_app.logger.error(f"Group with ID {group_id} not found")
            return jsonify({"error": f"Group with ID {group_id} not found"}), 404
            
        # Check if the request has the required fields
        if 'student_id' not in request.form or 'name' not in request.form:
            current_app.logger.error("Missing required fields in form data")
            return jsonify({"error": "Missing required fields. Both student_id and name are required."}), 400
            
        student_id = request.form['student_id']
        name = request.form['name']
        
        current_app.logger.info(f"Processing student: {student_id} - {name}")
        
        # Check if student already exists
        existing_student = Student.query.filter_by(student_id=student_id).first()
        if existing_student:
            current_app.logger.info(f"Student {student_id} already exists, updating group to {group_id}")
            # If student exists, update group
            existing_student.group_id = group_id
            db.session.commit()
            return jsonify({"message": "Student added to group", "student": existing_student.to_dict()}), 200
            
        # Create new student with basic info first
        new_student = Student(
            student_id=student_id,
            name=name,
            group_id=group_id,
            photo_path=None
        )
        
        # Import necessary modules
        import uuid
        import cv2
        from app.services.face_service import FaceService
        from app.services.drive_service import DriveService
        
        # Get services
        face_service = FaceService()
        drive_service = DriveService()
        
        # Initialize services if needed
        if not face_service.initialized:
            face_service.initialize()
        if not drive_service.initialized:
            drive_service.initialize()
        
        # Handle image file if present
        if 'image' in request.files:
            file = request.files['image']
            if file and file.filename.lower().endswith(('.png', '.jpg', '.jpeg')):
                # Generate a unique filename with UUID
                filename = f"{student_id}_{str(uuid.uuid4())}.jpg"
                filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
                
                # Ensure directory exists
                os.makedirs(os.path.dirname(filepath), exist_ok=True)
                
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
            current_app.logger.info(f"Processing Drive link: {drive_link}")
            
            try:
                # Ensure Drive service is initialized
                if not drive_service.initialized:
                    current_app.logger.info("Drive service not initialized. Initializing now...")
                    if not drive_service.initialize():
                        current_app.logger.error("Failed to initialize Drive service")
                        return jsonify({"error": "Google Drive service unavailable. Please try uploading an image directly."}), 500
                
                # Download image from drive and process
                current_app.logger.info("Attempting to download file from Drive...")
                temp_filepath = drive_service.download_file(drive_link)
                current_app.logger.info(f"File downloaded to: {temp_filepath}")
                
                # Generate a unique filename with UUID
                filename = f"{student_id}_{str(uuid.uuid4())}.jpg"
                filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
                
                # Ensure upload directory exists
                os.makedirs(os.path.dirname(filepath), exist_ok=True)
                
                # Copy the temp file to uploads
                import shutil
                shutil.copy(temp_filepath, filepath)
                current_app.logger.info(f"File copied to uploads: {filepath}")
                
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
                import traceback
                current_app.logger.error(traceback.format_exc())
                return jsonify({"error": f"Could not process image from Drive link: {str(e)}"}), 400
        
        # Save the student to the database
        db.session.add(new_student)
        db.session.commit()
        
        current_app.logger.info(f"Successfully added student {student_id} to group {group_id}")
        return jsonify({"message": "Student added to group", "student": new_student.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error adding student to group: {str(e)}")
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
        elif 'foreign key constraint' in str(e).lower():
            return jsonify({"error": f"Group with ID {group_id} does not exist"}), 404
        elif 'column' in str(e).lower() and 'not found' in str(e).lower():
            return jsonify({"error": "Database schema issue. Please contact the administrator."}), 500
        else:
            return jsonify({
                "error": "An unexpected error occurred",
                "details": str(e)
            }), 500

@groups_bp.route('/<int:group_id>/students/bulk', methods=['POST'])
@admin_required()
def bulk_add_students(group_id):
    """Bulk add students to a group from CSV file with drive links"""
    # Add logging
    current_app.logger.info(f"Bulk import request for group {group_id}")
    current_app.logger.info(f"Content type: {request.content_type}")
    current_app.logger.info(f"Files: {request.files}")
    
    # Import necessary modules
    import io
    import csv
    import uuid
    import cv2
    from app.services.face_service import FaceService
    from app.services.drive_service import DriveService
    
    # Get services
    face_service = FaceService()
    drive_service = DriveService()
    
    # Helper function to check allowed file extensions
    def allowed_bulk_file(filename):
        return '.' in filename and filename.rsplit('.', 1)[1].lower() in {'csv'}
    
    try:
        # Check if group exists
        group = Group.query.get_or_404(group_id)
        
        if 'file' not in request.files:
            return jsonify({"success": False, "message": "No file provided"}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"success": False, "message": "No file selected"}), 400
        
        if not allowed_bulk_file(file.filename):
            return jsonify({
                "success": False, 
                "message": "Only CSV accepted. File must include header: student_id,name,drive_link"
            }), 400
        
        # Process the CSV file
        # Read the CSV file
        stream = io.StringIO(file.stream.read().decode("UTF8"), newline=None)
        csv_reader = csv.reader(stream)
        
        # Check header
        try:
            header = next(csv_reader)
        except StopIteration:
            return jsonify({
                "success": False,
                "message": "CSV file is empty"
            }), 400
            
        # Normalize header by stripping whitespace and lowercasing
        header = [col.strip().lower() for col in header]
        
        # Define variations of required column names
        student_id_variations = ['student_id', 'student id', 'studentid', 'id', 'your college id', 'college id', 'student-id']
        name_variations = ['name', 'full name', 'student name', 'your name', 'fullname', 'student-name']
        drive_link_variations = ['drive_link', 'drive link', 'drivelink', 'photo', 'image', 'upload your clear image', 
                                'drive-link', 'google drive', 'google-drive', 'drive url', 'photo link', 'photo url']
        
        # Find matching columns with better logging
        student_id_col = None
        name_col = None
        drive_link_col = None
        
        # Find the student ID column
        for col_name in student_id_variations:
            if col_name in header:
                student_id_col = col_name
                current_app.logger.info(f"Found student ID column: {col_name}")
                break
                
        # Find the name column
        for col_name in name_variations:
            if col_name in header:
                name_col = col_name
                current_app.logger.info(f"Found name column: {col_name}")
                break
                
        # Find the drive link column
        for col_name in drive_link_variations:
            if col_name in header:
                drive_link_col = col_name
                current_app.logger.info(f"Found drive link column: {col_name}")
                break
        
        # Log the full header for debugging
        current_app.logger.info(f"CSV header: {header}")
        
        missing_columns = []
        if not student_id_col:
            missing_columns.append('student_id')
        if not name_col:
            missing_columns.append('name')
        if not drive_link_col:
            missing_columns.append('drive_link')
        
        if missing_columns:
            return jsonify({
                "success": False,
                "message": f"Missing required columns: {', '.join(missing_columns)}. File must include: student_id,name,drive_link"
            }), 400
            
        # Process the student records
        successes = []
        failures = []
        
        # Get column indices
        student_id_idx = header.index(student_id_col)
        name_idx = header.index(name_col)
        drive_link_idx = header.index(drive_link_col)
        
        # Initialize services
        drive_service_initialized = drive_service.initialize()
        face_service_initialized = face_service.initialize()
        
        if not drive_service_initialized:
            return jsonify({
                "success": False,
                "message": "Failed to initialize Google Drive service. Check service account configuration."
            }), 500
            
        row_num = 1  # Start at 1 to account for header row
        
        # Process each row in the CSV
        for row in csv_reader:
            row_num += 1
            
            try:
                # Skip empty rows
                if not row or len(row) < max(student_id_idx, name_idx, drive_link_idx) + 1:
                    failures.append({
                        "row": row_num,
                        "student_id": "unknown",
                        "reason_code": "invalid_row",
                        "message": "Row has missing columns"
                    })
                    continue
                
                # Extract data
                student_id = row[student_id_idx].strip()
                name = row[name_idx].strip()
                drive_link = row[drive_link_idx].strip()
                
                # Validate student_id
                if not student_id:
                    failures.append({
                        "row": row_num,
                        "student_id": "empty",
                        "reason_code": "missing_id",
                        "message": "Student ID is required"
                    })
                    continue
                
                # Validate name
                if not name:
                    failures.append({
                        "row": row_num,
                        "student_id": student_id,
                        "reason_code": "missing_name",
                        "message": "Student name is required"
                    })
                    continue
                
                # Validate drive_link
                if not drive_link:
                    failures.append({
                        "row": row_num,
                        "student_id": student_id,
                        "reason_code": "missing_drive_link",
                        "message": "Google Drive link is required"
                    })
                    continue
                
                # Check if student_id already exists
                existing_student = Student.query.filter_by(student_id=student_id).first()
                if existing_student:
                    failures.append({
                        "row": row_num,
                        "student_id": student_id,
                        "reason_code": "duplicate_id",
                        "message": f"Student with ID {student_id} already exists"
                    })
                    continue
                
                # Create new student
                new_student = Student(
                    student_id=student_id,
                    name=name,
                    group_id=group.id
                )
                
                # Process the drive link
                try:
                    # Download image from drive
                    temp_filepath = drive_service.download_file(drive_link)
                    
                    # Generate a unique filename with UUID
                    filename = f"{student_id}_{str(uuid.uuid4())}.jpg"
                    filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
                    
                    # Use shutil.copy2 instead of copy to preserve file metadata
                    # Also close any open file handles before copying
                    try:
                        # Ensure source file exists and is accessible
                        if not os.path.exists(temp_filepath):
                            raise FileNotFoundError(f"Temporary file not found: {temp_filepath}")
                        
                        # Create a new file instead of copying to avoid file locking issues
                        with open(temp_filepath, 'rb') as src_file:
                            image_data = src_file.read()
                            
                        with open(filepath, 'wb') as dest_file:
                            dest_file.write(image_data)
                            
                        # Delete the temporary file after ensuring it's closed
                        if os.path.exists(temp_filepath):
                            try:
                                os.remove(temp_filepath)
                            except Exception as e:
                                current_app.logger.warning(f"Could not remove temp file {temp_filepath}: {str(e)}")
                    except Exception as file_error:
                        current_app.logger.error(f"File operation error: {str(file_error)}")
                        raise
                    
                    # Update photo path
                    new_student.photo_path = filepath
                    
                    # Process face embedding if face service is initialized
                    if face_service_initialized:
                        try:
                            # Read the image - make sure the file is not locked
                            # Wait a short time to ensure the file is fully written
                            import time
                            time.sleep(0.1)  # 100ms delay
                            
                            # Read the image with proper error handling
                            try:
                                img = cv2.imread(filepath)
                                if img is None:
                                    current_app.logger.warning(f"Failed to read image file from Drive for student {student_id}")
                                    current_app.logger.warning(f"Checking if file exists: {os.path.exists(filepath)}")
                                    current_app.logger.warning(f"File size: {os.path.getsize(filepath) if os.path.exists(filepath) else 'N/A'}")
                                else:
                                    # Detect face and get embedding
                                    bbox, embedding = face_service.detect_and_embed_face(img)
                                    
                                    if embedding is None:
                                        current_app.logger.warning(f"No face detected in image from Drive for student {student_id}")
                                    else:
                                        # Store the embedding with the student
                                        new_student.set_embedding(embedding)
                            except Exception as img_error:
                                current_app.logger.error(f"Error reading image file: {str(img_error)}")
                        except Exception as e:
                            current_app.logger.error(f"Error processing face from Drive: {str(e)}")
                            # Continue without embedding - it's nullable now
                    
                    # Save the student to the database
                    db.session.add(new_student)
                    db.session.commit()
                    
                    # Add to successes
                    successes.append({
                        "row": row_num,
                        "student_id": student_id,
                        "name": name
                    })
                except Exception as e:
                    # If anything goes wrong, add to failures
                    failures.append({
                        "row": row_num,
                        "student_id": student_id,
                        "reason_code": "processing_error",
                        "message": f"Error processing student: {str(e)}"
                    })
                    # Rollback any partial changes
                    db.session.rollback()
            
            except Exception as e:
                # Handle any other errors
                failures.append({
                    "row": row_num,
                    "student_id": row[student_id_idx] if len(row) > student_id_idx else "unknown",
                    "reason_code": "unknown_error",
                    "message": f"Unexpected error: {str(e)}"
                })
        
        # Return results
        return jsonify({
            "success": True,
            "message": f"Processed {len(successes)} students successfully, with {len(failures)} failures",
            "group_id": group_id,
            "successes": successes,
            "failures": failures
        }), 200
    except Exception as e:
        current_app.logger.error(f"Error in bulk import for group {group_id}: {str(e)}")
        import traceback
        tb = traceback.format_exc()
        current_app.logger.error(tb)
        return jsonify({
            "success": False,
            "message": f"Error processing bulk import: {str(e)}"
        }), 500