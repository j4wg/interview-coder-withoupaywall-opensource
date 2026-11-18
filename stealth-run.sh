#!/bin/bash
# 输出语言判定：显式 APP_LANG=zh|en 优先，其次看 LC_ALL / LC_MESSAGES / LANG 的语言前缀，
# 都没有时（macOS）读系统区域设置，最后回落英文。
# 该判定只影响提示文案；目录创建、清理、构建、启动的流程与原脚本完全一致。

detect_lang() {
  case "${APP_LANG:-}" in
    zh*) echo zh; return ;;
    en*) echo en; return ;;
  esac
  for value in "${LC_ALL:-}" "${LC_MESSAGES:-}" "${LANG:-}"; do
    case "$value" in
      zh*) echo zh; return ;;
    esac
  done
  if command -v defaults >/dev/null 2>&1; then
    case "$(defaults read -g AppleLocale 2>/dev/null)" in
      zh*) echo zh; return ;;
    esac
  fi
  echo en
}

LANG_CODE="$(detect_lang)"

# 文案与 electron/i18n/messages/main.zh.ts / main.en.ts 的 main.script.* 逐条对应，
# shell 读不到 TS，两边靠 tests/mainMessages.test.mjs 比对保持一致。
say() {
  case "$LANG_CODE:$1" in
    zh:title) echo "=== Interview Coder —— 隐身版（无付费墙） ===" ;;
    en:title) echo "=== Interview Coder - Invisible Edition (No Paywall) ===" ;;
    zh:important) echo "重要：本应用默认是「不可见」的！" ;;
    en:important) echo "IMPORTANT: This app is designed to be INVISIBLE by default!" ;;
    zh:useShortcuts) echo "用以下快捷键控制它：" ;;
    en:useShortcuts) echo "Use the keyboard shortcuts to control it:" ;;
    zh:shortcutToggle) echo "- 显示/隐藏窗口：Cmd+B" ;;
    en:shortcutToggle) echo "- Toggle Window Visibility: Cmd+B" ;;
    zh:shortcutScreenshot) echo "- 截图：Cmd+H" ;;
    en:shortcutScreenshot) echo "- Take Screenshot: Cmd+H" ;;
    zh:shortcutProcess) echo "- 处理截图：Cmd+Enter" ;;
    en:shortcutProcess) echo "- Process Screenshots: Cmd+Enter" ;;
    zh:shortcutMove) echo "- 移动窗口：Cmd+方向键（左/右/上/下）" ;;
    en:shortcutMove) echo "- Move Window: Cmd+Arrow keys (Left/Right/Up/Down)" ;;
    zh:shortcutOpacity) echo "- 降低不透明度：Cmd+[ / 提高不透明度：Cmd+]" ;;
    en:shortcutOpacity) echo "- Decrease Opacity: Cmd+[ / Increase Opacity: Cmd+]" ;;
    zh:shortcutReset) echo "- 开始新题目：Cmd+R" ;;
    en:shortcutReset) echo "- Start New Problem: Cmd+R" ;;
    zh:shortcutQuit) echo "- 退出：Cmd+Q" ;;
    en:shortcutQuit) echo "- Quit: Cmd+Q" ;;
    zh:toggleHint) echo "按下 Cmd+B 时，窗口会在可见与不可见之间切换。" ;;
    en:toggleHint) echo "When you press Cmd+B, the window will toggle between visible and invisible." ;;
    zh:moveHint) echo "如果移动快捷键无效，请先用 Cmd+B 让窗口可见。" ;;
    en:moveHint) echo "If movement shortcuts aren't working, try making the window visible first with Cmd+B." ;;
    zh:stepDirs) echo "=== 第 1 步：创建所需目录… ===" ;;
    en:stepDirs) echo "=== Step 1: Creating required directories... ===" ;;
    zh:stepClean) echo "=== 第 2 步：清理旧构建… ===" ;;
    en:stepClean) echo "=== Step 2: Cleaning previous builds... ===" ;;
    zh:stepCleanDetail) echo "删除旧的构建产物，确保从干净状态开始…" ;;
    en:stepCleanDetail) echo "Removing old build files to ensure a fresh start..." ;;
    zh:stepBuild) echo "=== 第 3 步：构建应用… ===" ;;
    en:stepBuild) echo "=== Step 3: Building application... ===" ;;
    zh:stepBuildDetail) echo "这一步可能需要一点时间…" ;;
    en:stepBuildDetail) echo "This may take a moment..." ;;
    zh:stepLaunch) echo "=== 第 4 步：以隐身模式启动… ===" ;;
    en:stepLaunch) echo "=== Step 4: Launching in stealth mode... ===" ;;
    zh:stepLaunchHint) echo "记住：Cmd+B 让窗口可见，Cmd+[ 和 Cmd+] 调整不透明度！" ;;
    en:stepLaunchHint) echo "Remember: Cmd+B to make it visible, Cmd+[ and Cmd+] to adjust opacity!" ;;
    zh:running) echo "应用已在隐身状态下运行！按 Cmd+B 让它可见。" ;;
    en:running) echo "App is now running invisibly! Press Cmd+B to make it visible." ;;
    zh:issues) echo "如果遇到问题：" ;;
    en:issues) echo "If you encounter any issues:" ;;
    zh:issue1) echo "1. 确认已用 'npm install' 安装依赖" ;;
    en:issue1) echo "1. Make sure you've installed dependencies with 'npm install'" ;;
    zh:issue2) echo "2. 确认脚本有执行权限（chmod +x stealth-run.sh）" ;;
    en:issue2) echo "2. Make sure this script has execute permissions (chmod +x stealth-run.sh)" ;;
    zh:issue3) echo "3. 多次按 Cmd+B 切换可见性" ;;
    en:issue3) echo "3. Press Cmd+B multiple times to toggle visibility" ;;
    zh:issue4) echo "4. 在活动监视器中确认应用正在运行" ;;
    en:issue4) echo "4. Check Activity Monitor to verify the app is running" ;;
  esac
}

say title
echo
say important
say useShortcuts
echo
say shortcutToggle
say shortcutScreenshot
say shortcutProcess
say shortcutMove
say shortcutOpacity
say shortcutReset
say shortcutQuit
echo
say toggleHint
say moveHint
echo

# 切换到脚本所在目录
cd "$(dirname "$0")"

say stepDirs
mkdir -p ~/Library/Application\ Support/interview-coder-v1/temp
mkdir -p ~/Library/Application\ Support/interview-coder-v1/cache
mkdir -p ~/Library/Application\ Support/interview-coder-v1/screenshots
mkdir -p ~/Library/Application\ Support/interview-coder-v1/extra_screenshots

say stepClean
say stepCleanDetail
rm -rf dist dist-electron
rm -f .env

say stepBuild
say stepBuildDetail
npm run build

say stepLaunch
say stepLaunchHint
echo
export NODE_ENV=production
npx electron ./dist-electron/main.js &

say running
echo
say issues
say issue1
say issue2
say issue3
say issue4
