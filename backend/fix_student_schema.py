"""
Script to fix student table schema
This script alters the Student table to make the embedding column nullable
"""
from app import create_app, db
from flask_sqlalchemy import text

app = create_app()

with app.app_context():
    print("Modifying Student table schema...")
    
    # Using raw SQL to alter the column and allow NULL values
    try:
        with db.engine.connect() as connection:
            # For SQLite, we need to recreate the table
            # For PostgreSQL, we could use ALTER COLUMN ... DROP NOT NULL
            # This works for SQLite
            connection.execute(text("PRAGMA foreign_keys=OFF;"))
            connection.execute(text("""
                ALTER TABLE students RENAME TO students_old;
            """))
            connection.execute(text("""
                CREATE TABLE students (
                    student_id VARCHAR(50) NOT NULL PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    photo_path VARCHAR(255),
                    embedding BLOB,
                    group_id INTEGER,
                    created_at DATETIME,
                    FOREIGN KEY (group_id) REFERENCES groups (id)
                );
            """))
            connection.execute(text("""
                INSERT INTO students (student_id, name, photo_path, embedding, group_id, created_at)
                SELECT student_id, name, photo_path, embedding, group_id, created_at
                FROM students_old;
            """))
            connection.execute(text("""
                DROP TABLE students_old;
            """))
            connection.execute(text("PRAGMA foreign_keys=ON;"))
            connection.commit()
        
        print("Student table schema modified successfully!")
    except Exception as e:
        print(f"Error modifying schema: {str(e)}")