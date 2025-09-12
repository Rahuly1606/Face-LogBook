import os
from app import create_app
from flask import make_response, jsonify

# Create the Flask application
app = create_app(os.getenv('FLASK_ENV', 'dev'))

# Add a health check endpoint at the root
@app.route('/')
def health_check():
    return jsonify({"status": "healthy", "message": "Flask backend is running"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', 5000)), debug=True)