# Face-LogBook Backend

This directory contains the backend service for the Face-LogBook application.

## Running with Docker

### Prerequisites

- Docker installed and running on your system

### Steps to Run

1. **Create an environment file** (optional but recommended)
   ```
   cp .env.example .env
   ```
   Edit the `.env` file to customize your settings.

2. **Build and start the container**
   ```
   docker-compose up -d
   ```

3. **Access the API**
   The API will be available at http://localhost:5000

### Docker Configuration Details

- The Docker setup mounts these directories for persistent data:
  - `uploads`: For storing uploaded images
  - `models`: For caching face recognition models
  - `credentials`: For storing service credentials

- Environment variables can be customized in the `.env` file

### Stopping the Container

```
docker-compose down
```

### Viewing Logs

```
docker-compose logs -f
```

## Development Without Docker

For development without Docker, refer to the main project README.