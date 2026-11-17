# 中英双语与「跟随系统」设计方案

> 状态：已定稿，可据此开工。本文只给结论、契约与文件清单，不含实现代码。
> 适用范围：`interview-coder-withoupaywall-opensource`（Electron + React + Vite）。
> 本文的 7 条结论是后续实现 issue（JUN-38 / JUN-39 / JUN-40 / JUN-41 / 配置层 / 验收）的唯一口径来源。

## 1. 一页方案

### 1.1 结论摘要

| # | 决策点 | 唯一结论 |
|---|---|---|
| 1 | 文案资源组织 | 单一源码目录 `electron/i18n/`，按**归属模块**分三个命名空间：`ui`（渲染层界面）、`main`（主进程/脚本日志、报错、对话框）、`processing`（ProcessingHelper 的 prompt 与其日志）；每语言每命名空间一个文件，中文文件为类型真源，英文文件用中文文件的类型声明，缺键即编译失败 |
| 2 | 语言设置存储 | `config.json` 新增 `uiLanguage: "system" \| "zh" \| "en"`，默认 `"system"`；原 `language` 字段保持"编程语言"语义不变、默认由 `python` 改为 `java`；读取时机＝主进程 `ConfigHelper.loadConfig()`，渲染层通过 IPC 取一次，默认值不依赖文件是否存在 |
| 3 | 「跟随系统」判定 | 只用主进程 `app.getLocale()` 一个信号，取 `zh*` → `zh`，其余 → `en`；空/取不到时依次回落 `Intl.DateTimeFormat().resolvedOptions().locale`、`en`；应用内切换即时生效不需重启，操作系统语言在运行期变更需重启应用才生效 |
| 4 | 旧配置迁移 | `ConfigHelper` 构造时按 `configVersion < 2` 触发一次性迁移，只覆盖 `uiLanguage="system"`、`language="java"`、`configVersion=2` 三个键，其余（含 `apiKey`、模型、`opacity`、未知键）原样保留；写入同一份原子写；损坏文件先备份为 `config.invalid-<ISO>.json` 再写默认值 |
| 5 | AI 返回中文落点 | 只放在 **prompt 层**：`processing` 命名空间的中文 prompt 同时约束"解释性文字用简体中文"与"代码/标识符/API 名/代码块内注释不翻译"；**输出层不做任何翻译或后处理**；解析题面的 JSON 字段名固定英文 |
| 6 | 文档与注释 | 文档：英文原文留在原路径，另有 `*.zh-CN.md` 中文版，互加顶部链接，两份独立维护；代码注释：**只中文一份**，不维护双语注释 |
| 7 | 「跟随系统」是否含主题 | **否**。本次「跟随系统」只指界面语言。深色/浅色主题属新增能力，需另立 issue，本期不设计、不实现 |

### 1.2 分层与依赖方向

```
electron/i18n/           纯数据 + 纯函数（不 import electron、不 import 业务模块、不 import React）
├── types.ts             Locale / UiLanguageSetting / 命名空间类型
├── resolveLocale.ts     跟随系统判定（唯一一处语言判定）
├── index.ts             createTranslator / {{name}} 插值 / 缺键兜底
├── mainT.ts             主进程绑定翻译器（读 ConfigHelper）
├── prompts.ts           三类 prompt 的组装入口（唯一出口）
└── messages/
    ├── ui.zh.ts   ui.en.ts            ← JUN-39 独占
    ├── main.zh.ts main.en.ts          ← JUN-40 独占
    └── processing.zh.ts processing.en.ts ← JUN-41 独占

依赖方向：electron/ConfigHelper、electron/*.ts、src/**  →  electron/i18n  （单向，无环）
```

### 1.3 关键取舍（一行理由）

