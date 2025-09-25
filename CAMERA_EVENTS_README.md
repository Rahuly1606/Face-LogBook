# Camera Events In/Out Tracking Implementation

## Overview

This feature adds a detailed auditable event log for camera detections, recording each detection with timestamps and automatically determining whether it's an "in" or "out" event. The system ensures that events for a student on a given day alternate between "in" and "out" (1st, 3rd, 5th... detections are "in", while 2nd, 4th, 6th... are "out").

## Database Schema Changes

### New Table: `camera_events`

A new table `camera_events` has been added to store each individual camera detection:

```sql
CREATE TABLE camera_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_uuid VARCHAR(36) NOT NULL UNIQUE,
    student_id VARCHAR(50) NOT NULL,
    timestamp DATETIME NOT NULL,
    local_date DATE NOT NULL, -- Derived from timestamp in Asia/Kolkata timezone
    event_type VARCHAR(20) NOT NULL, -- 'in' or 'out'
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    modified_by VARCHAR(50) NULL,
    modification_reason VARCHAR(255) NULL,
    FOREIGN KEY (student_id) REFERENCES students(student_id)
);
```

### Indexes

```sql
CREATE INDEX idx_student_local_date ON camera_events(student_id, local_date);
CREATE INDEX idx_timestamp ON camera_events(timestamp);
CREATE INDEX idx_local_date ON camera_events(local_date);
```

## Backend Implementation

### New API Endpoints

1. **GET /api/v1/camera-events/student/:student_id/date/:date**
   - Returns all camera events for a student on a specific date
   - Sorted chronologically
   - Response includes event type, timestamp, etc.

2. **GET /api/v1/camera-events/student/:student_id/date/:date/pairs**
   - Returns in/out event pairs for a student on a specific date
   - Pairs are presented as `[in_event, out_event]` with `null` for missing out events
   - Response includes full details for each event

3. **POST /api/v1/camera-events/event**
   - Create a new camera event (admin function for corrections)
   - Request body includes student_id, timestamp, event_type, etc.

4. **DELETE /api/v1/camera-events/event/:event_id**
   - Delete a camera event (admin function for corrections)
   - Request body can include reason and user information for audit trail

### Camera Event Service

The `CameraEventService` handles:
- Recording new camera detections with proper event type determination
- Using database locking to prevent race conditions (ensuring alternation)
- Implementing a configurable debounce window to prevent duplicate detections
- Grouping events by local date (Asia/Kolkata timezone) for consistent day boundaries
- Returning events as chronological pairs for UI display

### Integration with Attendance Service

The `AttendanceService.process_attendance()` method has been updated to:
1. Record the camera detection as an event (in/out)
2. Continue with the existing attendance logic (marking students present/absent)

## Frontend Implementation

### New Components

1. **EventLogModal**
   - Displays in/out event pairs and raw events in a tabbed interface
   - Shows duration between paired events
   - Supports viewing both paired and raw event data

2. **AttendanceTable** (Updated)
   - Added "View In/Out" button in the actions column
   - Opens the EventLogModal when clicked

### New API Client

Added `camera-events.ts` with functions for:
- `getStudentEvents`: Fetch all events for a student on a date
- `getStudentEventPairs`: Fetch in/out event pairs for a student on a date
- `createEvent` and `deleteEvent`: Admin functions for corrections

## Configuration

A new environment variable `EVENT_DEBOUNCE_SECONDS` controls the debounce window (default: 30 seconds).

## Testing

Tests have been added for:
- Event alternation logic (in/out pairing)
- Debounce functionality
- Day boundary handling
- Concurrency safety (prevent race conditions)
- Pair formation from raw events

## Migration Plan

To deploy this feature:

1. Run the migration script to add the new table and indexes
2. Update the config to include the EVENT_DEBOUNCE_SECONDS parameter
3. Deploy updated code
4. No data backfill is required as this is a new feature that will start collecting events going forward