"""
Simple script to update the database schema to make the embedding field nullable.
This is a simpler alternative to the fix_schema.py script to avoid dependency issues.
"""
import os
import pymysql
from pathlib import Path
from dotenv import load_dotenv

def update_schema():
    # Load environment variables from .env file
    env_path = Path(__file__).parent / '.env'
    load_dotenv(dotenv_path=env_path)
    
    # Get database connection parameters from environment variables
    db_url = os.getenv('DEV_DATABASE_URL', 'mysql+pymysql://root:Rahul@1606@localhost:3306/face-logbook')
    
    # Parse the database URL
    # Expect format: mysql+pymysql://username:password@host:port/dbname
    try:
        # Remove the prefix
        if 'mysql+pymysql://' in db_url:
            db_url = db_url.replace('mysql+pymysql://', '')
        
        # Split into auth and location parts
        auth_part, location_part = db_url.split('@')
        username, password = auth_part.split(':')
        
        # Handle URL encoded characters
        password = password.replace('%40', '@')
        
        # Split location into host and database
        if '/' in location_part:
            host_part, db_name = location_part.split('/')
        else:
            host_part = location_part
            db_name = 'face-logbook'  # default name
        
        # Split host and port if present
        if ':' in host_part:
            host, port = host_part.split(':')
            port = int(port)
        else:
            host = host_part
            port = 3306  # default MySQL port
        
        print(f"Connecting to MySQL database at {host}:{port}, database: {db_name}")
        
        # Connect to the database
        conn = pymysql.connect(
            host=host,
            user=username,
            password=password,
            database=db_name,
            port=port
        )
        
        cursor = conn.cursor()
        
        # Check if the students table exists
        cursor.execute("SHOW TABLES LIKE 'students'")
        if not cursor.fetchone():
            print("Students table does not exist in the database.")
            return
        
        # Check the current structure of the students table
        cursor.execute("DESCRIBE students")
        columns = cursor.fetchall()
        
        # Look for the embedding column
        embedding_column = None
        for col in columns:
            if col[0] == 'embedding':
                embedding_column = col
                break
                
        if not embedding_column:
            print("No embedding column found in students table.")
            return
            
        # Check if the embedding column is nullable
        # In MySQL DESCRIBE, the third column 'Null' will be 'YES' if nullable
        if embedding_column[2] == 'YES':
            print("Embedding column is already nullable. No changes needed.")
            return
            
        print("Modifying embedding column to make it nullable...")
        
        # Alter the table to make the embedding column nullable
        cursor.execute("ALTER TABLE students MODIFY embedding LONGBLOB NULL")
        
        # Verify the change
        cursor.execute("DESCRIBE students")
        columns = cursor.fetchall()
        for col in columns:
            if col[0] == 'embedding':
                if col[2] == 'YES':
                    print("Successfully modified embedding column to be nullable.")
                else:
                    print("Failed to modify embedding column.")
                break
        
        # Commit the changes
        conn.commit()
        
        # Close the connection
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"Error updating schema: {str(e)}")

if __name__ == "__main__":
    update_schema()