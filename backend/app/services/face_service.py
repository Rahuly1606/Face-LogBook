import os
import base64  # noqa: F401  (kept for potential external use)
import threading
import uuid
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
            cls._instance._lock = threading.Lock()
            cls._instance._recent_recognitions = {}  # student_id -> last-seen timestamp (spam guard)
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
            
            current_app.logger.info(f"Initializing face model with path: {model_path}, backend: {detector_backend}")
            
            # Check if model path exists
            if not os.path.exists(model_path):
                current_app.logger.error(f"Model path does not exist: {model_path}")
                # Try to create the directory
                try:
                    os.makedirs(model_path, exist_ok=True)
                    current_app.logger.info(f"Created model directory: {model_path}")
                except Exception as e:
                    current_app.logger.error(f"Failed to create model directory: {str(e)}")
            
            try:
                # Try to initialize the face model with optimized detection size
                self.model = FaceAnalysis(
                    name=detector_backend, 
                    root=model_path, 
                    providers=['CPUExecutionProvider'],
                    allowed_modules=['detection', 'recognition']  # Only load what we need
                )
                # Optimized detection size: smaller = faster, but still accurate
                # 256x256 is a good balance between speed and accuracy
                self.model.prepare(ctx_id=0, det_size=(320, 320), det_thresh=0.45)
                self.initialized = True
                current_app.logger.info("Face recognition model successfully initialized with optimized settings")
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
        """Get cached student embeddings or rebuild cache if expired (thread-safe)."""
        current_time = time.time()

        # Fast path — read without acquiring the lock
        if self._embedding_cache is not None and (current_time - self._cache_timestamp) < self._cache_ttl:
            return self._embedding_cache

        with self._lock:
            # Double-checked: another thread may have rebuilt while we waited
            current_time = time.time()
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
            # Store plain student_id strings — NOT ORM objects.
            # ORM objects become detached after the session closes (end of the
            # request that built the cache), causing "Instance not bound to Session"
            # errors on every subsequent request that hits the still-valid cache.
            student_id_list = []

            for student in students:
                stored_embedding = student.get_embedding()
                if stored_embedding is not None:
                    embeddings_list.append(stored_embedding)
                    student_id_list.append(student.student_id)  # plain string, session-independent

            # Convert to numpy; L2-normalise so inner product == cosine similarity
            if embeddings_list:
                embeddings_matrix = np.vstack(embeddings_list).astype('float32')
                norms = np.linalg.norm(embeddings_matrix, axis=1, keepdims=True)
                norms = np.where(norms == 0, 1.0, norms)  # guard against zero-norm rows
                embeddings_matrix = (embeddings_matrix / norms).astype('float32')
                self._embedding_cache = (embeddings_matrix, student_id_list)

                # Build FAISS index if available
                if self._use_faiss and len(embeddings_list) > 0:
                    self._build_faiss_index(embeddings_matrix, student_id_list)
            else:
                self._embedding_cache = ([], [])
                if self._use_faiss:
                    self._faiss_index = None
                    self._faiss_student_list = None

            self._cache_timestamp = current_time

            if self._use_faiss:
                current_app.logger.info(f"Rebuilt FAISS index with {len(student_id_list)} students")
            else:
                current_app.logger.info(f"Rebuilt embedding cache with {len(student_id_list)} students (NumPy)")

            return self._embedding_cache

    def _build_faiss_index(self, embeddings_matrix, student_id_list):
        """Build FAISS index for fast similarity search - optimized for speed"""
        try:
            n_embeddings, dim = embeddings_matrix.shape
            
            # Choose index type based on dataset size - optimized for speed
            if n_embeddings < 500:
                # For small datasets, use exact search (Flat index) - fastest
                index = faiss.IndexFlatIP(dim)  # Inner Product (cosine similarity for normalized vectors)
                current_app.logger.info(f"Using FAISS Flat index for {n_embeddings} students")
            elif n_embeddings < 5000:
                # For medium datasets, use IVF (Inverted File Index) - balanced speed/accuracy
                nlist = min(50, max(10, n_embeddings // 20))  # Fewer clusters = faster search
                quantizer = faiss.IndexFlatIP(dim)
                index = faiss.IndexIVFFlat(quantizer, dim, nlist, faiss.METRIC_INNER_PRODUCT)
                index.train(embeddings_matrix)
                current_app.logger.info(f"Using FAISS IVF index with {nlist} clusters for {n_embeddings} students")
            else:
                # For large datasets, use HNSW (Hierarchical Navigable Small World) - fast approximate search
                index = faiss.IndexHNSWFlat(dim, 16, faiss.METRIC_INNER_PRODUCT)  # Reduced M from 32 to 16 for speed
                current_app.logger.info(f"Using FAISS HNSW index for {n_embeddings} students")
            
            # Add embeddings to index (embeddings should already be normalized)
            index.add(embeddings_matrix)
            
            # Optimize search parameters for speed
            if isinstance(index, faiss.IndexIVFFlat):
                index.nprobe = min(5, nlist)  # Reduced from 10 to 5 for faster search
            elif isinstance(index, faiss.IndexHNSWFlat):
                index.hnsw.efSearch = 16  # Lower = faster (default is 16, but being explicit)
            
            self._faiss_index = index
            # Store plain student_id strings (not ORM objects) so the index
            # is session-independent and safe across requests.
            self._faiss_student_list = student_id_list
            
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
                # _faiss_student_list holds plain student_id strings — no ORM access needed
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
            # student_list holds plain student_id strings — no ORM access needed
            return student_list[best_idx], float(best_score)
        return None, float(best_score)
    
    @staticmethod
    def _get_confidence_tier(score: float) -> str:
        """Return a human-readable confidence tier for a recognition score."""
        if score >= 0.80:
            return "high"
        elif score >= 0.65:
            return "medium"
        else:
            return "low"

    def _is_spamming(self, student_id: str) -> bool:
        """Return True if this student was recognised within the spam window."""
        spam_window = current_app.config.get('RECOGNITION_SPAM_WINDOW', 8)
        last_seen = self._recent_recognitions.get(student_id, 0)
        return (time.time() - last_seen) < spam_window

    def _mark_recognized(self, student_id: str):
        """Record the recognition time for spam detection; prune old entries."""
        now = time.time()
        self._recent_recognitions[student_id] = now
        # Prune entries older than 5 min so the dict doesn't grow unboundedly
        cutoff = now - 300
        self._recent_recognitions = {
            k: v for k, v in self._recent_recognitions.items() if v > cutoff
        }

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
            
            # Aggressive image optimization for speed
            max_size = current_app.config.get('MAX_IMAGE_SIZE', 640)  # Reduced from 800 to 640
            h, w = img.shape[:2]
            
            # Always resize to a reasonable size for faster processing
            if max(h, w) > max_size:
                scale = max_size / max(h, w)
                new_w, new_h = int(w * scale), int(h * scale)
                # Use INTER_LINEAR for faster resizing (still good quality)
                img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
            
            # Additional optimization: reduce to 8-bit if not already
            if img.dtype != np.uint8:
                img = img.astype(np.uint8)
            
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
                    student_id, score = self.match_face(embedding, threshold)
                    
                    if student_id:
                        # Fetch student within this request's session (db.session.get is the non-deprecated API)
                        student = db.session.get(Student, student_id)
                        if student:
                            if self._is_spamming(student.student_id):
                                current_app.logger.debug(
                                    f"Spam guard: skipping duplicate recognition for {student.student_id}"
                                )
                            else:
                                self._mark_recognized(student.student_id)
                                recognized.append({
                                    "student_id": student.student_id,
                                    "name": student.name,
                                    "score": float(score),
                                    "confidence_tier": self._get_confidence_tier(float(score)),
                                    "bbox": bbox.tolist()
                                })
                        else:
                            current_app.logger.warning(f"Student {student_id} not found in database")
                            unrecognized += 1
                    else:
                        unrecognized += 1
                        # Crop the face and save to disk; return a URL instead of inline base64
                        image_url = None
                        try:
                            x1, y1, x2, y2 = bbox
                            pad = 20
                            h_img, w_img = img.shape[:2]
                            x1c = max(0, x1 - pad)
                            y1c = max(0, y1 - pad)
                            x2c = min(w_img, x2 + pad)
                            y2c = min(h_img, y2 + pad)
                            crop = img[y1c:y2c, x1c:x2c]  # BGR crop
                            upload_folder = current_app.config.get('UPLOAD_FOLDER', 'uploads')
                            unrecognized_dir = os.path.join(upload_folder, 'unrecognized')
                            os.makedirs(unrecognized_dir, exist_ok=True)
                            filename = f"unk_{uuid.uuid4().hex[:10]}.jpg"
                            filepath = os.path.join(unrecognized_dir, filename)
                            cv2.imwrite(filepath, crop, [cv2.IMWRITE_JPEG_QUALITY, 85])
                            image_url = f"/uploads/unrecognized/{filename}"
                        except Exception as _e:
                            current_app.logger.warning(f"Could not crop face {i}: {_e}")
                        unrecognized_faces.append({
                            "id": f"unknown_{i}",
                            "bbox": bbox.tolist(),
                            "score": float(score) if score else 0.0,
                            "image_url": image_url,
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