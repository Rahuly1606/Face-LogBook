import unittest
import json
import io
import os
import tempfile
from app import create_app, db
from app.models.student import Student
from app.models.group import Group

class CSVBulkImportTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app('test')
        self.app.config['ADMIN_TOKEN'] = 'test_token'
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()
        self.client = self.app.test_client()
        
        # Create a test group
        self.test_group = Group(name="Test Group")
        db.session.add(self.test_group)
        db.session.commit()
        
    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()
    
    def get_admin_headers(self):
        return {'X-ADMIN-TOKEN': 'test_token'}
    
    def test_bulk_import_csv_validation(self):
        """Test CSV validation during bulk import"""
        # Invalid CSV (missing required columns)
        csv_content = "student_id,name\n123456,John Doe"
        csv_file = io.BytesIO(csv_content.encode('utf-8'))
        
        response = self.client.post(
            f'/api/v1/groups/{self.test_group.id}/students/bulk',
            data={'file': (csv_file, 'test.csv')},
            headers=self.get_admin_headers(),
            content_type='multipart/form-data'
        )
        
        data = json.loads(response.data)
        self.assertEqual(response.status_code, 400)
        self.assertIn('Missing required column', data.get('message', ''))
        
        # Valid CSV format
        csv_content = "student_id,name,drive_link\n123456,John Doe,https://drive.google.com/file/d/1abc123/view"
        csv_file = io.BytesIO(csv_content.encode('utf-8'))
        
        response = self.client.post(
            f'/api/v1/groups/{self.test_group.id}/students/bulk',
            data={'file': (csv_file, 'test.csv')},
            headers=self.get_admin_headers(),
            content_type='multipart/form-data'
        )
        
        # The response should include failures since the drive link is not real
        # but the CSV format validation should pass
        data = json.loads(response.data)
        self.assertEqual(response.status_code, 200)
        self.assertIn('failures', data)
    
    def test_drive_link_parsing(self):
        """Test different Google Drive link formats"""
        from app.services.drive_service import extract_drive_file_id
        
        # Test different link formats
        test_links = [
            ('https://drive.google.com/file/d/1abc123/view', '1abc123'),
            ('https://drive.google.com/open?id=1def456', '1def456'),
            ('https://docs.google.com/file/d/1ghi789/edit', '1ghi789'),
            ('https://drive.google.com/drive/folders/1jkl012', '1jkl012'),
            ('https://drive.google.com/uc?export=view&id=1mno345', '1mno345'),
        ]
        
        for link, expected_id in test_links:
            extracted_id = extract_drive_file_id(link)
            self.assertEqual(extracted_id, expected_id, f"Failed to extract ID from {link}")
    
    def test_bulk_import_results(self):
        """Test bulk import result structure"""
        # Mock CSV with some valid and some invalid entries
        csv_content = """student_id,name,drive_link
123456,John Doe,https://drive.google.com/file/d/invalid/view
654321,Jane Smith,https://drive.google.com/file/d/invalid2/view
"""
        csv_file = io.BytesIO(csv_content.encode('utf-8'))
        
        response = self.client.post(
            f'/api/v1/groups/{self.test_group.id}/students/bulk',
            data={'file': (csv_file, 'test.csv')},
            headers=self.get_admin_headers(),
            content_type='multipart/form-data'
        )
        
        data = json.loads(response.data)
        self.assertEqual(response.status_code, 200)
        
        # Verify response structure
        self.assertIn('successes', data)
        self.assertIn('failures', data)
        self.assertTrue(isinstance(data['successes'], list))
        self.assertTrue(isinstance(data['failures'], list))
        
        # We expect failures due to invalid drive links
        self.assertEqual(len(data['failures']), 2)
        
        # Validate failure structure
        if data['failures']:
            failure = data['failures'][0]
            self.assertIn('row', failure)
            self.assertIn('student_id', failure)
            self.assertIn('reason_code', failure)
            self.assertIn('message', failure)

if __name__ == '__main__':
    unittest.main()