@echo off
setlocal EnableExtensions DisableDelayedExpansion
title Arena Sahabat - Server Guru
chcp 65001 >nul
echo.
echo ======================================================
echo                 ARENA SAHABAT
echo            Peluncur untuk laptop guru
echo ======================================================
echo.

pushd "%~dp0" 2>nul
if errorlevel 1 goto folder_error

if not exist "runtime\node.exe" goto runtime_error
if not exist "peluncur.js" goto launcher_error

set "PORT=3000"
set "OPEN_ADMIN=1"
"runtime\node.exe" "peluncur.js"
if errorlevel 1 goto start_error

echo.
echo Server sudah dihentikan. Tekan tombol apa saja untuk menutup.
pause >nul
popd
exit /b 0

:runtime_error
echo [BELUM BISA DIMULAI] File runtime\node.exe tidak ditemukan.
echo Ekstrak seluruh ZIP Arena Sahabat dahulu, lalu buka folder hasilnya.
echo Jangan menjalankan game langsung dari dalam ZIP.
goto failed

:launcher_error
echo [BELUM BISA DIMULAI] File peluncur.js tidak ditemukan.
echo Ekstrak ulang paket game lengkap. Jangan pindahkan file ini sendirian.
goto failed

:start_error
echo.
echo Game belum berhasil dijalankan. Lihat pesan di atas.
echo Panduan bantuan tersedia dalam file BACA DULU.txt.
goto failed

:folder_error
echo [BELUM BISA DIMULAI] Folder game tidak dapat dibuka.
echo Salin seluruh folder ke Documents di laptop, lalu coba lagi.
echo.
pause
exit /b 1

:failed
echo.
echo Tekan tombol apa saja untuk menutup jendela ini.
pause >nul
popd
exit /b 1
