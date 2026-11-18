import { useEffect, useRef, useState } from "react"
import { Eye, EyeOff, Info, Plus, Trash2 } from "lucide-react"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { useToast } from "../../contexts/toast"
import { useI18n } from "../../contexts/i18n"
import type { ApiFormat, ProviderConfig } from "../../types/electron"
import {
  API_FORMAT_OPTIONS,
  addModel,
  normalizeModels,
  parseListModels
} from "./modelConfig"

// 下拉框统一样式：与既有输入框同一套 token，禁用态降低对比度
const SELECT_CLASS =
  "w-full h-9 px-3 rounded-md bg-black/50 border border-white/10 text-white text-sm " +
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 " +
  "disabled:cursor-not-allowed disabled:opacity-50"

const LABEL_CLASS = "text-xs font-medium text-white block"

interface ProviderCardProps {
  provider: ProviderConfig
  /** 卡片序号：用于生成稳定的表单 id（provider.id 也可能含特殊字符，统一用序号） */
  index: number
  canRemove: boolean
  onChange: (id: string, patch: Partial<ProviderConfig>) => void
  onRemove: (id: string) => void
  onModelsChange: (id: string, models: string[]) => void
}

/**
 * 一套 API 配置的编辑卡片（Base URL / API 格式 / API Key / 模型列表）。
 * 卡片内的临时交互态（明文开关、添加输入、拉取结果）留在本组件内，
 * 配置数据本身全部受控于设置对话框，保存时整表提交。
 */