- **选共享目录 `electron/i18n/`，不选根目录 `shared/`**：`tsconfig.electron.json` 的 `outDir` 是 `dist-electron`，输入文件根一旦上移，产物会变成 `dist-electron/electron/main.js`，`package.json` 的 `main` 与 `stealth-run.sh` 里写死的 `./dist-electron/main.js` 当场失效。
- **选自建类型化文案表，不选 i18next / react-i18next**：只有两门语言，缺键要能在 `tsc` 阶段暴露，而框架化需要主进程（tsc → CommonJS）与渲染层（Vite bundle）两套初始化，收益不抵成本。
- **选 `uiLanguage` 新字段，不改现有 `language` 字段名**：`language` 已是编程语言且被 `ProcessingHelper`、已发布用户的 `config.json` 依赖，改名等于破坏兼容；两个概念必须同名分离。
- **选主进程单点判定语言，不让渲染层读 `navigator.language`**：两端各判一次会出现"主进程中文日志 + 界面英文"的错位，且无法用同一个设置项同时控制两边。
- **选 `configVersion` 标记迁移，不选"检测字段缺失"**：用户手动改回 `language` 后字段仍在，缺字段检测会误判；版本标记写入即一次性。
- **选迁移只覆盖两个默认值、保留 `apiKey`，不选整体重建 config**：整体重建会丢掉凭据，导致后续 issue 的"真实调用截图"验收根本跑不出来；"旧配置覆盖"落在默认值上，不落在凭证上。
- **选 prompt 层约束输出语言，不选输出层翻译**：输出后处理要二次模型调用并会砸坏代码块，成本与延迟翻倍且不可逆；app 本身从不翻译模型输出。
- **选纯函数抽离迁移逻辑（`electron/configMigrations.ts`），不把迁移写进 `ConfigHelper` 私有方法**：`ConfigHelper` 在 import 期就 `new` 并依赖 `electron app`，迁移无法单测；抽成纯函数后可 `node --test` 直接覆盖 5 个边界。

## 2. 决策 1：文案资源的组织方式与命名约定

### 2.1 结论

- 全部文案集中在 `electron/i18n/messages/`，**按归属模块**分三个命名空间，不按页面分：

  | 命名空间 | 承载内容 | 独占 issue |
  |---|---|---|
  | `ui` | 渲染层所有用户可见文案：页面、对话框、Toast、按钮、占位符、空态、更新提示 | JUN-39 |
  | `main` | 主进程与脚本的日志、错误提示、系统对话框/通知、`stealth-run.sh/.bat` 输出 | JUN-40 |
  | `processing` | `ProcessingHelper` 的三类 prompt 与该文件内的日志 | JUN-41 |

  按模块分而非按页面分，是为了让三个实现 issue 各自只写自己那一个文件，不产生同一文件的并发编辑冲突。

- 文件名固定 `<namespace>.<locale>.ts`，`locale ∈ {zh, en}`；导出对象名固定 `<namespace>Zh` / `<namespace>En`。
- 中文表是类型真源：`en` 表的类型声明为 `typeof zh 表`，缺键、多键都在 `tsc` 阶段报错。
- 键名约定：`<namespace>.<区域>.<元素>[.<变体>]`，全小写、段间点分、段内小驼峰。例：`ui.settings.language.followSystem`、`ui.queue.empty.title`、`main.error.apiKeyInvalid`、`main.log.configPath`、`processing.prompt.extract.system`。
  - 一整个句子一个键，不在文案里拼接句子片段（中文语序会碎）。
  - 键名里不出现语言、不出现具体文案。
  - 动态值用 `{{name}}` 占位符，`t(key, vars)` 统一替换；占位符缺失时原样保留（可见、可测，不抛异常）。
- 各端引用方式：
  - 主进程：`mainT("main")` / `mainT("processing")` 得到绑定当前生效语言的翻译函数。
  - 渲染层：`import { ... } from "../../electron/i18n"` + `src/contexts/i18n.tsx` 的 `useI18n()`，组件内只调 `t("...")`。
  - prompt：只能通过 `electron/i18n/prompts.ts` 的导出函数拿整段 prompt，禁止在 `ProcessingHelper.ts` 里手写字符串拼接。
- 缺键兜底：运行时返回键名本身并输出一次 `console.warn`；因为 `en` 表已由类型保证完整，兜底只可能出现在动态拼键上，验收扫描能直接抓到键名残留。

### 2.2 影响文件

新增：
- `electron/i18n/types.ts`
- `electron/i18n/resolveLocale.ts`
- `electron/i18n/index.ts`
- `electron/i18n/mainT.ts`
- `electron/i18n/prompts.ts`
- `electron/i18n/messages/ui.zh.ts`、`ui.en.ts`（JUN-39）
- `electron/i18n/messages/main.zh.ts`、`main.en.ts`（JUN-40）
- `electron/i18n/messages/processing.zh.ts`、`processing.en.ts`（JUN-41）
- `src/contexts/i18n.tsx`（React Provider + `useI18n`）

