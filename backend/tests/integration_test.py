#!/usr/bin/env python

"""
Face-LogBook Integration Test Script

This script validates that the extended Face-LogBook functionality 
is working correctly by performing a series of API calls to test the flow:

1. Authentication with JWT
2. Creating a group
3. Adding a student via Google Drive
4. Bulk importing students from CSV
5. Processing attendance from a group photo
6. Verifying attendance records and embedding storage

Usage:
    python integration_test.py [--host HOST] [--admin-user USER] [--admin-pass PASS]

Requirements:
    - A running Face-LogBook backend server
    - Google Drive service account configured with access to test images
    - Test CSV file with student data
    - Test group photo with known faces
"""

import os
import sys
import argparse
import requests
import json
import time
import pandas as pd
from datetime import datetime

# Configuration
DEFAULT_HOST = "http://localhost:5000"
DEFAULT_ADMIN_USER = "admin"
DEFAULT_ADMIN_PASS = "password"

# Constants
API_PREFIX = "/api/v1"
TEST_GROUP_NAME = "Integration Test Group"
TEST_STUDENT_ID = "IT12345"
TEST_STUDENT_NAME = "Integration Test Student"
TEST_DRIVE_LINK = "https://drive.google.com/file/d/YOUR_TEST_IMAGE_ID/view?usp=sharing"  # Replace with actual test image
CSV_FILE_PATH = "test_students.csv"  # Replace with actual CSV path
GROUP_PHOTO_PATH = "test_group_photo.jpg"  # Replace with actual group photo path

