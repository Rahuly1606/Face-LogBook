@echo off
echo ====================================================
echo Building Face-LogBook Backend Docker Image
echo ====================================================
echo.
echo This may take several minutes. The build has these stages:
echo 1. Setting up base image
echo 2. Installing system dependencies
echo 3. Installing Python packages (longest step)
echo 4. Copying application code
echo 5. Final configuration
echo.
echo Starting build...
echo.

docker build -t face-logbook-backend . --progress=plain

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ====================================================
    echo Build completed successfully!
    echo ====================================================
    echo.
    echo To run the container:
    echo docker run -p 5000:5000 --name face-logbook-backend -d ^
    echo   -v %CD%\uploads:/app/uploads ^
    echo   -v %CD%\models:/app/models ^
    echo   -v %CD%\credentials:/app/credentials ^
    echo   --env-file .env ^
    echo   face-logbook-backend
    echo.
    echo Or use docker-compose:
    echo docker-compose up -d
) else (
    echo.
    echo ====================================================
    echo Build failed with error code %ERRORLEVEL%
    echo ====================================================
    echo.
    echo Please check the error messages above.
)