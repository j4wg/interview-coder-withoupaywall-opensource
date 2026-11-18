// ProcessingHelper.ts
import fs from "node:fs"
import path from "node:path"
import { ScreenshotHelper } from "./ScreenshotHelper"
import { IProcessingHelperDeps } from "./main"
import * as axios from "axios"
import { app, BrowserWindow, dialog } from "electron"
import { OpenAI } from "openai"
import { configHelper } from "./ConfigHelper"
import Anthropic from '@anthropic-ai/sdk';
import { mainT } from "./i18n/mainT"
import { t } from "./i18n"
import type { Locale } from "./i18n/types"
import {
  buildExtractionPrompt,
  buildSolutionSystemPrompt,
  buildSolutionPrompt,
  buildDebugSystemPrompt,
  buildDebugPrompt,
} from "./i18n/prompts"
import {
  parseProblemInfo,
  type ExtractedProblemInfo,
  type ProblemParseResult,
} from "./problemInfoParser"
import { parseSolutionResponse } from "./solutionResponseParser"

/**
 * 本文件内的文案统一走 `processing` 命名空间（见 docs/i18n-design.md 决策 1/5）。
 * 每次调用即时解析当前界面语言，因此切换语言后无需重启。
 */
const pt = (key: string, vars?: Record<string, string>): string =>
  mainT("processing")(key, vars)

/** 解析失败时打详细日志：字段被翻译成中文时，日志里能直接看到实际字段名 */
function logProblemParseFailure(result: ProblemParseResult): void {
  // 只处理失败分支；成功分支不该进来，这里直接返回而不抛错
  if (result.status === "ok") return
  if (result.status === "fields") {
    console.error(
      pt("processing.log.extract.fieldMissing", {
        missing: (result.missing ?? []).join(", "),
        keys: (result.keys ?? []).join(", "),
      })
    )
    return
  }
  if (result.status === "notObject") {
    console.error(pt("processing.log.extract.notObject", { snippet: result.snippet }))
    return
  }
  console.error(
    pt("processing.log.parse.failed", {
      error: result.error ?? "",
      snippet: result.snippet,
    })
  )
}

/** 解析失败时回给界面的错误文案（按失败类型区分，均带当前语言） */
function problemParseErrorMessage(result: ProblemParseResult): string {
  if (result.status === "ok") return ""
  if (result.status === "fields") {
    return pt("processing.error.extract.fieldMissing", {
      missing: (result.missing ?? []).join(", "),
    })
  }
  if (result.status === "notObject") {
    return pt("processing.error.extract.notObject")
  }
  return pt("processing.error.extract.parseFailed")
}

/**
 * 判断错误文案是否属于"API Key 未配置/无效"，用于决定界面上弹哪个提示。
 * 文案是双语的，所以中英两版都参与比对，不能只按英文子串匹配。
 */
const API_KEY_ERROR_KEYS = [
  "processing.error.openai.notConfigured",
  "processing.error.openai.invalidKey",
  "processing.error.gemini.notConfigured",
  "processing.error.anthropic.notConfigured",
] as const

const API_KEY_PROVIDER_NAMES = ["OpenAI", "Gemini", "Anthropic", "Claude"]

function isApiKeyError(message?: string): boolean {
  if (!message) return false
  const matchesLocalized = (["zh", "en"] as Locale[]).some((locale) =>
    API_KEY_ERROR_KEYS.some((key) => t("processing", locale, key) === message)
  )
  if (matchesLocalized) return true
  // 兜底：供应商 SDK 透传的错误里仍有英文名，保持与改动前一致的宽松匹配
  return (
    /api\s*key/i.test(message) ||
    API_KEY_PROVIDER_NAMES.some((name) => message.includes(name))
  )
}

// Gemini API 请求体结构
interface GeminiMessage {
  role: string;
  parts: Array<{
    text?: string;
    inlineData?: {
      mimeType: string;
      data: string;
    }
  }>;
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
    finishReason: string;
  }>;
}
interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: Array<{
    type: 'text' | 'image';
    text?: string;
    source?: {
      type: 'base64';
      media_type: string;
      data: string;
    };
  }>;
}
export class ProcessingHelper {
  private deps: IProcessingHelperDeps
  private screenshotHelper: ScreenshotHelper
  private openaiClient: OpenAI | null = null
  private geminiApiKey: string | null = null
  private anthropicClient: Anthropic | null = null