改造（由各实现 issue 认领）：`src/**` 全部 tsx（JUN-39）、`electron/main.ts`·`ipcHandlers.ts`·`ScreenshotHelper.ts`·`shortcuts.ts`·`autoUpdater.ts`·`preload.ts`·`stealth-run.sh`·`stealth-run.bat`·`cleanup-for-github.sh/.bat`（JUN-40）、`electron/ProcessingHelper.ts`（JUN-41）。

## 3. 决策 2：语言设置的存储、取值、读取时机与默认值

### 3.1 结论

- 存储位置：沿用现有 `~/Library/Application Support/interview-coder-v1/config.json`（`app.getPath("userData")`），不引入 `electron-store`（`electron/store.ts` 当前为空 schema，本次不启用）。
- 字段与取值（契约）：

  ```ts
  type UiLanguageSetting = "system" | "zh" | "en"   // 用户在设置里选的
  type Locale = "zh" | "en"                          // 实际生效的语言

  interface Config {
    // 既有字段保持不变，语义不变
    apiKey: string
    apiProvider: "openai" | "gemini" | "anthropic"
    extractionModel: string
    solutionModel: string
    debuggingModel: string
    language: string        // 编程语言，默认由 "python" 改为 "java"
    opacity: number
    // 本次新增
    uiLanguage: UiLanguageSetting   // 默认 "system"
    configVersion: number           // 迁移标记，当前值 2
  }
  ```

- 默认值：`uiLanguage: "system"`、`language: "java"`、`configVersion: 2`。三者写进 `defaultConfig`，并通过 `loadConfig()` 的 `{...defaultConfig, ...config}` 合并，保证**缺字段的老文件在运行期也表现为"跟随系统"**，不依赖迁移是否执行成功。
- 读取时机：
  - 主进程：每次需要时调用 `configHelper.getUiLocale()`，返回 `{ setting, locale }`，内部即时解析（不缓存），因此改设置后主进程后续日志立即跟随。
  - 渲染层：启动时调用一次 IPC `get-ui-locale` 拿初值，之后由 `ui-locale-changed` 事件与本地状态同步。
  - 在收到 `get-ui-locale` 之前，渲染层**不渲染任何用户可见文案**（初始化遮罩只渲染图标，不渲染 "Initializing..." 文字），以消除首帧语言闪烁。
- 非法值处理：`uiLanguage` 不是三个枚举之一时按 `"system"` 处理并输出一条 warn；`updateConfig` 忽略 `configVersion` 字段（防止渲染层误清迁移标记）。

### 3.2 影响文件

- `electron/ConfigHelper.ts`（`Config` 接口、`defaultConfig`、`getUiLocale()`、`updateConfig` 白名单与非法值兜底）
- `electron/ipcHandlers.ts`（`get-ui-locale` 处理器、`update-config` 后广播）
- `electron/preload.ts`（`getUiLocale` / `onUiLocaleChanged`、`updateConfig` 参数类型补 `uiLanguage`）
- `electron/main.ts`（窗口创建时不再需要注入语言，仅日志调用点改用翻译器）
- `src/types/electron.d.ts`（`electronAPI` 权威类型声明，补 `getUiLocale` / `onUiLocaleChanged` / `Config`）
- `src/types/global.d.ts`、`src/env.d.ts`（现有重复的 `Window` 声明需同步，避免同一 API 三处类型不一致）
- `src/App.tsx`（启动时取 `uiLanguage`/`locale`，替换当前 `currentLanguage` 初始化逻辑；`App.tsx` 由 JUN-39 改，配置层 issue 只出契约）
- `src/components/Settings/SettingsDialog.tsx`（新增"界面语言"三档控件）
- `src/components/shared/LanguageSelector.tsx`（保持编程语言选择器语义，仅新增 `Java` 为默认项；不得复用为界面语言选择器）

## 4. 决策 3：「跟随系统」的判定规则

### 4.1 结论

