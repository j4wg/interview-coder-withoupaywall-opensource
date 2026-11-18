/**
 * `processing` 命名空间（英文表）。
 *
 * 类型以中文表 `processing.zh.ts` 为准：缺键或多键都会在 `tsc` 阶段报错，
 * 因此两份表在编译期强制同构。
 */
import type { ProcessingMessages } from "./processing.zh"

export const processingEn: ProcessingMessages = {
  // ---------------------------------------------------------------- prompt · 截图解析题面
  "processing.prompt.extract.system":
    "You are a coding challenge interpreter. Analyze the screenshot of the coding problem and extract all relevant information.\n" +
    "\n" +
    "Return ONLY one valid JSON object. Do not add explanations, preamble, or Markdown code fences.\n" +
    "\n" +
    "The JSON must contain exactly these four fields. Keep these English field names byte-for-byte unchanged; never translate or rename them:\n" +
    "- problem_statement\n" +
    "- constraints\n" +
    "- example_input\n" +
    "- example_output\n" +
    "\n" +
    "Write the natural-language field values in English. Keep code, variables, function and class names, API names and library names verbatim.\n" +
    "If a piece of information is absent from the screenshot, use an empty string for that field. Never omit a field and never rename one.",
  "processing.prompt.extract.user":
    "Extract the coding problem details from these screenshots and return the JSON described in the system instruction. The preferred coding language for this problem is {{language}}.",

  // ---------------------------------------------------------------- prompt · 方案生成
  "processing.prompt.solution.system":
    "You are an expert coding interview assistant. Provide a clear, optimal solution with detailed explanations.\n" +
    "All explanatory prose, thoughts and complexity analysis must be written in English. Code blocks, identifiers, function and class names, API names, library names and original error messages stay verbatim and are never translated.",
  "processing.prompt.solution.user":
    "Generate a detailed solution for the following coding problem:\n" +
    "\n" +
    "PROBLEM STATEMENT:\n" +
    "{{problem_statement}}\n" +
    "\n" +
    "CONSTRAINTS:\n" +
    "{{constraints}}\n" +
    "\n" +
    "EXAMPLE INPUT:\n" +
    "{{example_input}}\n" +
    "\n" +
    "EXAMPLE OUTPUT:\n" +
    "{{example_output}}\n" +
    "\n" +
    "LANGUAGE: {{language}}\n" +
    "\n" +
    "Respond in exactly these four sections, keeping the section labels verbatim:\n" +
    "1. Code: A clean, optimized implementation in {{language}}\n" +
    "2. Thoughts: A list of key insights and reasoning behind your approach\n" +
    "3. Time complexity: O(X) with a detailed explanation (at least 2 sentences)\n" +
    "4. Space complexity: O(X) with a detailed explanation (at least 2 sentences)\n" +
    "\n" +
    "For complexity explanations, please be thorough. For example: \"Time complexity: O(n) because we iterate through the array only once. This is optimal as we need to examine each element at least once to find the solution.\" or \"Space complexity: O(n) because in the worst case, we store all elements in the hashmap. The additional space scales linearly with the input size.\"\n" +
    "\n" +
    "Rules (all must hold):\n" +
    "- Explanatory prose, thoughts and complexity analysis must be written in English; no wholesale switch to another language.\n" +
    "- Code blocks (inside ``` fences) keep their original content: do not translate, reorder, or add translated comments inside them. Identifiers, function and class names, API names, library names and original error messages are never translated.\n" +
    "- Output only the four sections above; no preamble or closing remarks.",
  "processing.prompt.solution.problem.missing": "(problem statement missing)",
  "processing.prompt.solution.constraints.missing": "No specific constraints provided.",
  "processing.prompt.solution.exampleInput.missing": "No example input provided.",
  "processing.prompt.solution.exampleOutput.missing": "No example output provided.",

  // ---------------------------------------------------------------- prompt · debug / 纠错
  "processing.prompt.debug.system":
    "You are a coding interview assistant helping debug and improve solutions. Analyze these screenshots, which include either error messages, incorrect outputs, or test cases, and provide detailed debugging help.\n" +
    "\n" +
    "Your response MUST follow this exact structure with these section headers (use ### for headers):\n" +
    "### Issues Identified\n" +
    "- List each issue as a bullet point with a clear explanation\n" +
    "\n" +
    "### Specific Improvements and Corrections\n" +
    "- List the specific code changes needed as bullet points\n" +
    "\n" +
    "### Optimizations\n" +
    "- List any performance optimizations if applicable\n" +
    "\n" +
    "### Explanation of Changes Needed\n" +
    "Explain clearly, in English, why these changes are needed\n" +
    "\n" +
    "### Key Points\n" +
    "- Summary bullet points of the most important takeaways\n" +
    "\n" +
    "If you include code examples, use proper markdown code blocks with a language specification (e.g. ```java). Code block content, identifiers and API names stay verbatim and are never translated.",
  "processing.prompt.debug.user":
    "I'm solving this coding problem: \"{{problem_statement}}\" in {{language}}.\n" +
    "I need help debugging or improving my solution; below are screenshots of my code, the errors or the test cases.\n" +
    "Please give the detailed analysis in the structure from the system instruction, written in English.",
  "processing.prompt.debug.problem.missing": "(problem statement missing)",

  // ---------------------------------------------------------------- 处理状态（发送到渲染层）
  "processing.status.extract.analyzing": "Analyzing the problem from screenshots...",
  "processing.status.extract.done":
    "Problem analyzed successfully. Preparing to generate the solution...",
  "processing.status.solution.generating":
    "Creating an optimal solution with detailed explanations...",
  "processing.status.solution.done": "Solution generated successfully",
  "processing.status.debug.analyzing":
    "Analyzing screenshots and generating debug feedback...",
  "processing.status.debug.done": "Debug analysis complete",

  // ---------------------------------------------------------------- 日志
  "processing.log.credits.failed": "Error getting credits: {{error}}",
  "processing.log.language.windowFailed":
    "Could not get the programming language from the window: {{error}}",
  "processing.log.language.failed":
    "Error getting the programming language: {{error}}",
  "processing.log.init.timeout": "App failed to initialize after 5 seconds",
  "processing.log.view.processing": "Processing screenshots in view: {{view}}",
  "processing.log.queue.main": "Processing main queue screenshots: {{queue}}",
  "processing.log.queue.empty": "No screenshots found in queue",
  "processing.log.queue.filesMissing": "Screenshot files don't exist on disk",
  "processing.log.queue.readFailed": "Error reading screenshot {{path}}: {{error}}",
  "processing.log.queue.loadFailed": "Failed to load screenshot data",
  "processing.log.queue.extra": "Processing extra queue screenshots: {{queue}}",
  "processing.log.queue.extraEmpty": "No extra screenshots found in queue",
  "processing.log.queue.extraFilesMissing":
    "Extra screenshot files don't exist on disk",
  "processing.log.queue.fileNotFound": "Screenshot file does not exist: {{path}}",
  "processing.log.queue.debugLoadFailed":
    "Failed to load screenshot data for debugging",
  "processing.log.queue.combined": "Combined screenshots for processing: {{paths}}",
  "processing.log.processing.failed": "Processing failed: {{error}}",
  "processing.log.processing.error": "Processing error: {{error}}",
  "processing.log.view.resetToQueue": "Resetting view to queue due to error",
  "processing.log.view.toSolutions":
    "Setting view to solutions after successful processing",
  "processing.log.api.errorDetails": "API error details: {{error}}",
  "processing.log.estimate.failed": "Failed to estimate problem info: {{error}}",
  "processing.log.solution.error": "Solution generation error: {{error}}",
  "processing.log.debug.error": "Debug processing error: {{error}}",
  "processing.log.parse.failed":
    "Failed to parse the model's JSON: {{error}}; raw response snippet: {{snippet}}",
  "processing.log.extract.fieldMissing":
    "Model JSON is missing required fields: {{missing}}; fields actually returned: {{keys}}. Translated field names count as this error.",
  "processing.log.extract.notObject":
    "Model JSON is not an object: {{snippet}}",

  // ---------------------------------------------------------------- 调用层日志（三种 API 格式）
  "processing.log.llm.request":
    "Sending {{method}} request to {{url}} (timeout {{seconds}}s)",
  "processing.log.llm.response":
    "Received response (HTTP {{status}}, {{ms}} ms)",
  "processing.log.llm.call":
    "Calling the model endpoint: provider {{provider}}, format {{format}}, purpose {{purpose}}, model {{model}}",
  "processing.log.llm.failed":
    "Model endpoint call failed: code {{code}}, HTTP {{status}}, details: {{detail}}",
  "processing.log.llm.configIssues":
    "Model configuration has issues (fallback values used for this run): {{issues}}",
  "processing.log.llm.modelsFetched":
    "Fetched the model list successfully: {{count}} models",
  "processing.log.llm.modelsFailed":
    "Failed to fetch the model list: code {{code}}, HTTP {{status}}, details: {{detail}}",

  // ---------------------------------------------------------------- 错误与兜底（会显示给用户）
  "processing.error.llm.baseUrlMissing":
    "No API Base URL configured yet. Please fill it in under Settings.",
  "processing.error.llm.baseUrlInvalid":
    "The API Base URL is not a valid HTTP(S) address. Please check your settings.",
  "processing.error.llm.apiKeyMissing":
    "No API key configured yet. Please fill it in under Settings.",
  "processing.error.llm.providerMissing":
    "The selected provider configuration was not found (it may have been deleted). Please choose or add one in Settings.",
  "processing.error.llm.bindingMissing":
    "No model is bound to this purpose yet. Choose a provider and model for it in Settings.",
  "processing.error.llm.modelMissing":
    "No model selected for this purpose yet. Add a model in Settings and select it first.",
  "processing.error.llm.network":
    "Could not reach the model endpoint. Check your network connection and the Base URL.",
  "processing.error.llm.timeout":
    "The request did not finish within {{seconds}} seconds. Please try again later or check your network.",
  "processing.error.llm.auth":
    "The API key is invalid or not allowed to access this endpoint (HTTP {{status}}). Please check your settings.",
  "processing.error.llm.rateLimit":
    "Too many requests or insufficient quota (HTTP {{status}}). Please try again later.",
  "processing.error.llm.server":
    "The model endpoint failed with a server error (HTTP {{status}}). Please try again later.",
  "processing.error.llm.badRequest":
    "The request was rejected by the endpoint (HTTP {{status}}). Check the Base URL, API format and model ID.",
  "processing.error.llm.tooLarge":
    "The request payload is too large (HTTP {{status}}). Remove some screenshots or use a model with a larger context window.",
  "processing.error.llm.invalidResponse":
    "The endpoint did not return parsable JSON. Check that the Base URL and API format match.",
  "processing.error.llm.emptyResponse":
    "The endpoint response contains no usable text. Check the model ID and API format.",
  "processing.error.llm.unknown":
    "An unknown error occurred while calling the model endpoint. Please try again later.",

  // ---------------------------------------------------------------- 多套配置（provider 卡片）
  "processing.modelPurpose.extraction": "problem extraction",
  "processing.modelPurpose.solution": "solution generation",
  "processing.modelPurpose.debugging": "debugging",
  "processing.notice.llm.bindingDetached":
    "Removed the {{purpose}} binding for \"{{provider}}\". That purpose needs a model selected again.",
  "processing.error.extract.parseFailed":
    "Failed to parse the problem information. Please try again or use clearer screenshots.",
  "processing.error.extract.fieldMissing":
    "The model's JSON is missing required fields ({{missing}}); the field names may have been translated. Please try again.",
  "processing.error.extract.notObject":
    "The model's JSON is not an object. Please try again.",
  "processing.error.extract.failed":
    "Failed to parse the problem information. Please try again.",
  "processing.error.solution.noProblem": "No problem info available.",
  "processing.error.debug.noProblem": "No problem info available.",
  "processing.error.solution.failed":
    "Failed to generate the solution. Please try again.",
  "processing.error.debug.failed":
    "Failed to process the debug request. Please try again.",
  "processing.error.process.failed":
    "Failed to process screenshots. Please try again.",
  "processing.error.cancelled": "Processing was canceled by the user.",
  "processing.error.extraCancelled": "Extra processing was canceled by the user.",
  "processing.error.server": "Server error. Please try again.",
  "processing.error.unknown": "Unknown error.",

  // ---------------------------------------------------------------- 解析兜底值（会显示给用户）
  "processing.fallback.problem.statement": "(problem statement missing)",
  "processing.fallback.thoughts.solution":
    "Solution approach based on efficiency and readability",
  "processing.fallback.timeComplexity":
    "O(n) - Linear time complexity because we only iterate through the array once. Each element is processed exactly once, and hashmap lookups are O(1) operations.",
  "processing.fallback.spaceComplexity":
    "O(n) - Linear space complexity because we store elements in the hashmap. In the worst case we may need to store all elements before finding the solution.",
  "processing.fallback.debug.code": "// Debug mode - see analysis below",
  "processing.fallback.debug.thoughts":
    "Debug analysis based on your screenshots",
  "processing.fallback.debug.complexity": "N/A - Debug mode",

  // ---------------------------------------------------------------- 兼容旧输出时的标题提升
  "processing.debug.heading.issues": "## Issues Identified",
  "processing.debug.heading.improvements": "## Code Improvements",
  "processing.debug.heading.optimizations": "## Optimizations",
  "processing.debug.heading.explanation": "## Explanation",
}
