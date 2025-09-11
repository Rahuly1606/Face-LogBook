import unittest
import json
import io
import os
from app import create_app, db
from app.models.student import Student
from app.models.attendance import Attendance

class APITestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app('test')
        self.app.config['ADMIN_TOKEN'] = 'test_token'
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()
        self.client = self.app.test_client()
        
    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()
    
    def get_admin_headers(self):
        return {'X-ADMIN-TOKEN': 'test_token'}
    
    def test_health_endpoint(self):
        response = self.client.get('/api/v1/health')
        data = json.loads(response.data)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(data['status'], 'ok')
    
    def test_student_crud(self):
        # Create a test student
        student = Student(student_id="123", name="Test Student")
        db.session.add(student)
        db.session.commit()
        
        # Test get all students
        response = self.client.get(
            '/api/v1/students',
            headers=self.get_admin_headers()
        )
        data = json.loads(response.data)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(data['students']), 1)
        self.assertEqual(data['students'][0]['student_id'], "123")
        
        # Test get specific student
        response = self.client.get(
            '/api/v1/students/123',
            headers=self.get_admin_headers()
        )
        data = json.loads(response.data)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(data['student']['name'], "Test Student")
        
        # Test update student
        response = self.client.put(
            '/api/v1/students/123',
            data={'name': 'Updated Name'},
            headers=self.get_admin_headers()
        )
        data = json.loads(response.data)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(data['student']['name'], "Updated Name")
        
        # Test delete student
        response = self.client.delete(
            '/api/v1/students/123',
            headers=self.get_admin_headers()
        )
        self.assertEqual(response.status_code, 200)
        
        # Verify student is gone
        response = self.client.get(
            '/api/v1/students',
            headers=self.get_admin_headers()
        )
        data = json.loads(response.data)
        self.assertEqual(len(data['students']), 0)
    
    def test_unauthorized_access(self):
        # Try to access admin endpoint without token
        response = self.client.get('/api/v1/students')
        self.assertEqual(response.status_code, 401)
        
if __name__ == '__main__':
    unittest.main()