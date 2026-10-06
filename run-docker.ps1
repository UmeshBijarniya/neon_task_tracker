# Windows Docker Launcher for Neon Classes Task Tracker
$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Neon Classes Task Tracker - Docker Setup " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Check if Docker is installed
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Docker is not installed or not in PATH." -ForegroundColor Red
    Write-Host ""
    Write-Host "To install Docker Desktop on Windows:" -ForegroundColor Yellow
    Write-Host "1. Run in PowerShell as Administrator:  winget install Docker.DockerDesktop" -ForegroundColor White
    Write-Host "2. Or download directly from: https://www.docker.com/products/docker-desktop/" -ForegroundColor White
    Write-Host "3. Make sure WSL2 is installed ('wsl --install') and restart your PC." -ForegroundColor White
    exit 1
}

# 2. Check if Docker daemon is running
try {
    docker info > $null 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Daemon not running"
    }
} catch {
    Write-Host "[ERROR] Docker Desktop is installed, but the Docker engine is not running." -ForegroundColor Red
    Write-Host "Please start the Docker Desktop application and try again once the engine is active." -ForegroundColor Yellow
    exit 1
}

Write-Host "[INFO] Docker engine is active." -ForegroundColor Green

# 3. Ensure .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "[INFO] Creating .env file from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
}

# 4. Build and start containers
Write-Host "[INFO] Building and starting containers with docker compose..." -ForegroundColor Cyan
docker compose up -d --build

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host " All services started successfully!       " -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Frontend Web App:  http://localhost" -ForegroundColor White
    Write-Host "  Interactive Docs:  http://localhost/docs" -ForegroundColor White
    Write-Host "  Backend Direct:    http://localhost:8000" -ForegroundColor White
    Write-Host ""
    Write-Host "To view real-time logs:  docker compose logs -f" -ForegroundColor Yellow
    Write-Host "To stop containers:      docker compose down" -ForegroundColor Yellow
} else {
    Write-Host "[ERROR] Failed to start containers. Check logs above." -ForegroundColor Red
}
