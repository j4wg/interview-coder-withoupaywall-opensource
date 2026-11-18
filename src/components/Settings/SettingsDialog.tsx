import { useEffect, useRef, useState } from "react"
import { Info, Plus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "../ui/dialog"
import { Button } from "../ui/button"
import { useToast } from "../../contexts/toast"
import { useI18n } from "../../contexts/i18n"
import type {
  BindingKey,
  Config,
  ModelBinding,
  ModelBindings,
  ProviderConfig
} from "../../types/electron"
import type { UiLanguageSetting } from "../../../electron/i18n/types"
import {
  BINDING_FIELDS,
  bindingsEqual,
  createEmptyProvider,
  emptyBindings,
  isValidBaseUrl,
  normalizeBindings,
  normalizeConfig,
  normalizeModels,
  normalizeProviderDrafts,
  normalizeProviders,
  providersEqual
} from "./modelConfig"
import { ProviderCard } from "./ProviderCard"

// 界面语言三档（控件顺序固定：跟随系统 / 中文 / English）
const UI_LANGUAGE_OPTIONS: Array<{
  value: UiLanguageSetting
  labelKey: string
}> = [
  { value: "system", labelKey: "ui.settings.interfaceLanguage.system" },
  { value: "zh", labelKey: "ui.settings.interfaceLanguage.zh" },
  { value: "en", labelKey: "ui.settings.interfaceLanguage.en" }
]

const SELECT_CLASS =
  "w-full h-9 px-3 rounded-md bg-black/50 border border-white/10 text-white text-sm " +
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 " +
  "disabled:cursor-not-allowed disabled:opacity-50"

interface SettingsDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * 设置对话框（配置 v3：多套 provider 并存）。
 *
 * 保存时整表提交 `{ providers, bindings }`：配置层只认 `providers` 数组，
 * 旧的 `{ provider, bindings: string }` 载荷会被直接忽略（这正是"保存不生效"的根因）。
 * 提交后还会回读返回值校验是否真的落盘，未生效时给出可见错误而不是假装成功。
 */
export function SettingsDialog({
  open: externalOpen,
  onOpenChange
}: SettingsDialogProps) {
  const [open, setOpen] = useState(externalOpen || false)
  const [providers, setProviders] = useState<ProviderConfig[]>([])
  const [bindings, setBindings] = useState<ModelBindings>(emptyBindings())
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  // 编辑过程中因删配置/删模型被清空的绑定，给一条可见提示（保存后自然消失）
  const [showClearedHint, setShowClearedHint] = useState(false)
  const { showToast } = useToast()
  const { t, locale, setting, setSetting } = useI18n()
  // 用户是否已开始编辑：读配置是异步的，落回来的数据不能盖掉正在填的内容
  const editedRef = useRef(false)
  // 把最新的 t / showToast 放进 ref，读配置的 effect 就不必依赖它们
  // （否则切换界面语言会重新拉配置，把用户刚填的 provider / 模型全部覆盖掉）
  const tRef = useRef(t)
  const showToastRef = useRef(showToast)
  tRef.current = t
  showToastRef.current = showToast

  // 与外部（App）持有的开关状态保持同步
  useEffect(() => {
    if (externalOpen !== undefined) {
      setOpen(externalOpen)
    }
  }, [externalOpen])

  // 开关变更：仅在真正变化时回传，避免死循环
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (onOpenChange && newOpen !== externalOpen) {
      onOpenChange(newOpen)
    }
  }

  // 打开时读取当前配置（providers 卡片列表 + 三用途绑定）。
  // 只依赖 open：切换界面语言、弹 toast 都不会再触发读配置，避免覆盖未保存的编辑。
  useEffect(() => {
    if (!open) return
    let cancelled = false
    editedRef.current = false
    setIsLoading(true)
    setShowClearedHint(false)

    window.electronAPI
      .getConfig()
      .then((config: Config) => {
        // 用户在配置回来之前已经开始填：保留用户输入
        if (cancelled || editedRef.current) return
        const normalized = normalizeConfig(config)
        setProviders(normalized.providers)
        setBindings(normalized.bindings)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error("加载配置失败：", error)
        showToastRef.current(
          tRef.current("ui.common.error"),
          tRef.current("ui.error.failedToLoadSettings"),
          "error"
        )
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open])

  // 配置变化后自检绑定：引用的 provider / 模型不存在时置空，并提示重新选择
  useEffect(() => {
    setBindings((prev) => {
      const next = normalizeBindings(prev, providers)
      if (bindingsEqual(prev, next)) return prev
      setShowClearedHint(true)
      return next
    })
  }, [providers])

  // 切换界面语言：写配置后立即生效，不等待"保存设置"
  const handleSelectUiLanguage = async (next: UiLanguageSetting) => {
    if (next === setting) return
    try {
      await setSetting(next)
    } catch (error) {
      console.error("更新界面语言失败：", error)
      showToast(
        t("ui.common.error"),
        t("ui.error.failedToSaveSettings"),
        "error"
      )
    }
  }

  const handleUpdateProvider = (id: string, patch: Partial<ProviderConfig>) => {
    editedRef.current = true
    setProviders((prev) =>
      prev.map((provider) =>
        provider.id === id ? { ...provider, ...patch } : provider
      )
    )
  }

  const handleModelsChange = (id: string, models: string[]) => {
    editedRef.current = true
    setProviders((prev) =>
      prev.map((provider) =>
        provider.id === id
          ? { ...provider, models: normalizeModels(models) }
          : provider
      )
    )
  }

  const handleAddProvider = () => {
    editedRef.current = true
    setProviders((prev) => [
      ...prev,
      createEmptyProvider(prev.map((provider) => provider.id))
    ])
  }

  const handleRemoveProvider = (id: string) => {
    editedRef.current = true
    setProviders((prev) => prev.filter((provider) => provider.id !== id))
  }

  const handleBindingProviderChange = (key: BindingKey, providerId: string) => {
    editedRef.current = true
    const provider = providers.find((item) => item.id === providerId)
    const nextBinding: ModelBinding = {
      providerId,
      // 换配置时默认选中该配置的首个模型；没有模型则留空等待用户添加
      modelId: provider?.models[0] ?? ""
    }
    setBindings((prev) => ({ ...prev, [key]: nextBinding }))
  }

  const handleBindingModelChange = (key: BindingKey, modelId: string) => {
    editedRef.current = true
    setBindings((prev) => ({
      ...prev,
      [key]: { providerId: prev[key].providerId, modelId }
    }))
  }

  // 保存设置：整表提交 providers + bindings，确认落盘后重载应用
  const handleSave = async () => {
    const drafts = normalizeProviderDrafts(providers)

    // baseUrl 可以是空串（尚未配置），但填了就必须是合法 http(s) 地址
    const invalid = drafts.find(
      (provider) => provider.baseUrl && !isValidBaseUrl(provider.baseUrl)
    )
    if (invalid) {
      showToast(
        t("ui.common.error"),
        t("ui.settings.validation.baseUrl", {
          name: invalid.name || t("ui.settings.providers.untitled")
        }),
        "error"
      )
      return
    }

    const nextBindings = normalizeBindings(bindings, drafts)
    setIsSaving(true)
    try {
      const outcome = await window.electronAPI.updateConfig({
        providers: drafts,
        bindings: nextBindings
      })

      const savedProviders = normalizeProviders(outcome?.config?.providers)
      const savedBindings = normalizeBindings(
        outcome?.config?.bindings,
        savedProviders
      )
      // 回读校验：旧契约会静默忽略载荷，这里必须把"没生效"显式暴露出来
      if (!providersEqual(drafts, savedProviders)) {
        console.error("保存后回读的 providers 与提交内容不一致", {
          submitted: drafts,
          saved: savedProviders
        })
        showToast(
          t("ui.common.error"),
          t("ui.settings.toast.saveNoEffect"),
          "error"
        )
        return
      }

      const clearedByConfig =
        Array.isArray(outcome?.clearedBindings) &&
        outcome.clearedBindings.length > 0
      const cleared =
        clearedByConfig || !bindingsEqual(nextBindings, savedBindings)

      showToast(
        t("ui.common.success"),
        cleared
          ? t("ui.settings.toast.savedWithCleared")
          : t("ui.settings.toast.saved"),
        cleared ? "neutral" : "success"
      )
      handleOpenChange(false)

      // 重载让主进程用新配置重新初始化（API Key / 模型立即生效）
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (error) {
      console.error("保存设置失败：", error)
      showToast(
        t("ui.common.error"),
        t("ui.settings.toast.saveFailed"),
        "error"
      )
    } finally {
      setIsSaving(false)
    }
  }

  const hasProviders = providers.length > 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-none bg-black border border-white/10 text-white settings-dialog"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(600px, 92vw)",
          maxWidth: "92vw",
          height: "auto",
          minHeight: "400px",
          // 头部/底部固定、中间滚动：多套配置时保存按钮不用一路翻到底
          display: "flex",
          flexDirection: "column",
          maxHeight: "min(90vh, 760px)",
          overflow: "hidden",
          zIndex: 9999,
          margin: 0,
          padding: "20px",
          transition: "opacity 0.25s ease, transform 0.25s ease"
        }}
      >
        <DialogHeader
          style={{
            flex: "0 0 auto",
            // 不透明表头：中间区域滚动时内容不会从标题下透出来
            background: "#000",
            position: "relative",
            zIndex: 1,
            paddingBottom: 4
          }}
        >
          <DialogTitle>{t("ui.settings.title")}</DialogTitle>
          <DialogDescription className="text-white/70">
            {t("ui.settings.description")}
          </DialogDescription>
        </DialogHeader>
        <div
          className="space-y-4 py-4 pr-1"
          style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto" }}
        >
          {/* 界面语言：跟随系统 / 中文 / English */}
          <div className="space-y-2">
            <label
              className="text-sm font-medium text-white"
              id="ui-language-label"
            >
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

          {/* 多套 API 配置卡片 */}
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <label className="text-sm font-medium text-white block">
                  {t("ui.settings.providers.title")}
                </label>
                <p className="text-xs text-white/60">
                  {t("ui.settings.providers.description")}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleAddProvider}
                className="bg-white/10 text-white hover:bg-white/20 shrink-0"
              >
                <Plus className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                {t("ui.settings.providers.add")}
              </Button>
            </div>

            {isLoading ? (
              <p className="text-xs text-white/50">
                {t("ui.app.initializing")}
              </p>
            ) : hasProviders ? (
              providers.map((provider, index) => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  index={index}
                  canRemove={providers.length > 1}
                  onChange={handleUpdateProvider}
                  onRemove={handleRemoveProvider}
                  onModelsChange={handleModelsChange}
                />
              ))
            ) : (
              <div className="flex items-start gap-2 p-3 rounded-lg border border-dashed border-white/15 text-xs text-white/60">
                <Info className="w-4 h-4 shrink-0" aria-hidden="true" />
                <p>{t("ui.settings.providers.empty")}</p>
              </div>
            )}
          </div>

          {/* 三个用途各选一套配置下的一个模型（允许跨配置） */}
          <div className="space-y-2">
            <div>
              <label className="text-sm font-medium text-white block">
                {t("ui.settings.bindings.title")}
              </label>
              <p className="text-xs text-white/60">
                {t("ui.settings.bindings.description")}
              </p>
            </div>

            {BINDING_FIELDS.map((field) => {
              const binding = bindings[field.key]
              const selectedProvider = providers.find(
                (provider) => provider.id === binding.providerId
              )
              const models = selectedProvider?.models ?? []
              return (
                <div
                  key={field.key}
                  className="space-y-1 rounded-lg border border-white/10 bg-black/30 p-2.5"
                >
                  <label
                    className="text-xs font-medium text-white block"
                    htmlFor={`binding-provider-${field.key}`}
                  >
                    {t(field.titleKey)}
                  </label>
                  <p className="text-xs text-white/50">
                    {t(field.descriptionKey)}
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <select
                      id={`binding-provider-${field.key}`}
                      aria-label={t("ui.settings.bindings.providerLabel")}
                      value={binding.providerId}
                      onChange={(event) =>
                        handleBindingProviderChange(field.key, event.target.value)
                      }
                      disabled={!hasProviders}
                      className={SELECT_CLASS}
                    >
                      <option value="">
                        {hasProviders
                          ? t("ui.settings.bindings.providerPlaceholder")
                          : t("ui.settings.bindings.addFirst")}
                      </option>
                      {providers.map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          {provider.name ||
                            t("ui.settings.providers.untitled")}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label={t("ui.settings.bindings.modelLabel")}
                      value={binding.modelId}
                      onChange={(event) =>
                        handleBindingModelChange(field.key, event.target.value)
                      }
                      disabled={models.length === 0}
                      title={binding.modelId}
                      className={SELECT_CLASS}
                    >
                      {models.length === 0 ? (
                        <option value="">
                          {t("ui.settings.bindings.noModels")}
                        </option>
                      ) : (
                        <>
                          {binding.modelId === "" && (
                            <option value="">
                              {t("ui.settings.bindings.modelPlaceholder")}
                            </option>
                          )}
                          {models.map((model) => (
                            <option key={model} value={model}>
                              {model}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                  </div>
                </div>
              )
            })}

            {!hasProviders && (
              <p className="text-xs text-amber-300/80">
                {t("ui.settings.bindings.addFirst")}
              </p>
            )}

            {showClearedHint && (
              <p role="status" className="text-xs text-amber-300/80">
                {t("ui.settings.bindings.cleared")}
              </p>
            )}
          </div>

          <div className="space-y-2 mt-4">
            <label className="text-sm font-medium text-white mb-2 block">
              {t("ui.shortcut.title")}
            </label>
            <div className="bg-black/30 border border-white/10 rounded-lg p-3">
              <div className="grid grid-cols-2 gap-y-2 text-xs">
                <div className="text-white/70">
                  {t("ui.shortcut.toggleVisibility")}
                </div>
                <div className="text-white/90 font-mono">Ctrl+B / Cmd+B</div>

                <div className="text-white/70">
                  {t("ui.shortcut.takeScreenshot")}
                </div>
                <div className="text-white/90 font-mono">Ctrl+H / Cmd+H</div>

                <div className="text-white/70">
                  {t("ui.shortcut.processScreenshots")}
                </div>
                <div className="text-white/90 font-mono">
                  Ctrl+Enter / Cmd+Enter
                </div>

                <div className="text-white/70">
                  {t("ui.shortcut.deleteLastScreenshot")}
                </div>
                <div className="text-white/90 font-mono">Ctrl+L / Cmd+L</div>

                <div className="text-white/70">
                  {t("ui.shortcut.resetView")}
                </div>
                <div className="text-white/90 font-mono">Ctrl+R / Cmd+R</div>

                <div className="text-white/70">{t("ui.shortcut.quitApp")}</div>
                <div className="text-white/90 font-mono">Ctrl+Q / Cmd+Q</div>

                <div className="text-white/70">
                  {t("ui.shortcut.moveWindow")}
                </div>
                <div className="text-white/90 font-mono">Ctrl+Arrow Keys</div>

                <div className="text-white/70">
                  {t("ui.shortcut.decreaseOpacity")}
                </div>
                <div className="text-white/90 font-mono">Ctrl+[ / Cmd+[</div>

                <div className="text-white/70">
                  {t("ui.shortcut.increaseOpacity")}
                </div>
                <div className="text-white/90 font-mono">Ctrl+] / Cmd+]</div>

                <div className="text-white/70">
                  {t("ui.shortcut.zoomOut")}
                </div>
                <div className="text-white/90 font-mono">Ctrl+- / Cmd+-</div>

                <div className="text-white/70">
                  {t("ui.shortcut.resetZoom")}
                </div>
                <div className="text-white/90 font-mono">Ctrl+0 / Cmd+0</div>

                <div className="text-white/70">{t("ui.shortcut.zoomIn")}</div>
                <div className="text-white/90 font-mono">Ctrl+= / Cmd+=</div>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter
          className="flex justify-between sm:justify-between border-t border-white/10 pt-3"
          style={{ flex: "0 0 auto" }}
        >
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
            disabled={isLoading || isSaving}
          >
            {isSaving ? t("ui.settings.saving") : t("ui.settings.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
