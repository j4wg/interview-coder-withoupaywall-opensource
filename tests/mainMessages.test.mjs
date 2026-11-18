// `main` 命名空间与脚本层的一致性单测：零新依赖，直接跑 tsc 产物（`dist-electron`）。
// 覆盖三件验收会盯的事：
//   1. main.zh / main.en 键集合与占位符一一对应（缺键即 tsc 报错，这里再兜一道）；
//   2. 脚本里的字面量与 main.script.* 逐条相同（shell 读不到 TS，靠本测试防两边各改一边）；
//   3. 7 条快捷键的标签与 README（英文 README.md / 中文 README.zh-CN.md）逐字一致。
// 运行：npm test —— pretest 先执行 `tsc -p tsconfig.electron.json` 生成产物。
import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, "..")

const zhFile = path.resolve(
  repoRoot,
  "dist-electron/i18n/messages/main.zh.js"
)
const enFile = path.resolve(
  repoRoot,
  "dist-electron/i18n/messages/main.en.js"
)
const i18nFile = path.resolve(repoRoot, "dist-electron/i18n/index.js")

if (!fs.existsSync(zhFile) || !fs.existsSync(enFile) || !fs.existsSync(i18nFile)) {
  throw new Error(
    "缺少编译产物 dist-electron/i18n/**，请先执行 `npx tsc -p tsconfig.electron.json`"
  )
}

const { mainZh } = require(zhFile)
const { mainEn } = require(enFile)
const { t } = require(i18nFile)

const read = (relative) => fs.readFileSync(path.resolve(repoRoot, relative), "utf8")
const stealthSh = read("stealth-run.sh")
const cleanupSh = read("cleanup-for-github.sh")
const stealthBat = read("stealth-run.bat")
const cleanupBat = read("cleanup-for-github.bat")

/** 中文表里 `main.script.*` 的键 → shell 内的 say 键名 */
const scriptKeyOf = (key) => {
  const aliases = {
    "main.script.step.dirs": "stepDirs",
    "main.script.step.clean": "stepClean",
    "main.script.step.cleanDetail": "stepCleanDetail",
    "main.script.step.build": "stepBuild",
    "main.script.step.buildDetail": "stepBuildDetail",
    "main.script.step.launch": "stepLaunch",
    "main.script.step.launchHint": "stepLaunchHint",
    "main.script.stealth.running": "running",
    "main.script.stealth.issues": "issues",
    "main.script.stealth.issue1": "issue1",
    "main.script.stealth.issue2": "issue2",
    "main.script.stealth.issue3": "issue3",
    "main.script.stealth.issue4": "issue4"
  }
  if (aliases[key]) return aliases[key]
  const tail = key.split(".").pop()
  return tail
}

/** 从 `- 标签：键位 / 标签：键位` 中取出标签与键位（两侧都可能是两项，如不透明度） */
function parseShortcut(value) {
  const body = value.replace(/^-\s*/, "")
  return body.split(" / ").map((part) => {
    if (part.includes("：")) {
      const index = part.indexOf("：")
      return { label: part.slice(0, index), chord: part.slice(index + 1) }
    }
    const index = part.indexOf(": ")
    return { label: part.slice(0, index), chord: part.slice(index + 2) }
  })
}

/** .bat 的平台专属文案：Windows 没有 chmod / 活动监视器，这两条单独一套键 */
const batOnlyKeys = [
  "main.script.stealth.batIssue2",
  "main.script.stealth.batIssue3"
]
const shOnlyKeys = [
  "main.script.stealth.issue2",
  "main.script.stealth.issue3",
  "main.script.stealth.issue4"
]

const shortcutKeys = Object.keys(mainZh).filter((key) =>
  key.startsWith("main.script.stealth.shortcut")
)

test("main.zh / main.en 键集合完全一致，无空值", () => {
  assert.deepEqual(Object.keys(mainEn).sort(), Object.keys(mainZh).sort())
  for (const key of Object.keys(mainZh)) {
    assert.ok(mainZh[key].length > 0, `中文文案为空：${key}`)
    assert.ok(mainEn[key].length > 0, `英文文案为空：${key}`)
  }
})

test("main 命名空间已注册：t() 取到文案而不是键名", () => {
  assert.equal(t("main", "zh", "main.window.loaded"), mainZh["main.window.loaded"])
  assert.equal(t("main", "en", "main.window.loaded"), mainEn["main.window.loaded"])
  assert.equal(t("main", "zh", "main.window.loaded"), "窗口加载完成")
  assert.equal(t("main", "en", "main.window.loaded"), "Window finished loading")
})

