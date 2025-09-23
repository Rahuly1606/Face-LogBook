#!/usr/bin/env python3
"""
Test Aiven MySQL connection

This script tests the connection to Aiven MySQL using environment variables.
It runs a simple SELECT VERSION() query to verify the connection works.
"""

import os
import sys
import tempfile
from dotenv import load_dotenv
import pymysql

def test_aiven_connection():
    """Test connection to Aiven MySQL"""
    # Load environment variables
    load_dotenv()
    
    # Check if Aiven environment variables are set
    required_vars = ['AIVEN_HOST', 'AIVEN_PORT', 'AIVEN_USER', 'AIVEN_PASSWORD', 'AIVEN_DB']
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        print(f"❌ Error: Missing required environment variables: {', '.join(missing_vars)}")
        print("Please set all required environment variables and try again.")
        sys.exit(1)
    
    # Set up SSL context if CA is provided
    ssl_config = None
    ca_path = None
    
    # If AIVEN_CA_PEM is provided, write it to a temporary file
    if os.getenv('AIVEN_CA_PEM'):
        print("Using CA certificate from AIVEN_CA_PEM environment variable")
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pem') as ca_file:
            ca_file.write(os.getenv('AIVEN_CA_PEM').encode())
            ca_path = ca_file.name
        print(f"CA certificate written to temporary file: {ca_path}")
        os.environ['AIVEN_CA_PATH'] = ca_path
    
    # Use existing CA path if provided
    if os.getenv('AIVEN_CA_PATH'):
        print(f"Using CA certificate from: {os.getenv('AIVEN_CA_PATH')}")
        ssl_config = {"ca": os.getenv('AIVEN_CA_PATH')}
    
    try:
        # Connect to Aiven MySQL
        print(f"Connecting to Aiven MySQL at {os.getenv('AIVEN_HOST')}:{os.getenv('AIVEN_PORT')}...")
        connection = pymysql.connect(
            host=os.getenv('AIVEN_HOST'),
            port=int(os.getenv('AIVEN_PORT')),
            user=os.getenv('AIVEN_USER'),
            password=os.getenv('AIVEN_PASSWORD'),
            database=os.getenv('AIVEN_DB'),
            charset='utf8mb4',
            ssl=ssl_config
        )
        
        with connection.cursor() as cursor:
            # Execute a simple query to test the connection
            cursor.execute("SELECT VERSION()")
            version = cursor.fetchone()[0]
            print(f"✅ Successfully connected to MySQL version: {version}")
        
        connection.close()
        print("✅ Connection test successful!")
        
        # Clean up temporary CA file if created
        if ca_path and os.path.exists(ca_path):
            os.unlink(ca_path)
            print(f"Removed temporary CA file: {ca_path}")
        
        return True
    except Exception as e:
        print(f"❌ Connection test failed: {str(e)}")
        
        # Clean up temporary CA file if created
        if ca_path and os.path.exists(ca_path):
            os.unlink(ca_path)
            print(f"Removed temporary CA file: {ca_path}")
        
        return False

if __name__ == "__main__":
    test_aiven_connection()