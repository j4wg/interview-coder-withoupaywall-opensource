import React from 'react';
import { Button } from './ui/button';
import { useI18n } from "../contexts/i18n";

interface WelcomeScreenProps {
  onOpenSettings: () => void;
}

// 欢迎页展示的快捷键清单：文案 key + 按键符号（按键符号不翻译）
const SHORTCUTS = [
  { labelKey: "ui.shortcut.toggleVisibility", keys: "Ctrl+B / Cmd+B" },
  { labelKey: "ui.shortcut.takeScreenshot", keys: "Ctrl+H / Cmd+H" },
  { labelKey: "ui.shortcut.deleteLastScreenshot", keys: "Ctrl+L / Cmd+L" },
  { labelKey: "ui.shortcut.processScreenshots", keys: "Ctrl+Enter / Cmd+Enter" },
  { labelKey: "ui.shortcut.resetView", keys: "Ctrl+R / Cmd+R" },
  { labelKey: "ui.shortcut.quitApp", keys: "Ctrl+Q / Cmd+Q" }
];

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onOpenSettings }) => {
  const { t } = useI18n();

  return (
    <div className="bg-black min-h-screen flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-black border border-white/10 rounded-xl p-6 shadow-lg">
        <h1 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          {/* 产品名不翻译 */}
          <span>Interview Coder</span>
          <span className="text-sm font-normal px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-md">
            {t("ui.welcome.badge")}
          </span>
        </h1>

        <div className="mb-8">
          <h2 className="text-lg font-medium text-white mb-3">{t("ui.welcome.title")}</h2>
          <p className="text-white/70 text-sm mb-4">
            {t("ui.welcome.description")}
          </p>
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-4">
            <h3 className="text-white/90 font-medium mb-2">{t("ui.welcome.shortcutsTitle")}</h3>
            <ul className="space-y-2">
              {SHORTCUTS.map((shortcut) => (
                <li key={shortcut.labelKey} className="flex justify-between text-sm">
                  <span className="text-white/70">{t(shortcut.labelKey)}</span>
                  <span className="text-white/90">{shortcut.keys}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-6">
          <h3 className="text-white/90 font-medium mb-2">{t("ui.welcome.gettingStartedTitle")}</h3>
          <p className="text-white/70 text-sm mb-3">
            {t("ui.welcome.gettingStartedDescription")}
          </p>
          <Button
            className="w-full px-4 py-3 bg-white text-black rounded-xl font-medium hover:bg-white/90 transition-colors flex items-center justify-center gap-2"
            onClick={onOpenSettings}
          >
            {t("ui.welcome.openSettings")}
          </Button>
        </div>

        <div className="text-white/40 text-xs text-center">
          {t("ui.welcome.footer")}
        </div>
      </div>
    </div>
  );
};
