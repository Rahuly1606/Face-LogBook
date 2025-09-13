import os
import cv2
import numpy as np
import insightface
from insightface.app import FaceAnalysis
from datetime import datetime
import time
from app import db
from app.models.student import Student
from flask import current_app

class FaceService:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(FaceService, cls).__new__(cls)
            cls._instance.initialized = False
            cls._instance.model = None
        return cls._instance
    
    def __init__(self):
        # Initialize will be called explicitly, so we don't need to do anything here
        pass
    
    def initialize(self):
        """Initialize the face detection and recognition model"""
        if self.initialized:
            return True
            
        try:
            # Initialize InsightFace model
            model_path = current_app.config.get('FACE_MODEL_PATH')
            detector_backend = current_app.config.get('FACE_DETECTOR_BACKEND')
            
            try:
                # Try to initialize the face model
                self.model = FaceAnalysis(name=detector_backend, root=model_path, providers=['CPUExecutionProvider'])
                self.model.prepare(ctx_id=0, det_size=(640, 640))
                self.initialized = True
                current_app.logger.info("Face recognition model successfully initialized")
                return True
            except ModuleNotFoundError as e:
                current_app.logger.error(f"Module error during face model initialization: {str(e)}")
                return False
            except AttributeError as e:
                current_app.logger.error(f"Attribute error during face model initialization (likely ml_dtypes issue): {str(e)}")
                return False
            except Exception as e:
                current_app.logger.error(f"Unknown error during face model initialization: {str(e)}")
                return False
        except Exception as e:
            current_app.logger.error(f"Failed to initialize face model: {str(e)}")
            return False
    
    def detect_and_embed_face(self, image_data):
        """Detect face in an image and return the embedding"""
        if not self.initialized or self.model is None:
            if not self.initialize():
                current_app.logger.warning("Face service not initialized and could not be initialized on-demand")
                return None, None
        
        try:
            # Convert bytes to image if needed
            if isinstance(image_data, bytes):
                np_arr = np.frombuffer(image_data, np.uint8)
                img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            else:
                img = image_data
            
            # Resize image if too large
            max_size = current_app.config.get('MAX_IMAGE_SIZE', 800)
            h, w = img.shape[:2]
            if max(h, w) > max_size:
                scale = max_size / max(h, w)
                img = cv2.resize(img, (int(w * scale), int(h * scale)))
            
            # BGR to RGB for insightface
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            
            # Detect faces
            try:
                faces = self.model.get(img_rgb)
            except AttributeError as e:
                current_app.logger.error(f"Face detection failed with attribute error: {str(e)}")
                return None, None
            except Exception as e:
                current_app.logger.error(f"Face detection failed: {str(e)}")
                return None, None
            
            if not faces:
                return None, None
            
            # Get the largest face in the image (presumably the main subject)
            # Sort by face box area (width * height)
            faces = sorted(faces, key=lambda x: (x.bbox[2] - x.bbox[0]) * (x.bbox[3] - x.bbox[1]), reverse=True)
            face = faces[0]
            
            # Return bounding box and embedding
            bbox = face.bbox.astype(int)
            embedding = face.embedding
            
            return bbox, embedding
        except Exception as e:
            current_app.logger.error(f"Error in face detection and embedding: {str(e)}")
            return None, None
    
    def match_face(self, embedding, threshold=None):
        """Match a face embedding against all students in the database"""
        if threshold is None:
            threshold = current_app.config.get('FACE_MATCH_THRESHOLD', 0.60)
        
        # Get all student embeddings
        students = Student.query.all()
        if not students:
            return None, 0.0
        
        best_match = None
        best_score = 0.0
        
        # Normalize query embedding for cosine similarity
        query_embedding = embedding / np.linalg.norm(embedding)
        
        for student in students:
            stored_embedding = student.get_embedding()
            if stored_embedding is not None:
                # Calculate cosine similarity
                similarity = np.dot(query_embedding, stored_embedding)
                if similarity > best_score:
                    best_score = similarity
                    best_match = student
        
        if best_score >= threshold:
            return best_match, best_score
        return None, best_score
    
    def process_image_for_attendance(self, image_data):
        """Process an image for attendance checking"""
        start_time = time.time()
        
        # Ensure model is initialized
        if not self.initialized or self.model is None:
            if not self.initialize():
                raise RuntimeError("Face recognition model could not be initialized")
                
        # Convert bytes to image
        if isinstance(image_data, bytes):
            np_arr = np.frombuffer(image_data, np.uint8)
            img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        else:
            img = image_data
        
        # Resize image if needed
        max_size = current_app.config.get('MAX_IMAGE_SIZE', 800)
        h, w = img.shape[:2]
        if max(h, w) > max_size:
            scale = max_size / max(h, w)
            img = cv2.resize(img, (int(w * scale), int(h * scale)))
        
        # BGR to RGB for insightface
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        # Detect all faces
        faces = self.model.get(img_rgb)
        
        if not faces:
            processing_time = int((time.time() - start_time) * 1000)  # ms
            return {"recognized": [], "unrecognized_count": 0, "unrecognized_faces": [], "processing_time_ms": processing_time}
        
        recognized = []
        unrecognized = 0
        unrecognized_faces = []
        threshold = current_app.config.get('FACE_MATCH_THRESHOLD', 0.60)
        
        for i, face in enumerate(faces):
            embedding = face.embedding
            bbox = face.bbox.astype(int)  # Get bounding box for each face
            student, score = self.match_face(embedding, threshold)
            
            if student:
                recognized.append({
                    "student_id": student.student_id,
                    "name": student.name,
                    "score": float(score),
                    "bbox": bbox.tolist()  # Add bounding box information
                })
            else:
                unrecognized += 1
                # Add information about unrecognized face
                unrecognized_faces.append({
                    "id": f"unknown_{i}",
                    "bbox": bbox.tolist(),
                    "score": float(score) if score else 0.0
                })
        
        processing_time = int((time.time() - start_time) * 1000)  # ms
        
        return {
            "recognized": recognized,
            "unrecognized_count": unrecognized,
            "unrecognized_faces": unrecognized_faces,
            "processing_time_ms": processing_time,
            "total_faces": len(faces)
        }