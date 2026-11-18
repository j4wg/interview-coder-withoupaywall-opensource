/**
 * 配置文件读写（唯一的文件级副作用层）。
 *
 * 刻意不 import electron：这样 `node --test` 可以直接 require 编译产物，
 * 用临时目录覆盖"全新安装 / 非法 JSON 备份 / 一次性迁移"等场景。
 *
 * 与 `./configMigrations.ts` 的分工：那边是纯数据与纯函数，这边只负责
 * 读文件、备份损坏文件、原子写盘，以及把结果如实报告给 `ConfigHelper`。
 */
import fs from "node:fs"
import path from "node:path"
import {
  diffNormalizedKeys,
  migrateConfigData,
  normalizeConfigData,
  type ConfigData
} from "./configMigrations"

/** 一次读取（必要时创建/迁移）的完整结果 */
export interface LoadConfigFileResult {
  config: ConfigData
  /** 本次是否执行了 `configVersion < 3` 的一次性迁移 */
  migrated: boolean
  /** 本次是否新建了配置文件（文件不存在或内容损坏被重写） */
  created: boolean
  /** 迁移时被丢弃的旧键（用于输出说明日志） */
  droppedLegacyKeys: string[]
  /** 归一化改动过的顶层键（bindings / apiFormat 等非法值被修正） */
  normalizedKeys: string[]
  /** 内容损坏时备份到的路径 */
  invalidBackupPath?: string
  /** 读文件失败（权限/目录只读/路径是目录） */
  readFailed: boolean
  /** 写盘失败：本次运行以内存态继续，下次启动重试（幂等） */
  writeFailed: boolean
  /** 失败原因，仅用于日志 */
  error?: string
}

/** 全新安装 / 损坏文件时的默认配置（每次返回新对象，避免调用方改到常量） */
export function defaultConfigData(): ConfigData {
  return normalizeConfigData({})
}

/**
 * 原子写：同目录临时文件 + rename，避免进程被杀时留下半截 JSON。
 * @returns 是否成功落盘
 */
export function writeConfigFileAtomic(
  configPath: string,
  data: unknown
): boolean {
  const tmpPath = `${configPath}.tmp`
  try {
    const dir = path.dirname(configPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2))
    fs.renameSync(tmpPath, configPath)
    return true
  } catch {
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath)
    } catch {
      // 清理临时文件失败不影响主流程
    }
    return false
  }
}

/**
 * 尽力把损坏的配置备份成同目录的 `config.invalid-<时间戳>.json`。
 * 备份失败只返回 undefined，由调用方记日志，不阻塞启动。
 */
export function backupInvalidConfigFile(
  configPath: string,
  now: Date = new Date()
): string | undefined {
  const stamp = now.toISOString().replace(/[:.]/g, "-")
  const backupPath = path.join(
    path.dirname(configPath),
    `config.invalid-${stamp}.json`
  )
  try {
    fs.copyFileSync(configPath, backupPath)
    return backupPath
  } catch {
    return undefined
  }
}

/** 把"损坏文件 → 备份 + 写默认值"的公共流程收在一处 */
function recoverFromInvalid(
  configPath: string,
  reason: string
): LoadConfigFileResult {
  const invalidBackupPath = backupInvalidConfigFile(configPath)
  const config = defaultConfigData()
  const written = writeConfigFileAtomic(configPath, config)
  return {
    config,
    migrated: false,
    created: true,
    droppedLegacyKeys: [],
    normalizedKeys: [],
    invalidBackupPath,
    readFailed: false,
    writeFailed: !written,
    error: reason
  }
}

/**
 * 读取配置文件；文件不存在则写入默认值，内容损坏则先备份再写默认值。
 *
 * 只有"迁移"会写回磁盘：读配置时的归一化（非法 apiFormat、bindings 指向不存在的模型等）
 * 只在内存里生效，不覆盖用户手改的内容——这正是"迁移一次性、之后重启不覆盖"的保证。
 */
export function loadConfigFile(configPath: string): LoadConfigFileResult {
  let rawText: string
  try {
    rawText = fs.readFileSync(configPath, "utf8")
  } catch (err) {
    if ((err as { code?: string })?.code === "ENOENT") {
      // 全新安装：写默认值
      const config = defaultConfigData()
      const written = writeConfigFileAtomic(configPath, config)
      return {
        config,
        migrated: false,
        created: true,
        droppedLegacyKeys: [],
        normalizedKeys: [],
        readFailed: false,
        writeFailed: !written,
        error: written ? undefined : "Failed to create default config"
      }
    }
    // 文件存在但读不了（权限/路径是目录）：本次用内存默认值，下次启动重试
    return {
      config: defaultConfigData(),
      migrated: false,
      created: false,
      droppedLegacyKeys: [],
      normalizedKeys: [],
      readFailed: true,
      writeFailed: false,
      error: err instanceof Error ? err.message : String(err)
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch (err) {
    return recoverFromInvalid(
      configPath,
      err instanceof Error ? err.message : String(err)
    )
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return recoverFromInvalid(configPath, "Config root is not a JSON object")
  }

  const { config: migratedRaw, migrated, droppedLegacyKeys } =
    migrateConfigData(parsed)

  if (migrated) {
    const written = writeConfigFileAtomic(configPath, migratedRaw)
    const config = normalizeConfigData(migratedRaw)
    return {
      config,
      migrated: true,
      created: false,
      droppedLegacyKeys,
      normalizedKeys: diffNormalizedKeys(migratedRaw, config),
      readFailed: false,
      writeFailed: !written,
      error: written ? undefined : "Failed to persist migrated config"
    }
  }

  const config = normalizeConfigData(parsed)
  return {
    config,
    migrated: false,
    created: false,
    droppedLegacyKeys: [],
    normalizedKeys: diffNormalizedKeys(parsed, config),
    readFailed: false,
    writeFailed: false
  }
}
