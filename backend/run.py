import os
from app import create_app

# Create the Flask application
app = create_app(os.getenv('FLASK_ENV', 'dev'))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', 5000)))