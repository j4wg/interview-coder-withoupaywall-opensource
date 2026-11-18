// ProcessingHelper.ts
import fs from "node:fs"
import path from "node:path"
import { ScreenshotHelper } from "./ScreenshotHelper"
import { IProcessingHelperDeps } from "./main"
import { app, BrowserWindow, dialog } from "electron"
import { configHelper } from "./ConfigHelper"
import { mainT } from "./i18n/mainT"
import type { Locale } from "./i18n/types"
import { completeForPurpose, providerSetupError } from "./llm/client"
import { resolveProviderConfig } from "./llm/providerConfig"
import {
  isApiKeyErrorCode,
  type ModelBindings,
  type ProviderSettings,
} from "./llm/types"
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

/** 用户取消/超时的判定：调用层统一用 AbortController，fetch 会抛 AbortError */
function isAbortError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false
  const candidate = error as Record<string, unknown>
  return candidate.name === "AbortError" || candidate.code === "ABORT_ERR"
}

export class ProcessingHelper {
  private deps: IProcessingHelperDeps
  private screenshotHelper: ScreenshotHelper

  // 三类请求的 AbortController，用于用户取消当前请求
  private currentProcessingAbortController: AbortController | null = null
  private currentExtraProcessingAbortController: AbortController | null = null

  constructor(deps: IProcessingHelperDeps) {
    this.deps = deps
    this.screenshotHelper = deps.getScreenshotHelper()
  }

  /**
   * 取当前生效的界面语言。与 mainT 同源（configHelper.getUiLocale()），不缓存，
   * 因此用户切换界面语言后，下一次请求的 prompt 与报错文案立刻跟随。
   */
  private getLocale(): Locale {
    return configHelper.getUiLocale().locale;
  }

  /**
   * 读一次当前配置并归一成调用层需要的结构。
   * 配置脏/缺字段不会抛错：归一过程中发现的问题只记日志，真正的阻塞由调用层的
   * `providerSetupError` 给出当前语言的可见提示。
   */
  private getProviderContext(): {
    locale: Locale
    provider: ProviderSettings
    bindings: ModelBindings
  } {
    const locale = this.getLocale()
    const { provider, bindings, issues } = resolveProviderConfig(
      configHelper.loadConfig()
    )
    if (issues.length > 0) {
      console.warn(
        pt("processing.log.llm.configIssues", { issues: issues.join(", ") })
      )
    }
    return { locale, provider, bindings }
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

    // 先确认 Base URL / API Key / 模型已就绪，避免白跑一趟截图队列
    const { locale, provider, bindings } = this.getProviderContext()
    const setupError = providerSetupError(
      provider,
      bindings,
      "extraction",
      locale
    )
    if (setupError) {
      console.error(setupError.message)
      if (isApiKeyErrorCode(setupError.code)) {
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.API_KEY_INVALID)
      } else {
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
          setupError.message
        )
      }
      return
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
          if (result.code && isApiKeyErrorCode(result.code)) {
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
        if (isAbortError(error)) {
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
        if (isAbortError(error)) {
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
      const language = await this.getLanguage();
      const mainWindow = this.deps.getMainWindow();

      // 第一步：用当前配置的模型解析题面（API 格式由 provider.apiFormat 决定）
      const imageDataList = screenshots.map(screenshot => screenshot.data);
      
      // 告知用户当前进度
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: pt("processing.status.extract.analyzing"),
          progress: 20
        });
      }

      // prompt 与日志语言都取当前界面语言，与编程语言正交
      const { locale, provider, bindings } = this.getProviderContext();
      const extractionPrompt = buildExtractionPrompt(locale, { language });

      // 模型 ID 由 bindings.extractionModel 决定；请求构造/响应解析由调用层按 apiFormat 分发
      const extraction = await completeForPurpose({
        purpose: "extraction",
        provider,
        bindings,
        system: extractionPrompt.system,
        user: extractionPrompt.user,
        images: imageDataList.map((data) => ({ mimeType: "image/png", data })),
        locale,
        signal,
      });
      if (extraction.kind === "failure") {
        return {
          success: false,
          error: extraction.message,
          code: extraction.code,
        };
      }

      // 解析并校验四个英文字段
      const parsed = parseProblemInfo(extraction.text);
      if (parsed.status !== "ok") {
        logProblemParseFailure(parsed);
        return { success: false, error: problemParseErrorMessage(parsed) };
      }
      const problemInfo: ExtractedProblemInfo = parsed.value;
      
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
          return {
            success: false,
            error: solutionsResult.error || pt("processing.error.solution.failed"),
            code: solutionsResult.code,
          };
        }
      }

      return { success: false, error: pt("processing.error.process.failed") };
    } catch (error: any) {
      // 用户主动取消的请求不重试
      if (isAbortError(error)) {
        return {
          success: false,
          error: pt("processing.error.cancelled"),
          code: "aborted" as const,
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
      const { locale, provider, bindings } = this.getProviderContext();
      const promptText = buildSolutionPrompt(locale, {
        language,
        problem: problemInfo,
      });
      const systemText = buildSolutionSystemPrompt(locale);

      // 模型 ID 由 bindings.solutionModel 决定
      const solution = await completeForPurpose({
        purpose: "solution",
        provider,
        bindings,
        system: systemText,
        user: promptText,
        locale,
        signal,
      });
      if (solution.kind === "failure") {
        return {
          success: false,
          error: solution.message,
          code: solution.code,
        };
      }
      const responseContent = solution.text;
      
      // 解析方案返回：中英两套分节标题（含全角括号）都认，抽不到的项用当前语言的兜底文案
      const formattedResponse = parseSolutionResponse(
        responseContent,
        {
          thoughts: pt("processing.fallback.thoughts.solution"),
          timeComplexity: pt("processing.fallback.timeComplexity"),
          spaceComplexity: pt("processing.fallback.spaceComplexity"),
        },
        locale
      );

      return { success: true, data: formattedResponse };
    } catch (error: any) {
      if (isAbortError(error)) {
        return {
          success: false,
          error: pt("processing.error.cancelled"),
          code: "aborted" as const,
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
      const { locale, provider, bindings } = this.getProviderContext();
      const debugSystem = buildDebugSystemPrompt(locale);
      const debugUser = buildDebugPrompt(locale, { language, problem: problemInfo });

      // 模型 ID 由 bindings.debuggingModel 决定
      const debug = await completeForPurpose({
        purpose: "debugging",
        provider,
        bindings,
        system: debugSystem,
        user: debugUser,
        images: imageDataList.map((data) => ({ mimeType: "image/png", data })),
        locale,
        signal,
      });
      if (debug.kind === "failure") {
        return {
          success: false,
          error: debug.message,
          code: debug.code,
        };
      }
      const debugContent = debug.text;

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
