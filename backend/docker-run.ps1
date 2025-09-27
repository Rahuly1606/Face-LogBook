# Ensure required directories exist
$dirs = @("uploads", "models", "credentials")
foreach ($dir in $dirs) {
    if (-Not (Test-Path -Path $dir)) { New-Item -Path $dir -ItemType Directory }
}

# Check .env file
if (-Not (Test-Path -Path ".env")) {
    Write-Host "No .env file found. Creating from .env.example..." -ForegroundColor Yellow
    Copy-Item .env.example .env
    Write-Host "Please edit the .env file and press any key to continue..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    notepad .env
}

# Check Aiven SSL certificate
$envContent = Get-Content .env
$hasCaPath = $envContent | Where-Object { $_ -match "AIVEN_CA_PATH" -and $_ -notmatch "^#" }
$hasCaPem  = $envContent | Where-Object { $_ -match "AIVEN_CA_PEM" -and $_ -notmatch "^#" }
if (-Not $hasCaPath -and -Not $hasCaPem) {
    Write-Host "Warning: No Aiven SSL certificate configuration found!" -ForegroundColor Yellow
}

# Optional: Test Aiven MySQL connection
Write-Host "Test Aiven MySQL connection before building? (y/n)" -ForegroundColor Cyan
$testConnection = Read-Host
if ($testConnection -eq "y") {
    python test_aiven_docker.py
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Connection failed. Continue anyway? (y/n)" -ForegroundColor Red
        $continue = Read-Host
        if ($continue -ne "y") { exit }
    }
}

# Build Docker image
Write-Host "Building Docker image..." -ForegroundColor Cyan
docker build -t face-logbook-backend .

# Run container
Write-Host "Starting container..." -ForegroundColor Cyan
docker run -d -p 5000:5000 --name face-logbook-backend `
    -v ${PWD}/uploads:/app/uploads `
    -v ${PWD}/models:/app/models `
    -v ${PWD}/credentials:/app/credentials `
    --env-file .env `
    face-logbook-backend

Write-Host "Container started at http://localhost:5000" -ForegroundColor Green
Write-Host "Check logs: docker logs face-logbook-backend" -ForegroundColor Cyan
Write-Host "Stop container: docker stop face-logbook-backend" -ForegroundColor Cyan
