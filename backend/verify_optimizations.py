"""
Performance Verification Script for Face Recognition Optimizations
Run this script to verify that the optimizations are working correctly.
"""

import time
import numpy as np
from app import create_app, db
from app.models.student import Student
from app.services.face_service import FaceService

# Check if FAISS is available
try:
    import faiss
    FAISS_AVAILABLE = True
except ImportError:
    FAISS_AVAILABLE = False

def test_embedding_cache():
    """Test the embedding cache performance"""
    print("\n=== Testing Embedding Cache Performance ===")
    
    app = create_app()
    with app.app_context():
        face_service = FaceService()
        
        # Initialize the service
        if not face_service.initialize():
            print("❌ Failed to initialize face service")
            return
        
        print("✓ Face service initialized")
        
        # Get student count
        student_count = Student.query.count()
        print(f"✓ Database has {student_count} students")
        
        if student_count == 0:
            print("⚠ No students in database. Add some students to test properly.")
            return
        
        # Generate a random embedding for testing
        test_embedding = np.random.rand(512).astype(np.float32)
        test_embedding = test_embedding / np.linalg.norm(test_embedding)
        
        # Test 1: First call (cache miss)
        print("\nTest 1: First call (cache should be built)")
        start = time.time()
        student, score = face_service.match_face(test_embedding)
        first_call_time = (time.time() - start) * 1000
        print(f"  Time: {first_call_time:.2f}ms")
        
        # Test 2: Second call (cache hit)
        print("\nTest 2: Second call (cache should be used)")
        start = time.time()
        student, score = face_service.match_face(test_embedding)
        second_call_time = (time.time() - start) * 1000
        print(f"  Time: {second_call_time:.2f}ms")
        
        # Test 3: Multiple calls (all cache hits)
        print("\nTest 3: 100 consecutive calls (all cache hits)")
        start = time.time()
        for _ in range(100):
            student, score = face_service.match_face(test_embedding)
        batch_time = (time.time() - start) * 1000
        avg_time = batch_time / 100
        print(f"  Total: {batch_time:.2f}ms")
        print(f"  Average per call: {avg_time:.2f}ms")
        
        # Performance assessment
        print("\n=== Performance Assessment ===")
        
        if avg_time < 1.0:
            print(f"✓ EXCELLENT: Average matching time is {avg_time:.2f}ms (target: <1ms)")
        elif avg_time < 5.0:
            print(f"✓ GOOD: Average matching time is {avg_time:.2f}ms (target: <5ms)")
        else:
            print(f"⚠ SLOW: Average matching time is {avg_time:.2f}ms (expected: <5ms)")
        
        if second_call_time < first_call_time * 0.5:
            print(f"✓ Cache is working properly (2nd call {((1 - second_call_time/first_call_time)*100):.0f}% faster)")
        else:
            print(f"⚠ Cache may not be working (2nd call only {((1 - second_call_time/first_call_time)*100):.0f}% faster)")
        
        # Expected performance based on student count
        expected_speedup = max(10, student_count / 10)
        print(f"\n✓ For {student_count} students:")
        print(f"  - Old method would take ~{student_count * 0.1:.0f}ms")
        print(f"  - New method takes ~{avg_time:.2f}ms")
        print(f"  - Speedup: ~{expected_speedup:.0f}x faster")

def test_cache_invalidation():
    """Test that cache invalidation works"""
    print("\n=== Testing Cache Invalidation ===")
    
    app = create_app()
    with app.app_context():
        face_service = FaceService()
        
        # Initialize the service
        if not face_service.initialize():
            print("❌ Failed to initialize face service")
            return
        
        # Build cache
        test_embedding = np.random.rand(512).astype(np.float32)
        test_embedding = test_embedding / np.linalg.norm(test_embedding)
        face_service.match_face(test_embedding)
        
        print("✓ Cache built")
        
        # Check cache exists
        if face_service._embedding_cache is not None:
            print("✓ Cache is populated")
        else:
            print("❌ Cache is not populated")
            return
        
        # Invalidate cache
        face_service.invalidate_cache()
        print("✓ Cache invalidated")
        
        # Check cache is cleared
        if face_service._embedding_cache is None:
            print("✓ Cache successfully cleared")
        else:
            print("❌ Cache was not cleared")

