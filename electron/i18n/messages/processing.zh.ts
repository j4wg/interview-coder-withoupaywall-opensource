/**
 * `processing` 命名空间（中文表，类型真源）。
 *
 * 承载 `ProcessingHelper` 的三类模型 prompt、该文件内的控制台日志、
 * 发给渲染层的处理状态文案与面向用户的错误/兜底文案。
 *
 * 约定：
 * - 键名 `<namespace>.<区域>.<元素>[.<变体>]`，一句完整的话一个键，不做句子级拼接；
 * - 动态值一律用 `{{name}}` 占位符，由 `electron/i18n/index.ts` 的 `interpolate` 替换；
 * - 英文表 `processing.en.ts` 以本文件的类型声明，缺键/多键都会在 `tsc` 阶段报错。
 *
 * 注意：prompt 文案里的 ``` 围栏是给模型的格式示例，不是本文件的代码块。
 */
export const processingZh = {
  // ---------------------------------------------------------------- prompt · 截图解析题面
  "processing.prompt.extract.system":
    "你是一名编程题面解析器。请分析编程题截图，提取全部关键信息。\n" +
    "\n" +
    "只返回一个合法的 JSON 对象，不要输出任何解释、前后缀说明或 Markdown 代码围栏。\n" +
    "\n" +
    "该 JSON 必须且只能包含下面四个字段，字段名保持英文原样，不得翻译、不得改写：\n" +
    "- problem_statement\n" +
    "- constraints\n" +
    "- example_input\n" +
    "- example_output\n" +
    "\n" +
    "字段值中的自然语言请用简体中文书写；题目中的代码、变量名、函数名、类名、API 名称与库名保持原文，不要翻译。\n" +
    "若某项信息在截图中不存在，请用空字符串占位，不要省略字段，也不要改名字段。",
  "processing.prompt.extract.user":
    "请从这些截图中提取编程题细节，按系统指令里说明的四个英文字段返回 JSON。本题准备使用的编程语言是 {{language}}。",

  // ---------------------------------------------------------------- prompt · 方案生成
  "processing.prompt.solution.system":
    "你是一名资深编程面试助手，负责给出清晰、最优的解法与详细讲解。\n" +
    "讲解、思路与复杂度分析一律使用简体中文；代码块、标识符、函数与类名、API 名称、库名及原始错误信息保持原样，不翻译。",
  "processing.prompt.solution.user":
    "请为下面这道编程题生成详细解答：\n" +
    "\n" +
    "题目描述：\n" +
    "{{problem_statement}}\n" +
    "\n" +
    "约束条件：\n" +
    "{{constraints}}\n" +
    "\n" +
    "示例输入：\n" +
    "{{example_input}}\n" +
    "\n" +
    "示例输出：\n" +
    "{{example_output}}\n" +
    "\n" +
    "编程语言：{{language}}\n" +
    "\n" +
    "请严格按以下四部分作答，标题保持下面给出的中英文标签原样，不要改写、不要翻译括号里的英文：\n" +
    "1. 代码 (Code)：用 {{language}} 写出干净、优化的实现\n" +
    "2. 思路 (Thoughts)：列出你的关键洞察与推理过程\n" +
    "3. 时间复杂度 (Time Complexity)：写成 O(X)，并附至少两句话的详细说明\n" +
    "4. 空间复杂度 (Space Complexity)：写成 O(X)，并附至少两句话的详细说明\n" +
    "\n" +
    "复杂度说明请写充分。例如：\"时间复杂度：O(n)，因为只遍历数组一次，每个元素最多被处理一次，哈希表查找是 O(1)。\" 或 \"空间复杂度：O(n)，因为最坏情况下需要把全部元素存进哈希表，额外空间随输入规模线性增长。\"\n" +
    "\n" +
    "写作要求（三条同时生效）：\n" +
    "- 解释性文字、思路与复杂度分析一律使用简体中文，不要出现整段英文讲解；\n" +
    "- 代码块（``` 围栏内）保持原样，不翻译、不重排、不追加中文注释；标识符、函数名、类名、API 名称、库名与原错误信息一律不翻译；\n" +
    "- 只输出上述四部分，不要额外的前言或结语。",
  "processing.prompt.solution.problem.missing": "（题目描述缺失）",
  "processing.prompt.solution.constraints.missing": "未提供具体约束。",
  "processing.prompt.solution.exampleInput.missing": "未提供示例输入。",
  "processing.prompt.solution.exampleOutput.missing": "未提供示例输出。",

  // ---------------------------------------------------------------- prompt · debug / 纠错
  "processing.prompt.debug.system":
    "你是一名编程面试助手，负责帮助调试和改进解法。请分析这些截图（可能包含错误信息、错误输出或用例），给出详细的调试帮助。\n" +
    "\n" +
    "你的回复必须严格使用下面的结构与小节标题（标题保持原样，用 ### 开头；小节内容用简体中文）：\n" +
    "### 发现的问题\n" +
    "- 逐条列出问题，每条都给出清晰解释\n" +
    "\n" +
    "### 具体改进与修正\n" +
    "- 逐条列出需要修改的代码\n" +
    "\n" +
    "### 可做的优化\n" +
    "- 列出可选的性能优化点\n" +
    "\n" +
    "### 改动原因说明\n" +
    "用简体中文说明为什么需要这些改动\n" +
    "\n" +
    "### 关键要点\n" +
    "- 用要点总结最重要的结论\n" +
    "\n" +
    "如需给出代码示例，请使用带语言标注的 Markdown 代码块（例如 ```java）。代码块内容、标识符与 API 名称保持原样，不要翻译。",
  "processing.prompt.debug.user":
    "我正在用 {{language}} 解决这道题：\"{{problem_statement}}\"。\n" +
    "我需要你帮我调试或改进我的解法，下面是我代码、报错或用例的截图。\n" +
    "请按系统指令给出的结构给出详细分析，并用简体中文讲解。",
  "processing.prompt.debug.problem.missing": "（题目描述缺失）",

  // ---------------------------------------------------------------- 处理状态（发送到渲染层）
  "processing.status.extract.analyzing": "正在从截图中分析题目…",
  "processing.status.extract.done": "题目解析完成，正在准备生成方案…",
  "processing.status.solution.generating": "正在生成带详细讲解的最优解…",
  "processing.status.solution.done": "方案生成完成",
  "processing.status.debug.analyzing": "正在分析截图，生成调试建议…",
  "processing.status.debug.analyzing.provider": "正在使用 {{provider}} 分析代码并生成调试建议…",
  "processing.status.debug.done": "调试分析完成",

  // ---------------------------------------------------------------- 日志
  "processing.log.client.openai.ready": "OpenAI 客户端初始化成功",
  "processing.log.client.openai.noKey": "没有可用的 API Key，OpenAI 客户端未初始化",
  "processing.log.client.gemini.ready": "Gemini API Key 设置成功",
  "processing.log.client.gemini.noKey": "没有可用的 API Key，Gemini 客户端未初始化",
  "processing.log.client.anthropic.ready": "Anthropic 客户端初始化成功",
  "processing.log.client.anthropic.noKey": "没有可用的 API Key，Anthropic 客户端未初始化",
  "processing.log.client.initFailed": "初始化 AI 客户端失败：{{error}}",
  "processing.log.client.openai.missing": "OpenAI 客户端未初始化",
  "processing.log.client.gemini.missing": "Gemini API Key 未初始化",
  "processing.log.client.anthropic.missing": "Anthropic 客户端未初始化",
  "processing.log.credits.failed": "获取额度失败：{{error}}",
  "processing.log.language.windowFailed": "无法从窗口读取编程语言：{{error}}",
  "processing.log.language.failed": "读取编程语言失败：{{error}}",
  "processing.log.init.timeout": "应用在 5 秒内仍未初始化完成",
  "processing.log.view.processing": "正在处理的视图：{{view}}",
  "processing.log.queue.main": "主队列截图：{{queue}}",
  "processing.log.queue.empty": "队列中没有截图",
  "processing.log.queue.filesMissing": "截图文件在磁盘上不存在",
  "processing.log.queue.readFailed": "读取截图 {{path}} 失败：{{error}}",
  "processing.log.queue.loadFailed": "加载截图数据失败",
  "processing.log.queue.extra": "额外的调试队列截图：{{queue}}",
  "processing.log.queue.extraEmpty": "调试队列中没有截图",
  "processing.log.queue.extraFilesMissing": "调试截图文件在磁盘上不存在",
  "processing.log.queue.fileNotFound": "截图文件不存在：{{path}}",
  "processing.log.queue.debugLoadFailed": "加载调试截图数据失败",
  "processing.log.queue.combined": "本次合并处理的全部截图：{{paths}}",
  "processing.log.processing.failed": "处理失败：{{error}}",
  "processing.log.processing.error": "处理出错：{{error}}",
  "processing.log.view.resetToQueue": "出错，视图已退回队列",
  "processing.log.view.toSolutions": "处理成功，视图切换到方案页",
  "processing.log.api.errorDetails": "API 错误详情：{{error}}",
  "processing.log.estimate.failed": "估算题目信息失败：{{error}}",
  "processing.log.solution.error": "生成方案出错：{{error}}",
  "processing.log.debug.error": "调试处理出错：{{error}}",
  "processing.log.parse.failed": "解析模型返回的 JSON 失败：{{error}}；原始返回片段：{{snippet}}",
  "processing.log.extract.fieldMissing":
    "模型返回的 JSON 缺少必需字段：{{missing}}；实际字段名为：{{keys}}。字段名被翻译成中文即属于此错误。",
  "processing.log.extract.notObject": "模型返回的 JSON 不是对象：{{snippet}}",
  "processing.log.api.gemini.provider": "调用 Gemini API 出错：{{error}}",
  "processing.log.api.gemini.solution": "调用 Gemini API 生成方案出错：{{error}}",
  "processing.log.api.gemini.debug": "调用 Gemini API 调试出错：{{error}}",
  "processing.log.api.gemini.empty": "Gemini API 返回内容为空",
  "processing.log.api.anthropic.provider": "调用 Anthropic API 出错：{{error}}",
  "processing.log.api.anthropic.solution": "调用 Anthropic API 生成方案出错：{{error}}",
  "processing.log.api.anthropic.debug": "调用 Anthropic API 调试出错：{{error}}",

  // ---------------------------------------------------------------- 错误与兜底（会显示给用户）
  "processing.error.openai.notConfigured": "OpenAI API Key 未配置或无效，请检查设置。",
  "processing.error.openai.invalidKey": "OpenAI API Key 无效，请检查设置。",
  "processing.error.openai.rateLimit": "OpenAI API 触发限流或额度不足，请稍后重试。",
  "processing.error.openai.server": "OpenAI 服务端错误，请稍后重试。",
  "processing.error.gemini.notConfigured": "Gemini API Key 未配置，请检查设置。",
  "processing.error.gemini.failed": "使用 Gemini API 处理失败，请检查 API Key 或稍后重试。",
  "processing.error.gemini.solutionFailed":
    "使用 Gemini API 生成方案失败，请检查 API Key 或稍后重试。",
  "processing.error.gemini.debugFailed":
    "使用 Gemini API 处理调试请求失败，请检查 API Key 或稍后重试。",
  "processing.error.anthropic.notConfigured": "Anthropic API Key 未配置，请检查设置。",
  "processing.error.anthropic.rateLimit": "Claude API 触发限流，请等几分钟后重试。",
  "processing.error.anthropic.tooLarge":
    "截图信息量超出 Claude 的处理上限，请在设置里切换到能处理更大输入的 OpenAI 或 Gemini。",
  "processing.error.anthropic.failed":
    "使用 Anthropic API 处理失败，请检查 API Key 或稍后重试。",
  "processing.error.anthropic.solutionFailed":
    "使用 Anthropic API 生成方案失败，请检查 API Key 或稍后重试。",
  "processing.error.anthropic.debugFailed":
    "使用 Anthropic API 处理调试请求失败，请检查 API Key 或稍后重试。",
  "processing.error.extract.parseFailed":
    "解析题目信息失败，请重试或改用更清晰的截图。",
  "processing.error.extract.fieldMissing":
    "模型返回的 JSON 缺少必需字段（{{missing}}），字段名可能被翻译成了中文。请重试。",
  "processing.error.extract.notObject": "模型返回的 JSON 结构不是对象，请重试。",
  "processing.error.extract.failed": "解析题目信息失败，请重试。",
  "processing.error.solution.noProblem": "没有可用的题目信息。",
  "processing.error.debug.noProblem": "没有可用的题目信息。",
  "processing.error.solution.failed": "生成方案失败，请重试。",
  "processing.error.debug.failed": "处理调试请求失败，请重试。",
  "processing.error.process.failed": "处理截图失败，请重试。",
  "processing.error.cancelled": "处理已被用户取消。",
  "processing.error.extraCancelled": "额外的处理已被用户取消。",
  "processing.error.server": "服务端错误，请重试。",
  "processing.error.unknown": "未知错误。",

  // ---------------------------------------------------------------- 解析兜底值（会显示给用户）
  "processing.fallback.problem.statement": "（题目描述缺失）",
  "processing.fallback.thoughts.solution": "方案思路基于效率与可读性权衡。",
  "processing.fallback.timeComplexity":
    "O(n) —— 线性时间复杂度，因为只遍历数组一次，每个元素只处理一次，哈希表查找是 O(1)。",
  "processing.fallback.spaceComplexity":
    "O(n) —— 线性空间复杂度，因为需要把元素存进哈希表，最坏情况下要存下全部元素。",
  "processing.fallback.debug.code": "// 调试模式 —— 详见下方分析",
  "processing.fallback.debug.thoughts": "基于你的截图给出的调试分析。",
  "processing.fallback.debug.complexity": "不适用 —— 调试模式",

  // ---------------------------------------------------------------- 兼容旧输出时的标题提升
  "processing.debug.heading.issues": "## 发现的问题",
  "processing.debug.heading.improvements": "## 代码改进",
  "processing.debug.heading.optimizations": "## 优化",
  "processing.debug.heading.explanation": "## 说明",
}

export type ProcessingMessages = typeof processingZh
