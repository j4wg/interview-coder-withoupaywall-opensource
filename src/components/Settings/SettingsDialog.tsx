import { useEffect, useRef, useState } from "react"
import { Eye, EyeOff, Info, Plus, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { useToast } from "../../contexts/toast"
import { useI18n } from "../../contexts/i18n"
import type {
  ApiFormat,
  Config,
  ModelBindings,
  ProviderConfig
} from "../../types/electron"
import type { UiLanguageSetting } from "../../../electron/i18n/types"
import {
  API_FORMAT_OPTIONS,
  BINDING_FIELDS,
  DEFAULT_API_FORMAT,
  EMPTY_BINDINGS,
  addModel,
  normalizeBindings,
  normalizeProviderConfig,
  parseListModels
} from "./modelConfig"

// 界面语言三档（控件顺序固定：跟随系统 / 中文 / English）
const UI_LANGUAGE_OPTIONS: Array<{
  value: UiLanguageSetting;
  labelKey: string;
}> = [
  { value: "system", labelKey: "ui.settings.interfaceLanguage.system" },
  { value: "zh", labelKey: "ui.settings.interfaceLanguage.zh" },
  { value: "en", labelKey: "ui.settings.interfaceLanguage.en" }
];

// 下拉框统一样式：与既有输入框同一套 token，禁用态降低对比度
const SELECT_CLASS =
  "w-full h-9 px-3 rounded-md bg-black/50 border border-white/10 text-white text-sm " +
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 " +
  "disabled:cursor-not-allowed disabled:opacity-50"

interface SettingsDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SettingsDialog({ open: externalOpen, onOpenChange }: SettingsDialogProps) {
  const [open, setOpen] = useState(externalOpen || false);
  // 供应商表单：Base URL / API 格式 / API Key / 模型列表
  const [baseUrl, setBaseUrl] = useState("");
  const [apiFormat, setApiFormat] = useState<ApiFormat>(DEFAULT_API_FORMAT);
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [bindings, setBindings] = useState<ModelBindings>(EMPTY_BINDINGS);
  const [showApiKey, setShowApiKey] = useState(false);
  // 手工添加模型
  const [addModelOpen, setAddModelOpen] = useState(false);
  const [newModelId, setNewModelId] = useState("");
  const [addModelError, setAddModelError] = useState<string | null>(null);
  // 拉取模型列表
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchedModels, setFetchedModels] = useState<string[] | null>(null);
  const [fetchedSelection, setFetchedSelection] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();
  const { t, locale, setting, setSetting } = useI18n();
  const addModelInputRef = useRef<HTMLInputElement>(null);

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

  // 打开时读取当前配置（供应商四项 + 三用途绑定）
  useEffect(() => {
    if (open) {
      setIsLoading(true);

      // 每次打开都重置临时交互态，避免上次的拉取结果与报错残留
      setAddModelOpen(false);
      setNewModelId("");
      setAddModelError(null);
      setFetchError(null);
      setFetchedModels(null);
      setFetchedSelection([]);

      window.electronAPI
        .getConfig()
        .then((config: Config) => {
          const normalized = normalizeProviderConfig(config);
          setBaseUrl(normalized.provider.baseUrl);
          setApiFormat(normalized.provider.apiFormat);
          setApiKey(normalized.provider.apiKey);
          setModels(normalized.provider.models);
          setBindings(normalized.bindings);
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

  // 展开"添加模型"后把焦点放进输入框，键盘用户不必再 Tab 一轮
  useEffect(() => {
    if (addModelOpen) {
      addModelInputRef.current?.focus();
    }
  }, [addModelOpen]);

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

  // 模型列表变更后同步归一三用途绑定（删掉正在使用的模型时回落到列表首项）
  const commitModels = (nextModels: string[]) => {
    setModels(nextModels);
    setBindings((prev) => normalizeBindings(prev, nextModels));
  };

  // 手工添加：去空白、重复即报错、成功后关闭输入行
  const handleAddModel = () => {
    const id = newModelId.trim();
    if (!id) {
      setAddModelError(t("ui.settings.models.addEmpty"));
      return;
    }
    if (models.includes(id)) {
      setAddModelError(t("ui.settings.models.addDuplicate", { model: id }));
      return;
    }
    commitModels(addModel(models, id));
    setNewModelId("");
    setAddModelError(null);
    setAddModelOpen(false);
  };

  const handleRemoveModel = (id: string) => {
    commitModels(models.filter((model) => model !== id));
    setFetchedSelection((prev) => prev.filter((model) => model !== id));
  };

  // 拉取模型列表：只用真实 IPC 通道；通道缺失/失败时只提示，不阻塞手工添加
  const handleFetchModels = async () => {
    const trimmedBaseUrl = baseUrl.trim();
    if (!trimmedBaseUrl) {
      setFetchedModels(null);
      setFetchError(t("ui.settings.models.fetchNeedsBaseUrl"));
      return;
    }

    setIsFetchingModels(true);
    setFetchError(null);

    try {
      const listModels = window.electronAPI.listModels;
      if (typeof listModels !== "function") {
        throw new Error(t("ui.settings.models.fetchUnavailable"));
      }

      const result = await listModels({
        baseUrl: trimmedBaseUrl,
        apiFormat,
        apiKey: apiKey.trim()
      });
      setFetchedModels(parseListModels(result));
      setFetchedSelection([]);
    } catch (error) {
      console.error("拉取模型列表失败：", error);
      setFetchedModels(null);
      setFetchError(
        error instanceof Error && error.message
          ? error.message
          : t("ui.settings.models.fetchUnknownError")
      );
    } finally {
      setIsFetchingModels(false);
    }
  };

  // 勾选加入：只在没加过的模型上保留可选，加入时统一去重
  const handleToggleFetched = (id: string) => {
    setFetchedSelection((prev) =>
      prev.includes(id) ? prev.filter((model) => model !== id) : [...prev, id]
    );
  };

  const handleAddSelectedModels = () => {
    if (fetchedSelection.length === 0) return;
    const nextModels = fetchedSelection.reduce(
      (acc, id) => addModel(acc, id),
      models
    );
    commitModels(nextModels);
    showToast(
      t("ui.common.success"),
      t("ui.settings.models.fetchAdded", {
        count: String(fetchedSelection.length)
      }),
      "success"
    );
    setFetchedSelection([]);
    setFetchedModels(null);
  };

  // 保存设置：成功后重载应用，让 API Key / 模型立即作用于主进程
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const provider: ProviderConfig = {
        baseUrl: baseUrl.trim(),
        apiFormat,
        apiKey: apiKey.trim(),
        models
      };

      const result = await window.electronAPI.updateConfig({
        provider,
        bindings: normalizeBindings(bindings, models)
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
      setIsSaving(false);
    }
  };

  const hasModels = models.length > 0;

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
                  className={`flex-1 p-1.5 rounded-lg cursor-pointer transition-colors text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 ${
                    setting === option.value
                      ? "bg-white/10 border border-white/20"
                      : "bg-black/30 border border-white/5 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 shrink-0 rounded-full ${
                        setting === option.value ? "bg-white" : "bg-white/20"
                      }`}
                    />
                    <p className="font-medium text-white text-[13px] whitespace-nowrap">
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

          {/* Base URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white" htmlFor="provider-base-url">
              {t("ui.settings.baseUrl.label")}
            </label>
            <Input
              id="provider-base-url"
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={t("ui.settings.baseUrl.placeholder")}
              spellCheck={false}
              autoComplete="off"
              className="bg-black/50 border-white/10 text-white placeholder:text-white/30"
            />
          </div>

          {/* API 格式三选一 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white" htmlFor="provider-api-format">
              {t("ui.settings.apiFormat.label")}
            </label>
            <select
              id="provider-api-format"
              value={apiFormat}
              onChange={(e) => setApiFormat(e.target.value as ApiFormat)}
              className={SELECT_CLASS}
            >
              {API_FORMAT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </div>

          {/* API Key：可切换明文/密文 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white" htmlFor="provider-api-key">
              {t("ui.settings.apiKey.label")}
            </label>
            <div className="relative">
              <Input
                id="provider-api-key"
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={t("ui.settings.apiKey.placeholder")}
                spellCheck={false}
                autoComplete="off"
                className="bg-black/50 border-white/10 text-white pr-10 placeholder:text-white/30"
              />
              <button
                type="button"
                onClick={() => setShowApiKey((prev) => !prev)}
                aria-label={
                  showApiKey
                    ? t("ui.settings.apiKey.hide")
                    : t("ui.settings.apiKey.show")
                }
                aria-pressed={showApiKey}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-2 rounded-md text-white/60 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
              >
                {showApiKey ? (
                  <EyeOff className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Eye className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {/* 模型列表 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-medium text-white" id="model-list-label">
                {t("ui.settings.models.listTitle")}
              </label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleFetchModels}
                  disabled={isFetchingModels}
                  className="border-white/10 bg-black/40 text-white hover:bg-white/10 hover:text-white"
                >
                  {isFetchingModels
                    ? t("ui.settings.models.fetching")
                    : t("ui.settings.models.fetch")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  aria-expanded={addModelOpen}
                  onClick={() => {
                    setAddModelOpen((prev) => !prev);
                    setAddModelError(null);
                  }}
                  className="bg-white/10 text-white hover:bg-white/20"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                  {t("ui.settings.models.add")}
                </Button>
              </div>
            </div>

            {/* 手工添加模型 ID */}
            {addModelOpen && (
              <form
                className="space-y-1"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleAddModel();
                }}
              >
                <div className="flex items-center gap-2">
                  <Input
                    ref={addModelInputRef}
                    aria-label={t("ui.settings.models.addInputLabel")}
                    value={newModelId}
                    onChange={(e) => {
                      setNewModelId(e.target.value);
                      setAddModelError(null);
                    }}
                    placeholder={t("ui.settings.models.addPlaceholder")}
                    spellCheck={false}
                    autoComplete="off"
                    className="bg-black/50 border-white/10 text-white placeholder:text-white/30"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="bg-white text-black hover:bg-white/90 shrink-0"
                  >
                    {t("ui.settings.models.addConfirm")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAddModelOpen(false);
                      setNewModelId("");
                      setAddModelError(null);
                    }}
                    className="text-white/70 hover:text-white shrink-0"
                  >
                    {t("ui.common.cancel")}
                  </Button>
                </div>
                {addModelError && (
                  <p role="alert" className="text-xs text-red-300">
                    {addModelError}
                  </p>
                )}
              </form>
            )}

            {/* 已配置的模型：每条可删除 */}
            <ul className="space-y-2" aria-labelledby="model-list-label">
              {models.map((model) => (
                <li
                  key={model}
                  className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-black/30 border border-white/5"
                >
                  <span className="text-xs text-white/90 font-mono break-all">
                    {model}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveModel(model)}
                    aria-label={t("ui.settings.models.remove", { model })}
                    className="p-1 rounded-md text-white/50 hover:text-red-300 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>

            {/* 空态：与设计稿文案一致 */}
            {!hasModels && (
              <div className="flex items-start gap-2 p-3 rounded-lg border border-dashed border-white/15 text-xs text-white/60">
                <Info className="w-4 h-4 shrink-0" aria-hidden="true" />
                <p>{t("ui.settings.models.empty")}</p>
              </div>
            )}

            {/* 拉取失败：当前语言的错误提示 + 重试，手工添加仍可用 */}
            {fetchError && (
              <div
                role="alert"
                className="space-y-1 p-2 rounded-lg border border-red-400/30 bg-red-500/10 text-xs text-red-200"
              >
                <p>
                  {t("ui.settings.models.fetchFailed", { message: fetchError })}
                </p>
                <p className="text-white/60">
                  {t("ui.settings.models.fetchManualHint")}
                </p>
                <button
                  type="button"
                  onClick={handleFetchModels}
                  disabled={isFetchingModels}
                  className="text-blue-300 underline-offset-2 hover:underline disabled:opacity-50"
                >
                  {t("ui.settings.models.retry")}
                </button>
              </div>
            )}

            {/* 拉取成功：勾选后加入列表 */}
            {fetchedModels !== null && (
              <div className="space-y-2 p-2 rounded-lg bg-white/5 border border-white/10">
                <p className="text-xs text-white/80">
                  {t("ui.settings.models.fetchResultTitle")}
                </p>
                {fetchedModels.length === 0 ? (
                  <p className="text-xs text-white/60">
                    {t("ui.settings.models.fetchEmpty")}
                  </p>
                ) : (
                  <>
                    <ul className="max-h-40 overflow-y-auto space-y-1">
                      {fetchedModels.map((model) => {
                        const alreadyAdded = models.includes(model);
                        return (
                          <li key={model}>
                            <label className="flex items-center gap-2 text-xs text-white/80">
                              <input
                                type="checkbox"
                                checked={alreadyAdded || fetchedSelection.includes(model)}
                                disabled={alreadyAdded}
                                onChange={() => handleToggleFetched(model)}
                                className="accent-white"
                              />
                              <span className="font-mono break-all">{model}</span>
                              {alreadyAdded && (
                                <span className="text-white/40">
                                  {t("ui.settings.models.alreadyAdded")}
                                </span>
                              )}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setFetchedModels(null)}
                        className="text-xs text-white/60 hover:text-white"
                      >
                        {t("ui.common.close")}
                      </button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAddSelectedModels}
                        disabled={fetchedSelection.length === 0}
                        className="bg-white text-black hover:bg-white/90"
                      >
                        {t("ui.settings.models.addSelected", {
                          count: String(fetchedSelection.length)
                        })}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 三个用途各从模型列表里选一个 */}
          <div className="space-y-3 mt-4">
            <div>
              <label className="text-sm font-medium text-white">
                {t("ui.settings.bindings.title")}
              </label>
              <p className="text-xs text-white/60">
                {t("ui.settings.bindings.description")}
              </p>
            </div>

            {BINDING_FIELDS.map((field) => (
              <div key={field.key} className="space-y-1">
                <label
                  className="text-xs font-medium text-white block"
                  htmlFor={`binding-${field.key}`}
                >
                  {t(field.titleKey)}
                </label>
                <p className="text-xs text-white/50">{t(field.descriptionKey)}</p>
                <select
                  id={`binding-${field.key}`}
                  value={bindings[field.key]}
                  onChange={(event) =>
                    setBindings((prev) => ({
                      ...prev,
                      [field.key]: event.target.value
                    }))
                  }
                  disabled={!hasModels}
                  title={bindings[field.key]}
                  className={SELECT_CLASS}
                >
                  {!hasModels && (
                    <option value="">{t("ui.settings.bindings.emptyOption")}</option>
                  )}
                  {hasModels && bindings[field.key] === "" && (
                    <option value="">
                      {t("ui.settings.bindings.selectPlaceholder")}
                    </option>
                  )}
                  {models.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>
            ))}

            {!hasModels && (
              <p className="text-xs text-amber-300/80">
                {t("ui.settings.bindings.addFirst")}
              </p>
            )}
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
            disabled={isLoading || isSaving || !apiKey.trim()}
          >
            {isSaving ? t("ui.settings.saving") : t("ui.settings.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