  // 三类请求的 AbortController，用于用户取消当前请求
  private currentProcessingAbortController: AbortController | null = null
  private currentExtraProcessingAbortController: AbortController | null = null

  constructor(deps: IProcessingHelperDeps) {
    this.deps = deps
    this.screenshotHelper = deps.getScreenshotHelper()
    
    // 按当前配置初始化 AI 客户端
    this.initializeAIClient();
    
    // 配置变更后重新初始化 AI 客户端（例如换供应商、换 Key、换模型）
    configHelper.on('config-updated', () => {
      this.initializeAIClient();
    });
  }

  /**
   * 取当前生效的界面语言。与 mainT 同源（configHelper.getUiLocale()），不缓存，
   * 因此用户切换界面语言后，下一次请求的 prompt 立刻跟随。
   */
  private getLocale(): Locale {
    return configHelper.getUiLocale().locale;
  }
  
  /**
   * 按当前配置初始化（或重建）AI 客户端
   */
  private initializeAIClient(): void {
    try {
      const config = configHelper.loadConfig();
      
      if (config.apiProvider === "openai") {
        if (config.apiKey) {
          this.openaiClient = new OpenAI({ 
            apiKey: config.apiKey,
            timeout: 60000, // 60 秒超时
            maxRetries: 2   // 最多重试 2 次
          });
          this.geminiApiKey = null;
          this.anthropicClient = null;
          console.log(pt("processing.log.client.openai.ready"));
        } else {
          this.openaiClient = null;
          this.geminiApiKey = null;
          this.anthropicClient = null;
          console.warn(pt("processing.log.client.openai.noKey"));
        }
      } else if (config.apiProvider === "gemini"){
        // Gemini 客户端初始化
        this.openaiClient = null;
        this.anthropicClient = null;
        if (config.apiKey) {
          this.geminiApiKey = config.apiKey;
          console.log(pt("processing.log.client.gemini.ready"));
        } else {
          this.openaiClient = null;
          this.geminiApiKey = null;
          this.anthropicClient = null;
          console.warn(pt("processing.log.client.gemini.noKey"));
        }
      } else if (config.apiProvider === "anthropic") {
        // 重置其它供应商的客户端
        this.openaiClient = null;
        this.geminiApiKey = null;
        if (config.apiKey) {
          this.anthropicClient = new Anthropic({
            apiKey: config.apiKey,
            timeout: 60000,
            maxRetries: 2
          });
          console.log(pt("processing.log.client.anthropic.ready"));
        } else {
          this.openaiClient = null;
          this.geminiApiKey = null;
          this.anthropicClient = null;
          console.warn(pt("processing.log.client.anthropic.noKey"));
        }
      }
    } catch (error) {
      console.error(
        pt("processing.log.client.initFailed", { error: String(error) })
      );
      this.openaiClient = null;
      this.geminiApiKey = null;
      this.anthropicClient = null;
    }
  }

  private async waitForInitialization(
    mainWindow: BrowserWindow
  ): Promise<void> {
    let attempts = 0
    const maxAttempts = 50 // 最多等 5 秒

    while (attempts < maxAttempts) {
      const isInitialized = await mainWindow.webContents.executeJavaScript(
        "window.__IS_INITIALIZED__"
      )
      if (isInitialized) return
      await new Promise((resolve) => setTimeout(resolve, 100))
      attempts++
    }
    throw new Error(pt("processing.log.init.timeout"))
  }

  private async getCredits(): Promise<number> {
    const mainWindow = this.deps.getMainWindow()
    if (!mainWindow) return 999 // Unlimited credits in this version

    try {
      await this.waitForInitialization(mainWindow)
      return 999 // 本版本不限制额度，永远返回足够值
    } catch (error) {
      console.error(pt("processing.log.credits.failed", { error: String(error) }))
      return 999 // 兜底：读取失败也不阻塞流程
    }
  }

