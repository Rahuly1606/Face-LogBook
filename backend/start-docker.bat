@echo off
echo Building and starting Face-LogBook Backend with Aiven MySQL...

:: Check if .env file exists, create from example if not
if not exist .env (
    echo Warning: No .env file found!
    echo Creating .env file from example template...
    copy .env.example .env
    echo Please edit the .env file with your Aiven MySQL credentials.
    echo Press any key to continue...
    pause > nul
    notepad .env
)

:: Build and start with docker-compose
echo.
echo Building and starting containers...
docker-compose up --build -d

echo.
echo Container started! The API is available at http://localhost:5000
echo.
echo To view logs, run: docker-compose logs -f
echo To stop the container, run: docker-compose down