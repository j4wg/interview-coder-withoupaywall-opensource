/**
 * 主进程翻译器：每次调用都实时解析当前生效语言，不缓存。
 * 因此用户切换界面语言后，主进程后续日志/提示立即跟随，无需重启。
 */
import { configHelper } from "../ConfigHelper"
import { createTranslator } from "./index"
import type { Namespace } from "./types"

export function mainT<N extends Exclude<Namespace, "ui">>(
  ns: N
): (key: string, vars?: Record<string, string>) => string {
  return (key: string, vars?: Record<string, string>): string => {
    const { locale } = configHelper.getUiLocale()
    return createTranslator(ns, locale)(key, vars)
  }
}
