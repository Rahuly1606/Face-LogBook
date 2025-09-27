# Docker Setup for Face-LogBook Backend

This document provides instructions for building and running the Face-LogBook backend in a Docker container.

## Required Files

- `Dockerfile` - Container configuration
- `docker-compose.yml` - Docker Compose configuration
- `docker-run.ps1` - PowerShell script for Windows users
- `test_aiven_docker.py` - Utility to test Aiven MySQL connection
- `.env` file (create from `.env.example`) - Environment configuration

## Quick Start

### Option 1: Using PowerShell Script (Windows, Recommended)

```powershell
.\docker-run.ps1
```

This script will:
- Check for proper configuration
- Test your Aiven MySQL connection
- Build and run the Docker container

### Option 2: Using Docker Compose

```powershell
# Create .env file first
copy .env.example .env
# Edit .env with your Aiven credentials

# Run Docker Compose
docker-compose up -d
```

## Aiven MySQL Configuration

In your `.env` file:

```
# Aiven MySQL database connection
AIVEN_HOST=your_aiven_host.aivencloud.com
AIVEN_PORT=your_aiven_port
AIVEN_USER=your_aiven_user
AIVEN_PASSWORD=your_aiven_password
AIVEN_DB=your_aiven_dbname

# SSL Certificate (use one of these options)
AIVEN_CA_PATH=/app/credentials/ca.pem
# OR
AIVEN_CA_PEM=-----BEGIN CERTIFICATE-----\nYour certificate content here\n-----END CERTIFICATE-----
```

## Testing the Connection

To test your Aiven MySQL connection:

```powershell
python test_aiven_docker.py
```

This script will verify that your credentials and SSL certificate are working correctly.