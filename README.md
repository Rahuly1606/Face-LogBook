# Face-LogBook - Facial Recognition Attendance System

A modern, full-stack web application for managing student attendance using advanced facial recognition technology. This system allows you to register students with their photos, take attendance using a webcam, track attendance history, and more.

![Face-LogBook Banner](https://img.shields.io/badge/Face--LogBook-Attendance%20System-blue)

## 📋 Features

- **Face Recognition**: Automatically identify registered students using webcam
- **Multiple Face Detection**: Process multiple students in a single frame
- **Real-time Attendance**: Mark attendance with live camera feed
- **Student Management**: Easily register, view, and manage student profiles
- **Attendance History**: View and export attendance records by date
- **Admin Dashboard**: Complete overview of system usage and statistics

## 🛠️ Technology Stack

- **Backend**: 
  - Flask (Python)
  - SQLAlchemy (ORM)
  - InsightFace (Face Recognition)
  - MySQL/SQLite (Database)

- **Frontend**: 
  - React
  - TypeScript
  - Tailwind CSS
  - Shadcn UI Components

## 📋 Prerequisites

Before starting installation, make sure you have the following installed:

- **Python 3.9+**
- **Node.js 16+**
- **npm or bun**
- **Git**
- **MySQL** (optional, can use SQLite for testing)

## 🚀 Installation Guide

### Step 1: Clone the Repository

```bash
git clone https://github.com/Rahuly1606/Face-LogBook.git
cd face_logbook
```

### Step 2: Backend Setup

#### A. Create Virtual Environment

```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
# For Windows:
python -m venv venv
venv\Scripts\activate

# For macOS/Linux:
python -m venv venv
source venv/bin/activate
```

#### B. Install Python Dependencies

```bash
# Install all required packages
pip install -r requirements.txt
```

#### C. Download Face Recognition Model

The application uses InsightFace for facial recognition, which requires pre-trained models:

1. Download the `buffalo_l` model from [InsightFace Model Zoo](https://github.com/deepinsight/insightface/releases/tag/v0.7)
2. Create a directory: `backend/models/`
3. Extract the downloaded zip and place the entire `buffalo_l` folder inside the `models` directory

Your folder structure should look like:
```
backend/
├── models/
│   └── buffalo_l/
│       ├── 1k3d68.onnx
│       ├── 2d106det.onnx
│       ├── genderage.onnx
│       └── w600k_r50.onnx
└── ...
```

#### D. Configure Environment

Create a `.env` file in the `backend` directory with the following content:

```env
# Flask Configuration
FLASK_APP=run.py
FLASK_ENV=development

# Security
SECRET_KEY=your_secret_key_here
ADMIN_TOKEN=your_admin_token_here

# Database Configuration
# For SQLite (easy setup):
DEV_DATABASE_URL=sqlite:///attendance.db

# For MySQL (recommended for production):
# DEV_DATABASE_URL=mysql+pymysql://username:password@localhost/face_logbook
```

#### E. Initialize Database

```bash
# Initialize migration repository
flask db init

# Create migration script
flask db migrate -m "Initial database setup"

# Apply migrations
flask db upgrade
```

#### F. Run Backend Server

```bash
# Start the Flask development server
python run.py
```

The backend server will start on http://127.0.0.1:5000

### Step 3: Frontend Setup

#### A. Install Dependencies

```bash
# Navigate to frontend directory
cd ../frontend

# Install dependencies
npm install
# OR if you use bun
bun install
```

#### B. Configure Environment

Create a `.env` file in the `frontend` directory:

```env
VITE_API_ROOT=http://127.0.0.1:5000/api/v1
VITE_ADMIN_TOKEN=your_admin_token_here
```

> ⚠️ Make sure the admin token matches the one in your backend `.env` file

#### C. Run Frontend Development Server

```bash
# Start the development server
npm run dev
# OR if you use bun
bun run dev
```

The frontend application will be available at http://localhost:5173 (or another port if 5173 is in use)

## 📱 Using the Application

1. **First-time Setup**:
   - Use the provided admin token to access the admin features
   - Register students with clear facial photos
   - Set up attendance sessions

2. **Taking Attendance**:
   - Navigate to the "Live Attendance" page
   - Click "Start Capture" to begin detecting faces
   - Recognized students will be automatically marked present
   - Unregistered faces will be counted and displayed

3. **Viewing Records**:
   - Go to the "Attendance Logs" page to view historical records
   - Filter by date to see specific attendance sessions
   - Export data as needed

## ⚠️ Troubleshooting

### Common Issues and Solutions

#### Backend Issues

- **Model Initialization Error**: 
  - Ensure the face recognition model is downloaded and placed in the correct directory
  - Check if all model files are present in the `backend/models/buffalo_l` folder

- **Database Connection Error**: 
  - Verify your database credentials in the `.env` file
  - Make sure the database exists and is accessible

- **CORS Errors**: 
  - Check that the frontend URL is accessible from the backend
  - Ensure CORS is properly configured in the Flask application

#### Frontend Issues

- **API Connection Error**: 
  - Verify the backend server is running
  - Check if the API URL in the frontend `.env` file is correct
  - Ensure the admin token is correctly set

- **Webcam Access Issues**: 
  - Grant camera permissions in your browser
  - Try using a different browser if problems persist

## 🔄 Updating

To update to the latest version:

```bash
# Pull the latest changes
git pull

# Update backend dependencies
cd backend
pip install -r requirements.txt

# Update database schema if needed
flask db migrate
flask db upgrade

# Update frontend dependencies
cd ../frontend
npm install
```

## 📚 Project Structure

```
face_logbook/
├── backend/               # Flask backend
│   ├── app/               # Main application code
│   │   ├── api/           # API endpoints
│   │   ├── models/        # Database models
│   │   ├── services/      # Business logic
│   │   └── utils/         # Utilities
│   ├── migrations/        # Database migrations
│   ├── models/            # Face recognition models
│   ├── tests/             # Test files
│   └── run.py             # Application entry point
├── frontend/              # React frontend
│   ├── public/            # Static files
│   ├── src/               # Source code
│   │   ├── api/           # API clients
│   │   ├── components/    # React components
│   │   ├── contexts/      # React contexts
│   │   ├── pages/         # Page components
│   │   └── utils/         # Utility functions
│   └── package.json       # Frontend dependencies
└── README.md              # This file
```

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgements

- [InsightFace](https://github.com/deepinsight/insightface) for the face recognition models
- [Flask](https://flask.palletsprojects.com/) for the backend framework
- [React](https://reactjs.org/) for the frontend library
- [Tailwind CSS](https://tailwindcss.com/) for the styling
- [Shadcn UI](https://ui.shadcn.com/) for the UI components

---

Made with ❤️ by [Rahuly1606](https://github.com/Rahuly1606)