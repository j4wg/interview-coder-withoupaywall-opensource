/**
 * 翻译器内核：`t()` / `createTranslator()` / `{{name}}` 插值 / 缺键兜底。
 *
 * 本文件不 import electron、不 import React，也不含任何文案表：
 * `ui` / `main` / `processing` 三个命名空间的文案表分别由 JUN-39 / JUN-40 / JUN-41
 * 在 `electron/i18n/messages/` 下提供，接线时把表填进下面的 `MESSAGE_TABLES` 即可。
 */
import type { Locale, Namespace } from "./types"
import { mainZh } from "./messages/main.zh"
import { mainEn } from "./messages/main.en"
import { processingZh } from "./messages/processing.zh"
import { processingEn } from "./messages/processing.en"

type MessageTable = Record<string, string>

/**
 * 文案表注册位，按命名空间登记。
 * 未登记的命名空间（或未登记的语言）所有键都走缺键兜底（返回键名 + 一次 warn），不会抛错。
 * `processing` 由 JUN-41 登记；`ui`（JUN-39）与 `main`（JUN-40）各自补自己那一行。
 */
const MESSAGE_TABLES: Partial<
  Record<Namespace, Partial<Record<Locale, MessageTable>>>
> = {
  main: { zh: mainZh, en: mainEn },
  processing: { zh: processingZh, en: processingEn },
}

/** 已告警过的缺键，保证同一个键只 warn 一次，避免日志刷屏 */
const warnedMissingKeys = new Set<string>()

/**
 * 注册某个命名空间某个语言的文案表（由各命名空间的 `messages/<ns>.ts` 在 import 期调用）。
 *
 * 之所以用注册而不是在上面的 `MESSAGE_TABLES` 里静态 import：三个命名空间分属三个 issue，
 * 各自只改自己的文件即可完成接线，不必抢同一个文件的同一段代码。
 */
export function registerMessages<N extends Namespace>(
  ns: N,
  locale: Locale,
  table: MessageTable
): void {
  const registered: Partial<Record<Locale, MessageTable>> =
    MESSAGE_TABLES[ns] ?? {}
  registered[locale] = { ...(registered[locale] ?? {}), ...table }
  MESSAGE_TABLES[ns] = registered
}

/** 把 `{{name}}` 占位符替换为 vars 中的值；缺失的占位符原样保留（可见、可测、不抛错） */
function interpolate(
  template: string,
  vars?: Record<string, string>
): string {
  if (!vars) return template
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name)
      ? String(vars[name])
      : match
  )
}

/**
 * 取一条文案。缺表 / 缺键时返回键名本身，并对该键输出一次 `console.warn`。
 */
export function t<N extends Namespace>(
  ns: N,
  locale: Locale,
  key: string,
  vars?: Record<string, string>
): string {
  const template = MESSAGE_TABLES[ns]?.[locale]?.[key]
  if (typeof template !== "string") {
    const warnKey = `${ns}.${locale}.${key}`
    if (!warnedMissingKeys.has(warnKey)) {
      warnedMissingKeys.add(warnKey)
      console.warn(`[i18n] Missing message: ${warnKey}`)
    }
    return key
  }
  return interpolate(template, vars)
}

/**
 * 绑定某个命名空间 + 语言的翻译函数。
 * 渲染层只拿得到 `ui`，主进程拿 `main` / `processing`，命名空间之间互不可达。
 */
export function createTranslator<N extends Namespace>(
  ns: N,
  locale: Locale
): (key: string, vars?: Record<string, string>) => string {
  return (key: string, vars?: Record<string, string>): string =>
    t(ns, locale, key, vars)
}
