@echo off
TITLE Controle Financeiro - Servidores
SETLOCAL
SET "PROJECT_DIR=c:\Users\mlbba\Desktop\controle-financeiro"
cd /d "%PROJECT_DIR%"

echo ==========================================
echo   INICIANDO CONTROLE FINANCEIRO
echo ==========================================
echo.
echo [1/2] Verificando dependencias...
echo.

REM Tentativa de iniciar via root (concurrently)
echo [2/2] Iniciando Backend e Frontend...
echo.
npm run dev

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERRO] Falha ao iniciar os servidores.
    echo Tentando limpar o cache do Vite e reiniciar...
    cd frontend && rmdir /s /q node_modules\.vite 2>nul
    cd ..
    npm run dev
)

pause
