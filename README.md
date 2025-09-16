# Face-LogBook - Attendance System

Full‑stack web app to manage student attendance with admin-only access for all functionality. Includes student and group management, live/photo attendance, and logs.

## Prerequisites

- Python 3.9+
- Node.js 16+ (or Bun)
- MySQL (recommended) or SQLite for quick local testing
- Git

## 1) Clone

```bash
git clone https://github.com/Rahuly1606/Face-LogBook.git
cd face_logbook
```

## 2) Backend setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # macOS/Linux
python -m pip install --upgrade pip setuptools wheel(if getting error)
pip install -r requirements.txt
```

Create `.env` in `backend/` (values shown are examples):

```env
FLASK_APP=run.py
FLASK_ENV=development

# Security
SECRET_KEY=change_me
JWT_SECRET_KEY=change_me_jwt
JWT_ACCESS_TOKEN_EXPIRES=86400

# Database (pick one)
# SQLite (simple):
DEV_DATABASE_URL=sqlite:///attendance.db

# MySQL (recommended):
# DEV_DATABASE_URL=mysql+pymysql://username:password@localhost/face_logbook

# CORS: allowed frontend origins (comma‑separated)
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Uploads
UPLOAD_FOLDER=uploads
```

Initialize DB schema:

```bash
python create_database.py
```

Create admin user (DB-only auth):

```bash
# Use in-file defaults (set in scripts/create_user.py)
python scripts/create_user.py

# Or specify explicitly
python scripts/create_user.py --username admin --password "YourStrongPassword123" --admin
```

Run backend:

```bash
python run.py
# Backend: http://127.0.0.1:5000
```

## 3) Frontend setup

```bash
cd ../frontend
npm install  # or: bun install
```

Create `frontend/.env`:

```env
VITE_API_ROOT=http://127.0.0.1:5000/api/v1
```

Start dev server:

```bash
npm run dev  # or: bun run dev
# Frontend: http://localhost:5173
```

## 4) Login and usage

1. Open the frontend URL → you’ll be redirected to the Admin Login.
2. Log in using the admin user you created.
3. After login, access all features: groups, students, live/photo attendance, and logs.

## Port forwarding (remote/dev containers)

- Forward BOTH ports: frontend (e.g., 5173) and backend (default 5000).
- Set `VITE_API_ROOT` to the forwarded backend URL, e.g. `http://<host>:<port>/api/v1`.
- Ensure backend CORS `ALLOWED_ORIGINS` includes your forwarded frontend origin.

## Troubleshooting login

- 401 Invalid credentials: verify the user exists in the same DB the backend is using.
- Wrong API root: confirm `VITE_API_ROOT` points to your reachable backend.
- CORS blocked: add your frontend origin to `ALLOWED_ORIGINS` and restart backend.
- Clear browser storage if switching environments:
  - In console: `localStorage.removeItem('user'); localStorage.removeItem('adminToken');`

## Scripts

- `backend/scripts/create_user.py` supports:
  - No args → creates/updates default admin (values inside the script)
  - CLI args → `--username ... --password ... --admin`

## License

MIT

