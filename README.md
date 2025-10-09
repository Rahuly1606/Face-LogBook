# Face-LogBook - AI-Enhanced Attendance System

A comprehensive full-stack attendance management system using facial recognition with **FAISS-accelerated matching** to automate and streamline attendance tracking. This application provides admin-only access with robust student and group management features, live/photo attendance tracking, detailed event logging, and reporting capabilities.

## ⚡ Performance Highlights

- **Ultra-Fast Face Recognition**: < 100ms total processing time
- **FAISS-Powered Matching**: 50-200x faster than traditional methods
- **Scalable**: Efficiently handles 100,000+ students
- **Real-time Recognition**: 15-20 FPS live processing
- **Optimized Detection**: 320x320 detection size for speed

### Performance Benchmarks

| Students | Processing Time | Speed |
|----------|----------------|-------|
| 100      | ~50ms         | ⚡⚡⚡ |
| 500      | ~51ms         | ⚡⚡⚡ |
| 5,000    | ~53ms         | ⚡⚡⚡ |
| 50,000   | ~55ms         | ⚡⚡⚡ |

## Features

- **FAISS-Accelerated Face Recognition**: Ultra-fast student identification with intelligent index selection
- **Optimized Performance**: Vectorized operations and smart caching for minimal latency
- **Group Management**: Organize students into customizable groups
- **Live & Photo Attendance**: Multiple ways to mark attendance with real-time processing
- **Event Logging**: Complete audit trail of check-ins and check-outs
- **Admin Dashboard**: Comprehensive management interface
- **Bulk Import**: Import multiple students at once
- **High-Quality Image Support**: Upload images up to 20MB (50MB on server)

## Prerequisites

- **Python**: 3.9+ (3.10 recommended)
- **Node.js**: 18+ (or Bun as alternative)
- **Database**: MySQL (recommended) or SQLite for quick testing
- **Git**: For repository management
- **Webcam**: For live attendance tracking (optional)
- **Docker** (optional): For containerized deployment
- **FAISS**: For ultra-fast face matching (auto-installed with requirements)

## Deployment Options

### Option 1: Using Docker (Recommended for Production)

The easiest way to run the application is using Docker:

1. Clone the repository:
   ```bash
   git clone https://github.com/Rahuly1606/Face-LogBook.git
   cd Face-LogBook
   ```

2. Copy the environment variables template:
   ```bash
   cp .env.example .env
   ```

3. Edit the `.env` file with your specific settings.

4. Start the application:
   ```bash
   docker-compose up -d
   ```

5. The backend will be available at http://localhost:5000

#### Docker Configuration Details
- The Docker setup mounts these directories:
  - `backend/uploads`: For storing uploaded images
  - `backend/models`: For caching face recognition models
  - `backend/credentials`: For storing service credentials

### Option 2: Manual Setup

#### 1. Clone the Repository

```bash
git clone https://github.com/Rahuly1606/Face-LogBook.git
cd face_logbook
```

#### 2. Backend Setup

##### Create and Activate Virtual Environment

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
# source venv/bin/activate

# Upgrade pip (if needed)
python -m pip install --upgrade pip setuptools wheel
```

#### Install Dependencies

```bash
pip install -r requirements.txt
```

This will install all required packages including:
- Flask (web framework)
- SQLAlchemy (ORM for database)
- InsightFace (facial recognition)
- **FAISS** (ultra-fast similarity search)
- OpenCV (computer vision)
- JWT (authentication)
- NumPy (optimized numerical operations)

**Note**: FAISS installation enables 50-200x faster face matching. The system automatically falls back to NumPy if FAISS is unavailable.

#### Configure Environment

Create a `.env` file in the `backend/` directory with the following settings:

```env
# Flask configuration
FLASK_APP=run.py
FLASK_ENV=development

# Security settings
SECRET_KEY=your_secure_secret_key_here
JWT_SECRET_KEY=your_secure_jwt_key_here
JWT_ACCESS_TOKEN_EXPIRES=86400  # Token validity in seconds (24 hours)

# Database connection (choose one option)
# Option 1 - SQLite (simple setup):
DEV_DATABASE_URL=sqlite:///attendance.db

# Option 2 - MySQL (recommended for production):
# DEV_DATABASE_URL=mysql+pymysql://username:password@localhost/face_logbook

# Option 3 - Aiven MySQL (cloud database):
# DEV_DATABASE_URL=mysql+pymysql://avnadmin:password@hostname:port/defaultdb
# AIVEN_CA_PATH=path/to/ca.pem

# CORS settings - allowed frontend origins (comma-separated)
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://your-domain.com

# Upload and image settings
UPLOAD_FOLDER=uploads
MAX_IMAGE_SIZE=2048
MAX_CONTENT_LENGTH=52428800  # 50MB in bytes
```

#### Initialize Database

```bash
python create_database.py
```

You should see console output confirming successful database and table creation.

#### Create Admin User

```bash
# Use default settings
python scripts/create_user.py

