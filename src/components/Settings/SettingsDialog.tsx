import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { useToast } from "../../contexts/toast";
import { useI18n } from "../../contexts/i18n";
import type { Config } from "../../types/electron";
import type { UiLanguageSetting } from "../../../electron/i18n/types";

type APIProvider = "openai" | "gemini" | "anthropic";

type AIModel = {
  id: string;
  name: string;
  // 模型描述走文案表，模型名（name/id）不翻译
  descriptionKey: string;
};

type ModelCategory = {
  key: 'extractionModel' | 'solutionModel' | 'debuggingModel';
  titleKey: string;
  descriptionKey: string;
  openaiModels: AIModel[];
  geminiModels: AIModel[];
  anthropicModels: AIModel[];
};

// 界面语言三档（控件顺序固定：跟随系统 / 中文 / English）
const UI_LANGUAGE_OPTIONS: Array<{
  value: UiLanguageSetting;
  labelKey: string;
}> = [
  { value: "system", labelKey: "ui.settings.interfaceLanguage.system" },
  { value: "zh", labelKey: "ui.settings.interfaceLanguage.zh" },
  { value: "en", labelKey: "ui.settings.interfaceLanguage.en" }
];

// 三类模型各自的候选项：描述文案按"效果/成本"复用同一批 key
const modelCategories: ModelCategory[] = [
  {
    key: 'extractionModel',
    titleKey: 'ui.settings.models.extraction.title',
    descriptionKey: 'ui.settings.models.extraction.description',
    openaiModels: [
      {
        id: "gpt-4o",
        name: "gpt-4o",
        descriptionKey: "ui.settings.model.bestForExtraction"
      },
      {
        id: "gpt-4o-mini",
        name: "gpt-4o-mini",
        descriptionKey: "ui.settings.model.faster"
      }
    ],
    geminiModels: [
      {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        descriptionKey: "ui.settings.model.bestForExtraction"
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        descriptionKey: "ui.settings.model.faster"
      }
    ],
    anthropicModels: [
      {
        id: "claude-3-7-sonnet-20250219",
        name: "Claude 3.7 Sonnet",
        descriptionKey: "ui.settings.model.bestForExtraction"
      },
      {
        id: "claude-3-5-sonnet-20241022",
        name: "Claude 3.5 Sonnet",
        descriptionKey: "ui.settings.model.balanced"
      },
      {
        id: "claude-3-opus-20240229",
        name: "Claude 3 Opus",
        descriptionKey: "ui.settings.model.topTier"
      }
    ]
  },
  {
    key: 'solutionModel',
    titleKey: 'ui.settings.models.solution.title',
    descriptionKey: 'ui.settings.models.solution.description',
    openaiModels: [
      {
        id: "gpt-4o",
        name: "gpt-4o",
        descriptionKey: "ui.settings.model.strongForCoding"
      },
      {
        id: "gpt-4o-mini",
        name: "gpt-4o-mini",
        descriptionKey: "ui.settings.model.faster"
      }
    ],
    geminiModels: [
      {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        descriptionKey: "ui.settings.model.strongForCoding"
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        descriptionKey: "ui.settings.model.faster"
      }
    ],
    anthropicModels: [
      {
        id: "claude-3-7-sonnet-20250219",
        name: "Claude 3.7 Sonnet",
        descriptionKey: "ui.settings.model.strongForCoding"
      },
      {
        id: "claude-3-5-sonnet-20241022",
        name: "Claude 3.5 Sonnet",
        descriptionKey: "ui.settings.model.balanced"
      },
      {
        id: "claude-3-opus-20240229",
        name: "Claude 3 Opus",
        descriptionKey: "ui.settings.model.topTier"
      }
    ]
  },
  {
    key: 'debuggingModel',
    titleKey: 'ui.settings.models.debugging.title',
    descriptionKey: 'ui.settings.models.debugging.description',
    openaiModels: [
      {
        id: "gpt-4o",
        name: "gpt-4o",
        descriptionKey: "ui.settings.model.bestForDebugging"
      },
      {
        id: "gpt-4o-mini",
        name: "gpt-4o-mini",
        descriptionKey: "ui.settings.model.faster"
      }
    ],
    geminiModels: [
      {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        descriptionKey: "ui.settings.model.bestForDebugging"
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        descriptionKey: "ui.settings.model.faster"
      }
    ],
    anthropicModels: [
      {
        id: "claude-3-7-sonnet-20250219",
        name: "Claude 3.7 Sonnet",
        descriptionKey: "ui.settings.model.bestForDebugging"
      },
      {
        id: "claude-3-5-sonnet-20241022",
        name: "Claude 3.5 Sonnet",
        descriptionKey: "ui.settings.model.balanced"
      },
      {
        id: "claude-3-opus-20240229",
        name: "Claude 3 Opus",
        descriptionKey: "ui.settings.model.topTier"
      }
    ]
  }
];