- 信号：只读主进程 `app.getLocale()`（Electron 在 app ready 后返回系统区域，如 `zh-CN`、`en-US`）。渲染层不读 `navigator.language`。
- 归一化：取主子标签，`zh*`（含 `zh-TW`、`zh-HK`）→ `zh`；其他一切值 → `en`。
- 回落链（严格按序，取到即止）：`app.getLocale()` → 非空则用；为空（app 未 ready 或平台返回空）则用 `Intl.DateTimeFormat().resolvedOptions().locale`；仍为空则 `en`。
- 选 `en` 作最终兜底，不选 `zh`：项目现有全部源码、第三方日志、模型默认输出均为英文，兜底到英文至少保证"信息正确但语言不是预期"，兜底到中文会在非中文系统上制造半中半英。
- 生效时机：
  - 应用内切换 跟随系统 / 中文 / English：**即时生效，不需重启**。渲染层靠 context 重渲染，主进程靠 `getUiLocale()` 即时解析 + `ui-locale-changed` 广播。
  - 操作系统语言在应用运行期间变更：**需重启应用**才生效（`app.getLocale()` 在 ready 后由 Electron 缓存）。本期不做运行期监听，理由：单窗口桌面应用，监听 `app` 级别的 locale 变化需要重启渲染层，收益低于成本。
- 该判定函数是唯一实现，`getUiLocale()`、日志翻译、prompt 选择都调用它。

### 4.2 影响文件

- `electron/i18n/resolveLocale.ts`（新增，唯一判定实现）
- `electron/ConfigHelper.ts`（`getUiLocale()` 调用判定函数）
- `electron/ipcHandlers.ts`、`electron/preload.ts`（`get-ui-locale` / `ui-locale-changed` 契约）
- `electron/main.ts`（ready 前不做任何文案翻译；`Config path:` 这类构造期日志按回落链取值）
- `src/contexts/i18n.tsx`、`src/App.tsx`（初值注入与事件订阅）
- `docs/i18n-design.md`

## 5. 决策 4：旧 `config.json` 的覆盖迁移

### 5.1 结论

- 触发条件：`ConfigHelper` 构造（`ensureConfigExists` 之后）读取现有 `config.json`，当 `typeof configVersion !== "number" || configVersion < 2` 时执行迁移。文件不存在时直接写默认配置（已含 `configVersion: 2`），不进入迁移分支。
- 覆盖范围：**只写三个键** `uiLanguage = "system"`、`language = "java"`、`configVersion = 2`。其余键（`apiKey`、`apiProvider`、三个模型、`opacity`、以及未来版本新增的键）原样保留；迁移基于**原始解析结果**做浅合并，不经过 `sanitizeModelSelection`，避免迁移顺手把用户 `apiProvider` 改写。
- 一次性保证：`configVersion: 2` 与覆盖值在**同一次写入**中落盘；后续任何启动版本号已满足，不再触发。用户之后把 `uiLanguage` 改成 `zh`、把 `language` 改成 `python` 都不会被再次覆盖。
- 写入方式：原子写（同目录写 `config.json.tmp` 后 `rename` 覆盖），避免迁移过程中断电/崩溃产生半截 JSON。
- 损坏文件回落：`JSON.parse` 抛错或解析结果不是普通对象时，先把原文件尽力复制为同目录 `config.invalid-<ISO 时间戳>.json`，再写入完整默认配置（含 `configVersion: 2`）；备份失败不阻塞启动，只记日志。
- 写盘失败（只读目录、权限不足）：继续使用内存中的默认配置，界面与语言仍可用，输出一条错误日志；因为 `configVersion` 没落盘，下次启动会重试，迁移整体幂等。
- 幂等性：迁移函数输入相同则输出相同，重复执行不改变结果；用户手工删除 `configVersion` 会再次被覆盖，这是预期行为（`configVersion` 是迁移标记，文档与日志都说明不要手改）。
- 语义澄清：本条的"旧配置直接覆盖"落在**默认值**上，不落在凭证上。整份重建会清空 `apiKey`，后续 issue 的"真实调用 + 截图"验收将无法进行。若产品侧确实要求连 `apiKey` 一并清空，这是迁移函数里一行的事，需在实现 issue 上显式追加。

### 5.2 迁移用例矩阵（实现与验收共用）

| 场景 | 期望结果 |
|---|---|
| 无 `config.json` | 生成默认配置：`uiLanguage=system`、`language=java`、`configVersion=2` |
| 旧文件无 `configVersion`（含用户现有 glm 配置） | 三个键被覆盖，`apiKey`/`apiProvider`/模型/`opacity` 原样保留 |
| 旧文件 `configVersion=1` | 同上一行 |
| 旧文件 `configVersion=2`，`uiLanguage=zh`、`language=python` | 完全不改动（不被覆盖） |
| `config.json` 内容为非法 JSON / 空文件 | 备份为 `config.invalid-*.json`，写入默认配置 |
| 目录只读 | 启动不崩，使用内存默认值并记录错误日志，下次启动重试 |

