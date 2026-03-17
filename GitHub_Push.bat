@echo off
title XenialRest - Subir a GitHub
cls
cd /d "%~dp0"

echo ============================================================
echo   XenialRest - Subir a GitHub
echo   Si pide autenticacion, elige "Sign in with your browser"
echo ============================================================
echo.

git add .
git status
echo.

set /p MSG="Mensaje del commit (Enter = Update): "
if "%MSG%"=="" set MSG=Update %date% %time%

git commit -m "%MSG%"
git branch -M main 2>nul
git push -u origin main

echo.
pause
