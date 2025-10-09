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

# Try to import FAISS, fallback to numpy if not available
try:
    import faiss
    FAISS_AVAILABLE = True
except ImportError:
    FAISS_AVAILABLE = False
    import warnings
    warnings.warn("FAISS not available, falling back to NumPy for face matching. Install faiss-cpu for better performance.")

class FaceService:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(FaceService, cls).__new__(cls)
            cls._instance.initialized = False
            cls._instance.model = None
            cls._instance._embedding_cache = None
            cls._instance._cache_timestamp = 0
            cls._instance._cache_ttl = 60  # Cache for 60 seconds
            cls._instance._faiss_index = None
            cls._instance._faiss_student_list = None
            cls._instance._use_faiss = FAISS_AVAILABLE
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
                # Try to initialize the face model with optimized detection size
                self.model = FaceAnalysis(name=detector_backend, root=model_path, providers=['CPUExecutionProvider'])
                # Reduced from 640x640 to 320x320 for faster detection
                self.model.prepare(ctx_id=0, det_size=(320, 320))
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
    
    def _get_cached_embeddings(self):
        """Get cached student embeddings or rebuild cache if expired"""
        current_time = time.time()
        
        # Check if cache is valid
        if self._embedding_cache is not None and (current_time - self._cache_timestamp) < self._cache_ttl:
            return self._embedding_cache
        
        # Rebuild cache
        students = Student.query.all()
        if not students:
            self._embedding_cache = ([], [])
            self._cache_timestamp = current_time
            if self._use_faiss:
                self._faiss_index = None
                self._faiss_student_list = None
            return self._embedding_cache
        
        embeddings_list = []
        student_list = []
        
        for student in students:
            stored_embedding = student.get_embedding()
            if stored_embedding is not None:
                embeddings_list.append(stored_embedding)
                student_list.append(student)
        
        # Convert to numpy array for vectorized operations
        if embeddings_list:
            embeddings_matrix = np.vstack(embeddings_list).astype('float32')
            self._embedding_cache = (embeddings_matrix, student_list)
            
            # Build FAISS index if available
            if self._use_faiss and len(embeddings_list) > 0:
                self._build_faiss_index(embeddings_matrix, student_list)
        else:
            self._embedding_cache = ([], [])
            if self._use_faiss:
                self._faiss_index = None
                self._faiss_student_list = None
        
        self._cache_timestamp = current_time
        
        if self._use_faiss:
            current_app.logger.info(f"Rebuilt FAISS index with {len(student_list)} students")
        else:
            current_app.logger.info(f"Rebuilt embedding cache with {len(student_list)} students (NumPy)")
        
        return self._embedding_cache

    def _build_faiss_index(self, embeddings_matrix, student_list):
        """Build FAISS index for fast similarity search"""
        try:
            n_embeddings, dim = embeddings_matrix.shape
            
            # Choose index type based on dataset size
            if n_embeddings < 1000:
                # For small datasets, use exact search (Flat index)
                index = faiss.IndexFlatIP(dim)  # Inner Product (cosine similarity for normalized vectors)
                current_app.logger.info(f"Using FAISS Flat index for {n_embeddings} students")
            elif n_embeddings < 10000:
                # For medium datasets, use IVF (Inverted File Index)
                nlist = min(100, n_embeddings // 10)  # Number of clusters
                quantizer = faiss.IndexFlatIP(dim)
                index = faiss.IndexIVFFlat(quantizer, dim, nlist, faiss.METRIC_INNER_PRODUCT)
                index.train(embeddings_matrix)
                current_app.logger.info(f"Using FAISS IVF index with {nlist} clusters for {n_embeddings} students")
            else:
                # For large datasets, use HNSW (Hierarchical Navigable Small World)
                index = faiss.IndexHNSWFlat(dim, 32, faiss.METRIC_INNER_PRODUCT)
                current_app.logger.info(f"Using FAISS HNSW index for {n_embeddings} students")
            
            # Add embeddings to index (embeddings should already be normalized)
            index.add(embeddings_matrix)
            
            # Set search parameters for IVF
            if isinstance(index, faiss.IndexIVFFlat):
                index.nprobe = min(10, nlist)  # Number of clusters to search
            
            self._faiss_index = index
            self._faiss_student_list = student_list
            
        except Exception as e:
            current_app.logger.error(f"Error building FAISS index: {str(e)}")
            # Fallback to NumPy
            self._use_faiss = False
            self._faiss_index = None
            self._faiss_student_list = None

    def invalidate_cache(self):
        """Invalidate the embedding cache (call when students are added/updated)"""
        self._embedding_cache = None
        self._cache_timestamp = 0
        self._faiss_index = None
        self._faiss_student_list = None
        if self._use_faiss:
            current_app.logger.info("FAISS index and embedding cache invalidated")
        else:
            current_app.logger.info("Embedding cache invalidated")

    def match_face(self, embedding, threshold=None):
        """Match a face embedding against all students using FAISS or NumPy"""
        if threshold is None:
            threshold = current_app.config.get('FACE_MATCH_THRESHOLD', 0.60)
        
        # Normalize query embedding for cosine similarity
        query_embedding = embedding / np.linalg.norm(embedding)
        query_embedding = query_embedding.astype('float32')
        
        # Try FAISS first if available
        if self._use_faiss:
            return self._match_face_faiss(query_embedding, threshold)
        else:
            return self._match_face_numpy(query_embedding, threshold)
    
    def _match_face_faiss(self, query_embedding, threshold):
        """Match face using FAISS index"""
        # Get cached embeddings (will build FAISS index if needed)
        embeddings_matrix, student_list = self._get_cached_embeddings()
        
        if len(student_list) == 0:
            return None, 0.0
        
        # Check if FAISS index is available
        if self._faiss_index is None or self._faiss_student_list is None:
            current_app.logger.warning("FAISS index not available, falling back to NumPy")
            return self._match_face_numpy(query_embedding, threshold)
        
        try:
            # Search for top match using FAISS
            # Query shape needs to be (1, dim) for FAISS
            query = query_embedding.reshape(1, -1)
            
            # Search for k=1 nearest neighbor
            distances, indices = self._faiss_index.search(query, 1)
            
            best_score = float(distances[0][0])
            best_idx = int(indices[0][0])
            
            if best_score >= threshold:
                return self._faiss_student_list[best_idx], best_score
            return None, best_score
            
        except Exception as e:
            current_app.logger.error(f"Error in FAISS search: {str(e)}, falling back to NumPy")
            return self._match_face_numpy(query_embedding, threshold)
    
    def _match_face_numpy(self, query_embedding, threshold):
        """Match face using NumPy (fallback method)"""
        # Get cached embeddings
        embeddings_matrix, student_list = self._get_cached_embeddings()
        
        if len(student_list) == 0:
            return None, 0.0
        
        # Vectorized cosine similarity calculation
        similarities = np.dot(embeddings_matrix, query_embedding)
        
        # Find best match
        best_idx = np.argmax(similarities)
        best_score = similarities[best_idx]
        
        if best_score >= threshold:
            return student_list[best_idx], float(best_score)
        return None, float(best_score)
    
    def process_image_for_attendance(self, image_data):
        """Process an image for attendance checking"""
        start_time = time.time()
        
        try:
            # Ensure model is initialized
            if not self.initialized or self.model is None:
                if not self.initialize():
                    current_app.logger.error("Face recognition model could not be initialized")
                    return {
                        "recognized": [],
                        "unrecognized_count": 0,
                        "unrecognized_faces": [],
                        "processing_time_ms": 0,
                        "error": True,
                        "error_message": "Face recognition model could not be initialized"
                    }
                    
            # Convert bytes to image
            if isinstance(image_data, bytes):
                try:
                    np_arr = np.frombuffer(image_data, np.uint8)
                    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
                    if img is None:
                        current_app.logger.error("Failed to decode image data")
                        return {
                            "recognized": [],
                            "unrecognized_count": 0,
                            "unrecognized_faces": [],
                            "processing_time_ms": 0,
                            "error": True,
                            "error_message": "Failed to decode image data"
                        }
                except Exception as e:
                    current_app.logger.error(f"Error decoding image: {str(e)}")
                    return {
                        "recognized": [],
                        "unrecognized_count": 0,
                        "unrecognized_faces": [],
                        "processing_time_ms": 0,
                        "error": True,
                        "error_message": f"Error decoding image: {str(e)}"
                    }
            else:
                img = image_data
            
            # Resize image if needed - optimized for faster processing
            max_size = current_app.config.get('MAX_IMAGE_SIZE', 800)
            h, w = img.shape[:2]
            if max(h, w) > max_size:
                scale = max_size / max(h, w)
                img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
            
            # BGR to RGB for insightface
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            
            # Detect all faces
            try:
                faces = self.model.get(img_rgb)
            except Exception as e:
                current_app.logger.error(f"Face detection failed: {str(e)}")
                return {
                    "recognized": [],
                    "unrecognized_count": 0,
                    "unrecognized_faces": [],
                    "processing_time_ms": int((time.time() - start_time) * 1000),
                    "error": True,
                    "error_message": f"Face detection failed: {str(e)}"
                }
            
            if not faces:
                processing_time = int((time.time() - start_time) * 1000)  # ms
                return {"recognized": [], "unrecognized_count": 0, "unrecognized_faces": [], "processing_time_ms": processing_time}
            
            recognized = []
            unrecognized = 0
            unrecognized_faces = []
            threshold = current_app.config.get('FACE_MATCH_THRESHOLD', 0.60)
            
            for i, face in enumerate(faces):
                try:
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
                except Exception as e:
                    current_app.logger.error(f"Error processing face {i}: {str(e)}")
                    unrecognized += 1
            
            processing_time = int((time.time() - start_time) * 1000)  # ms
            
            return {
                "recognized": recognized,
                "unrecognized_count": unrecognized,
                "unrecognized_faces": unrecognized_faces,
                "processing_time_ms": processing_time,
                "total_faces": len(faces)
            }
        
        except Exception as e:
            current_app.logger.error(f"Unexpected error in face processing: {str(e)}")
            return {
                "recognized": [],
                "unrecognized_count": 0,
                "unrecognized_faces": [],
                "processing_time_ms": int((time.time() - start_time) * 1000),
                "error": True,
                "error_message": f"Unexpected error: {str(e)}"
            }