### 5.3 影响文件

- `electron/configMigrations.ts`（新增，纯函数，不 import electron）
- `electron/ConfigHelper.ts`（构造时调用迁移、原子写、`configVersion` 兜底）
- `tests/configMigration.test.mjs`（新增，`node --test`，直接跑覆盖上表前 5 行）
- `package.json`（`test` 脚本从 `echo ...` 改为 `node --test tests/`）
- `docs/i18n-design.md`

## 6. 决策 5：AI 返回中文的落点

### 6.1 结论

- 落点：**prompt 层，且只在 prompt 层**。`processing.zh.*` 的 prompt 文案里显式规定：解释性文字、Thoughts、复杂度分析一律用简体中文；结论性回答用简体中文。
- 语言来源：跟随**界面语言**（`uiLanguage` 解析后的 `Locale`），与编程语言 `language` 正交。两者必须可同时成立：编程语言 Java + 中文界面 → 中文讲解 + Java 代码。
- 代码不翻译的保证方式：prompt 内三条硬约束，三条同时下发——
  1. 代码块（``` 围栏内）整体保持原样，不翻译、不重排、不追加中文注释；
  2. 标识符、函数名、类名、API 名称、错误信息原文、库名一律不翻译；
  3. JSON 结构（`problem_statement` / `constraints` / `example_input` / `example_output`）字段名固定英文，只翻译字段值中的自然语言。
- 三条约束同时写进 system prompt 与 user prompt（部分供应商对 system 指令遵循度低），因此每类请求的中英文版本都由 `prompts.ts` 统一组装，不在各供应商分支各写一遍。
- 输出层：**不做任何翻译、不做语言检测后重试、不做后处理**。理由见 1.3。若模型偶发违约，由验收截图判定并记入已知风险，不在本期加自动纠正重试。
- 该文件内的控制台日志与注释归 `processing` 命名空间，与 prompt 同属 JUN-41，保证该文件只被一个 issue 改动。

### 6.2 影响文件

- `electron/i18n/prompts.ts`（新增，三类请求 prompt 的唯一组装出口）
- `electron/i18n/messages/processing.zh.ts`、`processing.en.ts`（新增）
- `electron/ProcessingHelper.ts`（9 个供应商 × 请求组合的 prompt 与日志改调用；`problem_statement` 等 JSON 字段名不变）
- `docs/i18n-design.md`

## 7. 决策 6：文档与代码注释是否双语同步维护

### 7.1 结论

- 文档：**双份物理文件、各自维护**。英文原文保留在原路径（既有外链与徽章不失效），中文版为同目录 `<name>.zh-CN.md`；两份顶部各加一行互链。范围：`README.md`、`CONTRIBUTING.md`、`CHANGES.md`、`renderer/README.md`，以及本设计文档。
- 代码注释：**只中文一份**，不做双语注释。理由：注释是内部产物，双语注释是双份维护且腐化最快的一类文本；英文能力需求由文档双语满足。
- 不翻译的内容（全仓库统一）：代码标识符、字符串 key、文件名/路径、命令、快捷键符号、模型名与供应商名（`gpt-4o`、`gemini-2.0-flash`、`claude-3-7-sonnet-20250219`）、第三方库日志原文。
- 语言切换只影响界面与输出，**不影响文档**：文档双语是静态文件，不随 `uiLanguage` 变化。

### 7.2 影响文件

- `README.md` + 新增 `README.zh-CN.md`
- `CONTRIBUTING.md` + 新增 `CONTRIBUTING.zh-CN.md`
- `CHANGES.md` + 新增 `CHANGES.zh-CN.md`
- `renderer/README.md` + 新增 `renderer/README.zh-CN.md`
- `docs/i18n-design.md`（本文件，单语中文，不回译英文）
- 代码注释：落在各实现 issue 自己改的文件里，不产生额外文件

## 8. 决策 7：「跟随系统」是否包含深色/浅色主题

### 8.1 结论：否

- 本次「跟随系统」只指界面语言（`uiLanguage: "system"` + `app.getLocale()`）。
- 主题不在本期范围：仓库当前**没有主题概念**（全局搜索 `theme` 只命中 `tailwind.config.js` 的配置对象本身），`src/index.css` 把深色写死为 `#000000` / `#1a1a1a` 等具体色值，组件里大量 `bg-black`、`text-white/*` 硬编码。引入主题意味着先建语义化色板 token，再改 40+ 个 tsx 的样式类，属于新增能力，与汉化目标正交，无法在 0.5 天粒度内安全并行。
- 因此：不改 `src/index.css`，不改 `tailwind.config.js`，不新增 `theme` 字段。若后续需要"主题跟随系统"，另立 issue，先做 token 设计。

