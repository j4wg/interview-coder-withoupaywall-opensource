@echo off
rem 用 UTF-8 输出中文，避免 cmd 默认代码页（936）把中文显示成乱码
chcp 65001 >nul

rem 输出语言判定：显式 APP_LANG=zh|en 优先，否则读 Windows 的界面语言，最后回落英文。
set "LANG_CODE=%APP_LANG%"
if not defined LANG_CODE for /f "usebackq delims=" %%i in (`powershell -NoProfile -NonInteractive -Command "[System.Globalization.CultureInfo]::CurrentUICulture.Name" 2^>nul`) do set "LANG_CODE=%%i"
set "LANG_TWO=%LANG_CODE:~0,2%"
if /i "%LANG_TWO%"=="zh" (set "LANG_CODE=zh") else (set "LANG_CODE=en")

rem 文案与 electron/i18n/messages/main.zh.ts / main.en.ts 的 main.script.cleanup.* 逐条对应
call :say start
echo.

call :say rmNodeModules
if exist node_modules rmdir /s /q node_modules

call :say rmDist
if exist dist rmdir /s /q dist

call :say rmDistElectron
if exist dist-electron rmdir /s /q dist-electron

call :say rmRelease
if exist release rmdir /s /q release

call :say rmPackageLock
if exist package-lock.json del package-lock.json

call :say rmEnv
if exist .env del .env
if exist .env.local del .env.local
if exist .env.development del .env.development
if exist .env.production del .env.production
echo.

call :say done
call :say ready
call :say afterClone
call :say pressEnter
pause
goto :end

:say
if /i "%LANG_CODE%"=="zh" if /i "%~1"=="start" echo 正在清理项目，以便提交到 GitHub…
if /i "%LANG_CODE%"=="en" if /i "%~1"=="start" echo Cleaning up project for GitHub...
if /i "%LANG_CODE%"=="zh" if /i "%~1"=="rmNodeModules" echo 正在删除 node_modules 目录…
if /i "%LANG_CODE%"=="en" if /i "%~1"=="rmNodeModules" echo Removing node_modules directory...
if /i "%LANG_CODE%"=="zh" if /i "%~1"=="rmDist" echo 正在删除 dist 目录…
if /i "%LANG_CODE%"=="en" if /i "%~1"=="rmDist" echo Removing dist directory...
if /i "%LANG_CODE%"=="zh" if /i "%~1"=="rmDistElectron" echo 正在删除 dist-electron 目录…
if /i "%LANG_CODE%"=="en" if /i "%~1"=="rmDistElectron" echo Removing dist-electron directory...
if /i "%LANG_CODE%"=="zh" if /i "%~1"=="rmRelease" echo 正在删除 release 目录…
if /i "%LANG_CODE%"=="en" if /i "%~1"=="rmRelease" echo Removing release directory...
if /i "%LANG_CODE%"=="zh" if /i "%~1"=="rmPackageLock" echo 正在删除 package-lock.json…
if /i "%LANG_CODE%"=="en" if /i "%~1"=="rmPackageLock" echo Removing package-lock.json...
if /i "%LANG_CODE%"=="zh" if /i "%~1"=="rmEnv" echo 正在删除所有 .env 文件…
if /i "%LANG_CODE%"=="en" if /i "%~1"=="rmEnv" echo Removing any .env files...
if /i "%LANG_CODE%"=="zh" if /i "%~1"=="done" echo 清理完成！
if /i "%LANG_CODE%"=="en" if /i "%~1"=="done" echo Cleanup complete!
if /i "%LANG_CODE%"=="zh" if /i "%~1"=="ready" echo 可以提交到 GitHub 了。
if /i "%LANG_CODE%"=="en" if /i "%~1"=="ready" echo Ready to commit to GitHub.
if /i "%LANG_CODE%"=="zh" if /i "%~1"=="afterClone" echo 克隆后请运行 'npm install' 安装依赖。
if /i "%LANG_CODE%"=="en" if /i "%~1"=="afterClone" echo Run 'npm install' after cloning to install dependencies.
if /i "%LANG_CODE%"=="zh" if /i "%~1"=="pressEnter" echo 按回车键继续…
if /i "%LANG_CODE%"=="en" if /i "%~1"=="pressEnter" echo Press Enter to continue...
goto :eof

:end
