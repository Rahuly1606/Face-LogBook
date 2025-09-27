FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FLASK_APP=run.py \
    FLASK_ENV=production \
    PORT=5000 \
    INSIGHTFACE_MODEL_ROOT=/app/models

# Install system dependencies for Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3-dev \
    libpq-dev \
    default-libmysqlclient-dev \
    libjpeg-dev \
    zlib1g-dev \
    libfreetype6-dev \
    liblcms2-dev \
    libwebp-dev \
    tcl8.6-dev tk8.6-dev \
    openssl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install dependencies in multiple steps for better handling of errors
# First install numpy and pandas which are the problematic ones
RUN pip install --no-cache-dir numpy==1.26.0
RUN pip install --no-cache-dir pandas==2.0.1
RUN pip install --no-cache-dir opencv-python-headless==4.7.0.72

# Now install the rest of requirements excluding the ones we've already installed
RUN grep -v "numpy\|pandas\|opencv-python-headless" requirements.txt > other_requirements.txt && \
    pip install --no-cache-dir -r other_requirements.txt

# Copy app code
COPY . .

# Create required directories
RUN mkdir -p uploads models credentials

# Expose port
EXPOSE 5000

# Start the app using Gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "3", "--timeout", "120", "run:app"]