### 8.2 影响文件

无（本期明确不动）。若另立 issue，预期起点为 `src/index.css`、`tailwind.config.js`、`src/**/*.tsx` 中的硬编码颜色类。

## 9. 契约汇总（实现 issue 直接照此写）

### 9.1 IPC

| 通道 | 方向 | 请求 | 响应 | 说明 |
|---|---|---|---|---|
| `get-config` | handle（既有） | — | `Config`（含 `uiLanguage`、`configVersion`） | 返回磁盘+默认合并后的配置，不含派生语言 |
| `update-config` | handle（既有，扩展） | `Partial<Config>` | `Config` | 接受 `uiLanguage`；非法值忽略；`configVersion` 一律忽略 |
| `get-ui-locale` | handle（新增） | — | `{ setting: UiLanguageSetting, locale: Locale, source: "config" \| "system" }` | 永不抛错；异常时返回 `{setting:"system", locale:"en", source:"system"}` |
| `ui-locale-changed` | send（新增，主→渲染） | — | `{ setting, locale }` | `uiLanguage` 变更后广播，渲染层据此重渲染 |

- 鉴权与工作区隔离：桌面端单用户本地应用，无远程接口、无工作区概念；IPC 仅在主进程与本地渲染进程之间，沿用现有 `contextBridge` 暴露范围，**不改变**任何 `contextIsolation`/`nodeIntegration` 设置。
- 兼容性：`get-config` 只增字段不删字段；`updateConfig({language})` 的旧语义（编程语言）保持不变，已发布客户端不会因为本次改动改变编程语言行为。

### 9.2 模块导出契约（签名级，不含实现）

```ts
// electron/i18n/types.ts
export type Locale = "zh" | "en"
export type UiLanguageSetting = "system" | "zh" | "en"
export type Namespace = "ui" | "main" | "processing"

// electron/i18n/resolveLocale.ts
export function normalizeLocaleTag(tag: string | undefined | null): Locale
export function resolveLocale(setting: UiLanguageSetting): Locale

// electron/i18n/index.ts
export function t<N extends Namespace>(ns: N, locale: Locale, key: string, vars?: Record<string, string>): string
export function createTranslator<N extends Namespace>(ns: N, locale: Locale): (key: string, vars?: Record<string, string>) => string

// electron/i18n/mainT.ts
export function mainT<N extends Exclude<Namespace, "ui">>(ns: N): (key: string, vars?: Record<string, string>) => string

// electron/i18n/prompts.ts
export function buildExtractionPrompt(locale: Locale, v: { language: string }): { system: string; user: string }
export function buildSolutionPrompt(locale: Locale, v: { language: string; problem: ProblemInfo }): string
export function buildDebugPrompt(locale: Locale, v: { language: string; problem: ProblemInfo }): string

// electron/ConfigHelper.ts
class ConfigHelper {
  getUiLocale(): { setting: UiLanguageSetting; locale: Locale }
}

// electron/configMigrations.ts
export function migrateConfigData(raw: unknown): { config: Record<string, unknown>; migrated: boolean }
```

### 9.3 渲染层契约

```ts
// src/contexts/i18n.tsx
useI18n(): {
  locale: Locale
  setting: UiLanguageSetting
  t: (key: string, vars?: Record<string, string>) => string
  setSetting: (s: UiLanguageSetting) => Promise<void>   // 写 config + 立即重渲染
}
```

- `t` 的键必须是 `ui` 命名空间的键；其它命名空间的键在渲染层不可达（`createTranslator` 只注入一个命名空间）。

## 10. 失败模式与处理

