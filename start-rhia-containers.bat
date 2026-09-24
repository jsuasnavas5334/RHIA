@echo off
cd /d "C:\Users\jesfu\Desktop\Software RHIA\infrastructure"
echo Starting RHIA containers using docker-compose...
docker-compose up -d
echo.
echo Checking containers...
docker ps -a
pause
