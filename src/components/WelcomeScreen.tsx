import React from 'react';
import { Button } from './ui/button';

interface WelcomeScreenProps {
  onOpenSettings: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onOpenSettings }) => {
  return (
    <div className="bg-black min-h-screen flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-black border border-white/10 rounded-xl p-6 shadow-lg">
        <h1 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <span>Interview Coder</span>
          <span className="text-sm font-normal px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-md">Unlocked Edition</span>
        </h1>

        <div className="mb-8">
          <h2 className="text-lg font-medium text-white mb-3">Welcome to Interview Coder</h2>
          <p className="text-white/70 text-sm mb-4">
            This application helps you ace technical interviews by providing AI-powered
            solutions to coding problems.
          </p>
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-4">
            <h3 className="text-white/90 font-medium mb-2">Global Shortcuts</h3>
            <ul className="space-y-2">
              <li className="flex justify-between text-sm">
                <span className="text-white/70">Toggle Visibility</span>
                <span className="text-white/90">Ctrl+B / Cmd+B</span>
              </li>
              <li className="flex justify-between text-sm">
                <span className="text-white/70">Take Screenshot</span>
                <span className="text-white/90">Ctrl+H / Cmd+H</span>
              </li>
              <li className="flex justify-between text-sm">
                <span className="text-white/70">Delete Last Screenshot</span>
                <span className="text-white/90">Ctrl+L / Cmd+L</span>
              </li>
              <li className="flex justify-between text-sm">
                <span className="text-white/70">Process Screenshots</span>
                <span className="text-white/90">Ctrl+Enter / Cmd+Enter</span>
              </li>
              <li className="flex justify-between text-sm">
                <span className="text-white/70">Reset View</span>
                <span className="text-white/90">Ctrl+R / Cmd+R</span>
              </li>
              <li className="flex justify-between text-sm">
                <span className="text-white/70">Quit App</span>
                <span className="text-white/90">Ctrl+Q / Cmd+Q</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-4">
          <h3 className="text-white/90 font-medium mb-2">Log Files</h3>
          <p className="text-white/70 text-sm mb-2">
            Application logs are stored in your user data directory for debugging purposes.
          </p>
          <p className="text-white/60 text-xs">
            Location: <br/>
            ~/Library/Application Support/interview-coder-v1/logs/ (macOS)<br/><br/>

            %APPDATA%/interview-coder-v1/logs/ (Windows)<br/><br/>

            ~/.config/interview-coder-v1/logs/ (Linux)
          </p>
          <p className="text-white/50 text-xs mt-2">
            Note: Logs are automatically cleared when they exceed 1GB to prevent disk space issues.
          </p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-6">
          <h3 className="text-white/90 font-medium mb-2">Getting Started</h3>
          <p className="text-white/70 text-sm mb-3">
            Before using the application, you need to configure your OpenAI API key.
          </p>
          <Button
            className="w-full px-4 py-3 bg-white text-black rounded-xl font-medium hover:bg-white/90 transition-colors flex items-center justify-center gap-2"
            onClick={onOpenSettings}
          >
            Open Settings
          </Button>
        </div>

        <div className="text-white/40 text-xs text-center">
          Start by taking screenshots of your coding problem (Ctrl+H / Cmd+H)
        </div>
      </div>
    </div>
  );
};