| 场景 | 表现 | 处理 |
|---|---|---|
| `app.getLocale()` 返回空（ready 前） | 判定无法进行 | 走 `Intl` → `en` 回落链；ready 前不做用户可见文案 |
| 系统语言为 `zh-TW`/`zh-HK` | 只支持简体 | 归 `zh`，界面为简体中文；繁体输出不在本期范围 |
| `config.json` 为非法 JSON | 每次启动都读失败 | 备份 `config.invalid-*.json` 后重建默认，只发生一次 |
| 配置文件写失败（只读/权限） | 设置不落盘 | 内存态继续，日志报错，下次启动重试；不崩、不弹窗 |
| 迁移中途进程被杀 | 可能半截写入 | 原子写 + 未落 `configVersion` 则下次重跑，结果一致 |
| 渲染层与主进程语言不一致（改设置瞬间） | 界面已切、主进程日志仍旧 | `update-config` 成功后再广播 `ui-locale-changed`，主进程不缓存，窗口内不出现稳定错位 |
| 并发 `update-config`（连续点击） | 两次写入 | 写操作串行（同步写 <1ms，单窗口），最后一次生效；不引入锁 |
| 缺键 / 动态拼接键错 | 界面出现 key 字符串 | 返回 key 本身 + 一次 warn；验收扫描按"残留英文/花括号"抓 |
| 模型不遵守中文指令 | 返回整段英文 | 不做自动重试；验收 issue 按截图判定为不通过，回退到调整 prompt 文案 |
| 第三方库英文日志 | 中文环境下出现英文行 | 属已知例外，JUN-40 在评论中列清单，不视为遗漏 |
| `stealth-run.sh` 每次 `rm -rf dist dist-electron` | 语言设置若放在构建产物里会丢 | 语言设置只存 `userData/config.json`，与构建产物无关 |

## 11. 测试策略（哪一层测什么）

| 层 | 对象 | 手段 | 归属 |
|---|---|---|---|
| 编译期 | 中英文案键完整性、类型契约 | `npx tsc --noEmit`（渲染层）与 `npx tsc -p tsconfig.electron.json`（主进程） | JUN-39 / 40 / 41 / 配置层 |
| 单元 | `normalizeLocaleTag`/`resolveLocale`、`migrateConfigData`（含 6 行用例矩阵中前 5 行）、`t` 的插值与缺键兜底 | `node --test tests/`，跑编译后的 `dist-electron/**`（Node ≥18 内置 runner，零新依赖） | 配置层 issue |
| 静态扫描 | 硬编码文案残留 | 对 `src/**/*.tsx` 扫英文文案、对 `electron/**/*.ts` 扫中文字面量，命中逐条解释或修复 | JUN-39 / 40 / 41 |
| 接口 | `get-ui-locale` 四种设置组合、非法 `uiLanguage`、`configVersion` 被忽略 | 主进程手动驱动 + 日志佐证（项目无 IPC 测试框架，本期不引入） | 配置层 issue + 验收 |
| E2E / 验收 | `./stealth-run.sh` 启动后四态：系统中文→中文、系统英文→英文、手动中文重启后仍中文、手动英文重启后仍英文；以及"设置→切语言→界面即时变化" | 真实启动 + `Cmd+B` 显形 + 截图 | 验收 issue |
| E2E / 验收 | prompt 层：三类请求 × 两家以上供应商 × 中英两态，正文语言与代码块原样 | 真实 API 调用 + 截图 | JUN-41 |

补充约束：本期**不引入**测试框架（Jest/Vitest/Playwright），理由见"本次不做"。

## 12. 本次不做

- 不引入 i18n 框架与任何新运行时依赖（i18next、react-i18next、FormatJS 等）。
- 不引入测试框架（Jest/Vitest/Playwright），只使用 Node 内置 `node --test` 跑纯函数。
- 不做深色/浅色主题，不改 `src/index.css` 与 `tailwind.config.js`。
- 不做运行期操作系统语言热监听（需重启应用）。
- 不做繁体中文（`zh-TW`/`zh-HK` 归简体）。
- 不做输出层翻译、语言检测或模型违约自动重试。
- 不重命名既有 `language` 字段、不改 `apiProvider`/模型选择逻辑、不改 AI SDK 调用方式与请求参数结构。
- 不做 electron-builder 打包（dmg/exe）与发布流程改动。
- 不改 `stealth-run.sh` 的构建/启动流程（只汉化其输出文案，属 JUN-40）。
- 不改任何工作区隔离/鉴权逻辑（本地桌面应用，无相关面）。

## 13. 任务分解与分派建议

