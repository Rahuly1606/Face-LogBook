from app import create_app, db
from app.models.attendance import Attendance

app = create_app()
with app.app_context():
    records = Attendance.query.order_by(Attendance.id.desc()).limit(20).all()
    if not records:
        print("No records found!")
    for r in records:
        print(f"id={r.id} student={r.student_id} date={r.date} status={r.status} in_time={r.in_time}")
