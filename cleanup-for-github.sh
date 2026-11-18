#!/bin/bash
# 输出语言判定：显式 APP_LANG=zh|en 优先，其次看 LC_ALL / LC_MESSAGES / LANG 的语言前缀，
# 都没有时（macOS）读系统区域设置，最后回落英文。只影响提示文案。

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

# 文案与 electron/i18n/messages/main.zh.ts / main.en.ts 的 main.script.cleanup.* 逐条对应
say() {
  case "$LANG_CODE:$1" in
    zh:start) echo "正在清理项目，以便提交到 GitHub…" ;;
    en:start) echo "Cleaning up project for GitHub..." ;;
    zh:rmNodeModules) echo "正在删除 node_modules 目录…" ;;
    en:rmNodeModules) echo "Removing node_modules directory..." ;;
    zh:rmDist) echo "正在删除 dist 目录…" ;;
    en:rmDist) echo "Removing dist directory..." ;;
    zh:rmDistElectron) echo "正在删除 dist-electron 目录…" ;;
    en:rmDistElectron) echo "Removing dist-electron directory..." ;;
    zh:rmRelease) echo "正在删除 release 目录…" ;;
    en:rmRelease) echo "Removing release directory..." ;;
    zh:rmPackageLock) echo "正在删除 package-lock.json…" ;;
    en:rmPackageLock) echo "Removing package-lock.json..." ;;
    zh:rmEnv) echo "正在删除所有 .env 文件…" ;;
    en:rmEnv) echo "Removing any .env files..." ;;
    zh:done) echo "清理完成！" ;;
    en:done) echo "Cleanup complete!" ;;
    zh:ready) echo "可以提交到 GitHub 了。" ;;
    en:ready) echo "Ready to commit to GitHub." ;;
    zh:afterClone) echo "克隆后请运行 'npm install' 安装依赖。" ;;
    en:afterClone) echo "Run 'npm install' after cloning to install dependencies." ;;
    zh:pressEnter) echo "按回车键继续…" ;;
    en:pressEnter) echo "Press Enter to continue..." ;;
  esac
}

say start
echo

say rmNodeModules
rm -rf node_modules

say rmDist
rm -rf dist

say rmDistElectron
rm -rf dist-electron

say rmRelease
rm -rf release

say rmPackageLock
rm -f package-lock.json

say rmEnv
rm -f .env .env.local .env.development .env.production
echo

say done
say ready
say afterClone
say pressEnter
read
