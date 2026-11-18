@echo off
rem 用 UTF-8 输出中文，避免 cmd 默认代码页（936）把中文显示成乱码
chcp 65001 >nul

rem 输出语言判定：显式 APP_LANG=zh|en 优先，否则读 Windows 的界面语言，最后回落英文。
rem 该判定只影响提示文案；目录创建、清理、构建、启动的流程与原脚本完全一致。
set "LANG_CODE=%APP_LANG%"
if not defined LANG_CODE for /f "usebackq delims=" %%i in (`powershell -NoProfile -NonInteractive -Command "[System.Globalization.CultureInfo]::CurrentUICulture.Name" 2^>nul`) do set "LANG_CODE=%%i"
set "LANG_TWO=%LANG_CODE:~0,2%"
if /i "%LANG_TWO%"=="zh" (set "LANG_CODE=zh") else (set "LANG_CODE=en")

rem 文案与 electron/i18n/messages/main.zh.ts / main.en.ts 的 main.script.* 逐条对应，
rem Windows 的键位用 Ctrl+；标签措辞与 README 保持一致。
call :say title
echo.
call :say important
call :say useShortcuts
echo.
call :say shortcutToggle
call :say shortcutScreenshot
call :say shortcutProcess
call :say shortcutMove
call :say shortcutOpacity
call :say shortcutReset
call :say shortcutQuit
echo.
call :say toggleHint
call :say moveHint
echo.

cd /D "%~dp0"

call :say stepDirs
mkdir "%APPDATA%\interview-coder-v1\temp" 2>nul
mkdir "%APPDATA%\interview-coder-v1\cache" 2>nul
mkdir "%APPDATA%\interview-coder-v1\screenshots" 2>nul
mkdir "%APPDATA%\interview-coder-v1\extra_screenshots" 2>nul

call :say stepClean
call :say stepCleanDetail
rmdir /s /q dist dist-electron 2>nul
del /q .env 2>nul

call :say stepBuild
call :say stepBuildDetail
call npm run build

call :say stepLaunch
call :say stepLaunchHint
echo.
set NODE_ENV=production
start /B cmd /c "npx electron ./dist-electron/main.js"

call :say running
echo.
call :say issues
call :say issue1
call :say issue2
call :say issue3
goto :end