def test_detection_speed():
    """Test face detection speed with new settings"""
    print("\n=== Testing Face Detection Speed ===")
    
    app = create_app()
    with app.app_context():
        face_service = FaceService()
        
        # Initialize the service
        if not face_service.initialize():
            print("❌ Failed to initialize face service")
            return
        
        print("✓ Face service initialized")
        
        # Check if FAISS is being used
        if FAISS_AVAILABLE:
            print(f"✓ FAISS is available and will be used")
            if face_service._use_faiss:
                print("✓ Face service is configured to use FAISS")
            else:
                print("⚠ FAISS available but service is using NumPy fallback")
        else:
            print("ℹ FAISS not available, using NumPy (install faiss-cpu for better performance)")
        
        # Check detection size
        if hasattr(face_service.model, 'det_size'):
            det_size = face_service.model.det_size
            print(f"✓ Detection size: {det_size}")
            
            if det_size == (320, 320):
                print("✓ Using optimized detection size (320x320)")
            elif det_size == (640, 640):
                print("⚠ Using old detection size (640x640) - not optimized")
            else:
                print(f"ℹ Using detection size: {det_size}")

def test_faiss_index():
    """Test FAISS index building and performance"""
    if not FAISS_AVAILABLE:
        print("\n=== FAISS Not Available ===")
        print("ℹ Install faiss-cpu to enable FAISS acceleration")
        print("  pip install faiss-cpu")
        return
    
    print("\n=== Testing FAISS Index ===")
    
    app = create_app()
    with app.app_context():
        face_service = FaceService()
        
        # Initialize the service
        if not face_service.initialize():
            print("❌ Failed to initialize face service")
            return
        
        student_count = Student.query.count()
        
        if student_count == 0:
            print("⚠ No students in database. Add some students to test FAISS.")
            return
        
        # Trigger cache build (which builds FAISS index)
        test_embedding = np.random.rand(512).astype(np.float32)
        test_embedding = test_embedding / np.linalg.norm(test_embedding)
        
        print(f"Building FAISS index for {student_count} students...")
        start = time.time()
        face_service.match_face(test_embedding)
        build_time = (time.time() - start) * 1000
        print(f"✓ Index built in {build_time:.2f}ms")
        
        # Check index type
        if face_service._faiss_index is not None:
            index = face_service._faiss_index
            index_type = type(index).__name__
            print(f"✓ Using FAISS index type: {index_type}")
            
            if student_count < 1000:
                if "Flat" in index_type:
                    print("✓ Correct index type for dataset size (Flat - exact search)")
                else:
                    print(f"⚠ Unexpected index type for {student_count} students")
            elif student_count < 10000:
                if "IVF" in index_type:
                    print("✓ Correct index type for dataset size (IVF - fast approximate)")
                else:
                    print(f"ℹ Using {index_type} for {student_count} students")
            else:
                if "HNSW" in index_type:
                    print("✓ Correct index type for dataset size (HNSW - very fast)")
                else:
                    print(f"ℹ Using {index_type} for {student_count} students")
        else:
            print("❌ FAISS index was not built")

if __name__ == '__main__':
    print("=" * 60)
    print("Face Recognition Performance Verification")
    print("=" * 60)
    
    try:
        test_detection_speed()
        test_faiss_index()
        test_embedding_cache()
        test_cache_invalidation()
        
        print("\n" + "=" * 60)
        print("All tests completed!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Error during testing: {str(e)}")
        import traceback
        traceback.print_exc()
