import unittest
from datetime import datetime, timedelta
from app import create_app, db
from app.models.student import Student
from app.models.group import Group
from app.models.camera_event import CameraEvent
from app.services.camera_event_service import CameraEventService
import pytz
import threading
import time

class TestCameraEventService(unittest.TestCase):
    def setUp(self):
        self.app = create_app('test')
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()
        
        # Create test group
        self.group = Group(name='Test Group', description='Test group for camera events')
        db.session.add(self.group)
        db.session.commit()
        
        # Create test students
        self.student1 = Student(student_id='1234567890', name='Test Student 1', group_id=self.group.id)
        self.student2 = Student(student_id='0987654321', name='Test Student 2', group_id=self.group.id)
        db.session.add_all([self.student1, self.student2])
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_event_alternation(self):
        """Test that events alternate between in and out correctly"""
        # First event should be 'in'
        event_type1, event1 = CameraEventService.process_camera_detection(self.student1.student_id)
        self.assertEqual(event_type1, 'in')
        self.assertEqual(event1.event_type, 'in')
        
        # Second event should be 'out'
        event_type2, event2 = CameraEventService.process_camera_detection(self.student1.student_id)
        self.assertEqual(event_type2, 'out')
        self.assertEqual(event2.event_type, 'out')
        
        # Third event should be 'in' again
        event_type3, event3 = CameraEventService.process_camera_detection(self.student1.student_id)
        self.assertEqual(event_type3, 'in')
        self.assertEqual(event3.event_type, 'in')

    def test_debounce(self):
        """Test that events are debounced correctly"""
        # Set a short debounce window for testing
        self.app.config['EVENT_DEBOUNCE_SECONDS'] = 2
        
        # First event should be 'in'
        event_type1, event1 = CameraEventService.process_camera_detection(self.student1.student_id)
        self.assertEqual(event_type1, 'in')
        
        # Immediate second event should be debounced
        event_type2, event2 = CameraEventService.process_camera_detection(self.student1.student_id)
        self.assertEqual(event_type2, 'debounced')
        self.assertEqual(event2.id, event1.id)  # Should return the first event
        
        # Wait for the debounce window to pass
        time.sleep(3)
        
        # Now the event should go through as 'out'
        event_type3, event3 = CameraEventService.process_camera_detection(self.student1.student_id)
        self.assertEqual(event_type3, 'out')
        self.assertNotEqual(event3.id, event1.id)

    def test_day_boundaries(self):
        """Test that events are correctly grouped by local date"""
        # Create events with different timestamps
        now_ist = datetime.now(pytz.timezone('Asia/Kolkata'))
        yesterday_ist = now_ist - timedelta(days=1)
        tomorrow_ist = now_ist + timedelta(days=1)
        
        # Convert to UTC for storage
        now_utc = now_ist.astimezone(pytz.UTC)
        yesterday_utc = yesterday_ist.astimezone(pytz.UTC)
        tomorrow_utc = tomorrow_ist.astimezone(pytz.UTC)
        
        # Create events with different dates
        event1 = CameraEvent(
            student_id=self.student1.student_id,
            timestamp=yesterday_utc,
            local_date=yesterday_ist.date(),
            event_type='in'
        )
        
        event2 = CameraEvent(
            student_id=self.student1.student_id,
            timestamp=now_utc,
            local_date=now_ist.date(),
            event_type='in'
        )
        
        event3 = CameraEvent(
            student_id=self.student1.student_id,
            timestamp=tomorrow_utc,
            local_date=tomorrow_ist.date(),
            event_type='in'
        )
        
        db.session.add_all([event1, event2, event3])
        db.session.commit()
        
        # Test events by date
        yesterday_events = CameraEventService.get_student_events_by_date(
            self.student1.student_id, yesterday_ist.date()
        )
        self.assertEqual(len(yesterday_events), 1)
        self.assertEqual(yesterday_events[0].id, event1.id)
        
        today_events = CameraEventService.get_student_events_by_date(
            self.student1.student_id, now_ist.date()
        )
        self.assertEqual(len(today_events), 1)
        self.assertEqual(today_events[0].id, event2.id)
        
        tomorrow_events = CameraEventService.get_student_events_by_date(
            self.student1.student_id, tomorrow_ist.date()
        )
        self.assertEqual(len(tomorrow_events), 1)
        self.assertEqual(tomorrow_events[0].id, event3.id)

    def test_concurrency(self):
        """Test that simultaneous detections preserve correct parity"""
        # We'll simulate multiple concurrent detections with threads
        self.detection_results = []
        self.concurrent_threads = 5
        
        def simulate_detection(student_id):
            try:
                event_type, event = CameraEventService.process_camera_detection(student_id)
                self.detection_results.append((event_type, event.id))
            except Exception as e:
                self.detection_results.append(('error', str(e)))
        
        # Start multiple threads
        threads = []
        for i in range(self.concurrent_threads):
            t = threading.Thread(target=simulate_detection, args=(self.student1.student_id,))
            threads.append(t)
            t.start()
        
        # Wait for all threads to finish
        for t in threads:
            t.join()
        
        # Check results
        self.assertEqual(len(self.detection_results), self.concurrent_threads)
        
        # Count each type of event
        in_events = 0
        out_events = 0
        debounced = 0
        errors = 0
        
        for event_type, event_id in self.detection_results:
            if event_type == 'in':
                in_events += 1
            elif event_type == 'out':
                out_events += 1
            elif event_type == 'debounced':
                debounced += 1
            else:
                errors += 1
        
        # Depending on timing, we should have either:
        # 1. One 'in' event and the rest debounced (if they all hit at the same time)
        # 2. Alternating 'in' and 'out' events (if they're spaced out enough)
        self.assertEqual(errors, 0, "There should be no errors")
        
        # At minimum, we should have either an in or out event
        self.assertGreater(in_events + out_events, 0)
        
        # If we got both in and out events, they should alternate correctly
        if in_events > 0 and out_events > 0:
            self.assertTrue(
                (in_events == 1 and out_events == 1) or
                (in_events == 1 and out_events == 2) or
                (in_events == 2 and out_events == 1),
                "Should have at most 1-2 in/out events in alternating order"
            )

    def test_event_pairs(self):
        """Test the pairing of in/out events"""
        # Create events in sequence
        event1 = CameraEvent(
            student_id=self.student1.student_id,
            timestamp=datetime.now(pytz.UTC) - timedelta(hours=3),
            local_date=datetime.now(pytz.timezone('Asia/Kolkata')).date(),
            event_type='in'
        )
        
        event2 = CameraEvent(
            student_id=self.student1.student_id,
            timestamp=datetime.now(pytz.UTC) - timedelta(hours=2),
            local_date=datetime.now(pytz.timezone('Asia/Kolkata')).date(),
            event_type='out'
        )
        
        event3 = CameraEvent(
            student_id=self.student1.student_id,
            timestamp=datetime.now(pytz.UTC) - timedelta(hours=1),
            local_date=datetime.now(pytz.timezone('Asia/Kolkata')).date(),
            event_type='in'
        )
        
        # No matching out event for event3 (simulating student still present)
        
        db.session.add_all([event1, event2, event3])
        db.session.commit()
        
        # Get event pairs
        pairs = CameraEventService.get_student_event_pairs_by_date(
            self.student1.student_id, 
            datetime.now(pytz.timezone('Asia/Kolkata')).date()
        )
        
        # Should have two pairs: (event1, event2) and (event3, None)
        self.assertEqual(len(pairs), 2)
        
        # First pair should be complete
        self.assertEqual(pairs[0][0].id, event1.id)
        self.assertEqual(pairs[0][1].id, event2.id)
        
        # Second pair should have an in event but no out event
        self.assertEqual(pairs[1][0].id, event3.id)
        self.assertIsNone(pairs[1][1])

if __name__ == '__main__':
    unittest.main()