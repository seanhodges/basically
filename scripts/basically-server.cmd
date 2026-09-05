@echo off
rem The Basically toolchain, kept running. Rebuilds the bundle when it is stale,
rem so the client and the host are never built from different source.

setlocal

rem Look for node on PATH, which is required to run the toolchain. Node 22 or newer 
rem is required because the toolchain uses ES modules and top-level await.
where node >nul 2>nul
if errorlevel 1 (
  echo [basically-server] Node.js was not found on PATH. Install Node 22 or newer.>&2
  exit /b 1
)

pushd "%~dp0.."
if errorlevel 1 (
  echo [basically-server] Could not enter the repository root.>&2
  exit /b 1
)

set "BUNDLE=scripts\headless\dist\server.mjs"
rem The whole of src/, not just the toolchain's own folders: the bundle inlines
rem the dialect registry and every emulator with it, so a change to a machine is
rem as much a stale bundle as a change to an operation.
set "SOURCES=scripts/headless src"

rem "dist" is skipped: the build's own output lives under scripts/headless, and
rem the three bundles are written one after another - so counting them would find
rem the later ones newer than the first and rebuild on every single invocation.
node -e "const fs=require('fs'),p=require('path');const newer=(d,t)=>fs.readdirSync(d,{withFileTypes:true}).some((e)=>{if(e.name==='dist')return false;const f=p.join(d,e.name);return e.isDirectory()?newer(f,t):fs.statSync(f).mtimeMs>t});let stale=true;try{const t=fs.statSync(process.argv[1]).mtimeMs;stale=process.argv.slice(2).some((d)=>newer(d,t))}catch{}process.exit(stale?0:1)" "%BUNDLE%" %SOURCES%
if not errorlevel 1 (
  echo [basically-server] Building %BUNDLE%...>&2
  node scripts\headless\build.mjs >&2
  if errorlevel 1 (
    popd
    exit /b 1
  )
)

rem The runner writes UTF-8. A codepage outlives the process that sets it, 
rem so remember the old one and put it back.
set "PREV_CP="
for /f "tokens=2 delims=:" %%C in ('chcp') do for /f "tokens=1" %%D in ("%%C") do set "PREV_CP=%%D"
chcp 65001 >nul 2>nul

node "%BUNDLE%" %*
set "EXITCODE=%ERRORLEVEL%"

if defined PREV_CP chcp %PREV_CP% >nul 2>nul
popd
exit /b %EXITCODE%