# Or specify custom credentials
python scripts/create_user.py --username admin --password "YourStrongPassword123" --admin
```

#### Run the Backend Server

```bash
python run.py
```

The backend will start at http://127.0.0.1:5000 with the API accessible at http://127.0.0.1:5000/api/v1

**Performance Check**: Look for these log messages indicating optimizations are active:
```
INFO: Face recognition model successfully initialized
INFO: Rebuilt FAISS index with X students
INFO: Using FAISS Flat index for X students
```

If you see `(NumPy)` instead, FAISS may not be installed. Run:
```bash
pip install faiss-cpu
# Then restart the backend
```

### 3. Frontend Setup

```bash
cd ../frontend
```

#### Install Node.js Dependencies

```bash
npm install  # or: bun install
```

#### Configure Environment

Create a `.env` file in the `frontend/` directory:

```env
# API configuration
VITE_API_ROOT=http://127.0.0.1:5000/api/v1
```

#### Start Development Server

```bash
npm run dev  # or: bun run dev
```

The frontend will be available at http://localhost:5173

### 4. Accessing the Application

1. Open your browser and navigate to http://localhost:5173
2. You will be redirected to the login page
3. Log in using the admin credentials you created
4. After successful login, you'll have access to:
   - Dashboard
   - Student management
   - Group management
   - Live attendance
   - Upload attendance
   - Event logs and reports

## Bulk Student Import

1. Navigate to a group's detail page
2. Click the "Bulk Import" button
3. Upload a properly formatted CSV file with student data
4. The system processes students in batches for optimal performance
5. Maximum upload size is now 20MB (client-side) and 50MB (server-side)

## Advanced Configuration

### Using Cloud Database (Aiven MySQL)

For production deployments, a cloud database is recommended:

1. Create an Aiven MySQL instance
2. Download the CA certificate
3. Configure your `.env` file with:
   ```
   DEV_DATABASE_URL=mysql+pymysql://avnadmin:password@hostname:port/defaultdb
   AIVEN_CA_PATH=/path/to/ca.pem
   ```

### Setting Up HTTPS for Development

```bash
# Generate self-signed certificates
cd frontend
node generate-certs.js

# Start with HTTPS enabled
npm run dev
```

## Troubleshooting

### Login Issues
- **401 Unauthorized**: Verify admin credentials in database
- **API Connection Failed**: Check `VITE_API_ROOT` points to running backend
- **CORS Errors**: Ensure frontend origin is in backend's `ALLOWED_ORIGINS`
- **Persistent Session Issues**: Clear browser storage
  ```javascript
  localStorage.removeItem('user'); localStorage.removeItem('adminToken');
  ```

### Database Connection
- **MySQL Connection Failed**: Check username, password, and host are correct
- **SSL/TLS Issues**: Verify CA certificate path if using Aiven

### Face Recognition
- **Model Loading Errors**: Ensure the models directory exists and has correct permissions
- **Recognition Performance**: Adjust `MAX_IMAGE_SIZE` and `FACE_MATCH_THRESHOLD` in config
- **Slow Recognition**: 
  - Check if FAISS is installed: `pip show faiss-cpu`
  - Verify logs show "FAISS index" not "(NumPy)"
  - Expected processing time: < 100ms (check UI for metrics)

### Performance Optimization
- **FAISS Not Working**: 
  - Install: `pip install faiss-cpu`
  - Restart backend server
  - Check logs for "Rebuilt FAISS index" message
- **High Latency**: 
  - Reduce `MAX_IMAGE_SIZE` to 640 in config
  - Check if cache is rebuilding every request (should cache for 60 seconds)
  - Monitor processing times in the UI (should be green < 100ms)

### Large File Uploads
- **413 Request Entity Too Large**: Increase `MAX_CONTENT_LENGTH` in backend config
- **Client-side Validation Failure**: Check limits in `validateImageFile()` in frontend

## Performance & Architecture

### Optimization Technologies

The system uses several cutting-edge optimizations for minimal latency:

1. **FAISS Similarity Search**
   - Automatic index selection (Flat/IVF/HNSW) based on database size
   - 50-200x faster than traditional sequential matching
   - Handles 100,000+ students with sub-100ms response times

2. **Intelligent Caching**
   - 60-second TTL embedding cache
   - Automatic invalidation on student updates
   - Vectorized NumPy operations as fallback

3. **Optimized Detection**
   - 320x320 detection size for 4x faster processing
   - JPEG compression to 70% for faster uploads
   - Reduced frame throttle (50ms) for 20 FPS recognition

4. **Frontend Optimizations**
   - 15-second API timeout for faster error recovery
   - Real-time processing metrics display
   - Efficient state management

### Verification

To verify optimizations are working:

```bash
cd backend
python verify_optimizations.py
```

Expected output:
```
✓ FAISS is available and will be used
✓ Using FAISS Flat index for X students
✓ EXCELLENT: Average matching time is X ms
```

### Configuration Tuning

For different scenarios, adjust these settings in `backend/app/config.py`:

```python
# Maximum image size (lower = faster)
MAX_IMAGE_SIZE = 800  # Default optimized setting

# Face match threshold (higher = stricter)
FACE_MATCH_THRESHOLD = 0.60  # Default

# Detection backend
FACE_DETECTOR_BACKEND = 'retinaface'  # Default
```

## License

MIT License