:say
if /i "%LANG_CODE%"=="zh" if /i "%~1"=="title" echo === Interview Coder —— 隐身版（无付费墙） ===
if /i "%LANG_CODE%"=="en" if /i "%~1"=="title" echo === Interview Coder - Invisible Edition (No Paywall) ===
if /i "%LANG_CODE%"=="zh" if /i "%~1"=="important" echo 重要：本应用默认是「不可见」的！
if /i "%LANG_CODE%"=="en" if /i "%~1"=="important" echo IMPORTANT: This app is designed to be INVISIBLE by default!
if /i "%LANG_CODE%"=="zh" if /i "%~1"=="useShortcuts" echo 用以下快捷键控制它：
if /i "%LANG_CODE%"=="en" if /i "%~1"=="useShortcuts" echo Use the keyboard shortcuts to control it:
if /i "%LANG_CODE%"=="zh" if /i "%~1"=="shortcutToggle" echo - 显示/隐藏窗口：Ctrl+B
if /i "%LANG_CODE%"=="en" if /i "%~1"=="shortcutToggle" echo - Toggle Window Visibility: Ctrl+B
if /i "%LANG_CODE%"=="zh" if /i "%~1"=="shortcutScreenshot" echo - 截图：Ctrl+H
if /i "%LANG_CODE%"=="en" if /i "%~1"=="shortcutScreenshot" echo - Take Screenshot: Ctrl+H
if /i "%LANG_CODE%"=="zh" if /i "%~1"=="shortcutProcess" echo - 处理截图：Ctrl+Enter
if /i "%LANG_CODE%"=="en" if /i "%~1"=="shortcutProcess" echo - Process Screenshots: Ctrl+Enter
if /i "%LANG_CODE%"=="zh" if /i "%~1"=="shortcutMove" echo - 移动窗口：Ctrl+方向键（左/右/上/下）
if /i "%LANG_CODE%"=="en" if /i "%~1"=="shortcutMove" echo - Move Window: Ctrl+Arrow keys (Left/Right/Up/Down)
if /i "%LANG_CODE%"=="zh" if /i "%~1"=="shortcutOpacity" echo - 降低不透明度：Ctrl+[ / 提高不透明度：Ctrl+]
if /i "%LANG_CODE%"=="en" if /i "%~1"=="shortcutOpacity" echo - Decrease Opacity: Ctrl+[ / Increase Opacity: Ctrl+]
if /i "%LANG_CODE%"=="zh" if /i "%~1"=="shortcutReset" echo - 开始新题目：Ctrl+R
if /i "%LANG_CODE%"=="en" if /i "%~1"=="shortcutReset" echo - Start New Problem: Ctrl+R
if /i "%LANG_CODE%"=="zh" if /i "%~1"=="shortcutQuit" echo - 退出：Ctrl+Q
if /i "%LANG_CODE%"=="en" if /i "%~1"=="shortcutQuit" echo - Quit: Ctrl+Q
if /i "%LANG_CODE%"=="zh" if /i "%~1"=="toggleHint" echo 按下 Ctrl+B 时，窗口会在可见与不可见之间切换。
if /i "%LANG_CODE%"=="en" if /i "%~1"=="toggleHint" echo When you press Ctrl+B, the window will toggle between visible and invisible.
if /i "%LANG_CODE%"=="zh" if /i "%~1"=="moveHint" echo 如果移动快捷键无效，请先用 Ctrl+B 让窗口可见。
if /i "%LANG_CODE%"=="en" if /i "%~1"=="moveHint" echo If movement shortcuts aren't working, try making the window visible first with Ctrl+B.
if /i "%LANG_CODE%"=="zh" if /i "%~1"=="stepDirs" echo === 第 1 步：创建所需目录… ===
if /i "%LANG_CODE%"=="en" if /i "%~1"=="stepDirs" echo === Step 1: Creating required directories... ===
if /i "%LANG_CODE%"=="zh" if /i "%~1"=="stepClean" echo === 第 2 步：清理旧构建… ===
if /i "%LANG_CODE%"=="en" if /i "%~1"=="stepClean" echo === Step 2: Cleaning previous builds... ===
if /i "%LANG_CODE%"=="zh" if /i "%~1"=="stepCleanDetail" echo 删除旧的构建产物，确保从干净状态开始…
if /i "%LANG_CODE%"=="en" if /i "%~1"=="stepCleanDetail" echo Removing old build files to ensure a fresh start...
if /i "%LANG_CODE%"=="zh" if /i "%~1"=="stepBuild" echo === 第 3 步：构建应用… ===
if /i "%LANG_CODE%"=="en" if /i "%~1"=="stepBuild" echo === Step 3: Building application... ===
if /i "%LANG_CODE%"=="zh" if /i "%~1"=="stepBuildDetail" echo 这一步可能需要一点时间…
if /i "%LANG_CODE%"=="en" if /i "%~1"=="stepBuildDetail" echo This may take a moment...
if /i "%LANG_CODE%"=="zh" if /i "%~1"=="stepLaunch" echo === 第 4 步：以隐身模式启动… ===
if /i "%LANG_CODE%"=="en" if /i "%~1"=="stepLaunch" echo === Step 4: Launching in stealth mode... ===
if /i "%LANG_CODE%"=="zh" if /i "%~1"=="stepLaunchHint" echo 记住：Ctrl+B 让窗口可见，Ctrl+[ 和 Ctrl+] 调整不透明度！
if /i "%LANG_CODE%"=="en" if /i "%~1"=="stepLaunchHint" echo Remember: Ctrl+B to make it visible, Ctrl+[ and Ctrl+] to adjust opacity!
if /i "%LANG_CODE%"=="zh" if /i "%~1"=="running" echo 应用已在隐身状态下运行！按 Ctrl+B 让它可见。
if /i "%LANG_CODE%"=="en" if /i "%~1"=="running" echo App is now running invisibly! Press Ctrl+B to make it visible.
if /i "%LANG_CODE%"=="zh" if /i "%~1"=="issues" echo 如果遇到问题：
if /i "%LANG_CODE%"=="en" if /i "%~1"=="issues" echo If you encounter any issues:
if /i "%LANG_CODE%"=="zh" if /i "%~1"=="issue1" echo 1. 确认已用 'npm install' 安装依赖
if /i "%LANG_CODE%"=="en" if /i "%~1"=="issue1" echo 1. Make sure you've installed dependencies with 'npm install'
if /i "%LANG_CODE%"=="zh" if /i "%~1"=="issue2" echo 2. 多次按 Ctrl+B 切换可见性
if /i "%LANG_CODE%"=="en" if /i "%~1"=="issue2" echo 2. Press Ctrl+B multiple times to toggle visibility
if /i "%LANG_CODE%"=="zh" if /i "%~1"=="issue3" echo 3. 在任务管理器中确认应用正在运行
if /i "%LANG_CODE%"=="en" if /i "%~1"=="issue3" echo 3. Check Task Manager to verify the app is running
goto :eof

:end
