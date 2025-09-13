import os
import sys
import unittest
import json
import tempfile
import pickle
import numpy as np
from datetime import datetime, date, timedelta
from flask_jwt_extended import create_access_token

# Add the parent directory to the path so we can import the app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app, db
from app.models.group import Group
from app.models.student import Student
from app.models.attendance import Attendance

class TestAPI(unittest.TestCase):
    """Test case for the Flask API"""
    
    def setUp(self):
        """Set up test client and create temp database"""
        self.app = create_app('testing')
        self.app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        self.app.config['TESTING'] = True
        self.app.config['JWT_SECRET_KEY'] = 'test_jwt_secret'
        self.client = self.app.test_client()
        
        # Create the database
        with self.app.app_context():
            db.create_all()
    
    def tearDown(self):
        """Clean up after each test"""
        with self.app.app_context():
            db.session.remove()
            db.drop_all()
    
    def get_auth_token(self, role='admin'):
        """Helper to get a valid JWT token for tests"""
        with self.app.app_context():
            identity = 'testuser'
            expires_delta = timedelta(minutes=30)
            token = create_access_token(
                identity=identity,
                additional_claims={'role': role},
                expires_delta=expires_delta
            )
            return token
    
    def test_auth_login(self):
        """Test login endpoint"""
        # Test valid login
        response = self.client.post(
            '/api/v1/auth/login',
            json={'username': 'admin', 'password': 'password'}
        )
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 200)
        self.assertTrue(data['success'])
        self.assertTrue('access_token' in data)
        self.assertTrue('expires_at' in data)
        
        # Test invalid login
        response = self.client.post(
            '/api/v1/auth/login',
            json={'username': 'wrong', 'password': 'wrong'}
        )
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 401)
        self.assertFalse(data['success'])
    
    def test_jwt_protection(self):
        """Test that endpoints are protected by JWT"""
        # Try to access protected endpoint without token
        response = self.client.get('/api/v1/groups')
        self.assertEqual(response.status_code, 401)
        
        # Try with token
        token = self.get_auth_token()
        response = self.client.get(
            '/api/v1/groups',
            headers={'Authorization': f'Bearer {token}'}
        )
        self.assertEqual(response.status_code, 200)
    
    def test_group_crud(self):
        """Test create, read, delete operations for groups"""
        token = self.get_auth_token()
        
        # Create a group
        response = self.client.post(
            '/api/v1/groups',
            json={'name': 'Test Group'},
            headers={'Authorization': f'Bearer {token}'}
        )
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 201)
        self.assertTrue('id' in data)
        self.assertEqual(data['name'], 'Test Group')
        
        group_id = data['id']
        
        # Get the group
        response = self.client.get(
            f'/api/v1/groups/{group_id}',
            headers={'Authorization': f'Bearer {token}'}
        )
        data = json.loads(response.data)
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(data['group']['id'], group_id)
        
        # Delete the group
        response = self.client.delete(
            f'/api/v1/groups/{group_id}',
            headers={'Authorization': f'Bearer {token}'}
        )
        
        self.assertEqual(response.status_code, 200)
        
        # Verify it's gone
        response = self.client.get(
            f'/api/v1/groups/{group_id}',
            headers={'Authorization': f'Bearer {token}'}
        )
        self.assertEqual(response.status_code, 404)
    
    def test_student_with_group(self):
        """Test adding a student to a group"""
        token = self.get_auth_token()
        
        # Create a group first
        response = self.client.post(
            '/api/v1/groups',
            json={'name': 'Test Group'},
            headers={'Authorization': f'Bearer {token}'}
        )
        group_data = json.loads(response.data)
        group_id = group_data['id']
        
        # Create a temporary image file
        with tempfile.NamedTemporaryFile(suffix='.jpg') as temp_file:
            # Write a small test image to the file
            # This is a minimal valid JPEG file
            temp_file.write(bytes.fromhex('FFD8FFE000104A46494600010101004800480000FFDB004300080606070605080707070909080A0C140D0C0B0B0C1912130F141D1A1F1E1D1A1C1C20242E2720222C231C1C2837292C30313434341F27393D38323C2E333432FFDB0043010909090C0B0C180D0D1832211C213232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232FFC00011080001000103012200021101031101FFC4001F0000010501010101010100000000000000000102030405060708090A0BFFC400B5100002010303020403050504040000017D01020300041105122131410613516107227114328191A1082342B1C11552D1F02433627282090A161718191A25262728292A3435363738393A434445464748494A535455565758595A636465666768696A737475767778797A838485868788898A92939495969798999AA2A3A4A5A6A7A8A9AAB2B3B4B5B6B7B8B9BAC2C3C4C5C6C7C8C9CAD2D3D4D5D6D7D8D9DAE1E2E3E4E5E6E7E8E9EAF1F2F3F4F5F6F7F8F9FAFFC4001F0100030101010101010101010000000000000102030405060708090A0BFFC400B51100020102040403040705040400010277000102031104052131061241510761711322328108144291A1B1C109233352F0156272D10A162434E125F11718191A262728292A35363738393A434445464748494A535455565758595A636465666768696A737475767778797A82838485868788898A92939495969798999AA2A3A4A5A6A7A8A9AAB2B3B4B5B6B7B8B9BAC2C3C4C5C6C7C8C9CAD2D3D4D5D6D7D8D9DAE2E3E4E5E6E7E8E9EAF2F3F4F5F6F7F8F9FAFFDA000C03010002110311003F00F7FA28A2803FFD9'))
            temp_file.flush()
            
            # Create a test embedding
            test_embedding = np.random.rand(512).astype(np.float32)
            test_embedding = test_embedding / np.linalg.norm(test_embedding)
            
            # Mock the face service to return our test embedding
            with self.app.app_context():
                from app.services.face_service import FaceService
                original_detect_and_embed_face = FaceService.detect_and_embed_face
                
                def mock_detect_and_embed_face(self, image_data):
                    return [0, 0, 100, 100], test_embedding
                
                FaceService.detect_and_embed_face = mock_detect_and_embed_face
                
                # Upload the student with the image
                with open(temp_file.name, 'rb') as image:
                    response = self.client.post(
                        f'/api/v1/groups/{group_id}/students',
                        data={
                            'student_id': 'S12345',
                            'name': 'Test Student',
                            'image': (image, 'test.jpg')
                        },
                        headers={'Authorization': f'Bearer {token}'},
                        content_type='multipart/form-data'
                    )
                
                # Restore the original method
                FaceService.detect_and_embed_face = original_detect_and_embed_face
            
            data = json.loads(response.data)
            
            self.assertEqual(response.status_code, 201)
            self.assertEqual(data['student_id'], 'S12345')
            self.assertEqual(data['group_id'], group_id)
            
            # Verify the student was added to the group
            with self.app.app_context():
                student = Student.query.get('S12345')
                self.assertIsNotNone(student)
                self.assertEqual(student.group_id, group_id)
                
                # Verify the embedding was saved and has the right format
                embedding = student.get_embedding()
                self.assertIsNotNone(embedding)
                self.assertEqual(embedding.shape, (512,))
                self.assertEqual(embedding.dtype, np.float32)
    
    def test_attendance_with_group(self):
        """Test attendance recording with group association"""
        with self.app.app_context():
            # Create a group
            group = Group(name='Test Group')
            db.session.add(group)
            db.session.commit()
            
            # Create a student in that group
            student = Student(
                student_id='S12345',
                name='Test Student',
                group_id=group.id,
                photo_path='test.jpg'
            )
            
            # Create a test embedding
            test_embedding = np.random.rand(512).astype(np.float32)
            test_embedding = test_embedding / np.linalg.norm(test_embedding)
            student.set_embedding(test_embedding)
            
            db.session.add(student)
            db.session.commit()
            
            # Get a token
            token = self.get_auth_token()
            
            # Mark attendance via API
            from app.services.face_service import FaceService
            original_process_image_for_attendance = FaceService.process_image_for_attendance
            
            def mock_process_image_for_attendance(self, image_data):
                return {
                    "recognized": [{
                        "student_id": "S12345",
                        "name": "Test Student",
                        "score": 0.95,
                        "bbox": [0, 0, 100, 100]
                    }],
                    "unrecognized_count": 0,
                    "processing_time_ms": 10
                }
            
            FaceService.process_image_for_attendance = mock_process_image_for_attendance
            
            # Generate a dummy image for the request
            with tempfile.NamedTemporaryFile(suffix='.jpg') as temp_file:
                temp_file.write(bytes.fromhex('FFD8FFE000104A46494600010101004800480000FFDB004300080606070605080707070909080A0C140D0C0B0B0C1912130F141D1A1F1E1D1A1C1C20242E2720222C231C1C2837292C30313434341F27393D38323C2E333432FFDB0043010909090C0B0C180D0D1832211C213232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232FFC00011080001000103012200021101031101FFC4001F0000010501010101010100000000000000000102030405060708090A0BFFC400B5100002010303020403050504040000017D01020300041105122131410613516107227114328191A1082342B1C11552D1F02433627282090A161718191A25262728292A3435363738393A434445464748494A535455565758595A636465666768696A737475767778797A838485868788898A92939495969798999AA2A3A4A5A6A7A8A9AAB2B3B4B5B6B7B8B9BAC2C3C4C5C6C7C8C9CAD2D3D4D5D6D7D8D9DAE1E2E3E4E5E6E7E8E9EAF1F2F3F4F5F6F7F8F9FAFFC4001F0100030101010101010101010000000000000102030405060708090A0BFFC400B51100020102040403040705040400010277000102031104052131061241510761711322328108144291A1B1C109233352F0156272D10A162434E125F11718191A262728292A35363738393A434445464748494A535455565758595A636465666768696A737475767778797A82838485868788898A92939495969798999AA2A3A4A5A6A7A8A9AAB2B3B4B5B6B7B8B9BAC2C3C4C5C6C7C8C9CAD2D3D4D5D6D7D8D9DAE2E3E4E5E6E7E8E9EAF2F3F4F5F6F7F8F9FAFFDA000C03010002110311003F00F7FA28A2803FFD9'))
                temp_file.flush()
                
                with open(temp_file.name, 'rb') as image:
                    response = self.client.post(
                        '/api/v1/attendance/upload',
                        data={'image': (image, 'test.jpg')},
                        headers={'Authorization': f'Bearer {token}'},
                        content_type='multipart/form-data'
                    )
            
            # Restore the original method
            FaceService.process_image_for_attendance = original_process_image_for_attendance
            
            data = json.loads(response.data)
            
            self.assertEqual(response.status_code, 200)
            self.assertEqual(len(data['recognized']), 1)
            self.assertEqual(data['recognized'][0]['student_id'], 'S12345')
            self.assertEqual(data['recognized'][0]['action'], 'checkin')
            
            # Verify attendance record was created with group_id
            attendance = Attendance.query.filter_by(student_id='S12345').first()
            self.assertIsNotNone(attendance)
            self.assertEqual(attendance.group_id, group.id)
            self.assertEqual(attendance.status, 'present')
            self.assertIsNotNone(attendance.in_time)

if __name__ == '__main__':
    unittest.main()