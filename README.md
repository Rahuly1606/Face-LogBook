# Face-LogBook - Advanced Facial Recognition Attendance System

A comprehensive, full-stack web application for managing student attendance using cutting-edge facial recognition technology. This system allows administrators to register students with their photos, organize them into groups, take attendance using webcam or photo uploads, and maintain detailed attendance records.

![Face-LogBook Banner](https://img.shields.io/badge/Face--LogBook-Attendance%20System-blue)

## 🌟 Key Features

- **Advanced Face Recognition**: Accurately identify registered students using the InsightFace deep learning model
- **Multiple Face Detection**: Process multiple students in a single photo
- **Real-time Attendance**: Mark attendance with live webcam feed
- **Student Management**: Register, view, edit, and manage student profiles
- **Group Organization**: Create and manage logical student groups
- **Attendance Records**: View, filter, and export attendance logs by date and group
- **Google Drive Integration**: Import student photos directly from Google Drive links
- **CSV Bulk Import**: Add multiple students at once using CSV files
- **Secure Authentication**: JWT-based authentication for API endpoints

## 🛠️ Technology Stack

### Backend
- **Flask**: Python web framework
- **SQLAlchemy**: ORM for database interactions
- **InsightFace**: State-of-the-art facial recognition library
- **Flask-JWT-Extended**: Authentication with JSON Web Tokens
- **SQLite/MySQL**: Database options for storing data
- **Google Drive API**: Integration for importing photos

### Frontend
- **React**: Frontend library for building user interfaces
- **TypeScript**: Type-safe JavaScript for improved development
- **Tailwind CSS**: Utility-first CSS framework
- **Shadcn UI**: High-quality component library
- **Vite**: Fast, modern frontend build tool
- **Axios**: Promise-based HTTP client

## 📋 Prerequisites

Before installing Face-LogBook, ensure you have:

- **Python 3.9+**
- **Node.js 16+** (or **Bun**)
- **Git**
- **MySQL** (optional, SQLite works for testing)
- **Webcam** (for live attendance feature)
- **Google Cloud account** (optional, for Google Drive integration)

## 🚀 Installation Guide

### Step 1: Clone the Repository

```bash
git clone https://github.com/Rahuly1606/Face-LogBook.git
cd face_logbook
```

### Step 2: Backend Setup

#### Create Virtual Environment

```bash
# Navigate to backend directory
cd backend

# Windows
python -m venv venv
venv\Scripts\activate

# macOS/Linux
python -m venv venv
source venv/bin/activate
```

#### Install Python Dependencies

```bash
pip install -r requirements.txt
```

#### Download Face Recognition Model

The system requires InsightFace pre-trained models:

1. Download the `buffalo_l` model from [InsightFace Model Zoo](https://github.com/deepinsight/insightface/releases/tag/v0.7)
2. Create a directory: `backend/models/`
3. Extract the downloaded zip and place the entire `buffalo_l` folder inside the `models` directory

Your structure should look like:
```
backend/
├── models/
│   └── buffalo_l/
│       ├── 1k3d68.onnx
│       ├── 2d106det.onnx
│       ├── genderage.onnx
│       └── w600k_r50.onnx
```

#### Configure Environment

Create a `.env` file in the `backend` directory:

```env
# Flask Configuration
FLASK_APP=run.py
FLASK_ENV=development

# Security
SECRET_KEY=your_secret_key_here
JWT_SECRET_KEY=your_jwt_secret_key_here
JWT_ACCESS_TOKEN_EXPIRES=86400  # 24 hours

# Database Configuration
# SQLite (easier setup):
DEV_DATABASE_URL=sqlite:///attendance.db

# MySQL (recommended for production):
# DEV_DATABASE_URL=mysql+pymysql://username:password@localhost/face_logbook

# Face Recognition Settings
FACE_MATCH_THRESHOLD=0.60
FACE_DETECTOR_BACKEND=retinaface
FACE_MODEL_PATH=models

# Google Drive API (optional)
# GOOGLE_APPLICATION_CREDENTIALS=credentials/service_account.json
```

#### Setup Database

```bash
# Create database directories
mkdir -p migrations/versions

# Initialize database
flask db init
flask db migrate -m "Initial database setup"
flask db upgrade

# Create initial admin user
python scripts/create_user.py
```

#### Create Upload Directory

```bash
mkdir -p uploads
```

#### Google Drive Integration (Optional)

To enable importing student photos from Google Drive:

1. Create a Google Cloud project
2. Enable the Google Drive API
3. Create a service account with "Drive File Viewer" role
4. Download the JSON key file
5. Save it as `credentials/service_account.json`
6. Uncomment the `GOOGLE_APPLICATION_CREDENTIALS` line in your `.env` file

#### Start Backend Server

```bash
python run.py
```

The backend will run on http://127.0.0.1:5000

### Step 3: Frontend Setup

#### Install Dependencies

```bash
# Navigate to frontend directory
cd ../frontend

# Using npm
npm install

# Or using Bun
bun install
```

#### Configure Environment

Create a `.env` file in the `frontend` directory:

```env
VITE_API_ROOT=http://127.0.0.1:5000/api/v1
```

#### Start Development Server

```bash
# Using npm
npm run dev

# Or using Bun
bun run dev
```

The frontend will be available at http://localhost:5173

## 🖥️ Using the System

### Initial Setup

1. **Login**: Access the system using default credentials (username: `admin`, password: `admin123`)
2. **Create Groups**: Set up logical groups (classes, departments, etc.)
3. **Register Students**: Add students individually or through bulk import

### Managing Students

1. **Individual Registration**:
   - Enter student ID and name
   - Upload a photo or provide a Google Drive link
   - Assign to a group

2. **Bulk Import**:
   - Prepare a CSV file with columns: `student_id`, `name`, `drive_link`
   - Navigate to a group's student management page
   - Click "Bulk Import" and upload your CSV

### Taking Attendance

1. **Live Attendance**:
   - Select the relevant group
   - Click "Start Capture" to activate webcam
   - Students will be automatically recognized and marked present

2. **Photo Upload**:
   - Upload a photo containing multiple students
   - The system will identify all recognized students
   - View recognition results and attendance status

### Viewing Records

- Access the "Attendance Logs" section
- Filter by date, group, and student
- View attendance details and statistics

## ⚙️ Configuration Options

### Backend Settings

Key configurations in `.env`:

- `FACE_MATCH_THRESHOLD`: Recognition confidence threshold (default: 0.60)
- `FACE_DETECTOR_BACKEND`: Face detection model (default: retinaface)
- `DEBOUNCE_SECONDS`: Minimum seconds between attendance records (default: 30)
- `MAX_IMAGE_SIZE`: Maximum image dimension for processing (default: 800px)

### Database Options

- **SQLite**: Quick setup, suitable for testing
  - `DEV_DATABASE_URL=sqlite:///attendance.db`

- **MySQL**: Better for production use
  - `DEV_DATABASE_URL=mysql+pymysql://username:password@localhost/face_logbook`

## 🔍 Troubleshooting

### Common Issues

1. **Face Recognition Problems**:
   - Ensure the `buffalo_l` model is correctly installed
   - Check lighting conditions when taking photos
   - Make sure student photos contain clear, front-facing faces

2. **Google Drive Integration Issues**:
   - Verify the service account has access to the Drive files
   - Ensure the correct Drive link format is used
   - Check service account permissions

3. **Database Connection Errors**:
   - Verify database credentials
   - Ensure the database exists and is accessible
   - Check for proper migrations

4. **Performance Issues**:
   - Reduce image size for faster processing
   - Consider using a more powerful machine for large deployments

## 📱 Mobile Compatibility

The frontend is responsive and works on mobile devices, but the following features have limitations:

- **Live Attendance**: Works best on devices with good quality cameras
- **Photo Upload**: Fully functional on mobile devices
- **Student Management**: Fully responsive for on-the-go administration

## 🔄 Updating the System

To update to the latest version:

```bash
# Pull latest code
git pull

# Update backend
cd backend
pip install -r requirements.txt
flask db upgrade

# Update frontend
cd ../frontend
npm install
npm run build
```

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Backend tests
cd backend
python -m pytest tests/

# Integration tests
python tests/integration_test.py
```

## 📚 Additional Documentation

- [Authentication Setup Guide](AUTH_SETUP.md)
- [Group Management Guide](GROUP_MANAGEMENT.md)
- [CSV Bulk Import Guide](CSV_IMPORT_GUIDE.md)
- [Testing Checklist](TEST_CHECKLIST.md)

## 🔐 Security Considerations

- The default admin password should be changed immediately
- JWT tokens expire after 24 hours (configurable)
- Student photos and face embeddings are stored securely
- API endpoints are protected with JWT authentication

## 📄 License

This project is licensed under the MIT License.

## 👏 Acknowledgements

- [InsightFace](https://github.com/deepinsight/insightface) for the facial recognition models
- [Flask](https://flask.palletsprojects.com/) for the backend framework
- [React](https://reactjs.org/) for the frontend library
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Shadcn UI](https://ui.shadcn.com/) for UI components

---

Made with ❤️ by [Rahuly1606](https://github.com/Rahuly1606)