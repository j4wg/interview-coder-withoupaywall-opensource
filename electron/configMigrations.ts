/**
 * 配置迁移纯函数：不 import electron、不碰磁盘，可被 node --test 直接覆盖。
 *
 * 迁移口径（设计文档 5.1）：
 * - 触发条件：`typeof configVersion !== "number" || configVersion < 2`
 * - 只覆盖 `uiLanguage = "system"`、`language = "java"`、`configVersion = 2` 三个键；
 *   其余键（apiKey、apiProvider、三个模型、opacity、未知键）基于原始解析结果原样保留（浅合并）。
 * - 版本已满足时完全不改动。
 *
 * 文件级动作（备份损坏文件、原子写盘、内存回落）由 `ConfigHelper` 负责。
 */
import type { UiLanguageSetting } from "./i18n/types"

/** 迁移标记的当前版本 */
export const CURRENT_CONFIG_VERSION = 2

/** 与 `ConfigHelper.Config` 结构一致的纯数据契约，供默认值与迁移共用 */
export interface ConfigData {
  apiKey: string
  apiProvider: "openai" | "gemini" | "anthropic"
  extractionModel: string
  solutionModel: string
  debuggingModel: string
  language: string
  opacity: number
  uiLanguage: UiLanguageSetting
  configVersion: number
}

/** 全新安装 / 损坏文件时写入的完整默认配置 */
export const DEFAULT_CONFIG_DATA: Readonly<ConfigData> = {
  apiKey: "",
  apiProvider: "gemini",
  extractionModel: "gemini-2.0-flash",
  solutionModel: "gemini-2.0-flash",
  debuggingModel: "gemini-2.0-flash",
  language: "java",
  opacity: 1.0,
  uiLanguage: "system",
  configVersion: CURRENT_CONFIG_VERSION
}

/** 普通对象判定：排除 null、数组、以及 JSON.parse 出来的标量 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * 迁移已解析的配置数据。
 *
 * @param raw `JSON.parse` 的结果，或任何无法解析的原始值
 * @returns `config` 为应落盘的数据；`migrated` 表示本次是否发生了覆盖
 */
export function migrateConfigData(raw: unknown): {
  config: Record<string, unknown>
  migrated: boolean
} {
  // 非普通对象（非法 JSON、空文件、数组、标量）一律回落完整默认配置
  if (!isPlainObject(raw)) {
    return { config: { ...DEFAULT_CONFIG_DATA }, migrated: true }
  }

  const version = raw.configVersion
  const needsMigration =
    typeof version !== "number" || version < CURRENT_CONFIG_VERSION

  if (!needsMigration) {
    return { config: { ...raw }, migrated: false }
  }

  // 只覆盖三个键，其余（含未知键）原样保留；一次性由 configVersion=2 同批落盘保证
  return {
    config: {
      ...raw,
      uiLanguage: "system",
      language: "java",
      configVersion: CURRENT_CONFIG_VERSION
    },
    migrated: true
  }
}
