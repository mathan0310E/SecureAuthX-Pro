@echo off
REM ===========================================================================
REM SecureAuthX Pro — Development setup (Windows PowerShell)
REM ===========================================================================
setlocal

echo [1/5] Installing dependencies with pnpm...
call pnpm install
if errorlevel 1 (echo FAILED: pnpm install & exit /b 1)

echo [2/5] Generating Prisma client...
call pnpm db:generate
if errorlevel 1 (echo FAILED: prisma generate & exit /b 1)

echo [3/5] Starting infrastructure (PostgreSQL + Redis)...
docker compose -f docker/docker-compose.yml --profile infra up -d
if errorlevel 1 (echo FAILED: docker compose up & exit /b 1)

echo [4/5] Applying database migrations...
call pnpm db:migrate
if errorlevel 1 (echo FAILED: prisma migrate & exit /b 1)

echo [5/5] Seeding bootstrap administrator...
call pnpm db:seed
if errorlevel 1 (echo FAILED: db seed & exit /b 1)

echo.
echo Setup complete.
echo   API:  http://localhost:4000/api/v1/health
echo   Web:  http://localhost:3000
echo   Run:  pnpm dev
endlocal
