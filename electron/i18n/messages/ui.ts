/**
 * `ui` 命名空间文案表的接线入口（JUN-39 独占）。
 *
 * 渲染层 import 本文件即可让 `createTranslator("ui", locale)` / `t("ui", ...)` 生效：
 * 注册发生在模块求值期，早于任何组件渲染，不存在"先渲染后注册"的时序问题。
 *
 * 主进程不需要 `ui` 文案，因此这里没有被 `electron/i18n/index.ts` 静态 import，
 * 也就不会被打进 `dist-electron`。
 */
import { registerMessages } from "../index"
import { uiEn } from "./ui.en"
import { uiZh } from "./ui.zh"

registerMessages("ui", "zh", uiZh)
registerMessages("ui", "en", uiEn)

/** 供调用方直接取表的只读视图（测试与残留扫描用） */
export const uiMessages = { zh: uiZh, en: uiEn }

export type { UiMessageKey } from "./ui.zh"
