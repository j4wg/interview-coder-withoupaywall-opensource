import React, { useState } from 'react';
import { Settings, LogOut, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../ui/button';
import { useToast } from '../../contexts/toast';

interface HeaderProps {
  currentLanguage: string;
  setLanguage: (language: string) => void;
  onOpenSettings: () => void;
}

// Available programming languages
const LANGUAGES = [
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'react', label: 'React.js' },
  { value: 'auto', label: 'Auto (Detect from Screen)' },
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

  // Handle logout - clear API key and reload app
  const handleLogout = async () => {
    try {
      // Update config with empty API key
      await window.electronAPI.updateConfig({
        apiKey: '',
      });
      
      showToast('Success', 'Logged out successfully', 'success');
      
      // Reload the app after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Error logging out:', error);
      showToast('Error', 'Failed to log out', 'error');
    }
  };

  // Handle language selection
  const handleLanguageSelect = (lang: string) => {
    setLanguage(lang);
    setDropdownOpen(false);
    
    // Also save the language preference to config
    window.electronAPI.updateConfig({
      language: lang
    }).catch(error => {
      console.error('Failed to save language preference:', error);
    });
  };

  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };

  // Find the current language object
  const currentLangObj = LANGUAGES.find(lang => lang.value === currentLanguage) || LANGUAGES[0];

  return (
    <div className="bg-black p-2 border-b border-white/10 flex items-center justify-between">
      <div className="flex items-center space-x-1">
        <span className="text-white text-sm mr-2">Language:</span>
        <div className="relative">
          <button
            onClick={toggleDropdown}
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
              <div className="py-1">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.value}
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
          title="Settings"
        >
          <Settings className="h-4 w-4 mr-1" />
          <span className="text-xs">Settings</span>
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-red-400/80 hover:text-red-400 hover:bg-white/10"
          onClick={handleLogout}
          title="Log Out"
        >
          <LogOut className="h-4 w-4 mr-1" />
          <span className="text-xs">Log Out</span>
        </Button>
      </div>
    </div>
  );
}
