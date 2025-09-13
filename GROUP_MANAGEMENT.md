# Face LogBook - Group Management Feature

This feature enhances the Face LogBook system by implementing a group-based management system for students and attendance tracking.

## Overview

After logging in as an admin, you will be directed to the Groups page where you can:

1. View all groups/sections with student counts
2. Create new groups
3. Access group workspaces with five key functionalities

## Using the Groups Workspace

Each group workspace offers the following features:

### 1. Register Student

- Register students to the selected group using:
  - Direct photo upload (capture with webcam or upload file)
  - Google Drive link to student photo
- Required fields: Student ID, Full Name, and Photo/Drive Link
- System will automatically extract face embedding for recognition

### 2. Manage Students

- View all students in the selected group
- Edit student information (name and photo)
- Delete students
- All changes to student photos will automatically update the face embedding cache

### 3. Live Attendance

- Start/stop live webcam capture
- System recognizes students in real-time as they appear in the webcam frame
- Greeting toasts for recognized students
- Live list of recognized students with timestamps

### 4. Upload Attendance

- Upload a group photo containing multiple students
- System recognizes all students in the image and marks attendance
- View recognition results showing:
  - Number of recognized students
  - Number of unrecognized faces
  - Table of recognized students with their actions (check-in/check-out)

### 5. Attendance Logs

- View attendance records for the selected group
- Filter by date range
- Filter by student ID or name
- Export attendance data to CSV

## Bulk Import Instructions

To bulk import students:

1. Prepare a CSV file with the following columns:
   - `student_id`: Unique identifier for each student
   - `name`: Full name of the student
   - `drive_link`: Google Drive link to student photo

2. Ensure your Google Drive links are:
   - Publicly accessible or shared with the service account
   - Direct links to image files (JPG, PNG)

3. Use the API endpoint: `POST /api/v1/groups/{group_id}/students/bulk`

## Testing the Attendance Flow

### Live Attendance Testing

1. Register at least one student with a clear face photo
2. Go to the "Live Attendance" tab
3. Click "Start Capture"
4. Position a registered student's face in front of the webcam
5. System should recognize the student and display a welcome toast
6. The student should appear in the live attendance list

### Group Photo Testing

1. Register multiple students with clear face photos
2. Take a group photo containing some of these students
3. Go to the "Upload Attendance" tab
4. Upload the group photo
5. System should recognize registered students and mark attendance
6. Check the "Attendance Logs" tab to verify attendance records

## Technical Details

- Face recognition uses the existing ArcFace pipeline
- Google Drive integration uses the configured service account
- All student operations include automatic embedding cache updates
- Group-scoped endpoints ensure operations only affect the selected group