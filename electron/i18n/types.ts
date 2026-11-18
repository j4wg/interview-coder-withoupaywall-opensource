/**
 * 国际化基础类型（唯一真源）。
 * 本文件不 import electron、不 import React、不 import 任何业务模块，
 * 可同时被主进程（tsc）与渲染层（Vite）引用。
 */

/** 实际生效的界面语言 */
export type Locale = "zh" | "en"

/** 用户在设置里选择的界面语言；system = 跟随系统 */
export type UiLanguageSetting = "system" | "zh" | "en"

/** 文案表命名空间，按归属模块划分（不按页面划分） */
export type Namespace = "ui" | "main" | "processing"
