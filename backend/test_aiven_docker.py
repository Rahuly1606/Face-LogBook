#!/usr/bin/env python3
"""
Test script for Aiven MySQL connection from Docker environment.
This can be used to verify your Aiven connection settings before running the full application.
"""

import os
import sys
import pymysql
import urllib.parse
from dotenv import load_dotenv
import tempfile

def write_temp_ca_file(ca_content):
    """Write CA certificate content to a temporary file."""
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pem')
    temp_file.write(ca_content.encode('utf-8'))
    temp_file.close()
    return temp_file.name

def test_aiven_connection():
    """Test connection to Aiven MySQL using environment variables."""
    # Load environment variables from .env file
    load_dotenv()
    
    # Get Aiven connection details
    aiven_host = os.getenv('AIVEN_HOST')
    aiven_port = os.getenv('AIVEN_PORT')
    aiven_user = urllib.parse.quote_plus(os.getenv('AIVEN_USER', ''))
    aiven_password = urllib.parse.quote_plus(os.getenv('AIVEN_PASSWORD', ''))
    aiven_db = os.getenv('AIVEN_DB')
    
    # Check for required variables
    if not all([aiven_host, aiven_port, aiven_user, aiven_password, aiven_db]):
        print("Error: Missing required Aiven connection variables.")
        print("Please ensure AIVEN_HOST, AIVEN_PORT, AIVEN_USER, AIVEN_PASSWORD, and AIVEN_DB are set.")
        sys.exit(1)
    
    # Handle SSL certificate
    ssl_args = {}
    ca_path = os.getenv('AIVEN_CA_PATH')
    ca_pem = os.getenv('AIVEN_CA_PEM')
    
    if ca_path and os.path.exists(ca_path):
        ssl_args = {'ca': ca_path}
    elif ca_pem:
        temp_ca_path = write_temp_ca_file(ca_pem)
        ssl_args = {'ca': temp_ca_path}
    else:
        print("Warning: No SSL certificate provided. Connection will be insecure.")
        print("Consider providing AIVEN_CA_PATH or AIVEN_CA_PEM for secure connection.")
    
    # Try to connect
    try:
        print(f"Connecting to Aiven MySQL at {aiven_host}:{aiven_port}...")
        conn = pymysql.connect(
            host=aiven_host,
            port=int(aiven_port),
            user=os.getenv('AIVEN_USER'),
            password=os.getenv('AIVEN_PASSWORD'),
            database=aiven_db,
            ssl=ssl_args if ssl_args else None
        )
        
        with conn.cursor() as cursor:
            cursor.execute("SELECT VERSION()")
            version = cursor.fetchone()[0]
        
        print("Connection successful!")
        print(f"MySQL version: {version}")
        print("Your Aiven MySQL configuration is working correctly.")
        
        # Clean up temporary file if created
        if ca_pem and 'temp_ca_path' in locals():
            os.unlink(temp_ca_path)
            
    except Exception as e:
        print(f"Error connecting to Aiven MySQL: {e}")
        print("\nTroubleshooting tips:")
        print("1. Check your Aiven connection credentials")
        print("2. Ensure your CA certificate is correct")
        print("3. Verify that your Aiven service allows connections from your IP")
        print("4. Check if your database exists")
        
        # Clean up temporary file if created
        if ca_pem and 'temp_ca_path' in locals():
            os.unlink(temp_ca_path)
        
        sys.exit(1)

if __name__ == '__main__':
    test_aiven_connection()