// 各供应商的注册页 / 密钥页与文案 key：三家的操作步骤结构一致，只有链接与第三步措辞不同
const providerHelp: Record<
  APIProvider,
  { signupUrl: string; linkKey: string; keysUrl: string; step3Key: string }
> = {
  openai: {
    signupUrl: "https://platform.openai.com/signup",
    linkKey: "ui.settings.link.openai",
    keysUrl: "https://platform.openai.com/api-keys",
    step3Key: "ui.settings.apiKey.step3.secret"
  },
  gemini: {
    signupUrl: "https://aistudio.google.com/",
    linkKey: "ui.settings.link.gemini",
    keysUrl: "https://aistudio.google.com/app/apikey",
    step3Key: "ui.settings.apiKey.step3.apiKey"
  },
  anthropic: {
    signupUrl: "https://console.anthropic.com/signup",
    linkKey: "ui.settings.link.anthropic",
    keysUrl: "https://console.anthropic.com/settings/keys",
    step3Key: "ui.settings.apiKey.step3.apiKey"
  }
};

interface SettingsDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SettingsDialog({ open: externalOpen, onOpenChange }: SettingsDialogProps) {
  const [open, setOpen] = useState(externalOpen || false);
  const [apiKey, setApiKey] = useState("");
  const [apiProvider, setApiProvider] = useState<APIProvider>("openai");
  const [extractionModel, setExtractionModel] = useState("gpt-4o");
  const [solutionModel, setSolutionModel] = useState("gpt-4o");
  const [debuggingModel, setDebuggingModel] = useState("gpt-4o");
  const [isLoading, setIsLoading] = useState(false);
  const { showToast } = useToast();
  const { t, locale, setting, setSetting } = useI18n();

  // 与外部（App）持有的开关状态保持同步
  useEffect(() => {
    if (externalOpen !== undefined) {
      setOpen(externalOpen);
    }
  }, [externalOpen]);