test("插值：{{name}} 被替换，缺失占位符原样保留", () => {
  assert.equal(
    t("main", "zh", "main.shot.dirCreated", { path: "/tmp/a" }),
    "已创建目录：/tmp/a"
  )
  assert.equal(
    t("main", "en", "main.shot.dirCreated"),
    "Created directory: {{path}}"
  )
})

test("zh / en 占位符集合一一对应", () => {
  const placeholders = (value) =>
    [...value.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]).sort()
  for (const key of Object.keys(mainZh)) {
    assert.deepEqual(
      placeholders(mainEn[key]),
      placeholders(mainZh[key]),
      `占位符不一致：${key}`
    )
  }
})

test("英文表不含中日韩文字，中文表每一条都是中文", () => {
  const cjk = /[\u4e00-\u9fff\u3000-\u303f\uff01-\uff5e]/
  for (const key of Object.keys(mainEn)) {
    assert.ok(!cjk.test(mainEn[key]), `英文文案里混入中文：${key}`)
    assert.ok(cjk.test(mainZh[key]), `中文文案里没有中文：${key}`)
  }
})

test("源码里用到的 main.* 键全部存在，无残留键名", () => {
  const sources = [
    "electron/main.ts",
    "electron/ipcHandlers.ts",
    "electron/ScreenshotHelper.ts",
    "electron/shortcuts.ts",
    "electron/autoUpdater.ts",
    "electron/preload.ts"
  ].map(read)

  const used = new Set()
  for (const source of sources) {
    for (const match of source.matchAll(/\bt[p]?\(\s*"(main\.[A-Za-z0-9_.]+)"/g)) {
      used.add(match[1])
    }
  }

  assert.ok(used.size > 100, `扫描到的键过少（${used.size}），正则可能失效`)
  const missing = [...used].filter((key) => !(key in mainZh))
  assert.deepEqual(missing, [], `以下键未在 main.zh.ts 中定义：${missing.join(", ")}`)

  const unused = Object.keys(mainZh).filter(
    (key) => !used.has(key) && !key.startsWith("main.script.")
  )
  assert.deepEqual(unused, [], `以下键未被任何代码使用：${unused.join(", ")}`)
})

test("preload 内联文案（受 sandbox 限制）与 main.zh / main.en 逐条一致", () => {
  const source = read("electron/preload.ts")
  const zhBlock = source
    .split("const PRELOAD_MESSAGES_ZH")[1]
    .split("const PRELOAD_MESSAGES_EN")[0]
  const enBlock = source
    .split("const PRELOAD_MESSAGES_EN")[1]
    .split("const PRELOAD_MESSAGES:")[0]

  const parse = (block) => {
    const map = {}
    for (const match of block.matchAll(/"(main\.[A-Za-z0-9_.]+)":\s*"([^"]*)"/g)) {
      map[match[1]] = match[2]
    }
    return map
  }

  const zh = parse(zhBlock)
  const en = parse(enBlock)

  const expectedKeys = Object.keys(mainZh)
    .filter((key) => key.startsWith("main.preload.") || key === "main.error.preloadToggle")
    .sort()

  assert.deepEqual(Object.keys(zh).sort(), expectedKeys)
  assert.deepEqual(Object.keys(en).sort(), expectedKeys)
  for (const key of expectedKeys) {
    assert.equal(zh[key], mainZh[key], `preload 中文文案与 main.zh.ts 不一致：${key}`)
    assert.equal(en[key], mainEn[key], `preload 英文文案与 main.en.ts 不一致：${key}`)
  }
})

test("stealth-run.sh 的文案与 main.script.* 逐条一致（zh 与 en 两态）", () => {
  for (const key of Object.keys(mainZh).filter(
    (k) =>
      (k.startsWith("main.script.stealth.") || k.startsWith("main.script.step.")) &&
      !batOnlyKeys.includes(k)
  )) {
    const sayKey = scriptKeyOf(key)
    assert.ok(
      stealthSh.includes(`zh:${sayKey}) echo "${mainZh[key]}"`),
      `stealth-run.sh 缺少中文文案：${key} → ${sayKey}`
    )
    assert.ok(
      stealthSh.includes(`en:${sayKey}) echo "${mainEn[key]}"`),
      `stealth-run.sh 缺少英文文案：${key} → ${sayKey}`
    )
  }
})

test("cleanup-for-github.sh 的文案与 main.script.cleanup.* 逐条一致", () => {
  for (const key of Object.keys(mainZh).filter((k) =>
    k.startsWith("main.script.cleanup.")
  )) {
    const sayKey = scriptKeyOf(key)
    assert.ok(
      cleanupSh.includes(`zh:${sayKey}) echo "${mainZh[key]}"`),
      `cleanup-for-github.sh 缺少中文文案：${key}`
    )
    assert.ok(
      cleanupSh.includes(`en:${sayKey}) echo "${mainEn[key]}"`),
      `cleanup-for-github.sh 缺少英文文案：${key}`
    )
  }
})

