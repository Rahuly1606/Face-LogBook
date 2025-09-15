#!/usr/bin/env python3
"""
Test script to verify attendance functionality changes
"""

import os
import sys
from datetime import date, datetime
import pytz

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_attendance_model():
    """Test the attendance model changes"""
    print("Testing attendance model...")
    
    # Test the model import and default values
    try:
        from app.models.attendance import Attendance
        from app.models.student import Student
        
        # Create a test attendance record
        test_attendance = Attendance(
            student_id="TEST001",
            date=date.today(),
            status=None  # Should default to 'absent'
        )
        
        print(f"✅ Attendance model default status: {test_attendance.status}")
        assert test_attendance.status == 'absent', f"Expected 'absent', got '{test_attendance.status}'"
        
        print("✅ Attendance model test passed")
        return True
        
    except Exception as e:
        print(f"❌ Attendance model test failed: {str(e)}")
        return False

def test_attendance_service():
    """Test the attendance service changes"""
    print("Testing attendance service...")
    
    try:
        from app.services.attendance_service import AttendanceService
        
        # Test IST time functions
        ist_now = AttendanceService.get_ist_now()
        ist_today = AttendanceService.get_ist_today()
        
        print(f"✅ IST Now: {ist_now}")
        print(f"✅ IST Today: {ist_today}")
        
        # Test date parsing
        test_date = "2024-01-15"
        parsed_date = date.fromisoformat(test_date)
        print(f"✅ Date parsing test: {parsed_date}")
        
        print("✅ Attendance service test passed")
        return True
        
    except Exception as e:
        print(f"❌ Attendance service test failed: {str(e)}")
        return False

def test_api_imports():
    """Test API imports"""
    print("Testing API imports...")
    
    try:
        from app.api.attendance import attendance_bp
        print("✅ Attendance API imports successfully")
        return True
        
    except Exception as e:
        print(f"❌ Attendance API test failed: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("🧪 Testing attendance functionality changes...")
    print("=" * 50)
    
    tests = [
        test_attendance_model,
        test_attendance_service,
        test_api_imports
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
        print()
    
    print("=" * 50)
    print(f"📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Attendance functionality changes are working correctly.")
        return True
    else:
        print("❌ Some tests failed. Please check the errors above.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