class IntegrationTest:
    def __init__(self, host, admin_user, admin_pass):
        self.host = host
        self.admin_user = admin_user
        self.admin_pass = admin_pass
        self.token = None
        self.group_id = None
        self.student_ids = []
        self.successful_tests = 0
        self.total_tests = 0
    
    def run_all_tests(self):
        """Run all integration tests in sequence"""
        print("=== Face-LogBook Integration Test ===")
        print(f"Host: {self.host}")
        print(f"Time: {datetime.now().isoformat()}")
        print("=" * 40)
        
        try:
            self.test_auth()
            self.test_create_group()
            self.test_add_student_drive()
            self.test_bulk_import()
            self.test_attendance_upload()
            self.test_attendance_logs()
            self.test_debug_embedding()
            
            # Summary
            print("\n" + "=" * 40)
            print(f"TESTS PASSED: {self.successful_tests}/{self.total_tests}")
            if self.successful_tests == self.total_tests:
                print("✅ ALL TESTS PASSED")
                return 0
            else:
                print("❌ SOME TESTS FAILED")
                return 1
        except Exception as e:
            print(f"\n❌ ERROR: {str(e)}")
            return 1
    
    def assert_equals(self, actual, expected, message):
        """Assert that two values are equal"""
        self.total_tests += 1
        if actual == expected:
            print(f"✅ {message}")
            self.successful_tests += 1
        else:
            print(f"❌ {message} - Expected {expected}, got {actual}")
    
    def assert_true(self, condition, message):
        """Assert that a condition is true"""
        self.total_tests += 1
        if condition:
            print(f"✅ {message}")
            self.successful_tests += 1
        else:
            print(f"❌ {message}")
    
    def test_auth(self):
        """Test authentication and JWT token acquisition"""
        print("\n📋 Testing Authentication...")
        
        # Login request
        response = requests.post(
            f"{self.host}{API_PREFIX}/auth/login",
            json={"username": self.admin_user, "password": self.admin_pass}
        )
        
        self.assert_equals(response.status_code, 200, "Authentication request successful")
        
        data = response.json()
        self.assert_true("access_token" in data, "JWT token received")
        self.assert_true("expires_at" in data, "Token expiration time received")
        
        # Save token for later requests
        self.token = data["access_token"]
        
        # Test protected endpoint with token
        headers = {"Authorization": f"Bearer {self.token}"}
        response = requests.get(f"{self.host}{API_PREFIX}/groups", headers=headers)
        
        self.assert_equals(response.status_code, 200, "Protected endpoint accessible with JWT")
    
    def test_create_group(self):
        """Test creating a new group"""
        print("\n📋 Testing Group Creation...")
        
        headers = {"Authorization": f"Bearer {self.token}"}
        
        # Create a new group
        response = requests.post(
            f"{self.host}{API_PREFIX}/groups",
            json={"name": TEST_GROUP_NAME},
            headers=headers
        )
        
        self.assert_equals(response.status_code, 201, "Group created successfully")
        
        data = response.json()
        self.assert_true("id" in data, "Group ID returned")
        self.assert_equals(data["name"], TEST_GROUP_NAME, "Group name matches")
        
        # Save group ID for later
        self.group_id = data["id"]
        
        # Get group details
        response = requests.get(
            f"{self.host}{API_PREFIX}/groups/{self.group_id}",
            headers=headers
        )
        
        self.assert_equals(response.status_code, 200, "Group details retrieved")
    
    def test_add_student_drive(self):
        """Test adding a student with a Google Drive link"""
        print("\n📋 Testing Student Addition with Drive Link...")
        
        headers = {"Authorization": f"Bearer {self.token}"}
        
        # Skip this test if no valid drive link is provided
        if TEST_DRIVE_LINK == "https://drive.google.com/file/d/YOUR_TEST_IMAGE_ID/view?usp=sharing":
            print("⚠️ Skipping Drive link test - no valid drive link provided")
            return
        
        # Add a student with Drive link
        response = requests.post(
            f"{self.host}{API_PREFIX}/groups/{self.group_id}/students",
            data={
                "student_id": TEST_STUDENT_ID,
                "name": TEST_STUDENT_NAME,
                "drive_link": TEST_DRIVE_LINK
            },
            headers=headers
        )
        
        self.assert_equals(response.status_code, 201, "Student added successfully")
        
        data = response.json()
        self.assert_equals(data["student_id"], TEST_STUDENT_ID, "Student ID matches")
        self.assert_equals(data["name"], TEST_STUDENT_NAME, "Student name matches")
        
        # Save student ID
        self.student_ids.append(TEST_STUDENT_ID)
        
        # Get student details
        response = requests.get(
            f"{self.host}{API_PREFIX}/students/{TEST_STUDENT_ID}",
            headers=headers
        )
        
        self.assert_equals(response.status_code, 200, "Student details retrieved")
        
        data = response.json()
        self.assert_true("student" in data, "Student data returned")
        self.assert_equals(data["student"]["group_id"], self.group_id, "Student's group ID matches")
    
    def test_bulk_import(self):
        """Test bulk importing students from CSV"""
        print("\n📋 Testing Bulk Import...")
        
        headers = {"Authorization": f"Bearer {self.token}"}
        
        # Skip this test if CSV file doesn't exist
        if not os.path.exists(CSV_FILE_PATH):
            print(f"⚠️ Skipping bulk import test - file {CSV_FILE_PATH} not found")
            return
        
        # Upload CSV file
        with open(CSV_FILE_PATH, 'rb') as f:
            response = requests.post(
                f"{self.host}{API_PREFIX}/groups/{self.group_id}/students/bulk",
                files={"file": (os.path.basename(CSV_FILE_PATH), f)},
                headers=headers
            )
        
        self.assert_equals(response.status_code, 200, "Bulk import processed")
        
        data = response.json()
        self.assert_true("successes" in data, "Success list returned")
        self.assert_true("failures" in data, "Failures list returned")
        
        print(f"  - Successfully imported {len(data['successes'])} students")
        print(f"  - Failed to import {len(data['failures'])} students")
        
        # Add successful student IDs to our list
        for student in data["successes"]:
            self.student_ids.append(student["student_id"])
    
    def test_attendance_upload(self):
        """Test uploading a group photo for attendance"""
        print("\n📋 Testing Attendance Upload...")
        
        headers = {"Authorization": f"Bearer {self.token}"}
        
        # Skip this test if photo doesn't exist
        if not os.path.exists(GROUP_PHOTO_PATH):
            print(f"⚠️ Skipping attendance test - file {GROUP_PHOTO_PATH} not found")
            return
        
        # Upload group photo
        with open(GROUP_PHOTO_PATH, 'rb') as f:
            response = requests.post(
                f"{self.host}{API_PREFIX}/attendance/upload",
                files={"image": (os.path.basename(GROUP_PHOTO_PATH), f)},
                headers=headers
            )
        
        self.assert_equals(response.status_code, 200, "Attendance upload processed")
        
        data = response.json()
        self.assert_true("recognized" in data, "Recognized students returned")
        
        recognized_count = len(data["recognized"])
        print(f"  - Recognized {recognized_count} students in the photo")
        
        # Check if any of our test students were recognized
        recognized_test_students = [s for s in data["recognized"] if s["student_id"] in self.student_ids]
        self.assert_true(len(recognized_test_students) > 0, "At least one test student recognized")
    
    def test_attendance_logs(self):
        """Test retrieving attendance logs for a group"""
        print("\n📋 Testing Attendance Logs...")
        
        headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get attendance logs for the group
        response = requests.get(
            f"{self.host}{API_PREFIX}/attendance/logs/{self.group_id}",
            headers=headers
        )
        
        self.assert_equals(response.status_code, 200, "Attendance logs retrieved")
        
        data = response.json()
        self.assert_true("attendance" in data, "Attendance records returned")
        
        # Check if any records exist for our test students
        test_student_logs = [r for r in data["attendance"] if r["student_id"] in self.student_ids]
        self.assert_true(len(test_student_logs) > 0, "Attendance records found for test students")
    
    def test_debug_embedding(self):
        """Test the debug embedding endpoint"""
        print("\n📋 Testing Embedding Debug Endpoint...")
        
        headers = {"Authorization": f"Bearer {self.token}"}
        
        if not self.student_ids:
            print("⚠️ Skipping embedding test - no student IDs available")
            return
        
        # Get embedding details for the first test student
        student_id = self.student_ids[0]
        response = requests.get(
            f"{self.host}{API_PREFIX}/attendance/debug/embeddings/{student_id}",
            headers=headers
        )
        
        self.assert_equals(response.status_code, 200, "Embedding debug info retrieved")
        
        data = response.json()
        self.assert_true("exists" in data, "Embedding existence status returned")
        
        if data["exists"]:
            self.assert_true("shape" in data, "Embedding shape returned")
            self.assert_equals(data["shape"][0], 512, "Embedding has correct dimension")
            self.assert_equals(data["dtype"], "float32", "Embedding has correct dtype")

