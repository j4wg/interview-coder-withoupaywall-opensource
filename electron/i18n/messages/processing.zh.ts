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
  "processing.status.debug.done": "调试分析完成",

  // ---------------------------------------------------------------- 日志
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

  // ---------------------------------------------------------------- 调用层日志（三种 API 格式）
  "processing.log.llm.request": "发出 {{method}} 请求：{{url}}（超时 {{seconds}} 秒）",
  "processing.log.llm.response": "收到响应（HTTP {{status}}，用时 {{ms}} 毫秒）",
  "processing.log.llm.call": "调用模型接口：格式 {{format}}，用途 {{purpose}}，模型 {{model}}",
  "processing.log.llm.failed": "模型接口调用失败：错误码 {{code}}，HTTP {{status}}，详情：{{detail}}",
  "processing.log.llm.configIssues": "模型配置存在问题（本次按兜底值继续）：{{issues}}",
  "processing.log.llm.modelsFetched": "拉取模型列表成功，共 {{count}} 个模型",
  "processing.log.llm.modelsFailed": "拉取模型列表失败：错误码 {{code}}，HTTP {{status}}，详情：{{detail}}",

  // ---------------------------------------------------------------- 错误与兜底（会显示给用户）
  "processing.error.llm.baseUrlMissing": "尚未配置 API Base URL，请先在设置里填写。",
  "processing.error.llm.baseUrlInvalid": "API Base URL 不是合法的 HTTP(S) 地址，请检查设置。",
  "processing.error.llm.apiKeyMissing": "尚未配置 API Key，请先在设置里填写。",
  "processing.error.llm.modelMissing":
    "尚未选择该用途的模型，请先在设置里添加模型并完成选择。",
  "processing.error.llm.network": "无法连接到模型接口，请检查网络与 Base URL 是否正确。",
  "processing.error.llm.timeout":
    "请求在 {{seconds}} 秒内没有返回，请稍后重试或检查网络。",
  "processing.error.llm.auth":
    "API Key 无效或无权访问该接口（HTTP {{status}}），请检查设置。",
  "processing.error.llm.rateLimit":
    "请求过于频繁或额度不足（HTTP {{status}}），请稍后重试。",
  "processing.error.llm.server": "模型接口服务端错误（HTTP {{status}}），请稍后重试。",
  "processing.error.llm.badRequest":
    "请求被接口拒绝（HTTP {{status}}），请检查 Base URL、API 格式与模型 ID。",
  "processing.error.llm.tooLarge":
    "请求内容过大（HTTP {{status}}），请减少截图数量或改用支持更大上下文的模型。",
  "processing.error.llm.invalidResponse":
    "接口返回的不是可解析的 JSON，请检查 Base URL 与 API 格式是否匹配。",
  "processing.error.llm.emptyResponse":
    "接口返回里没有可用的文本内容，请检查模型 ID 与 API 格式。",
  "processing.error.llm.unknown": "调用模型接口时出现未知错误，请稍后重试。",
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