  private async getLanguage(): Promise<string> {
    try {
      // 编程语言以配置为准（默认 java，由配置层迁移保证）
      const config = configHelper.loadConfig();
      if (config.language) {
        return config.language;
      }
      
      // 配置里没有时，回退到窗口注入的变量
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        try {
          await this.waitForInitialization(mainWindow)
          const language = await mainWindow.webContents.executeJavaScript(
            "window.__LANGUAGE__"
          )

          if (
            typeof language === "string" &&
            language !== undefined &&
            language !== null
          ) {
            return language;
          }
        } catch (err) {
          console.warn(
            pt("processing.log.language.windowFailed", { error: String(err) })
          );
        }
      }
      
      // 最终兜底
      return "python";
    } catch (error) {
      console.error(
        pt("processing.log.language.failed", { error: String(error) })
      );
      return "python"
    }
  }

  public async processScreenshots(): Promise<void> {
    const mainWindow = this.deps.getMainWindow()
    if (!mainWindow) return

    const config = configHelper.loadConfig();
    
    // 先确认当前供应商的客户端可用
    if (config.apiProvider === "openai" && !this.openaiClient) {
      this.initializeAIClient();
      
      if (!this.openaiClient) {
        console.error(pt("processing.log.client.openai.missing"));
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.API_KEY_INVALID
        );
        return;
      }
    } else if (config.apiProvider === "gemini" && !this.geminiApiKey) {
      this.initializeAIClient();
      
      if (!this.geminiApiKey) {
        console.error(pt("processing.log.client.gemini.missing"));
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.API_KEY_INVALID
        );
        return;
      }
    } else if (config.apiProvider === "anthropic" && !this.anthropicClient) {
      // Anthropic 也要单独检查
      this.initializeAIClient();
      
      if (!this.anthropicClient) {
        console.error(pt("processing.log.client.anthropic.missing"));
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.API_KEY_INVALID
        );
        return;
      }
    }

    const view = this.deps.getView()
    console.log(pt("processing.log.view.processing", { view: String(view) }))

    if (view === "queue") {
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.INITIAL_START)
      const screenshotQueue = this.screenshotHelper.getScreenshotQueue()
      console.log(
        pt("processing.log.queue.main", { queue: screenshotQueue.join(", ") })
      )
      
      // 队列为空时直接提示
      if (!screenshotQueue || screenshotQueue.length === 0) {
        console.log(pt("processing.log.queue.empty"));
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }

      // 确认文件确实存在于磁盘
      const existingScreenshots = screenshotQueue.filter(path => fs.existsSync(path));
      if (existingScreenshots.length === 0) {
        console.log(pt("processing.log.queue.filesMissing"));
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }

      try {
        // 初始化 AbortController
        this.currentProcessingAbortController = new AbortController()
        const { signal } = this.currentProcessingAbortController

        const screenshots = await Promise.all(
          existingScreenshots.map(async (path) => {
            try {
              return {
                path,
                preview: await this.screenshotHelper.getImagePreview(path),
                data: fs.readFileSync(path).toString('base64')
              };
            } catch (err) {
              console.error(
                pt("processing.log.queue.readFailed", {
                  path,
                  error: String(err),
                })
              );
              return null;
            }
          })
        )

        // 剔除读取失败的截图
        const validScreenshots = screenshots.filter(Boolean);
        
        if (validScreenshots.length === 0) {
          throw new Error(pt("processing.log.queue.loadFailed"));
        }

        const result = await this.processScreenshotsHelper(validScreenshots, signal)

        if (!result.success) {
          console.log(
            pt("processing.log.processing.failed", {
              error: result.error ?? "",
            })
          )
          if (isApiKeyError(result.error)) {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.API_KEY_INVALID
            )
          } else {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
              result.error
            )
          }
          // 出错时视图退回队列
          console.log(pt("processing.log.view.resetToQueue"))
          this.deps.setView("queue")
          return
        }

        // 仅在处理成功时切换到方案页
        console.log(pt("processing.log.view.toSolutions"))
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
          result.data
        )
        this.deps.setView("solutions")
      } catch (error: any) {
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
          error
        )
        console.error(
          pt("processing.log.processing.error", { error: String(error) })
        )
        if (axios.isCancel(error)) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            pt("processing.error.cancelled")
          )
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            error.message || pt("processing.error.server")
          )
        }
        // 出错时视图退回队列
        console.log(pt("processing.log.view.resetToQueue"))
        this.deps.setView("queue")
      } finally {
        this.currentProcessingAbortController = null
      }
    } else {
      // view == 'solutions'：处理调试截图
      const extraScreenshotQueue =
        this.screenshotHelper.getExtraScreenshotQueue()
      console.log(
        pt("processing.log.queue.extra", {
          queue: extraScreenshotQueue.join(", "),
        })
      )
      
      // 调试队列为空时直接提示
      if (!extraScreenshotQueue || extraScreenshotQueue.length === 0) {
        console.log(pt("processing.log.queue.extraEmpty"));
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        
        return;
      }

      // 确认文件确实存在于磁盘
      const existingExtraScreenshots = extraScreenshotQueue.filter(path => fs.existsSync(path));
      if (existingExtraScreenshots.length === 0) {
        console.log(pt("processing.log.queue.extraFilesMissing"));
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }
      
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.DEBUG_START)

      // 初始化 AbortController
      this.currentExtraProcessingAbortController = new AbortController()
      const { signal } = this.currentExtraProcessingAbortController

      try {
        // 取全部截图（主队列 + 调试队列）一起处理
        const allPaths = [
          ...this.screenshotHelper.getScreenshotQueue(),
          ...existingExtraScreenshots
        ];
        
        const screenshots = await Promise.all(
          allPaths.map(async (path) => {
            try {
              if (!fs.existsSync(path)) {
                console.warn(
                  pt("processing.log.queue.fileNotFound", { path })
                );
                return null;
              }
              
              return {
                path,
                preview: await this.screenshotHelper.getImagePreview(path),
                data: fs.readFileSync(path).toString('base64')
              };
            } catch (err) {
              console.error(
                pt("processing.log.queue.readFailed", {
                  path,
                  error: String(err),
                })
              );
              return null;
            }
          })
        )
        
        // 剔除读取失败的截图
        const validScreenshots = screenshots.filter(Boolean);
        
        if (validScreenshots.length === 0) {
          throw new Error(pt("processing.log.queue.debugLoadFailed"));
        }
        
        console.log(
          pt("processing.log.queue.combined", {
            paths: validScreenshots.map((s) => s.path).join(", "),
          })
        )

        const result = await this.processExtraScreenshotsHelper(
          validScreenshots,
          signal
        )

        if (result.success) {
          this.deps.setHasDebugged(true)
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_SUCCESS,
            result.data
          )
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            result.error
          )
        }
      } catch (error: any) {
        if (axios.isCancel(error)) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            pt("processing.error.extraCancelled")
          )
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            error.message
          )
        }
      } finally {
        this.currentExtraProcessingAbortController = null
      }
    }
  }

  private async processScreenshotsHelper(
    screenshots: Array<{ path: string; data: string }>,
    signal: AbortSignal
  ) {
    try {
      const config = configHelper.loadConfig();
      const language = await this.getLanguage();
      const mainWindow = this.deps.getMainWindow();
      
      // 第一步：用视觉模型解析题面（OpenAI / Gemini / Anthropic 三选一）
      const imageDataList = screenshots.map(screenshot => screenshot.data);
      
      // 告知用户当前进度
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: pt("processing.status.extract.analyzing"),
          progress: 20
        });
      }

      // prompt 与日志语言都取当前界面语言，与编程语言正交
      const locale = this.getLocale();
      const extractionPrompt = buildExtractionPrompt(locale, { language });

      let problemInfo: ExtractedProblemInfo;
      
      if (config.apiProvider === "openai") {
        // 确认 OpenAI 客户端可用
        if (!this.openaiClient) {
          this.initializeAIClient(); // 尝试重新初始化
          
          if (!this.openaiClient) {
            return {
              success: false,
              error: pt("processing.error.openai.notConfigured")
            };
          }
        }

        // 走 OpenAI Vision
        const messages = [
          {
            role: "system" as const, 
            content: extractionPrompt.system
          },
          {
            role: "user" as const,
            content: [
              {
                type: "text" as const, 
                text: extractionPrompt.user
              },
              ...imageDataList.map(data => ({
                type: "image_url" as const,
                image_url: { url: `data:image/png;base64,${data}` }
              }))
            ]
          }
        ];

        // 发请求给 OpenAI Vision
        const extractionResponse = await this.openaiClient.chat.completions.create({
          model: config.extractionModel || "gpt-4o",
          messages: messages,
          max_tokens: 4000,
          temperature: 0.2
        });

        // 解析并校验四个英文字段
        const parsed = parseProblemInfo(
          extractionResponse.choices[0].message.content ?? ""
        );
        if (parsed.status !== "ok") {
          logProblemParseFailure(parsed);
          return { success: false, error: problemParseErrorMessage(parsed) };
        }
        problemInfo = parsed.value;
      } else if (config.apiProvider === "gemini")  {
        // 走 Gemini API
        if (!this.geminiApiKey) {
          return {
            success: false,
            error: pt("processing.error.gemini.notConfigured")
          };
        }

        try {
          // Gemini 没有独立 system 位，把 system 与 user 拼成一条消息
          const geminiMessages: GeminiMessage[] = [
            {
              role: "user",
              parts: [
                {
                  text: `${extractionPrompt.system}\n\n${extractionPrompt.user}`
                },
                ...imageDataList.map(data => ({
                  inlineData: {
                    mimeType: "image/png",
                    data: data
                  }
                }))
              ]
            }
          ];

          // 发请求给 Gemini
          const response = await axios.default.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${config.extractionModel || "gemini-2.0-flash"}:generateContent?key=${this.geminiApiKey}`,
            {
              contents: geminiMessages,
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 4000
              }
            },
            { signal }
          );

          const responseData = response.data as GeminiResponse;
          
          if (!responseData.candidates || responseData.candidates.length === 0) {
            throw new Error(pt("processing.log.api.gemini.empty"));
          }
          
          // 解析并校验四个英文字段
          const parsed = parseProblemInfo(
            responseData.candidates[0].content.parts[0].text ?? ""
          );
          if (parsed.status !== "ok") {
            logProblemParseFailure(parsed);
            return { success: false, error: problemParseErrorMessage(parsed) };
          }
          problemInfo = parsed.value;
        } catch (error) {
          console.error(
            pt("processing.log.api.gemini.provider", { error: String(error) })
          );
          return {
            success: false,
            error: pt("processing.error.gemini.failed")
          };
        }
      } else if (config.apiProvider === "anthropic") {
        if (!this.anthropicClient) {
          return {
            success: false,
            error: pt("processing.error.anthropic.notConfigured")
          };
        }

        try {
          const messages = [
            {
              role: "user" as const,
              content: [
                {
                  type: "text" as const,
                  text: `${extractionPrompt.system}\n\n${extractionPrompt.user}`
                },
                ...imageDataList.map(data => ({
                  type: "image" as const,
                  source: {
                    type: "base64" as const,
                    media_type: "image/png" as const,
                    data: data
                  }
                }))
              ]
            }
          ];

          const response = await this.anthropicClient.messages.create({
            model: config.extractionModel || "claude-3-7-sonnet-20250219",
            max_tokens: 4000,
            messages: messages,
            temperature: 0.2
          });

          const responseText = (response.content[0] as { type: 'text', text: string }).text;
          // 解析并校验四个英文字段
          const parsed = parseProblemInfo(responseText ?? "");
          if (parsed.status !== "ok") {
            logProblemParseFailure(parsed);
            return { success: false, error: problemParseErrorMessage(parsed) };
          }
          problemInfo = parsed.value;
        } catch (error: any) {
          console.error(
            pt("processing.log.api.anthropic.provider", {
              error: String(error),
            })
          );

          // Claude 的输入上限/限流例外单独提示
          if (error.status === 429) {
            return {
              success: false,
              error: pt("processing.error.anthropic.rateLimit")
            };
          } else if (error.status === 413 || (error.message && error.message.includes("token"))) {
            return {
              success: false,
              error: pt("processing.error.anthropic.tooLarge")
            };
          }

          return {
            success: false,
            error: pt("processing.error.anthropic.failed")
          };
        }
      }
      
      // 告知用户当前进度
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: pt("processing.status.extract.done"),
          progress: 40
        });
      }

      // 把题目信息存进 AppState
      this.deps.setProblemInfo(problemInfo);

      // 先发一次解析成功事件
      if (mainWindow) {
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.PROBLEM_EXTRACTED,
          problemInfo
        );

        // 解析成功后继续生成方案
        const solutionsResult = await this.generateSolutionsHelper(signal);
        if (solutionsResult.success) {
          // 切换到方案页前清掉残留的调试截图
          this.screenshotHelper.clearExtraScreenshotQueue();
          
          // 最终进度
          mainWindow.webContents.send("processing-status", {
            message: pt("processing.status.solution.done"),
            progress: 100
          });
          
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
            solutionsResult.data
          );
          return { success: true, data: solutionsResult.data };
        } else {
          throw new Error(
            solutionsResult.error || pt("processing.error.solution.failed")
          );
        }
      }

      return { success: false, error: pt("processing.error.process.failed") };
    } catch (error: any) {
      // 用户主动取消的请求不重试
      if (axios.isCancel(error)) {
        return {
          success: false,
          error: pt("processing.error.cancelled")
        };
      }
      
      // OpenAI 的 HTTP 错误单独提示
      if (error?.response?.status === 401) {
        return {
          success: false,
          error: pt("processing.error.openai.invalidKey")
        };
      } else if (error?.response?.status === 429) {
        return {
          success: false,
          error: pt("processing.error.openai.rateLimit")
        };
      } else if (error?.response?.status === 500) {
        return {
          success: false,
          error: pt("processing.error.openai.server")
        };
      }

      console.error(
        pt("processing.log.api.errorDetails", { error: String(error) })
      );
      return { 
        success: false, 
        error: error.message || pt("processing.error.process.failed")
      };
    }
  }

  private async generateSolutionsHelper(signal: AbortSignal) {
    try {
      const problemInfo = this.deps.getProblemInfo();
      const language = await this.getLanguage();
      const config = configHelper.loadConfig();
      const mainWindow = this.deps.getMainWindow();

      if (!problemInfo) {
        throw new Error(pt("processing.error.solution.noProblem"));
      }

      // 更新进度状态
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: pt("processing.status.solution.generating"),
          progress: 60
        });
      }

      // prompt 统一由 electron/i18n/prompts.ts 组装（中英两版，唯一出口）
      const locale = this.getLocale();
      const promptText = buildSolutionPrompt(locale, {
        language,
        problem: problemInfo,
      });
      const systemText = buildSolutionSystemPrompt(locale);

      let responseContent;
      
      if (config.apiProvider === "openai") {
        // OpenAI 分支
        if (!this.openaiClient) {
          return {
            success: false,
            error: pt("processing.error.openai.notConfigured")
          };
        }
        
        // 发请求给 OpenAI
        const solutionResponse = await this.openaiClient.chat.completions.create({
          model: config.solutionModel || "gpt-4o",
          messages: [
            { role: "system", content: systemText },
            { role: "user", content: promptText }
          ],
          max_tokens: 4000,
          temperature: 0.2
        });

        responseContent = solutionResponse.choices[0].message.content;
      } else if (config.apiProvider === "gemini")  {
        // Gemini 分支
        if (!this.geminiApiKey) {
          return {
            success: false,
            error: pt("processing.error.gemini.notConfigured")
          };
        }
        
        try {
          // Gemini 没有独立 system 位，拼成一条消息
          const geminiMessages = [
            {
              role: "user",
              parts: [
                {
                  text: `${systemText}\n\n${promptText}`
                }
              ]
            }
          ];

          // 发请求给 Gemini
          const response = await axios.default.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${config.solutionModel || "gemini-2.0-flash"}:generateContent?key=${this.geminiApiKey}`,
            {
              contents: geminiMessages,
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 4000
              }
            },
            { signal }
          );

          const responseData = response.data as GeminiResponse;
          
          if (!responseData.candidates || responseData.candidates.length === 0) {
            throw new Error(pt("processing.log.api.gemini.empty"));
          }
          
          responseContent = responseData.candidates[0].content.parts[0].text;
        } catch (error) {
          console.error(
            pt("processing.log.api.gemini.solution", { error: String(error) })
          );
          return {
            success: false,
            error: pt("processing.error.gemini.solutionFailed")
          };
        }
      } else if (config.apiProvider === "anthropic") {
        // Anthropic 分支
        if (!this.anthropicClient) {
          return {
            success: false,
            error: pt("processing.error.anthropic.notConfigured")
          };
        }
        
        try {
          const messages = [
            {
              role: "user" as const,
              content: [
                {
                  type: "text" as const,
                  text: `${systemText}\n\n${promptText}`
                }
              ]
            }
          ];

          // 发请求给 Anthropic
          const response = await this.anthropicClient.messages.create({
            model: config.solutionModel || "claude-3-7-sonnet-20250219",
            max_tokens: 4000,
            messages: messages,
            temperature: 0.2
          });

          responseContent = (response.content[0] as { type: 'text', text: string }).text;
        } catch (error: any) {
          console.error(
            pt("processing.log.api.anthropic.solution", { error: String(error) })
          );

          // Claude 的输入上限/限流例外单独提示
          if (error.status === 429) {
            return {
              success: false,
              error: pt("processing.error.anthropic.rateLimit")
            };
          } else if (error.status === 413 || (error.message && error.message.includes("token"))) {
            return {
              success: false,
              error: pt("processing.error.anthropic.tooLarge")
            };
          }

          return {
            success: false,
            error: pt("processing.error.anthropic.solutionFailed")
          };
        }
      }
      
      // 解析方案返回：中英两套分节标题都认，抽不到的项用当前语言的兜底文案
      const formattedResponse = parseSolutionResponse(responseContent, {
        thoughts: pt("processing.fallback.thoughts.solution"),
        timeComplexity: pt("processing.fallback.timeComplexity"),
        spaceComplexity: pt("processing.fallback.spaceComplexity"),
      });

      return { success: true, data: formattedResponse };
    } catch (error: any) {
      if (axios.isCancel(error)) {
        return {
          success: false,
          error: pt("processing.error.cancelled")
        };
      }
      
      if (error?.response?.status === 401) {
        return {
          success: false,
          error: pt("processing.error.openai.invalidKey")
        };
      } else if (error?.response?.status === 429) {
        return {
          success: false,
          error: pt("processing.error.openai.rateLimit")
        };
      }
      
      console.error(
        pt("processing.log.solution.error", { error: String(error) })
      );
      return {
        success: false,
        error: error.message || pt("processing.error.solution.failed")
      };
    }
  }

  private async processExtraScreenshotsHelper(
    screenshots: Array<{ path: string; data: string }>,
    signal: AbortSignal
  ) {
    try {
      const problemInfo = this.deps.getProblemInfo();
      const language = await this.getLanguage();
      const config = configHelper.loadConfig();
      const mainWindow = this.deps.getMainWindow();

      if (!problemInfo) {
        throw new Error(pt("processing.error.debug.noProblem"));
      }

      // 更新进度状态
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: pt("processing.status.debug.analyzing"),
          progress: 30
        });
      }

      // 准备发给模型的图片数据
      const imageDataList = screenshots.map(screenshot => screenshot.data);
      
      // prompt 同样走唯一出口，与界面语言一致
      const locale = this.getLocale();
      const debugSystem = buildDebugSystemPrompt(locale);
      const debugUser = buildDebugPrompt(locale, { language, problem: problemInfo });
      
      let debugContent;
      
      if (config.apiProvider === "openai") {
        if (!this.openaiClient) {
          return {
            success: false,
            error: pt("processing.error.openai.notConfigured")
          };
        }
        
        const messages = [
          {
            role: "system" as const, 
            content: debugSystem
          },
          {
            role: "user" as const,
            content: [
              {
                type: "text" as const, 
                text: debugUser
              },
              ...imageDataList.map(data => ({
                type: "image_url" as const,
                image_url: { url: `data:image/png;base64,${data}` }
              }))
            ]
          }
        ];

        if (mainWindow) {
          mainWindow.webContents.send("processing-status", {
            message: pt("processing.status.debug.analyzing"),
            progress: 60
          });
        }

        const debugResponse = await this.openaiClient.chat.completions.create({
          model: config.debuggingModel || "gpt-4o",
          messages: messages,
          max_tokens: 4000,
          temperature: 0.2
        });
        
        debugContent = debugResponse.choices[0].message.content;
      } else if (config.apiProvider === "gemini")  {
        if (!this.geminiApiKey) {
          return {
            success: false,
            error: pt("processing.error.gemini.notConfigured")
          };
        }
        
        try {
          // Gemini 没有独立 system 位，拼成一条消息
          const debugPrompt = `${debugSystem}\n\n${debugUser}`;

          const geminiMessages = [
            {
              role: "user",
              parts: [
                { text: debugPrompt },
                ...imageDataList.map(data => ({
                  inlineData: {
                    mimeType: "image/png",
                    data: data
                  }
                }))
              ]
            }
          ];

          if (mainWindow) {
            mainWindow.webContents.send("processing-status", {
              message: pt("processing.status.debug.analyzing.provider", {
                provider: "Gemini"
              }),
              progress: 60
            });
          }

          const response = await axios.default.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${config.debuggingModel || "gemini-2.0-flash"}:generateContent?key=${this.geminiApiKey}`,
            {
              contents: geminiMessages,
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 4000
              }
            },
            { signal }
          );

          const responseData = response.data as GeminiResponse;
          
          if (!responseData.candidates || responseData.candidates.length === 0) {
            throw new Error(pt("processing.log.api.gemini.empty"));
          }
          
          debugContent = responseData.candidates[0].content.parts[0].text;
        } catch (error) {
          console.error(
            pt("processing.log.api.gemini.debug", { error: String(error) })
          );
          return {
            success: false,
            error: pt("processing.error.gemini.debugFailed")
          };
        }
      } else if (config.apiProvider === "anthropic") {
        if (!this.anthropicClient) {
          return {
            success: false,
            error: pt("processing.error.anthropic.notConfigured")
          };
        }
        
        try {
          // Anthropic 同样没有独立 system 位
          const debugPrompt = `${debugSystem}\n\n${debugUser}`;

          const messages = [
            {
              role: "user" as const,
              content: [
                {
                  type: "text" as const,
                  text: debugPrompt
                },
                ...imageDataList.map(data => ({
                  type: "image" as const,
                  source: {
                    type: "base64" as const,
                    media_type: "image/png" as const, 
                    data: data
                  }
                }))
              ]
            }
          ];

          if (mainWindow) {
            mainWindow.webContents.send("processing-status", {
              message: pt("processing.status.debug.analyzing.provider", {
                provider: "Claude"
              }),
              progress: 60
            });
          }

          const response = await this.anthropicClient.messages.create({
            model: config.debuggingModel || "claude-3-7-sonnet-20250219",
            max_tokens: 4000,
            messages: messages,
            temperature: 0.2
          });
          
          debugContent = (response.content[0] as { type: 'text', text: string }).text;
        } catch (error: any) {
          console.error(
            pt("processing.log.api.anthropic.debug", { error: String(error) })
          );
          
          // Claude 的输入上限/限流例外单独提示
          if (error.status === 429) {
            return {
              success: false,
              error: pt("processing.error.anthropic.rateLimit")
            };
          } else if (error.status === 413 || (error.message && error.message.includes("token"))) {
            return {
              success: false,
              error: pt("processing.error.anthropic.tooLarge")
            };
          }
          
          return {
            success: false,
            error: pt("processing.error.anthropic.debugFailed")
          };
        }
      }
      
      
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: pt("processing.status.debug.done"),
          progress: 100
        });
      }

      let extractedCode = pt("processing.fallback.debug.code");
      const codeMatch = debugContent.match(/```(?:[a-zA-Z]+)?([\s\S]*?)```/);
      if (codeMatch && codeMatch[1]) {
        extractedCode = codeMatch[1].trim();
      }

      let formattedDebugContent = debugContent;
      
      if (!debugContent.includes('# ') && !debugContent.includes('## ')) {
        // 模型没有按结构输出时的兼容处理：把句子里的关键词提升成标题（中英都认）
        formattedDebugContent = debugContent
          .replace(
            /issues identified|problems found|bugs found|发现的问题/gi,
            pt("processing.debug.heading.issues")
          )
          .replace(
            /code improvements|improvements|suggested changes|具体改进与修正/gi,
            pt("processing.debug.heading.improvements")
          )
          .replace(
            /optimizations|performance improvements|可做的优化/gi,
            pt("processing.debug.heading.optimizations")
          )
          .replace(
            /explanation|detailed analysis|改动原因说明/gi,
            pt("processing.debug.heading.explanation")
          );
      }

      const bulletPoints = formattedDebugContent.match(/(?:^|\n)[ ]*(?:[-*•]|\d+\.)[ ]+([^\n]+)/g);
      const thoughts = bulletPoints 
        ? bulletPoints.map(point => point.replace(/^[ ]*(?:[-*•]|\d+\.)[ ]+/, '').trim()).slice(0, 5)
        : [pt("processing.fallback.debug.thoughts")];
      
      const response = {
        code: extractedCode,
        debug_analysis: formattedDebugContent,
        thoughts: thoughts,
        time_complexity: pt("processing.fallback.debug.complexity"),
        space_complexity: pt("processing.fallback.debug.complexity")
      };

      return { success: true, data: response };
    } catch (error: any) {
      console.error(
        pt("processing.log.debug.error", { error: String(error) })
      );
      return {
        success: false,
        error: error.message || pt("processing.error.debug.failed")
      };
    }
  }

  public cancelOngoingRequests(): void {
    let wasCancelled = false

    if (this.currentProcessingAbortController) {
      this.currentProcessingAbortController.abort()
      this.currentProcessingAbortController = null
      wasCancelled = true
    }

    if (this.currentExtraProcessingAbortController) {
      this.currentExtraProcessingAbortController.abort()
      this.currentExtraProcessingAbortController = null
      wasCancelled = true
    }

    this.deps.setHasDebugged(false)

    this.deps.setProblemInfo(null)

    const mainWindow = this.deps.getMainWindow()
    if (wasCancelled && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS)
    }
  }
}
