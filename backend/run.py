import os
from app import create_app
from flask import make_response, jsonify

# Create the Flask application
app = create_app(os.getenv('FLASK_ENV', 'dev'))

# Add a health check endpoint at the root
@app.route('/')
def health_check():
    return make_response(jsonify({"status": "healthy", "message": "Flask backend is running"}), 200)

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    host = '0.0.0.0'
    print(f"\n\n🚀 Server running at http://localhost:{port}\n\n")
    app.run(host=host, port=port, debug=True)