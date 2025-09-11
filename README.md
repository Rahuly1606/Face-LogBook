# Face Attendance App

A modern, full-stack web application for managing student attendance using advanced face recognition technology. Built with a Flask backend and a React frontend.

## ✨ Features

-   **Student Management**: Register, view, update, and delete student profiles.
-   **Face-Powered Registration**: Automatically extracts and stores facial embeddings from an uploaded photo.
-   **Live Attendance**: Mark attendance in real-time using a live camera feed.
-   **Bulk Attendance**: Upload a group photo to mark attendance for multiple students at once.
-   **Attendance Tracking**: View and manage historical attendance records.
-   **Secure Admin Operations**: Protected endpoints for administrative tasks.

---

## 🛠️ Technology Stack

-   **Backend**: Flask, Python, SQLAlchemy, Flask-Migrate
-   **Frontend**: React, Vite, TypeScript, Tailwind CSS
-   **Face Recognition**: `insightface` library
-   **Database**: MySQL (or SQLite for quick testing)
-   **API Communication**: Axios, RESTful principles

---

## 🚀 Getting Started

Follow these instructions to get the development environment up and running on your local machine.

### Prerequisites

-   Python 3.9+ and Pip
-   Node.js 16+ and npm
-   A running MySQL server (recommended)

### 1. Backend Setup

The backend server handles all business logic, database interactions, and face recognition tasks.

**A. Clone and Set Up Virtual Environment**

```bash
# Navigate to the backend directory
cd backend

# Create a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows, use `venv\Scripts\activate`
```

**B. Install Dependencies**

Create a file named `requirements.txt` in the `backend` directory and add the following contents. Then, run `pip install -r requirements.txt`.

```text name=backend/requirements.txt
flask==2.2.3
flask-sqlalchemy==3.0.3
flask-migrate==4.0.4
flask-cors==3.0.10
pymysql==1.0.3
cryptography==40.0.2
python-dotenv==1.0.0
gunicorn==20.1.0
insightface>=0.7.3
onnxruntime>=1.17.0
opencv-python==4.7.0.72
numpy==1.24.3
Werkzeug==2.2.3
```

```bash
# Install the packages from the file you just created
pip install -r requirements.txt
```

**C. Configure Environment Variables**

Create a `.env` file in the `backend` directory. This file will store your secret keys and database configuration.

```ini name=backend/.env
# Flask Configuration
FLASK_APP=run.py
FLASK_DEBUG=1

# Security Keys (change these to your own random strings)
SECRET_KEY=a_very_secret_and_long_random_string
ADMIN_TOKEN=a_secure_admin_token_for_api_access

# Database URL
# Replace user, password, and db_name with your MySQL credentials
DEV_DATABASE_URL="mysql+pymysql://user:password@localhost/your_db_name"

# Face Recognition Model
# This must match the model folder you download (e.g., 'buffalo_l')
FACE_MODEL_NAME=buffalo_l
```

**D. Download Face Recognition Models**

The `insightface` library requires pre-trained model files to function. These must be downloaded manually and placed in the correct directory to avoid runtime errors.

1.  **Download the Model Pack**: The `buffalo_l` model is recommended. Download it from the official [InsightFace Model Zoo](https://github.com/deepinsight/insightface/releases/tag/v0.7).
    -   **File to download**: `buffalo_l.zip` (approx. 275 MB)

2.  **Create the Directory and Place the Model**:
    -   In the `backend` directory, find or create a folder named `models`.
    -   Unzip the `buffalo_l.zip` file. You will get a folder named `buffalo_l`.
    -   Move the entire `buffalo_l` folder into the `models` directory.

    Your final directory structure should look like this:
    ```
    backend/
    ├── models/
    │   └── buffalo_l/      <-- The unzipped model folder
    │       ├── 1k3d68.onnx
    │       ├── 2d106det.onnx
    │       ├── genderage.onnx
    │       └── w600k_r50.onnx
    ├── app/
    └── ...
    ```
    > **Note**: The `buffalo_l` pack includes the necessary face detector models (like `retinaface`), so you only need this one download. The application will find them automatically if they are in this structure.

**E. Initialize and Migrate the Database**

Make sure your MySQL server is running and you have created the database specified in your `.env` file.

```bash
# Create the database in MySQL first:
# CREATE DATABASE your_db_name;

# Initialize the migration folder (only run this once)
flask db init

# Generate the initial migration script
flask db migrate -m "Initial database setup"

# Apply the migration to create the tables in your database
flask db upgrade
```

**F. Run the Backend Server**

```bash
flask run
```

The backend API will now be running at `http://127.0.0.1:5000`.

---

### 2. Frontend Setup

The frontend is a responsive React application for interacting with the backend API.

**A. Install Dependencies**

```bash
# Navigate to the frontend directory
cd frontend

# Install required npm packages
npm install
```

**B. Configure Environment Variables**

Create a `.env` file in the `frontend` directory to tell the app where the backend API is located.

```ini name=frontend/.env
VITE_API_ROOT=http://127.0.0.1:5000/api/v1
```

**C. Run the Frontend Development Server**

```bash
npm run dev
```

The frontend will now be running and accessible at `http://localhost:5173` (or another port if 5173 is busy).

---

## 🚨 Troubleshooting

-   **`RuntimeError: Face recognition model could not be initialized`**: This is the most common error. It almost always means the model files from step `1-D` are missing or in the wrong directory. Double-check the `backend/models/buffalo_l` folder structure.

-   **CORS Policy Errors**: If your browser shows a CORS error, it's usually a symptom of a backend crash (`500 Internal Server Error`). Check the Flask terminal for the real error message. If the backend is running fine, ensure your frontend's URL (`http://localhost:5173`) is listed in the `CORS_ORIGINS` setting in `backend/app/__init__.py`.

-   **`Access denied for user 'root'@'localhost'`**: This is a database connection error. Verify that the `DEV_DATABASE_URL` in your `backend/.env` file has the correct username, password, and database name.

-   **File Uploads Failing (4xx Errors)**:
    -   Ensure you are sending the `X-ADMIN-TOKEN` in the request header and that it matches the token in your `backend/.env` file.
    -   Check that the student ID is unique.
    -   Make sure the photo contains a single, clearly visible face.