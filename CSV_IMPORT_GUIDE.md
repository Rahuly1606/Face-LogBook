# CSV Bulk Import Feature

This guide explains how to use the CSV bulk import feature to efficiently add multiple students to a group.

## Preparing Your CSV File

1. Create a CSV file with the following columns:
   - `student_id` - The unique identifier for each student
   - `name` - The full name of the student
   - `drive_link` - A Google Drive link to the student's photo

Example CSV format:
```
student_id,name,drive_link
2300001001,John Smith,https://drive.google.com/file/d/1Abc123XYZ/view?usp=sharing
2300001002,Jane Doe,https://drive.google.com/open?id=1Def456UVW
```

## Google Drive Sharing Requirements

For the system to access photos from Google Drive:

1. Make sure the Google Drive files are shared with the service account email: 
   (Please ask your administrator for the specific service account email)

2. The sharing permissions should be set to "Viewer" or higher

3. Supported Google Drive link formats:
   - `https://drive.google.com/file/d/{fileId}/view`
   - `https://drive.google.com/open?id={fileId}`
   - `https://docs.google.com/file/d/{fileId}/edit`
   - `https://drive.google.com/drive/folders/{fileId}`

## Import Process

1. Navigate to the Students page for the desired group
2. Click the "Bulk Import" button
3. Upload your CSV file
4. Review the preview to ensure the data is correct
5. Click "Import Students" to begin the process
6. Review the import results

## Troubleshooting Import Failures

Common reasons for import failures:

1. **Invalid Student ID**: The student ID format is incorrect or already exists
2. **Missing or Invalid Google Drive Link**: The link is not properly formatted or the file is not accessible
3. **Face Detection Failed**: No face was detected in the provided image
4. **Multiple Faces Detected**: More than one face was detected in the image
5. **Network Error**: Unable to download the image from Google Drive

## Sample CSV File

A sample CSV file (`sample_bulk_import.csv`) is provided in the root directory of this project for testing purposes.