| 任务 | 内容 | 依赖 | 建议归属 |
|---|---|---|---|
| T0 | 本设计文档 | — | 已完成（JUN-37） |
| T1 | **配置层**：`ConfigHelper`（`uiLanguage`/`configVersion`/`getUiLocale`）、`configMigrations.ts`、`get-ui-locale` IPC、`preload` 契约、`src/types/*.d.ts`、`tests/*.mjs`、`package.json` test 脚本 | T0 | 需新建子 issue，建议给主进程线负责人（JUN-40/41 同一负责人） |
| T2 | **文档双语**（JUN-38） | T0（第 7 条结论） | 现有负责人，可立即并行 |
| T3 | **渲染层**（JUN-39）：`ui.*` 文案、`src/contexts/i18n.tsx`、`App.tsx`、设置对话框三档 | T0 契约 + T1 的 IPC/preload 落地 | 现有负责人（前端线） |
| T4 | **主进程与脚本**（JUN-40）：`main.*` 文案、脚本输出、注释 | T0 契约 + T1 | 现有负责人（主进程线） |
| T5 | **prompt 双语**（JUN-41）：`processing.*`、`prompts.ts`、`ProcessingHelper.ts` | T0 契约 + T1 | 现有负责人（主进程线） |
| T6 | **验收**：`stealth-run.sh` 启动 + 四态截图 + 迁移矩阵复核 | T1–T5 | 需新建验收 issue |

- 可并行：T2 与 T1 同时开工；T3/T4/T5 在 T1 契约合并后**三者同时**开工（文件零重叠：`ui.*` / `main.*` / `processing.*`，业务文件也分属 `src/**` 与 `electron/**`）。
- 阻塞点：T1 → {T3, T4, T5} → T6；T1 未合并前，T3/T4/T5 只能写文案表，不能接 IPC，否则会各自造一份字段名。
- 唯一共享写入点：`src/types/*.d.ts`（T1 独占）、`electron/preload.ts`（T1 独占）、`src/App.tsx`（T3 独占）、`electron/ConfigHelper.ts`（T1 独占）；除这些之外不得跨 issue 改同一文件。

## 14. 风险清单

| # | 风险 | 影响 | 处置 |
|---|---|---|---|
| R1 | **配置层实现 issue 缺失**：JUN-39 只提到"默认跟随系统"，JUN-40/41 都显式把 `ConfigHelper`/`store.ts` 排除在外，当前子 issue 列表里没有任何 issue 实现 `uiLanguage` 字段、`get-ui-locale` 与迁移 | 三个实现 issue 会各自造字段名与默认值，最终无法合并 | 必须先建 T1 子 issue 并先合并；本文件 9.1/9.2 即其验收口径 |
| R2 | 共享模块若被移出 `electron/`，tsc 产出路径变化 | `dist-electron/main.js` 消失，`stealth-run.sh` 与 `package.json main` 直接失效 | 共享模块固定在 `electron/i18n/`，作为硬约束写入实现 issue |
| R3 | 迁移强制 `language="java"` 会覆盖用户既有编程语言选择（如 `csharp`） | 一次性意外 | 用户已明确"旧配置覆盖即可"；迁移一次性，用户改回后不再覆盖；迁移时输出一条日志说明已覆盖 |
| R4 | 渲染层跨目录 import `electron/i18n` | 若构建器限制目录会报错；同时把 `main`/`processing` 文案带进渲染包 | 文案表按命名空间分文件、无副作用，Vite 可摇树；需要时在 JUN-39 里只 import `ui` 与 `types` |
| R5 | 文案体量大（`electron/**` 约 189 处 `console.*`，`src/**` 约 76 处 + 数百条 UI 文案） | 各 0.5 天的估时偏紧 | 分三个命名空间并行；先接框架再批量替换，不留半中半英 |
| R6 | `zh-TW`/`zh-HK` 用户看到简体 | 语言不地道 | 明确列为范围外；后续若需要再加 `zh-Hant` 语言包 |
| R7 | 模型不遵守"代码块不翻译" | 代码块被改写 | prompt 双写约束 + 验收截图逐条核对；不做自动重试 |
| R8 | `stealth-run.sh` 每次清空 `dist`/`.env` | 若把语言状态放进构建产物会每次丢失 | 语言状态只存 `userData/config.json`；验收前不需要额外恢复步骤 |
| R9 | 现有 `src/types/electron.d.ts` 的 `getConfig`/`updateConfig` 类型与实际实现已不一致（只声明 `apiKey`/`model`） | 新增字段后类型更偏离 | T1 顺带修正为真实 `Config` 结构；不引入 `any` |
