# Face Attendance App

A web application for managing student attendance with face recognition technology.

## Backend Setup

The backend uses Flask with SQLAlchemy, Flask-CORS, and InsightFace for face recognition.

### Environment Variables

- `FLASK_ENV`: Set to `development`, `testing`, or `production`
- `SECRET_KEY`: Secret key for the Flask app
- `ADMIN_TOKEN`: Token required for admin operations
- `DATABASE_URL`: Database connection string (SQLite by default)
- `UPLOAD_FOLDER`: Folder path for uploaded files
- `CORS_ORIGINS`: Comma-separated list of allowed origins for CORS

### Running the Backend

1. Install dependencies:
```bash
cd backend
pip install -r requirements.txt
```

2. Initialize the database:
```bash
flask db init
flask db migrate -m "Initial migration"
flask db upgrade
```

3. Run the server:
```bash
python run.py
```

The backend will be accessible at http://127.0.0.1:5000.

### Debug Checks

- Verify embedding storage:
```python
from app import create_app, Student
import pickle
app = create_app()
with app.app_context():
    student = Student.query.first()
    if student and student.embedding is not None:
        emb = pickle.loads(student.embedding)
        print(f"Embedding shape: {emb.shape}, type: {emb.dtype}")
```

## Frontend Setup

The frontend uses React with Vite, TypeScript, Axios, and Tailwind CSS.

### Environment Variables

Create a `.env` file in the frontend directory with:
```
VITE_API_ROOT=http://127.0.0.1:5000/api/v1
```

### Running the Frontend

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Run the development server:
```bash
npm run dev
```

The frontend will be accessible at http://localhost:5173.

## API Endpoints

### Students

- `POST /api/v1/students/register`: Register a new student with face recognition
- `GET /api/v1/students`: Get all students
- `GET /api/v1/students/<student_id>`: Get a single student
- `PUT /api/v1/students/<student_id>`: Update student details
- `DELETE /api/v1/students/<student_id>`: Delete a student

### Attendance

- `POST /api/v1/attendance/live`: Mark attendance using face recognition (single face)
- `POST /api/v1/attendance/upload`: Mark attendance for multiple students in a group photo
- `GET /api/v1/attendance`: Get attendance records

### Health Check

- `GET /api/v1/health`: Check the API health and model status

## Troubleshooting

### CORS Issues

If you encounter CORS errors:

1. Verify that the backend CORS settings include your frontend origin:
   - Backend CORS is configured to allow requests from:
     - http://localhost:8080
     - http://127.0.0.1:8080
     - http://localhost:5173
     - http://127.0.0.1:5173

2. Check the browser console for detailed error messages.

3. Ensure the frontend is using the correct API URL: `http://127.0.0.1:5000/api/v1`.

### File Upload Issues

If file uploads fail:

1. Check that the image is in JPEG or PNG format and under 5MB.
2. Ensure the student ID is unique.
3. Make sure the photo contains a clearly visible face.
4. Check that the admin token is being sent correctly in the X-ADMIN-TOKEN header.

### Database Issues

If students are not being saved properly:

1. Verify that the database migrations are up to date.
2. Check that the embedding is being properly extracted and serialized.
3. Ensure the database transaction is being properly committed.

## Example API Requests

### Register a Student

```bash
curl -X POST http://127.0.0.1:5000/api/v1/students/register \
  -H "X-ADMIN-TOKEN: YOUR_ADMIN_TOKEN" \
  -F "student_id=1001" \
  -F "name=John Doe" \
  -F "image=@/path/to/photo.jpg"
```

### Get Students

```bash
curl http://127.0.0.1:5000/api/v1/students
```

### Mark Attendance (Live)

```bash
curl -X POST http://127.0.0.1:5000/api/v1/attendance/live \
  -F "image=@/path/to/photo.jpg"
```