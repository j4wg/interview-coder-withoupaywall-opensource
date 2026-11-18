/**
 * 渲染层界面文案（`ui` 命名空间）中文表。
 *
 * 本文件是**类型真源**：`ui.en.ts` 的类型由本文件推导，缺键或多键都会在 `tsc` 阶段报错。
 * 键名规则见 `docs/i18n-design.md` §2.1：`ui.<区域>.<元素>[.<变体>]`，一段一句完整句子，
 * 不用文案片段拼接（中文语序会碎）；动态值统一用 `{{name}}` 占位符。
 *
 * 不翻译：模型名（`gpt-4o`…）、API 供应商名（OpenAI / Gemini / Anthropic）、
 * 快捷键符号（⌘ / Ctrl / ↑ 等）、代码标识符。
 */
export const uiZh = {
  // 全局通用
  "ui.common.success": "成功",
  "ui.common.error": "错误",
  "ui.common.cancel": "取消",
  "ui.common.close": "关闭",
  "ui.common.settings": "设置",
  "ui.common.logOut": "退出登录",
  "ui.common.programmingLanguage": "编程语言",
  "ui.common.apiSettings": "OpenAI API 设置",

  // 应用外壳
  "ui.app.initializing": "正在初始化…",
  "ui.app.toast.apiKeyInvalid.title": "API Key 无效",
  "ui.app.toast.apiKeyInvalid.description":
    "你的 OpenAI API Key 似乎无效，或额度不足",
  "ui.app.toast.apiKeySaved": "API Key 已保存",
  "ui.app.toast.apiKeySaveFailed": "API Key 保存失败",

  // 欢迎页（未配置 API Key）
  "ui.welcome.badge": "已解锁版本",
  "ui.welcome.title": "欢迎使用 Interview Coder",
  "ui.welcome.description":
    "本应用为编程题提供 AI 生成的解答，帮你在技术面试中拿到更好的结果。",
  "ui.welcome.shortcutsTitle": "全局快捷键",
  "ui.welcome.gettingStartedTitle": "快速开始",
  "ui.welcome.gettingStartedDescription":
    "使用本应用前，需要先配置你的 OpenAI API Key。",
  "ui.welcome.openSettings": "打开设置",
  "ui.welcome.footer": "先截一张题目截图开始（Ctrl+H / Cmd+H）",

  // 快捷键名称（欢迎页、设置对话框、工具栏共用）
  "ui.shortcut.title": "键盘快捷键",
  "ui.shortcut.toggleVisibility": "显示/隐藏窗口",
  "ui.shortcut.takeScreenshot": "截图",
  "ui.shortcut.processScreenshots": "处理截图",
  "ui.shortcut.deleteLastScreenshot": "删除最后一张截图",
  "ui.shortcut.resetView": "重置视图",
  "ui.shortcut.quitApp": "退出应用",
  "ui.shortcut.moveWindow": "移动窗口",
  "ui.shortcut.decreaseOpacity": "降低不透明度",
  "ui.shortcut.increaseOpacity": "提高不透明度",
  "ui.shortcut.zoomOut": "缩小",
  "ui.shortcut.resetZoom": "重置缩放",
  "ui.shortcut.zoomIn": "放大",

  // 顶栏
  "ui.header.programmingLanguageLabel": "语言：",
  "ui.header.toast.loggedOut": "已退出登录",
  "ui.header.toast.logoutFailed": "退出登录失败",

  // 队列页
  "ui.queue.screenshot.first": "截取第一张截图",
  "ui.queue.screenshot.second": "截取第二张截图",
  "ui.queue.screenshot.third": "截取第三张截图",
  "ui.queue.screenshot.fourth": "截取第四张截图",
  "ui.queue.screenshot.fifth": "截取第五张截图",
  "ui.queue.screenshot.replaceFirst": "下一张将替换第一张截图",

  // 工具栏与快捷键浮层
  "ui.commands.showHide": "显示/隐藏",
  "ui.commands.toggleWindow": "显示/隐藏窗口",
  "ui.commands.toggleWindowDescription": "显示或隐藏此窗口。",
  "ui.commands.takeScreenshot": "截图",
  "ui.commands.takeScreenshotDescription": "截取题目描述。",
  "ui.commands.takeScreenshotForCode": "截取代码",
  "ui.commands.takeScreenshotForSolutionDescription":
    "截取题目的其余部分或你的解答，用于获取调试帮助。",
  "ui.commands.solve": "解答",
  "ui.commands.solveDescription": "基于当前题目生成解答。",
  "ui.commands.solveNeedsScreenshot": "请先截图，再生成解答。",
  "ui.commands.deleteLastScreenshot": "删除最后一张截图",
  "ui.commands.deleteLastScreenshotDescription": "移除最近一次截取的截图。",
  "ui.commands.deleteLastScreenshotEmpty": "没有可删除的截图。",
  "ui.commands.debug": "调试",
  "ui.commands.debugDescription":
    "基于此前全部截图与新增截图重新生成解答。",
  "ui.commands.startOver": "重新开始",
  "ui.commands.startOverDescription": "换一道题从头开始。",
  "ui.commands.screenshot": "截图",

  // 解答页
  "ui.solutions.problemStatement": "题目描述",
  "ui.solutions.extracting": "正在提取题目描述…",
  "ui.solutions.thoughts": "我的思路（{{key}} + 方向键滚动）",
  "ui.solutions.generating": "正在生成解答…",
  "ui.solutions.solutionTitle": "解答",
  "ui.solutions.loading": "正在加载解答…",
  "ui.solutions.copy": "复制",
  "ui.solutions.copied": "已复制！",
  "ui.solutions.complexity": "复杂度",
  "ui.solutions.calculating": "正在计算复杂度…",
  "ui.solutions.time": "时间：",
  "ui.solutions.space": "空间：",
  "ui.solutions.complexityUnavailable": "暂无复杂度信息",

  // 调试页
  "ui.debug.whatIChanged": "我改了什么",
  "ui.debug.originalCode": "原始代码",
  "ui.debug.analysis": "分析与改进",
  "ui.debug.loadingAnalysis": "正在加载调试分析…",
  "ui.debug.fallbackThoughts": "基于你的截图给出的调试分析",
  "ui.debug.notAvailable": "不适用（调试模式）",
  "ui.debug.placeholder.noAnalysis": "// 暂无分析内容",
  "ui.debug.placeholder.seeAnalysis": "// 调试模式，详见下方分析",

  // Toast：错误与提示
  "ui.error.failedToTakeScreenshot": "截图失败",
  "ui.error.failedToProcessScreenshots": "处理截图失败",
  "ui.error.failedToToggleWindow": "显示/隐藏窗口失败",
  "ui.error.failedToDeleteScreenshot": "删除截图失败",
  "ui.error.failedToReset": "重置失败",
  "ui.error.failedToLoadSettings": "设置加载失败",
  "ui.error.failedToSaveSettings": "设置保存失败",
  "ui.error.failedToDownloadUpdate": "更新包下载失败",
  "ui.error.processingFailed": "处理失败",
  "ui.error.queueProcessingDescription": "处理你的截图时出错。",
  "ui.error.debugDescription": "调试你的代码时出错。",
  "ui.info.noScreenshots": "没有截图",
  "ui.info.noScreenshotsToDelete": "没有可删除的截图。",
  "ui.info.noScreenshotsToProcess": "没有可处理的截图。",
  "ui.info.noExtraScreenshotsToProcess": "没有可处理的额外截图。",

  // 设置对话框
  "ui.settings.title": "API 设置",
  "ui.settings.description":
    "配置你的 API 地址、密钥与模型。使用本应用需要你自己的 API 凭证。",
  "ui.settings.interfaceLanguage": "界面语言",
  "ui.settings.interfaceLanguageHint": "切换后立即生效，无需重启应用",
  "ui.settings.interfaceLanguage.current": "当前界面语言：{{locale}}",
  "ui.settings.interfaceLanguage.system": "跟随系统",
  "ui.settings.interfaceLanguage.zh": "中文",
  "ui.settings.interfaceLanguage.en": "English",
  "ui.settings.baseUrl.label": "Base URL",
  "ui.settings.baseUrl.placeholder": "https://api.example.com/v1",
  "ui.settings.apiFormat.label": "API 格式",
  "ui.settings.apiFormat.anthropicMessages": "Anthropic Messages (/v1/messages)",
  "ui.settings.apiFormat.chatCompletions": "Chat Completions (/chat/completions)",
  "ui.settings.apiFormat.responses": "Responses (/responses)",
  "ui.settings.apiKey.label": "API Key",
  "ui.settings.apiKey.placeholder": "输入 API Key",
  "ui.settings.apiKey.show": "显示 API Key 明文",
  "ui.settings.apiKey.hide": "隐藏 API Key（改为密文）",
  "ui.settings.models.listTitle": "模型列表",
  "ui.settings.models.add": "添加模型",
  "ui.settings.models.fetch": "拉取模型列表",
  "ui.settings.models.fetching": "正在拉取…",
  "ui.settings.models.empty": "当前没有配置模型，添加模型后可在聊天中使用。",
  "ui.settings.models.addInputLabel": "模型 ID",
  "ui.settings.models.addPlaceholder": "输入模型 ID，例如 glm-4.6",
  "ui.settings.models.addConfirm": "添加",
  "ui.settings.models.addEmpty": "请输入模型 ID",
  "ui.settings.models.addDuplicate": "「{{model}}」已在列表中",
  "ui.settings.models.remove": "删除模型 {{model}}",
  "ui.settings.models.fetchNeedsBaseUrl": "请先填写 Base URL 再拉取模型列表",
  "ui.settings.models.fetchUnavailable":
    "模型列表接口尚未就绪，请手工添加模型 ID",
  "ui.settings.models.fetchUnknownError": "未知错误",
  "ui.settings.models.fetchFailed": "拉取模型列表失败：{{message}}",
  "ui.settings.models.fetchManualHint":
    "仍可点击「添加模型」手工填写模型 ID，界面不会因此卡住。",
  "ui.settings.models.retry": "重试",
  "ui.settings.models.fetchResultTitle": "接口返回的模型，勾选后加入列表",
  "ui.settings.models.fetchEmpty":
    "接口没有返回任何模型，可手工填写模型 ID。",
  "ui.settings.models.alreadyAdded": "已添加",
  "ui.settings.models.addSelected": "加入所选（{{count}}）",
  "ui.settings.models.fetchAdded": "已加入 {{count}} 个模型",
  "ui.settings.bindings.title": "模型用途",
  "ui.settings.bindings.description": "为每个用途各选一套配置下的一个模型",
  "ui.settings.bindings.emptyOption": "先添加模型",
  "ui.settings.bindings.selectPlaceholder": "请选择一个模型",
  "ui.settings.bindings.addFirst": "先添加配置和模型，再为每个用途各选一个",
  "ui.settings.models.extraction.title": "题目提取",
  "ui.settings.models.extraction.description": "用于分析截图并提取题目细节的模型",
  "ui.settings.models.solution.title": "解答生成",
  "ui.settings.models.solution.description": "用于生成代码解答的模型",
  "ui.settings.models.debugging.title": "调试",
  "ui.settings.models.debugging.description": "用于调试并改进解答的模型",
  "ui.settings.providers.title": "API 配置",
  "ui.settings.providers.description":
    "可以添加多套配置，每个用途各选一套、各选一个模型。",
  "ui.settings.providers.add": "添加配置",
  "ui.settings.providers.empty": "还没有 API 配置，点击「添加配置」开始。",
  "ui.settings.providers.nameLabel": "配置名称",
  "ui.settings.providers.namePlaceholder": "例如：公司 GLM（可选）",
  "ui.settings.providers.untitled": "未命名配置",
  "ui.settings.providers.remove": "删除这套配置",
  "ui.settings.providers.removeConfirm":
    "删除「{{name}}」？引用它的用途会被清空。",
  "ui.settings.bindings.providerLabel": "配置",
  "ui.settings.bindings.modelLabel": "模型",
  "ui.settings.bindings.providerPlaceholder": "选择配置",
  "ui.settings.bindings.modelPlaceholder": "选择模型",
      "ui.settings.bindings.modelNeedsProvider": "先选择配置",
  "ui.settings.bindings.noModels": "该配置还没有模型",
  "ui.settings.bindings.cleared":
    "部分用途引用的模型已不存在，已清空，请重新选择。",
  "ui.settings.validation.baseUrl":
    "「{{name}}」的 Base URL 不是合法的 http(s) 地址。",
  "ui.settings.toast.savedWithCleared":
    "设置已保存，但有用途需要重新选择模型",
  "ui.settings.toast.saveFailed": "保存失败，请重试",
  "ui.settings.toast.saveNoEffect": "保存没有生效，请检查配置后重试",
  "ui.settings.saving": "正在保存…",
  "ui.settings.save": "保存设置",
  "ui.settings.toast.saved": "设置已保存",

  // 更新提示
  "ui.update.readyTitle": "更新已就绪",
  "ui.update.availableTitle": "有新版本可用",
  "ui.update.readyDescription": "更新已下载完成，重启应用后将自动安装。",
  "ui.update.availableDescription":
    "Interview Coder 有新版本可用，请更新后继续使用。",
  "ui.update.restartAndInstall": "重启并安装",
  "ui.update.downloading": "正在下载…",
  "ui.update.download": "下载更新",

  // 订阅页（历史页面，当前路由未引用，但属 src/** 用户可见文案）
  "ui.subscribe.title": "欢迎使用 Interview Coder",
  "ui.subscribe.description": "继续使用 Interview Coder 需要订阅（$60/月）",
  "ui.subscribe.note":
    "* 部分 macOS 版本可能无法保证不可检测，详情见帮助中心",
  "ui.subscribe.subscribe": "订阅",
  "ui.subscribe.error.signOutFailed": "退出登录失败，请重试。",
  "ui.subscribe.error.portalFailed": "打开订阅页面失败，请重试。",

  // 截图缩略图
  "ui.screenshotQueue.alt": "截图",
  "ui.screenshotQueue.delete": "删除这张截图",
}

/** `ui` 命名空间的全部键（由中文表推导，供英文表与调用方约束键集合） */
export type UiMessageKey = keyof typeof uiZh
