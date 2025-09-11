import os
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
from app import db
from app.models.student import Student
from app.services.face_service import FaceService
from app.utils.auth import require_admin
import uuid

student_bp = Blueprint('students', __name__)
face_service = FaceService()

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in {'png', 'jpg', 'jpeg'}

@student_bp.route('/register', methods=['POST'])
@require_admin
def register_student():
    """Register a new student with face embedding"""
    if 'image' not in request.files:
        return jsonify({"success": False, "message": "No image file provided"}), 400
    
    file = request.files['image']
    if file.filename == '':
        return jsonify({"success": False, "message": "No image selected"}), 400
    
    if not allowed_file(file.filename):
        return jsonify({"success": False, "message": "Invalid file type, use jpg or png"}), 400
    
    student_id = request.form.get('student_id')
    name = request.form.get('name')
    
    if not student_id or not name:
        return jsonify({"success": False, "message": "Student ID and name are required"}), 400
    
    # Check if student already exists
    existing_student = Student.query.get(student_id)
    if existing_student:
        return jsonify({"success": False, "message": "Student ID already exists"}), 400
    
    # Process the image to get face embedding
    image_data = file.read()
    bbox, embedding = face_service.detect_and_embed_face(image_data)
    
    if embedding is None:
        return jsonify({"success": False, "message": "No face detected in the image"}), 400
    
    # Save the image file
    filename = secure_filename(f"{student_id}_{uuid.uuid4()}.jpg")
    upload_folder = current_app.config['UPLOAD_FOLDER']
    os.makedirs(upload_folder, exist_ok=True)
    filepath = os.path.join(upload_folder, filename)
    
    with open(filepath, 'wb') as f:
        f.write(image_data)
    
    # Create and save student
    student = Student(
        student_id=student_id,
        name=name,
        photo_path=filepath
    )
    student.set_embedding(embedding)
    
    db.session.add(student)
    db.session.commit()
    
    return jsonify({
        "success": True,
        "student_id": student.student_id,
        "name": student.name
    }), 201

@student_bp.route('', methods=['GET'])
@require_admin
def get_all_students():
    """Get all students"""
    students = Student.query.all()
    return jsonify({
        "students": [student.to_dict() for student in students]
    }), 200

@student_bp.route('/<student_id>', methods=['GET'])
@require_admin
def get_student(student_id):
    """Get a specific student"""
    student = Student.query.get_or_404(student_id)
    return jsonify({
        "student": student.to_dict()
    }), 200

@student_bp.route('/<student_id>', methods=['PUT'])
@require_admin
def update_student(student_id):
    """Update a student's information"""
    student = Student.query.get_or_404(student_id)
    
    # Update name if provided
    if 'name' in request.form:
        student.name = request.form.get('name')
    
    # Update face embedding if new image provided
    if 'image' in request.files and request.files['image'].filename != '':
        file = request.files['image']
        
        if not allowed_file(file.filename):
            return jsonify({"success": False, "message": "Invalid file type"}), 400
        
        image_data = file.read()
        bbox, embedding = face_service.detect_and_embed_face(image_data)
        
        if embedding is None:
            return jsonify({"success": False, "message": "No face detected in the image"}), 400
        
        # Save the new image file
        filename = secure_filename(f"{student_id}_{uuid.uuid4()}.jpg")
        upload_folder = current_app.config['UPLOAD_FOLDER']
        filepath = os.path.join(upload_folder, filename)
        
        with open(filepath, 'wb') as f:
            f.write(image_data)
        
        # Delete old photo if exists
        if student.photo_path and os.path.exists(student.photo_path):
            try:
                os.remove(student.photo_path)
            except:
                current_app.logger.warning(f"Could not delete old photo: {student.photo_path}")
        
        student.photo_path = filepath
        student.set_embedding(embedding)
    
    db.session.commit()
    
    return jsonify({
        "success": True,
        "student": student.to_dict()
    }), 200

@student_bp.route('/<student_id>', methods=['DELETE'])
@require_admin
def delete_student(student_id):
    """Delete a student"""
    student = Student.query.get_or_404(student_id)
    
    # Delete photo if exists
    if student.photo_path and os.path.exists(student.photo_path):
        try:
            os.remove(student.photo_path)
        except:
            current_app.logger.warning(f"Could not delete photo: {student.photo_path}")
    
    db.session.delete(student)
    db.session.commit()
    
    return jsonify({
        "success": True
    }), 200