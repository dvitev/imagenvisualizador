@echo off
REM Manga Reader Pro - Docker Build & Run Script (Windows)

echo Building Manga Reader Pro...

REM Build and start all services
docker-compose up -d --build

echo.
echo Build complete!
echo.
echo Services:
echo    - Client (Nginx): http://localhost:3000
echo    - Server (API): http://localhost:3001
echo.
echo Useful commands:
echo    docker-compose logs -f          REM View logs
echo    docker-compose down             REM Stop services
echo    docker-compose restart          REM Restart services
echo.

pause