test("两个 .bat 都带中文/英文两套文案（Windows 键位为 Ctrl+）", () => {
  for (const [file, content] of [
    ["stealth-run.bat", stealthBat],
    ["cleanup-for-github.bat", cleanupBat]
  ]) {
    const isStealth = file === "stealth-run.bat"
    const keys = Object.keys(mainZh).filter((k) => {
      if (isStealth) {
        if (shOnlyKeys.includes(k)) return false
        return (
          k.startsWith("main.script.stealth.") ||
          k.startsWith("main.script.step.")
        )
      }
      return k.startsWith("main.script.cleanup.")
    })

    assert.ok(content.includes("chcp 65001"), `${file} 缺少 UTF-8 代码页设置`)
    for (const key of keys) {
      const ctrlZh = mainZh[key].replace(/Cmd\+/g, "Ctrl+")
      const ctrlEn = mainEn[key].replace(/Cmd\+/g, "Ctrl+")
      assert.ok(content.includes(`echo ${ctrlZh}`), `${file} 缺少中文文案：${key}`)
      assert.ok(content.includes(`echo ${ctrlEn}`), `${file} 缺少英文文案：${key}`)
    }
  }
})

test("7 条快捷键（Cmd+B/H/Enter/方向键/[/]/R/Q）标签与 README 逐字一致", () => {
  assert.equal(shortcutKeys.length, 7, "快捷键条数必须是 7")

  const readmeEn = read("README.md")
  const zhReadmePath = path.resolve(repoRoot, "README.zh-CN.md")
  const readmeZh = fs.existsSync(zhReadmePath)
    ? fs.readFileSync(zhReadmePath, "utf8")
    : null

  const enLabels = []
  const zhLabels = []

  for (const key of shortcutKeys) {
    for (const { label, chord } of parseShortcut(mainEn[key])) {
      enLabels.push(label)
      // 键位：.sh 用 Cmd，.bat 用 Ctrl，两条都要在脚本里出现
      assert.ok(chord.startsWith("Cmd+"), `英文键位应以 Cmd+ 开头：${key} → ${chord}`)
      assert.ok(stealthSh.includes(chord), `stealth-run.sh 缺少键位 ${chord}`)
      assert.ok(
        stealthBat.includes(chord.replace("Cmd+", "Ctrl+")),
        `stealth-run.bat 缺少键位 ${chord.replace("Cmd+", "Ctrl+")}`
      )
      // 标签：英文对齐 README.md
      assert.ok(
        readmeEn.includes(`- ${label}:`),
        `英文标签与 README.md 不一致：${key} → ${label}`
      )
    }

    for (const { label, chord } of parseShortcut(mainZh[key])) {
      zhLabels.push(label)
      assert.ok(chord.startsWith("Cmd+"), `中文键位应以 Cmd+ 开头：${key} → ${chord}`)
      assert.ok(stealthSh.includes(chord), `stealth-run.sh 缺少键位 ${chord}`)
      // 标签：中文对齐 README.zh-CN.md（存在时）
      if (readmeZh) {
        assert.ok(
          readmeZh.includes(`- ${label}：`),
          `中文标签与 README.zh-CN.md 不一致：${key} → ${label}`
        )
      }
    }
  }

  assert.deepEqual(enLabels, [
    "Toggle Window Visibility",
    "Take Screenshot",
    "Process Screenshots",
    "Move Window",
    "Decrease Opacity",
    "Increase Opacity",
    "Start New Problem",
    "Quit"
  ])
  assert.deepEqual(zhLabels, [
    "显示/隐藏窗口",
    "截图",
    "处理截图",
    "移动窗口",
    "降低不透明度",
    "提高不透明度",
    "开始新题目",
    "退出"
  ])
})

test("脚本流程未被改写：清空 dist/dist-electron 与启动命令仍在", () => {
  assert.ok(stealthSh.includes("rm -rf dist dist-electron"))
  assert.ok(stealthSh.includes("npm run build"))
  assert.ok(stealthSh.includes("npx electron ./dist-electron/main.js"))
  assert.ok(stealthSh.includes('cd "$(dirname "$0")"'))
  assert.ok(stealthBat.includes("rmdir /s /q dist dist-electron 2>nul"))
  assert.ok(stealthBat.includes("call npm run build"))
  assert.ok(stealthBat.includes("npx electron ./dist-electron/main.js"))
  assert.ok(stealthBat.includes('cd /D "%~dp0"'))
})