def create_test_csv():
    """Create a test CSV file for bulk import if it doesn't exist"""
    if os.path.exists(CSV_FILE_PATH):
        return
    
    print(f"Creating test CSV file at {CSV_FILE_PATH}")
    
    # Replace this with your actual test Drive links
    data = {
        "student_id": ["BULK001", "BULK002", "BULK003"],
        "name": ["Bulk Student 1", "Bulk Student 2", "Bulk Student 3"],
        "drive_link": [
            "https://drive.google.com/file/d/YOUR_TEST_IMAGE_ID1/view?usp=sharing",
            "https://drive.google.com/file/d/YOUR_TEST_IMAGE_ID2/view?usp=sharing",
            "https://drive.google.com/file/d/YOUR_TEST_IMAGE_ID3/view?usp=sharing"
        ]
    }
    
    df = pd.DataFrame(data)
    df.to_csv(CSV_FILE_PATH, index=False)

def main():
    parser = argparse.ArgumentParser(description="Face-LogBook Integration Test")
    parser.add_argument("--host", default=DEFAULT_HOST, help="Host URL for the backend server")
    parser.add_argument("--admin-user", default=DEFAULT_ADMIN_USER, help="Admin username")
    parser.add_argument("--admin-pass", default=DEFAULT_ADMIN_PASS, help="Admin password")
    args = parser.parse_args()
    
    # Create test data files
    create_test_csv()
    
    # Run tests
    test = IntegrationTest(args.host, args.admin_user, args.admin_pass)
    result = test.run_all_tests()
    
    sys.exit(result)

if __name__ == "__main__":
    main()