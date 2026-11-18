import React, { useState } from 'react';
import { Settings, LogOut, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../ui/button';
import { useToast } from '../../contexts/toast';
import { useI18n } from "../../contexts/i18n";

interface HeaderProps {
  currentLanguage: string;
  setLanguage: (language: string) => void;
  onOpenSettings: () => void;
}

// 可选的编程语言：名称（语言名不翻译）+ 运行时值
const LANGUAGES = [
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'typescript', label: 'TypeScript' },
];

export function Header({ currentLanguage, setLanguage, onOpenSettings }: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { showToast } = useToast();
  const { t } = useI18n();

  // 退出登录：清空 API Key 并重载应用
  const handleLogout = async () => {
    try {
      await window.electronAPI.updateConfig({
        apiKey: '',
      });

      showToast(t("ui.common.success"), t("ui.header.toast.loggedOut"), 'success');

      // 稍作延迟后重载，让主进程用空 Key 重新初始化
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('退出登录出错：', error);
      showToast(t("ui.common.error"), t("ui.header.toast.logoutFailed"), 'error');
    }
  };

  // 切换编程语言并落盘（不影响界面语言）
  const handleLanguageSelect = (lang: string) => {
    setLanguage(lang);
    setDropdownOpen(false);

    window.electronAPI.updateConfig({
      language: lang
    }).catch(error => {
      console.error('保存编程语言偏好失败：', error);
    });
  };

  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };

  // 当前编程语言对象（配置值异常时回落到第一项）
  const currentLangObj = LANGUAGES.find(lang => lang.value === currentLanguage) || LANGUAGES[0];

  return (
    <div className="bg-black p-2 border-b border-white/10 flex items-center justify-between">
      <div className="flex items-center space-x-1">
        <span className="text-white text-sm mr-2">{t("ui.header.programmingLanguageLabel")}</span>
        <div className="relative">
          <button
            onClick={toggleDropdown}
            aria-haspopup="listbox"
            aria-expanded={dropdownOpen}
            aria-label={t("ui.common.programmingLanguage")}
            className="flex items-center gap-1 rounded-md bg-white/5 px-3 py-1.5 text-sm text-white hover:bg-white/10 transition-colors"
          >
            {currentLangObj.label}
            {dropdownOpen ? (
              <ChevronUp className="h-4 w-4 text-white/70" />
            ) : (
              <ChevronDown className="h-4 w-4 text-white/70" />
            )}
          </button>

          {dropdownOpen && (
            <div className="absolute z-10 mt-1 w-full rounded-md bg-black border border-white/10 shadow-lg">
              <div className="py-1" role="listbox">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.value}
                    role="option"
                    aria-selected={currentLanguage === lang.value}
                    onClick={() => handleLanguageSelect(lang.value)}
                    className={`block w-full text-left px-4 py-2 text-sm ${
                      currentLanguage === lang.value
                        ? 'bg-white/10 text-white'
                        : 'text-white/70 hover:bg-white/5'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-white/70 hover:text-white hover:bg-white/10"
          onClick={onOpenSettings}
          title={t("ui.common.settings")}
        >
          <Settings className="h-4 w-4 mr-1" />
          <span className="text-xs">{t("ui.common.settings")}</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-red-400/80 hover:text-red-400 hover:bg-white/10"
          onClick={handleLogout}
          title={t("ui.common.logOut")}
        >
          <LogOut className="h-4 w-4 mr-1" />
          <span className="text-xs">{t("ui.common.logOut")}</span>
        </Button>
      </div>
    </div>
  );
}
