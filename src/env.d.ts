/// <reference types="vite/client" />

/**
 * 环境变量类型。
 * `Window` / `electronAPI` 的权威声明在 `./types/electron.d.ts`（由 tsconfig 自动纳入编译），
 * 本文件不再重复声明。
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly NODE_ENV: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