export function ProviderCard({
  provider,
  index,
  canRemove,
  onChange,
  onRemove,
  onModelsChange
}: ProviderCardProps) {
  const { t } = useI18n()
  const { showToast } = useToast()
  const [showApiKey, setShowApiKey] = useState(false)
  const [addModelOpen, setAddModelOpen] = useState(false)
  const [newModelId, setNewModelId] = useState("")
  const [addModelError, setAddModelError] = useState<string | null>(null)
  const [isFetching, setIsFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const addModelInputRef = useRef<HTMLInputElement>(null)

  // 展开"添加模型"后把焦点放进输入框。放在 effect 里而不是 setState 更新函数里：
  // 更新函数必须是纯函数（React 可能重复调用它），副作用会让焦点行为不可预测。
  useEffect(() => {
    if (addModelOpen) addModelInputRef.current?.focus()
  }, [addModelOpen])

  const fieldId = (name: string) => `provider-${index}-${name}`
  const displayName = provider.name.trim() || t("ui.settings.providers.untitled")

  const handleAddModel = () => {
    const id = newModelId.trim()
    if (!id) {
      setAddModelError(t("ui.settings.models.addEmpty"))
      return
    }
    if (provider.models.includes(id)) {
      setAddModelError(t("ui.settings.models.addDuplicate", { model: id }))
      return
    }
    onModelsChange(provider.id, addModel(provider.models, id))
    setNewModelId("")
    setAddModelError(null)
    setAddModelOpen(false)
  }

  const handleRemoveModel = (modelId: string) => {
    onModelsChange(
      provider.id,
      provider.models.filter((model) => model !== modelId)
    )
  }

  // 拉取模型列表：用真实 IPC 通道；失败只提示，不阻塞手工添加
  const handleFetchModels = async () => {
    const baseUrl = provider.baseUrl.trim()
    if (!baseUrl) {
      setFetchError(t("ui.settings.models.fetchNeedsBaseUrl"))
      return
    }

    setIsFetching(true)
    setFetchError(null)
    try {
      const listModels = window.electronAPI.listModels
      if (typeof listModels !== "function") {
        throw new Error(t("ui.settings.models.fetchUnavailable"))
      }

      const result = await listModels({
        providerId: provider.id,
        name: provider.name,
        baseUrl,
        apiFormat: provider.apiFormat,
        apiKey: provider.apiKey
      })
      const parsed = parseListModels(result)
      if (parsed.models.length === 0) {
        setFetchError(t("ui.settings.models.fetchEmpty"))
        return
      }

      const added = parsed.models.filter(
        (model) => !provider.models.includes(model)
      )
      onModelsChange(
        provider.id,
        normalizeModels([...provider.models, ...parsed.models])
      )
      showToast(
        t("ui.common.success"),
        t("ui.settings.models.fetchAdded", { count: String(added.length) }),
        "success"
      )
    } catch (error) {
      console.error("拉取模型列表失败：", error)
      setFetchError(
        error instanceof Error && error.message
          ? error.message
          : t("ui.settings.models.fetchUnknownError")
      )
    } finally {
      setIsFetching(false)
    }
  }

  return (
    <section
      aria-label={displayName}
      className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-3"
    >
      {/* 配置名称 + 删除 */}
      <div className="flex items-center gap-2">
        <Input
          aria-label={t("ui.settings.providers.nameLabel")}
          value={provider.name}
          onChange={(event) => onChange(provider.id, { name: event.target.value })}
          placeholder={t("ui.settings.providers.namePlaceholder")}
          spellCheck={false}
          autoComplete="off"
          className="bg-black/50 border-white/10 text-white placeholder:text-white/30"
        />
        <button
          type="button"
          onClick={() => setConfirmRemove(true)}
          disabled={!canRemove}
          aria-label={t("ui.settings.providers.remove")}
          title={t("ui.settings.providers.remove")}
          className="p-2 rounded-md text-white/50 hover:text-red-300 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 shrink-0"
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* 删除确认：避免误删带绑定的配置 */}
      {confirmRemove && (
        <div
          role="alertdialog"
          aria-label={t("ui.settings.providers.remove")}
          className="space-y-2 p-2 rounded-lg border border-red-400/30 bg-red-500/10"
        >
          <p className="text-xs text-red-100">
            {t("ui.settings.providers.removeConfirm", { name: displayName })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setConfirmRemove(false)
                onRemove(provider.id)
              }}
              className="bg-red-500 text-white hover:bg-red-400"
            >
              {t("ui.settings.providers.remove")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmRemove(false)}
              className="text-white/70 hover:text-white"
            >
              {t("ui.common.cancel")}
            </Button>
          </div>
        </div>
      )}

      {/* Base URL */}
      <div className="space-y-1">
        <label className={LABEL_CLASS} htmlFor={fieldId("base-url")}>
          {t("ui.settings.baseUrl.label")}
        </label>
        <Input
          id={fieldId("base-url")}
          type="url"
          value={provider.baseUrl}
          onChange={(event) =>
            onChange(provider.id, { baseUrl: event.target.value })
          }
          placeholder={t("ui.settings.baseUrl.placeholder")}
          spellCheck={false}
          autoComplete="off"
          className="bg-black/50 border-white/10 text-white placeholder:text-white/30"
        />
      </div>

      {/* API 格式三选一 */}
      <div className="space-y-1">
        <label className={LABEL_CLASS} htmlFor={fieldId("api-format")}>
          {t("ui.settings.apiFormat.label")}
        </label>
        <select
          id={fieldId("api-format")}
          value={provider.apiFormat}
          onChange={(event) =>
            onChange(provider.id, {
              apiFormat: event.target.value as ApiFormat
            })
          }
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
      <div className="space-y-1">
        <label className={LABEL_CLASS} htmlFor={fieldId("api-key")}>
          {t("ui.settings.apiKey.label")}
        </label>
        <div className="relative">
          <Input
            id={fieldId("api-key")}
            type={showApiKey ? "text" : "password"}
            value={provider.apiKey}
            onChange={(event) =>
              onChange(provider.id, { apiKey: event.target.value })
            }
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
          <label className={`${LABEL_CLASS} mb-0`} id={fieldId("models-label")}>
            {t("ui.settings.models.listTitle")}
          </label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleFetchModels}
              disabled={isFetching}
              className="border-white/10 bg-black/40 text-white hover:bg-white/10 hover:text-white"
            >
              {isFetching
                ? t("ui.settings.models.fetching")
                : t("ui.settings.models.fetch")}
            </Button>
            <Button
              type="button"
              size="sm"
              aria-expanded={addModelOpen}
              onClick={() => {
                setAddModelOpen((prev) => !prev)
                setAddModelError(null)
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
              event.preventDefault()
              handleAddModel()
            }}
          >
            <div className="flex items-center gap-2">
              <Input
                ref={addModelInputRef}
                aria-label={t("ui.settings.models.addInputLabel")}
                value={newModelId}
                onChange={(event) => {
                  setNewModelId(event.target.value)
                  setAddModelError(null)
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
                  setAddModelOpen(false)
                  setNewModelId("")
                  setAddModelError(null)
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
        {provider.models.length > 0 && (
          <ul className="space-y-1.5" aria-labelledby={fieldId("models-label")}>
            {provider.models.map((model) => (
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
        )}

        {provider.models.length === 0 && (
          <div className="flex items-start gap-2 p-2 rounded-lg border border-dashed border-white/15 text-xs text-white/60">
            <Info className="w-4 h-4 shrink-0" aria-hidden="true" />
            <p>{t("ui.settings.models.empty")}</p>
          </div>
        )}

        {fetchError && (
          <div
            role="alert"
            className="space-y-1 p-2 rounded-lg border border-red-400/30 bg-red-500/10 text-xs text-red-200"
          >
            <p>{fetchError}</p>
            <p className="text-white/60">
              {t("ui.settings.models.fetchManualHint")}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
