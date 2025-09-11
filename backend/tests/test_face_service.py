import unittest
import os
import cv2
import numpy as np
from app import create_app, db
from app.models.student import Student
from app.services.face_service import FaceService

class FaceServiceTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app('test')
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()
        self.client = self.app.test_client()
        self.face_service = FaceService()
        self.face_service.initialize()
        
    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()
    
    def test_detect_and_embed_face(self):
        # Load a test image
        test_image_path = os.path.join(os.path.dirname(__file__), 'test_data/sample_face.jpg')
        if not os.path.exists(test_image_path):
            self.skipTest("Test image not found")
        
        img = cv2.imread(test_image_path)
        bbox, embedding = self.face_service.detect_and_embed_face(img)
        
        # Assert that face was detected
        self.assertIsNotNone(bbox)
        self.assertIsNotNone(embedding)
        
        # Check embedding dimensions
        self.assertEqual(embedding.shape[0], 512)
    
    def test_match_face(self):
        # Create a test student with known embedding
        embedding = np.random.rand(512).astype(np.float32)
        student = Student(student_id="test123", name="Test Student")
        student.set_embedding(embedding)
        db.session.add(student)
        db.session.commit()
        
        # Test with exact same embedding (should match perfectly)
        matched_student, score = self.face_service.match_face(embedding)
        self.assertIsNotNone(matched_student)
        self.assertEqual(matched_student.student_id, "test123")
        self.assertAlmostEqual(score, 1.0, places=5)
        
        # Test with different embedding (should not match)
        different_embedding = np.random.rand(512).astype(np.float32)
        matched_student, score = self.face_service.match_face(different_embedding, threshold=0.99)
        self.assertIsNone(matched_student)
        
if __name__ == '__main__':
    unittest.main()