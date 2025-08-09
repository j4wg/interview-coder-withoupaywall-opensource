#!/bin/bash
echo "=== Interview Coder - Invisible Edition (No Paywall) ==="
echo
echo "IMPORTANT: This app is designed to be INVISIBLE by default!"
echo "Use the keyboard shortcuts to control it:"
echo
echo "- Toggle Visibility: Cmd+B"
echo "- Take Screenshot: Cmd+H"
echo "- Process Screenshots: Cmd+Enter"
echo "- Move Window: Cmd+Arrows (Left/Right/Up/Down)"
echo "- Adjust Opacity: Cmd+[ (decrease) / Cmd+] (increase)"
echo "- Reset View: Cmd+R"
echo "- Quit App: Cmd+Q"
echo
echo "When you press Cmd+B, the window will toggle between visible and invisible."
echo "If movement shortcuts aren't working, try making the window visible first with Cmd+B."
echo

# Navigate to script directory
cd "$(dirname "$0")"

echo "=== Step 1: Creating required directories... ==="
mkdir -p ~/Library/Application\ Support/interview-coder-v1/temp
mkdir -p ~/Library/Application\ Support/interview-coder-v1/cache
mkdir -p ~/Library/Application\ Support/interview-coder-v1/screenshots
mkdir -p ~/Library/Application\ Support/interview-coder-v1/extra_screenshots

echo "=== Step 2: Cleaning previous builds... ==="
echo "Removing old build files to ensure a fresh start..."
rm -rf dist dist-electron
rm -f .env

echo "=== Step 3: Building application... ==="
echo "This may take a moment..."
npm run build

echo "=== Step 4: Launching in stealth mode... ==="
echo "Remember: Cmd+B to make it visible, Cmd+[ and Cmd+] to adjust opacity!"
echo
export NODE_ENV=production
npx electron ./dist-electron/main.js &

echo "App is now running invisibly! Press Cmd+B to make it visible."
echo
echo "If you encounter any issues:"
echo "1. Make sure you've installed dependencies with 'npm install'"
echo "2. Make sure this script has execute permissions (chmod +x stealth-run.sh)"
echo "3. Press Cmd+B multiple times to toggle visibility"
echo "4. Check Activity Monitor to verify the app is running"
