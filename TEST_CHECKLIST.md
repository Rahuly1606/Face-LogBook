# Group Management Test Checklist

Use this checklist to verify all group management functionality works correctly.

## Group Management

- [ ] Log in as admin
- [ ] Landing page shows all groups with correct student counts
- [ ] Create a new group successfully
- [ ] Delete a group successfully (with confirmation)
- [ ] Group list updates immediately after create/delete

## Group Workspace

- [ ] Click on a group opens group workspace
- [ ] Breadcrumb navigation back to groups list works
- [ ] All five tabs are visible and accessible

## Register Student

- [ ] Form validates required fields (student ID, name)
- [ ] Upload student photo works
- [ ] Google Drive link upload works (if available)
- [ ] Success message shown after registration
- [ ] Student appears in Manage Students tab after registration

## Manage Students

- [ ] All students in the group are displayed
- [ ] Edit student information works
- [ ] Delete student works (with confirmation)
- [ ] Changes update immediately in the UI

## CSV Bulk Import

- [ ] "Bulk Import" button visible and accessible from student management
- [ ] CSV file upload works
- [ ] Validation displays errors for invalid CSV formats
- [ ] Preview shows first few rows of the CSV
- [ ] Import process shows progress indication
- [ ] Results display shows successful and failed imports
- [ ] Successfully imported students appear in the student list
- [ ] Failed imports show detailed error messages
- [ ] Error messages for drive link issues are clear
- [ ] Can download a CSV template for bulk import
- [ ] Can download failed imports as a CSV file
- [ ] Different Google Drive link formats are supported
- [ ] After successful import, user is returned to student list
- [ ] Delete student works (with confirmation)
- [ ] Student list refreshes after edits/deletes

## Live Attendance

- [ ] Webcam activates correctly
- [ ] Start/Stop capture buttons work
- [ ] A registered student's face is recognized
- [ ] Welcome/Goodbye toast appears for recognized students
- [ ] Recognized students appear in the live list

## Upload Attendance

- [ ] Upload group photo interface works
- [ ] Photo preview displays correctly
- [ ] Processing status shown during recognition
- [ ] Recognition results display correctly:
  - [ ] Number of recognized students
  - [ ] Number of unrecognized faces
  - [ ] List of recognized students with actions

## Attendance Logs

- [ ] Attendance records for the group are displayed
- [ ] Date filtering works
- [ ] Student filtering works
- [ ] CSV export generates a valid file with correct data

## Bulk Import

- [ ] CSV/XLSX upload interface works
- [ ] Processing status shown during import
- [ ] Import report shows successes and failures
- [ ] Students from successful imports appear in Manage Students

## API Verification

- GET /api/v1/groups - Returns all groups with counts
- POST /api/v1/groups - Creates a new group
- DELETE /api/v1/groups/{group_id} - Deletes a group
- GET /api/v1/groups/{group_id}/students - Lists students for the group
- POST /api/v1/groups/{group_id}/students - Adds a student to the group
- POST /api/v1/groups/{group_id}/students/bulk - Bulk imports students to the group
- PUT /api/v1/students/{student_id} - Updates a student
- DELETE /api/v1/students/{student_id} - Deletes a student
- POST /api/v1/attendance/live - Processes live webcam frame
- POST /api/v1/attendance/upload - Processes group photo
- GET /api/v1/attendance/logs/{group_id} - Returns attendance logs for the group