  // 开关变更：仅在真正变化时回传，避免死循环
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (onOpenChange && newOpen !== externalOpen) {
      onOpenChange(newOpen);
    }
  };

  // 打开时读取当前配置（API Key、供应商、三个模型）
  useEffect(() => {
    if (open) {
      setIsLoading(true);

      window.electronAPI
        .getConfig()
        .then((config: Config) => {
          setApiKey(config.apiKey || "");
          setApiProvider(config.apiProvider || "openai");
          setExtractionModel(config.extractionModel || "gpt-4o");
          setSolutionModel(config.solutionModel || "gpt-4o");
          setDebuggingModel(config.debuggingModel || "gpt-4o");
        })
        .catch((error: unknown) => {
          console.error("加载配置失败：", error);
          showToast(
            t("ui.common.error"),
            t("ui.error.failedToLoadSettings"),
            "error"
          );
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open, showToast, t]);

  // 切换界面语言：写配置后立即生效，不等待"保存设置"
  const handleSelectUiLanguage = async (next: UiLanguageSetting) => {
    if (next === setting) return;
    try {
      await setSetting(next);
    } catch (error) {
      console.error("更新界面语言失败：", error);
      showToast(
        t("ui.common.error"),
        t("ui.error.failedToSaveSettings"),
        "error"
      );
    }
  };

  // 切换供应商：三个模型重置为该供应商的默认模型
  const handleProviderChange = (provider: APIProvider) => {
    setApiProvider(provider);

    if (provider === "openai") {
      setExtractionModel("gpt-4o");
      setSolutionModel("gpt-4o");
      setDebuggingModel("gpt-4o");
    } else if (provider === "gemini") {
      setExtractionModel("gemini-1.5-pro");
      setSolutionModel("gemini-1.5-pro");
      setDebuggingModel("gemini-1.5-pro");
    } else if (provider === "anthropic") {
      setExtractionModel("claude-3-7-sonnet-20250219");
      setSolutionModel("claude-3-7-sonnet-20250219");
      setDebuggingModel("claude-3-7-sonnet-20250219");
    }
  };

  // 保存设置：成功后重载应用，让 API Key / 模型立即作用于主进程
  const handleSave = async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.updateConfig({
        apiKey,
        apiProvider,
        extractionModel,
        solutionModel,
        debuggingModel,
      });

      if (result) {
        showToast(
          t("ui.common.success"),
          t("ui.settings.toast.saved"),
          "success"
        );
        handleOpenChange(false);

        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (error) {
      console.error("保存设置失败：", error);
      showToast(
        t("ui.common.error"),
        t("ui.error.failedToSaveSettings"),
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 展示用脱敏：保留前 4 位与后 4 位
  const maskApiKey = (key: string) => {
    if (!key || key.length < 10) return "";
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  };

  // 用系统浏览器打开外链
  const openExternalLink = (url: string) => {
    window.electronAPI.openLink(url);
  };

  const help = providerHelp[apiProvider];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="sm:max-w-md bg-black border border-white/10 text-white settings-dialog"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(450px, 90vw)',
          height: 'auto',
          minHeight: '400px',
          maxHeight: '90vh',
          overflowY: 'auto',
          zIndex: 9999,
          margin: 0,
          padding: '20px',
          transition: 'opacity 0.25s ease, transform 0.25s ease',
          animation: 'fadeIn 0.25s ease forwards',
          opacity: 0.98
        }}
      >        
        <DialogHeader>
          <DialogTitle>{t("ui.settings.title")}</DialogTitle>
          <DialogDescription className="text-white/70">
            {t("ui.settings.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* 界面语言：跟随系统 / 中文 / English */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white" id="ui-language-label">
              {t("ui.settings.interfaceLanguage")}
            </label>
            <div
              className="flex gap-2"
              role="radiogroup"
              aria-labelledby="ui-language-label"
            >
              {UI_LANGUAGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={setting === option.value}
                  onClick={() => handleSelectUiLanguage(option.value)}
                  className={`flex-1 p-2 rounded-lg cursor-pointer transition-colors text-left ${
                    setting === option.value
                      ? "bg-white/10 border border-white/20"
                      : "bg-black/30 border border-white/5 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        setting === option.value ? "bg-white" : "bg-white/20"
                      }`}
                    />
                    <p className="font-medium text-white text-sm">
                      {t(option.labelKey)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-white/50">
              {t("ui.settings.interfaceLanguageHint")}
            </p>
            <p className="text-xs text-white/50">
              {t("ui.settings.interfaceLanguage.current", {
                locale: t(`ui.settings.interfaceLanguage.${locale}`)
              })}
            </p>
          </div>

          {/* API 供应商 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white">{t("ui.settings.provider")}</label>
            <div className="flex gap-2">
              <div
                className={`flex-1 p-2 rounded-lg cursor-pointer transition-colors ${
                  apiProvider === "openai"
                    ? "bg-white/10 border border-white/20"
                    : "bg-black/30 border border-white/5 hover:bg-white/5"
                }`}
                onClick={() => handleProviderChange("openai")}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      apiProvider === "openai" ? "bg-white" : "bg-white/20"
                    }`}
                  />
                  <div className="flex flex-col">
                    <p className="font-medium text-white text-sm">OpenAI</p>
                    <p className="text-xs text-white/60">{t("ui.settings.provider.openai.models")}</p>
                  </div>
                </div>
              </div>
              <div
                className={`flex-1 p-2 rounded-lg cursor-pointer transition-colors ${
                  apiProvider === "gemini"
                    ? "bg-white/10 border border-white/20"
                    : "bg-black/30 border border-white/5 hover:bg-white/5"
                }`}
                onClick={() => handleProviderChange("gemini")}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      apiProvider === "gemini" ? "bg-white" : "bg-white/20"
                    }`}
                  />
                  <div className="flex flex-col">
                    <p className="font-medium text-white text-sm">Gemini</p>
                    <p className="text-xs text-white/60">{t("ui.settings.provider.gemini.models")}</p>
                  </div>
                </div>
              </div>
              <div
                className={`flex-1 p-2 rounded-lg cursor-pointer transition-colors ${
                  apiProvider === "anthropic"
                    ? "bg-white/10 border border-white/20"
                    : "bg-black/30 border border-white/5 hover:bg-white/5"
                }`}
                onClick={() => handleProviderChange("anthropic")}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      apiProvider === "anthropic" ? "bg-white" : "bg-white/20"
                    }`}
                  />
                  <div className="flex flex-col">
                    <p className="font-medium text-white text-sm">Claude</p>
                    <p className="text-xs text-white/60">{t("ui.settings.provider.anthropic.models")}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-white" htmlFor="apiKey">
            {t(`ui.settings.apiKey.label.${apiProvider}`)}
            </label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                apiProvider === "openai" ? "sk-..." : 
                apiProvider === "gemini" ? t("ui.settings.apiKey.placeholder.gemini") :
                "sk-ant-..."
              }
              className="bg-black/50 border-white/10 text-white"
            />
            {apiKey && (
              <p className="text-xs text-white/50">
                {t("ui.settings.apiKey.current", { key: maskApiKey(apiKey) })}
              </p>
            )}
            <p className="text-xs text-white/50">
              {t("ui.settings.apiKey.storageNote", {
                provider: apiProvider === "openai" ? "OpenAI" : "Google"
              })}
            </p>
            <div className="mt-2 p-2 rounded-md bg-white/5 border border-white/10">
              <p className="text-xs text-white/80 mb-1">{t("ui.settings.apiKey.helpTitle")}</p>
              <p className="text-xs text-white/60 mb-1">
                {t("ui.settings.apiKey.step1")}{" "}
                <button
                  onClick={() => openExternalLink(help.signupUrl)}
                  className="text-blue-400 hover:underline cursor-pointer"
                >
                  {t(help.linkKey)}
                </button>
              </p>
              <p className="text-xs text-white/60 mb-1">
                {t("ui.settings.apiKey.step2")}{" "}
                <button
                  onClick={() => openExternalLink(help.keysUrl)}
                  className="text-blue-400 hover:underline cursor-pointer"
                >
                  {t("ui.settings.link.apiKeys")}
                </button>
              </p>
              <p className="text-xs text-white/60">{t(help.step3Key)}</p>
            </div>
          </div>
          
          <div className="space-y-2 mt-4">
            <label className="text-sm font-medium text-white mb-2 block">{t("ui.shortcut.title")}</label>
            <div className="bg-black/30 border border-white/10 rounded-lg p-3">
              <div className="grid grid-cols-2 gap-y-2 text-xs">
                <div className="text-white/70">{t("ui.shortcut.toggleVisibility")}</div>
                <div className="text-white/90 font-mono">Ctrl+B / Cmd+B</div>
                
                <div className="text-white/70">{t("ui.shortcut.takeScreenshot")}</div>
                <div className="text-white/90 font-mono">Ctrl+H / Cmd+H</div>
                
                <div className="text-white/70">{t("ui.shortcut.processScreenshots")}</div>
                <div className="text-white/90 font-mono">Ctrl+Enter / Cmd+Enter</div>
                
                <div className="text-white/70">{t("ui.shortcut.deleteLastScreenshot")}</div>
                <div className="text-white/90 font-mono">Ctrl+L / Cmd+L</div>
                
                <div className="text-white/70">{t("ui.shortcut.resetView")}</div>
                <div className="text-white/90 font-mono">Ctrl+R / Cmd+R</div>
                
                <div className="text-white/70">{t("ui.shortcut.quitApp")}</div>
                <div className="text-white/90 font-mono">Ctrl+Q / Cmd+Q</div>
                
                <div className="text-white/70">{t("ui.shortcut.moveWindow")}</div>
                <div className="text-white/90 font-mono">Ctrl+Arrow Keys</div>
                
                <div className="text-white/70">{t("ui.shortcut.decreaseOpacity")}</div>
                <div className="text-white/90 font-mono">Ctrl+[ / Cmd+[</div>
                
                <div className="text-white/70">{t("ui.shortcut.increaseOpacity")}</div>
                <div className="text-white/90 font-mono">Ctrl+] / Cmd+]</div>
                
                <div className="text-white/70">{t("ui.shortcut.zoomOut")}</div>
                <div className="text-white/90 font-mono">Ctrl+- / Cmd+-</div>
                
                <div className="text-white/70">{t("ui.shortcut.resetZoom")}</div>
                <div className="text-white/90 font-mono">Ctrl+0 / Cmd+0</div>
                
                <div className="text-white/70">{t("ui.shortcut.zoomIn")}</div>
                <div className="text-white/90 font-mono">Ctrl+= / Cmd+=</div>
              </div>
            </div>
          </div>
          
          <div className="space-y-4 mt-4">
            <label className="text-sm font-medium text-white">{t("ui.settings.models.title")}</label>
            <p className="text-xs text-white/60 -mt-3 mb-2">
              {t("ui.settings.models.description")}
            </p>
            
            {modelCategories.map((category) => {
              // 按当前供应商取候选模型
              const models = 
                apiProvider === "openai" ? category.openaiModels : 
                apiProvider === "gemini" ? category.geminiModels :
                category.anthropicModels;
              
              return (
                <div key={category.key} className="mb-4">
                  <label className="text-sm font-medium text-white mb-1 block">
                    {t(category.titleKey)}
                  </label>
                  <p className="text-xs text-white/60 mb-2">{t(category.descriptionKey)}</p>
                  
                  <div className="space-y-2">
                    {models.map((m) => {
                      // 当前选中值与该类别的 setter
                      const currentValue = 
                        category.key === 'extractionModel' ? extractionModel :
                        category.key === 'solutionModel' ? solutionModel :
                        debuggingModel;
                      
                      const setValue = 
                        category.key === 'extractionModel' ? setExtractionModel :
                        category.key === 'solutionModel' ? setSolutionModel :
                        setDebuggingModel;
                        
                      return (
                        <div
                          key={m.id}
                          className={`p-2 rounded-lg cursor-pointer transition-colors ${
                            currentValue === m.id
                              ? "bg-white/10 border border-white/20"
                              : "bg-black/30 border border-white/5 hover:bg-white/5"
                          }`}
                          onClick={() => setValue(m.id)}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-3 h-3 rounded-full ${
                                currentValue === m.id ? "bg-white" : "bg-white/20"
                              }`}
                            />
                            <div>
                              <p className="font-medium text-white text-xs">{m.name}</p>
                              <p className="text-xs text-white/60">{t(m.descriptionKey)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <DialogFooter className="flex justify-between sm:justify-between">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="border-white/10 hover:bg-white/5 text-white"
          >
            {t("ui.common.cancel")}
          </Button>
          <Button
            className="px-4 py-3 bg-white text-black rounded-xl font-medium hover:bg-white/90 transition-colors"
            onClick={handleSave}
            disabled={isLoading || !apiKey}
          >
            {isLoading ? t("ui.settings.saving") : t("ui.settings.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
