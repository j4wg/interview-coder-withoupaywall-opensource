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
import { jsonrepair } from 'jsonrepair';

// API URL constants for Chinese AI providers
const API_URLS = {
  deepseek: 'https://api.deepseek.com',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  bailian: 'https://coding.dashscope.aliyuncs.com/v1'  // Coding Plan 专属 URL
} as const;

// Interface for Gemini API requests
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

  // AbortControllers for API requests
  private currentProcessingAbortController: AbortController | null = null
  private currentExtraProcessingAbortController: AbortController | null = null

  constructor(deps: IProcessingHelperDeps) {
    this.deps = deps
    this.screenshotHelper = deps.getScreenshotHelper()
    
    // Initialize AI client based on config
    this.initializeAIClient();
    
    // Listen for config changes to re-initialize the AI client
    configHelper.on('config-updated', () => {
      this.initializeAIClient();
    });
  }
  
  /**
   * Initialize or reinitialize the AI client with current config
   */
  private initializeAIClient(): void {
    try {
      const config = configHelper.loadConfig();
      const apiKey = configHelper.getApiKeyForProvider();

      // Reset all clients first
      this.openaiClient = null;
      this.geminiApiKey = null;
      this.anthropicClient = null;

      if (config.apiProvider === "openai") {
        if (apiKey) {
          this.openaiClient = new OpenAI({
            apiKey: apiKey,
            timeout: 60000, // 60 second timeout
            maxRetries: 2   // Retry up to 2 times
          });
          console.log("OpenAI client initialized successfully");
        } else {
          console.warn("No API key available, OpenAI client not initialized");
        }
      } else if (config.apiProvider === "gemini") {
        // Gemini client initialization
        if (apiKey) {
          this.geminiApiKey = apiKey;
          console.log("Gemini API key set successfully");
        } else {
          console.warn("No API key available, Gemini client not initialized");
        }
      } else if (config.apiProvider === "anthropic") {
        if (apiKey) {
          this.anthropicClient = new Anthropic({
            apiKey: apiKey,
            timeout: 60000,
            maxRetries: 2
          });
          console.log("Anthropic client initialized successfully");
        } else {
          console.warn("No API key available, Anthropic client not initialized");
        }
      } else if (config.apiProvider === "deepseek") {
        // Deepseek uses OpenAI-compatible API
        if (apiKey) {
          this.openaiClient = new OpenAI({
            apiKey: apiKey,
            baseURL: API_URLS.deepseek,
            timeout: 60000,
            maxRetries: 2
          });
          console.log("Deepseek client initialized successfully (OpenAI-compatible)");
        } else {
          console.warn("No API key available, Deepseek client not initialized");
        }
      } else if (config.apiProvider === "zhipu") {
        // Zhipu/GLM uses OpenAI-compatible API
        if (apiKey) {
          this.openaiClient = new OpenAI({
            apiKey: apiKey,
            baseURL: API_URLS.zhipu,
            timeout: 60000,
            maxRetries: 2
          });
          console.log("Zhipu/GLM client initialized successfully (OpenAI-compatible)");
        } else {
          console.warn("No API key available, Zhipu client not initialized");
        }
      } else if (config.apiProvider === "bailian") {
        // Alibaba Bailian uses OpenAI-compatible API
        if (apiKey) {
          this.openaiClient = new OpenAI({
            apiKey: apiKey,
            baseURL: API_URLS.bailian,
            timeout: 120000, // 2 minute timeout for Bailian
            maxRetries: 2
          });
          console.log("Bailian client initialized successfully (OpenAI-compatible)");
        } else {
          console.warn("No API key available, Bailian client not initialized");
        }
      }
    } catch (error) {
      console.error("Failed to initialize AI client:", error);
      this.openaiClient = null;
      this.geminiApiKey = null;
      this.anthropicClient = null;
    }
  }

  /**
   * Fix malformed JSON from GLM API:
   * 1. Single-quoted string values: "key": 'value' -> "key": "value"
   * 2. Unescaped quotes inside string values: "例如："abc"" -> "例如：\"abc\""
   * 3. Chinese curly quotes: " " -> escaped regular quotes
   */
  private fixChineseQuotesInJson(text: string): string {
    // Step 1: Replace single-quoted values with double-quoted values
    let result = '';
    let i = 0;

    while (i < text.length) {
      if (text[i] === ':') {
        result += ':';
        i++;

        // Skip whitespace after colon
        while (i < text.length && /\s/.test(text[i])) {
          result += text[i];
          i++;
        }

        // Check if the value starts with a single quote
        if (i < text.length && text[i] === "'") {
          // Find the matching closing single quote (followed by , } ] or end)
          let endPos = -1;
          let j = i + 1;
          while (j < text.length) {
            if (text[j] === "'") {
              let k = j + 1;
              while (k < text.length && /\s/.test(text[k])) k++;
              if (k >= text.length || text[k] === ',' || text[k] === '}' || text[k] === ']') {
                endPos = j;
                break;
              }
            }
            j++;
          }

          if (endPos !== -1) {
            const content = text.substring(i + 1, endPos);
            const escaped = content.replace(/"/g, '\\"');
            result += '"' + escaped + '"';
            i = endPos + 1;
            continue;
          }
        }
      } else {
        result += text[i];
        i++;
      }
    }

    // Step 2: Fix unescaped quotes inside JSON string values
    // This handles cases like: "problem": "例如："0.1" 和 "1.2""
    // The inner quotes need to be escaped
    let finalResult = '';
    let inString = false;
    i = 0;

    while (i < result.length) {
      const char = result[i];

      if (char === '"') {
        // Check if this quote is escaped
        let backslashCount = 0;
        let j = i - 1;
        while (j >= 0 && result[j] === '\\') {
          backslashCount++;
          j--;
        }
        const isEscaped = backslashCount % 2 === 1;

        if (!isEscaped) {
          if (!inString) {
            // Starting a string
            inString = true;
            finalResult += char;
          } else {
            // This might be the end of string OR an unescaped quote inside
            // Look ahead to determine if this is really the end of the string
            let k = i + 1;
            while (k < result.length && /\s/.test(result[k])) k++;

            // If followed by : , } ] or end of input, it's a real string end
            if (k >= result.length || result[k] === ':' || result[k] === ',' ||
                result[k] === '}' || result[k] === ']') {
              inString = false;
              finalResult += char;
            } else {
              // This is an unescaped quote inside the string - escape it
              finalResult += '\\"';
            }
          }
        } else {
          finalResult += char;
        }
      }
      // Replace Chinese curly quotes with escaped regular quotes
      else if (inString && (char === '\u201C' || char === '\u201D')) {
        finalResult += '\\"';
      }
      // Replace Chinese single quotes
      else if (inString && (char === '\u2018' || char === '\u2019')) {
        finalResult += "'";
      }
      else {
        finalResult += char;
      }
      i++;
    }

    return finalResult;
  }

  /**
   * Make a Zhipu API call using native HTTP (bypasses OpenAI SDK quirks)
   */
  private async callZhipuAPI(
    messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }>,
    model: string,
    timeout: number = 60000
  ): Promise<{ choices: Array<{ message: { content: string } }> }> {
    const zhipuApiKey = configHelper.getApiKeyForProvider("zhipu");
    const response = await axios.default.post(
      `${API_URLS.zhipu}/chat/completions`,
      { model, messages },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${zhipuApiKey}`
        },
        timeout
      }
    );
    return response.data;
  }

  private async waitForInitialization(
    mainWindow: BrowserWindow
  ): Promise<void> {
    let attempts = 0
    const maxAttempts = 50 // 5 seconds total

    while (attempts < maxAttempts) {
      const isInitialized = await mainWindow.webContents.executeJavaScript(
        "window.__IS_INITIALIZED__"
      )
      if (isInitialized) return
      await new Promise((resolve) => setTimeout(resolve, 100))
      attempts++
    }
    throw new Error("App failed to initialize after 5 seconds")
  }

  private async getCredits(): Promise<number> {
    const mainWindow = this.deps.getMainWindow()
    if (!mainWindow) return 999 // Unlimited credits in this version

    try {
      await this.waitForInitialization(mainWindow)
      return 999 // Always return sufficient credits to work
    } catch (error) {
      console.error("Error getting credits:", error)
      return 999 // Unlimited credits as fallback
    }
  }

  private async getLanguage(): Promise<string> {
    try {
      // Get language from config
      const config = configHelper.loadConfig();
      if (config.language) {
        return config.language;
      }
      
      // Fallback to window variable if config doesn't have language
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
          console.warn("Could not get language from window", err);
        }
      }
      
      // Default fallback
      return "python";
    } catch (error) {
      console.error("Error getting language:", error)
      return "python"
    }
  }

  public async processScreenshots(): Promise<void> {
    const mainWindow = this.deps.getMainWindow()
    if (!mainWindow) return

    const config = configHelper.loadConfig();
    
    // First verify we have a valid AI client
    if (config.apiProvider === "openai" && !this.openaiClient) {
      this.initializeAIClient();
      
      if (!this.openaiClient) {
        console.error("OpenAI client not initialized");
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.API_KEY_INVALID
        );
        return;
      }
    } else if (config.apiProvider === "gemini" && !this.geminiApiKey) {
      this.initializeAIClient();
      
      if (!this.geminiApiKey) {
        console.error("Gemini API key not initialized");
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.API_KEY_INVALID
        );
        return;
      }
    } else if (config.apiProvider === "anthropic" && !this.anthropicClient) {
      // Add check for Anthropic client
      this.initializeAIClient();
      
      if (!this.anthropicClient) {
        console.error("Anthropic client not initialized");
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.API_KEY_INVALID
        );
        return;
      }
    }

    const view = this.deps.getView()
    console.log("Processing screenshots in view:", view)

    if (view === "queue") {
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.INITIAL_START)
      const screenshotQueue = this.screenshotHelper.getScreenshotQueue()
      console.log("Processing main queue screenshots:", screenshotQueue)
      
      // Check if the queue is empty
      if (!screenshotQueue || screenshotQueue.length === 0) {
        console.log("No screenshots found in queue");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }

      // Check that files actually exist
      const existingScreenshots = screenshotQueue.filter(path => fs.existsSync(path));
      if (existingScreenshots.length === 0) {
        console.log("Screenshot files don't exist on disk");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }

      try {
        // Initialize AbortController
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
              console.error(`Error reading screenshot ${path}:`, err);
              return null;
            }
          })
        )

        // Filter out any nulls from failed screenshots
        const validScreenshots = screenshots.filter(Boolean);
        
        if (validScreenshots.length === 0) {
          throw new Error("Failed to load screenshot data");
        }

        const result = await this.processScreenshotsHelper(validScreenshots, signal)

        if (!result.success) {
          console.log("Processing failed:", result.error)
          if (result.error?.includes("API Key") || result.error?.includes("OpenAI") || result.error?.includes("Gemini")) {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.API_KEY_INVALID
            )
          } else {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
              result.error
            )
          }
          // Reset view back to queue on error
          console.log("Resetting view to queue due to error")
          this.deps.setView("queue")
          return
        }

        // Only set view to solutions if processing succeeded
        console.log("Setting view to solutions after successful processing")
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
        console.error("Processing error:", error)
        if (axios.isCancel(error)) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            "Processing was canceled by the user."
          )
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            error.message || "Server error. Please try again."
          )
        }
        // Reset view back to queue on error
        console.log("Resetting view to queue due to error")
        this.deps.setView("queue")
      } finally {
        this.currentProcessingAbortController = null
      }
    } else {
      // view == 'solutions'
      const extraScreenshotQueue =
        this.screenshotHelper.getExtraScreenshotQueue()
      console.log("Processing extra queue screenshots:", extraScreenshotQueue)
      
      // Check if the extra queue is empty
      if (!extraScreenshotQueue || extraScreenshotQueue.length === 0) {
        console.log("No extra screenshots found in queue");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        
        return;
      }

      // Check that files actually exist
      const existingExtraScreenshots = extraScreenshotQueue.filter(path => fs.existsSync(path));
      if (existingExtraScreenshots.length === 0) {
        console.log("Extra screenshot files don't exist on disk");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }
      
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.DEBUG_START)

      // Initialize AbortController
      this.currentExtraProcessingAbortController = new AbortController()
      const { signal } = this.currentExtraProcessingAbortController

      try {
        // Get all screenshots (both main and extra) for processing
        const allPaths = [
          ...this.screenshotHelper.getScreenshotQueue(),
          ...existingExtraScreenshots
        ];
        
        const screenshots = await Promise.all(
          allPaths.map(async (path) => {
            try {
              if (!fs.existsSync(path)) {
                console.warn(`Screenshot file does not exist: ${path}`);
                return null;
              }
              
              return {
                path,
                preview: await this.screenshotHelper.getImagePreview(path),
                data: fs.readFileSync(path).toString('base64')
              };
            } catch (err) {
              console.error(`Error reading screenshot ${path}:`, err);
              return null;
            }
          })
        )
        
        // Filter out any nulls from failed screenshots
        const validScreenshots = screenshots.filter(Boolean);
        
        if (validScreenshots.length === 0) {
          throw new Error("Failed to load screenshot data for debugging");
        }
        
        console.log(
          "Combined screenshots for processing:",
          validScreenshots.map((s) => s.path)
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
            "Extra processing was canceled by the user."
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
      
      // Step 1: Extract problem info using AI Vision API (OpenAI or Gemini)
      const imageDataList = screenshots.map(screenshot => screenshot.data);
      
      // Update the user on progress
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Analyzing problem from screenshots...",
          progress: 20
        });
      }

      let problemInfo;

      // OpenAI, Deepseek, Zhipu, and Bailian all use OpenAI-compatible API
      if (config.apiProvider === "openai" || config.apiProvider === "deepseek" || config.apiProvider === "zhipu" || config.apiProvider === "bailian") {
        // Verify OpenAI-compatible client
        if (!this.openaiClient) {
          this.initializeAIClient(); // Try to reinitialize

          if (!this.openaiClient) {
            const providerName = config.apiProvider === "deepseek" ? "Deepseek" :
                                 config.apiProvider === "zhipu" ? "Zhipu/GLM" :
                                 config.apiProvider === "bailian" ? "Bailian" : "OpenAI";
            return {
              success: false,
              error: `${providerName} API key not configured or invalid. Please check your settings.`
            };
          }
        }

        // Get the appropriate model for the provider
        let extractionModel = config.extractionModel;
        if (config.apiProvider === "deepseek") {
          extractionModel = extractionModel || "deepseek-chat";
        } else if (config.apiProvider === "zhipu") {
          // GLM-4V models support vision
          extractionModel = extractionModel || "glm-4v-flash";
        } else if (config.apiProvider === "bailian") {
          // Coding Plan 支持图片理解的模型
          extractionModel = extractionModel || "qwen3.5-plus";
        } else {
          extractionModel = extractionModel || "gpt-4o";
        }

        // Build messages based on provider
        let messages;

        let extractionResponse;

        if (config.apiProvider === "zhipu") {
          // Zhipu GLM-4V: Use native HTTP request to bypass OpenAI SDK quirks
          const systemPrompt = "You are a coding challenge interpreter. Analyze the screenshots of the coding problem and extract all relevant information. Return the information in JSON format with these fields: problem_statement, constraints, example_input, example_output. Just return the structured JSON without any other text.";

          // Build content array with text first, then ALL images
          const contentArray: any[] = [
            {
              type: "text",
              text: `${systemPrompt}\n\nExtract the coding problem details from these screenshots. Return in JSON format. Preferred coding language we gonna use for this problem is ${language}.`
            }
          ];

          // Add all screenshots to the request
          for (const imageData of imageDataList) {
            const imageUrl = imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`;
            contentArray.push({
              type: "image_url",
              image_url: { url: imageUrl }
            });
          }

          console.log(`Solve mode: sending ${imageDataList.length} screenshots to Zhipu API for problem extraction`);

          const zhipuMessages = [
            {
              role: "user",
              content: contentArray
            }
          ];

          // Increase timeout for multiple images (60s per image, minimum 120s)
          const extractionTimeout = Math.max(120000, imageDataList.length * 60000);
          console.log(`Problem extraction timeout: ${extractionTimeout / 1000}s for ${imageDataList.length} images`);
          extractionResponse = await this.callZhipuAPI(zhipuMessages, extractionModel, extractionTimeout);
        } else {
          // OpenAI and Deepseek: standard format via OpenAI SDK
          messages = [
            {
              role: "system" as const,
              content: "You are a coding challenge interpreter. Analyze the screenshot of the coding problem and extract all relevant information. Return the information in JSON format with these fields: problem_statement, constraints, example_input, example_output. Just return the structured JSON without any other text."
            },
            {
              role: "user" as const,
              content: [
                {
                  type: "text" as const,
                  text: `Extract the coding problem details from these screenshots. Return in JSON format. Preferred coding language we gonna use for this problem is ${language}.`
                },
                ...imageDataList.map(data => ({
                  type: "image_url" as const,
                  image_url: { url: `data:image/png;base64,${data}` }
                }))
              ]
            }
          ];

          // Send to OpenAI-compatible Vision API
          extractionResponse = await this.openaiClient.chat.completions.create({
            model: extractionModel,
            messages: messages,
            max_tokens: 4000,
            temperature: 0.2
          });
        }

        // Parse the response
        try {
          const responseText = extractionResponse.choices[0].message.content;
          // Handle when AI might wrap the JSON in markdown code blocks
          let jsonText = responseText.replace(/```json\n?|```\n?/g, '').trim();
          // Also try to extract JSON from text if AI added extra content
          const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonText = jsonMatch[0];
          }
          // Fix Chinese quotes and single-quoted arrays using character traversal
          // This safely handles Chinese quotes (U+201C, U+201D) inside JSON strings
          jsonText = this.fixChineseQuotesInJson(jsonText);

          // Use jsonrepair to fix remaining issues (handles single quotes, trailing commas, etc.)
          const repairedJson = jsonrepair(jsonText);
          problemInfo = JSON.parse(repairedJson);
        } catch (error) {
          console.error("Error parsing API response:", error);
          return {
            success: false,
            error: "Failed to parse problem information. Please try again or use clearer screenshots."
          };
        }
      } else if (config.apiProvider === "gemini") {
        // Use Gemini API
        if (!this.geminiApiKey) {
          return {
            success: false,
            error: "Gemini API key not configured. Please check your settings."
          };
        }

        try {
          // Create Gemini message structure
          const geminiMessages: GeminiMessage[] = [
            {
              role: "user",
              parts: [
                {
                  text: `You are a coding challenge interpreter. Analyze the screenshots of the coding problem and extract all relevant information. Return the information in JSON format with these fields: problem_statement, constraints, example_input, example_output. Just return the structured JSON without any other text. Preferred coding language we gonna use for this problem is ${language}.`
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

          // Make API request to Gemini
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
            throw new Error("Empty response from Gemini API");
          }
          
          const responseText = responseData.candidates[0].content.parts[0].text;
          
          // Handle when Gemini might wrap the JSON in markdown code blocks
          const jsonText = responseText.replace(/```json|```/g, '').trim();
          problemInfo = JSON.parse(jsonText);
        } catch (error) {
          console.error("Error using Gemini API:", error);
          return {
            success: false,
            error: "Failed to process with Gemini API. Please check your API key or try again later."
          };
        }
      } else if (config.apiProvider === "anthropic") {
        if (!this.anthropicClient) {
          return {
            success: false,
            error: "Anthropic API key not configured. Please check your settings."
          };
        }

        try {
          const messages = [
            {
              role: "user" as const,
              content: [
                {
                  type: "text" as const,
                  text: `Extract the coding problem details from these screenshots. Return in JSON format with these fields: problem_statement, constraints, example_input, example_output. Preferred coding language is ${language}.`
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
          const jsonText = responseText.replace(/```json|```/g, '').trim();
          problemInfo = JSON.parse(jsonText);
        } catch (error: any) {
          console.error("Error using Anthropic API:", error);

          // Add specific handling for Claude's limitations
          if (error.status === 429) {
            return {
              success: false,
              error: "Claude API rate limit exceeded. Please wait a few minutes before trying again."
            };
          } else if (error.status === 413 || (error.message && error.message.includes("token"))) {
            return {
              success: false,
              error: "Your screenshots contain too much information for Claude to process. Switch to OpenAI or Gemini in settings which can handle larger inputs."
            };
          }

          return {
            success: false,
            error: "Failed to process with Anthropic API. Please check your API key or try again later."
          };
        }
      }
      
      // Update the user on progress
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Problem analyzed successfully. Preparing to generate solution...",
          progress: 40
        });
      }

      // Store problem info in AppState
      this.deps.setProblemInfo(problemInfo);

      // Send first success event
      if (mainWindow) {
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.PROBLEM_EXTRACTED,
          problemInfo
        );

        // Generate solutions after successful extraction
        const solutionsResult = await this.generateSolutionsHelper(signal);
        if (solutionsResult.success) {
          // Clear any existing extra screenshots before transitioning to solutions view
          this.screenshotHelper.clearExtraScreenshotQueue();
          
          // Final progress update
          mainWindow.webContents.send("processing-status", {
            message: "Solution generated successfully",
            progress: 100
          });
          
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
            solutionsResult.data
          );
          return { success: true, data: solutionsResult.data };
        } else {
          throw new Error(
            solutionsResult.error || "Failed to generate solutions"
          );
        }
      }

      return { success: false, error: "Failed to process screenshots" };
    } catch (error: any) {
      // If the request was cancelled, don't retry
      if (axios.isCancel(error)) {
        return {
          success: false,
          error: "Processing was canceled by the user."
        };
      }
      
      // Handle OpenAI API errors specifically
      if (error?.response?.status === 401) {
        return {
          success: false,
          error: "Invalid OpenAI API key. Please check your settings."
        };
      } else if (error?.response?.status === 429) {
        return {
          success: false,
          error: "OpenAI API rate limit exceeded or insufficient credits. Please try again later."
        };
      } else if (error?.response?.status === 500) {
        return {
          success: false,
          error: "OpenAI server error. Please try again later."
        };
      }

      console.error("API Error Details:", error);
      return { 
        success: false, 
        error: error.message || "Failed to process screenshots. Please try again." 
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
        throw new Error("No problem info available");
      }

      // Update progress status
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Creating optimal solution with detailed explanations...",
          progress: 60
        });
      }

      // Create prompt for solution generation
      const promptText = `
请为以下编程题目提供详细的解答。**重要：除了代码本身，所有文字说明必须使用中文！**

【题目描述】
${problemInfo.problem_statement}

【约束条件】
${problemInfo.constraints || "未提供具体约束条件。"}

【输入示例】
${problemInfo.example_input || "未提供输入示例。"}

【输出示例】
${problemInfo.example_output || "未提供输出示例。"}

【编程语言】${language}

请严格按以下 JSON 格式回答（不要添加任何其他内容）：

\`\`\`json
{
  "code": "你的 ${language} 代码（代码注释用中文）",
  "thoughts": [
    "**核心算法**：描述你使用的主要算法或数据结构...",
    "**优化策略**：描述任何优化或剪枝策略..."
  ],
  "time_complexity": "O(X) - 用中文详细解释原因，说明循环次数、操作复杂度等（至少2句话）",
  "space_complexity": "O(X) - 用中文详细解释原因，说明使用了哪些额外空间（至少2句话）"
}
\`\`\`

**重要**：
1. 必须返回有效的 JSON 格式
2. code 字段中的换行符用 \\n 表示
3. 解题思路、复杂度分析必须是中文
4. 复杂度分析必须基于你生成的代码，不要使用模板答案
`;

      let responseContent;

      // OpenAI, Deepseek, Zhipu, and Bailian all use OpenAI-compatible API
      if (config.apiProvider === "openai" || config.apiProvider === "deepseek" || config.apiProvider === "zhipu" || config.apiProvider === "bailian") {
        if (!this.openaiClient) {
          const providerName = config.apiProvider === "deepseek" ? "Deepseek" :
                               config.apiProvider === "zhipu" ? "Zhipu/GLM" :
                               config.apiProvider === "bailian" ? "Bailian" : "OpenAI";
          return {
            success: false,
            error: `${providerName} API key not configured. Please check your settings.`
          };
        }

        // Get the appropriate model for the provider
        // Re-read config to get latest solutionModel
        const latestConfig = configHelper.loadConfig();
        let solutionModel = latestConfig.solutionModel || config.solutionModel;
        if (config.apiProvider === "deepseek") {
          solutionModel = solutionModel || "deepseek-chat";
        } else if (config.apiProvider === "zhipu") {
          solutionModel = solutionModel || "glm-4-flash";
        } else if (config.apiProvider === "bailian") {
          solutionModel = solutionModel || "qwen3.5-plus";
        } else {
          solutionModel = solutionModel || "gpt-4o";
        }

        let solutionResponse;

        if (config.apiProvider === "zhipu") {
          // Zhipu: Use native HTTP request
          const zhipuMessages = [
            { role: "user", content: `你是一位资深的编程面试助手。请提供清晰、最优的解决方案，并附带详细的解释。\n\n${promptText}` }
          ];

          const zhipuResponse = await this.callZhipuAPI(zhipuMessages, solutionModel, 120000);
          responseContent = zhipuResponse.choices[0].message.content;
        } else {
          // OpenAI/Deepseek/Bailian: Use OpenAI SDK
          const solutionMessages = [
            { role: "system" as const, content: "你是一位资深的编程面试助手。请提供清晰、最优的解决方案，并附带详细的解释。" },
            { role: "user" as const, content: promptText }
          ];

          // Send to OpenAI-compatible API
          solutionResponse = await this.openaiClient.chat.completions.create({
            model: solutionModel,
            messages: solutionMessages,
            max_tokens: 4000,
            temperature: 0.2
          });

          responseContent = solutionResponse.choices[0].message.content;
        }
      } else if (config.apiProvider === "gemini") {
        // Gemini processing
        if (!this.geminiApiKey) {
          return {
            success: false,
            error: "Gemini API key not configured. Please check your settings."
          };
        }
        
        try {
          // Create Gemini message structure
          const geminiMessages = [
            {
              role: "user",
              parts: [
                {
                  text: `你是一位资深的编程面试助手。请为以下问题提供清晰、最优的解决方案，并附带详细的解释：\n\n${promptText}`
                }
              ]
            }
          ];

          // Make API request to Gemini
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
            throw new Error("Empty response from Gemini API");
          }
          
          responseContent = responseData.candidates[0].content.parts[0].text;
        } catch (error) {
          console.error("Error using Gemini API for solution:", error);
          return {
            success: false,
            error: "Failed to generate solution with Gemini API. Please check your API key or try again later."
          };
        }
      } else if (config.apiProvider === "anthropic") {
        // Anthropic processing
        if (!this.anthropicClient) {
          return {
            success: false,
            error: "Anthropic API key not configured. Please check your settings."
          };
        }
        
        try {
          const messages = [
            {
              role: "user" as const,
              content: [
                {
                  type: "text" as const,
                  text: `你是一位资深的编程面试助手。请为以下问题提供清晰、最优的解决方案，并附带详细的解释：\n\n${promptText}`
                }
              ]
            }
          ];

          // Send to Anthropic API
          const response = await this.anthropicClient.messages.create({
            model: config.solutionModel || "claude-3-7-sonnet-20250219",
            max_tokens: 4000,
            messages: messages,
            temperature: 0.2
          });

          responseContent = (response.content[0] as { type: 'text', text: string }).text;
        } catch (error: any) {
          console.error("Error using Anthropic API for solution:", error);

          // Add specific handling for Claude's limitations
          if (error.status === 429) {
            return {
              success: false,
              error: "Claude API rate limit exceeded. Please wait a few minutes before trying again."
            };
          } else if (error.status === 413 || (error.message && error.message.includes("token"))) {
            return {
              success: false,
              error: "Your screenshots contain too much information for Claude to process. Switch to OpenAI or Gemini in settings which can handle larger inputs."
            };
          }

          return {
            success: false,
            error: "Failed to generate solution with Anthropic API. Please check your API key or try again later."
          };
        }
      }
      
      // Parse JSON response from AI
      let parsedResponse: {
        code: string;
        thoughts: string[];
        time_complexity: string;
        space_complexity: string;
      };

      try {
        // Extract JSON from response (may be wrapped in ```json ... ```)
        let jsonText = responseContent;
        const jsonMatch = responseContent.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonText = jsonMatch[1].trim();
        }

        // Fix common JSON issues using jsonrepair
        const fixedJson = this.fixChineseQuotesInJson(jsonText);
        parsedResponse = JSON.parse(fixedJson);
      } catch (parseError) {
        // Fallback: try to extract using regex if JSON parsing fails
        console.warn("JSON parsing failed, attempting regex fallback:", parseError);

        const codeMatch = responseContent.match(/```(?:\w+)?\s*([\s\S]*?)```/);
        const code = codeMatch ? codeMatch[1].trim() : responseContent;

        parsedResponse = {
          code: code,
          thoughts: ["AI 返回格式异常，无法解析解题思路"],
          time_complexity: "无法解析 - AI 返回格式不符合预期，请重新生成",
          space_complexity: "无法解析 - AI 返回格式不符合预期，请重新生成"
        };
      }

      // Validate and format the response
      const formattedResponse = {
        code: parsedResponse.code || "",
        thoughts: Array.isArray(parsedResponse.thoughts) && parsedResponse.thoughts.length > 0
          ? parsedResponse.thoughts
          : ["基于效率和可读性的解题方法"],
        time_complexity: parsedResponse.time_complexity || "未提供时间复杂度分析",
        space_complexity: parsedResponse.space_complexity || "未提供空间复杂度分析"
      };

      return { success: true, data: formattedResponse };
    } catch (error: any) {
      if (axios.isCancel(error)) {
        return {
          success: false,
          error: "Processing was canceled by the user."
        };
      }
      
      if (error?.response?.status === 401) {
        return {
          success: false,
          error: "Invalid OpenAI API key. Please check your settings."
        };
      } else if (error?.response?.status === 429) {
        return {
          success: false,
          error: "OpenAI API rate limit exceeded or insufficient credits. Please try again later."
        };
      }
      
      console.error("Solution generation error:", error);
      return { success: false, error: error.message || "Failed to generate solution" };
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
        throw new Error("No problem info available");
      }

      // Update progress status
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Processing debug screenshots...",
          progress: 30
        });
      }

      // Prepare the images for the API call
      const imageDataList = screenshots.map(screenshot => screenshot.data);
      
      let debugContent;

      // OpenAI, Deepseek, Zhipu, and Bailian all use OpenAI-compatible API
      if (config.apiProvider === "openai" || config.apiProvider === "deepseek" || config.apiProvider === "zhipu" || config.apiProvider === "bailian") {
        if (!this.openaiClient) {
          const providerName = config.apiProvider === "deepseek" ? "Deepseek" :
                               config.apiProvider === "zhipu" ? "Zhipu/GLM" :
                               config.apiProvider === "bailian" ? "Bailian" : "OpenAI";
          return {
            success: false,
            error: `${providerName} API key not configured. Please check your settings.`
          };
        }

        // Get the appropriate model for the provider
        // IMPORTANT: Debugging requires vision models since we're processing screenshots
        let debuggingModel = config.debuggingModel;
        if (config.apiProvider === "deepseek") {
          debuggingModel = debuggingModel || "deepseek-chat";
        } else if (config.apiProvider === "zhipu") {
          // GLM-4V models support vision - MUST use vision model for debugging
          // Force vision model even if user configured a non-vision model
          const isVisionModel = debuggingModel && (debuggingModel.includes("4v") || debuggingModel.includes("4V"));
          debuggingModel = isVisionModel ? debuggingModel : "glm-4v-flash";
        } else if (config.apiProvider === "bailian") {
          // Coding Plan 支持图片理解的模型
          debuggingModel = debuggingModel || "qwen3.5-plus";
        } else {
          debuggingModel = debuggingModel || "gpt-4o";
        }

        const systemPrompt = `你是一个编程面试助手，帮助调试和改进解决方案。分析截图中的错误信息、错误输出或测试用例，提供详细的调试帮助。

你的回复必须严格按照以下 JSON 格式（不要添加任何其他内容）：

{
  "fixed_code": "完整的修复后代码，纯代码文本，不要包含 markdown 代码块标记",
  "issues": [
    "问题1：具体描述发现的第一个问题",
    "问题2：具体描述发现的第二个问题"
  ],
  "changes": [
    "修改1：描述你做的第一个修改",
    "修改2：描述你做的第二个修改"
  ],
  "explanation": "用中文详细解释为什么需要这些修改，以及修改后代码如何解决原来的问题"
}

重要要求：
1. fixed_code 必须是完整的、可直接提交运行的代码，不要用 \`\`\` 包裹
2. 代码注释用中文
3. 所有分析内容用中文
4. 只返回 JSON，不要有其他任何内容`;

        const userPrompt = `我正在解决这道编程题：「${problemInfo.problem_statement}」，使用 ${language} 语言。

截图中包含我的代码和错误信息/测试结果。请：
1. 分析我的代码存在的问题
2. 提供完整的修复后代码（不是代码片段，是完整可运行的代码）
3. 解释你做了哪些修改以及为什么`;

        if (mainWindow) {
          mainWindow.webContents.send("processing-status", {
            message: "Analyzing code and generating debug feedback...",
            progress: 60
          });
        }

        if (config.apiProvider === "zhipu") {
          // Zhipu: Use native HTTP request for vision
          // Build content array with text first, then ALL images
          const contentArray: any[] = [
            {
              type: "text",
              text: `${systemPrompt}\n\n${userPrompt}`
            }
          ];

          // Add all screenshots to the request
          for (const imageData of imageDataList) {
            const imageUrl = imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`;
            contentArray.push({
              type: "image_url",
              image_url: { url: imageUrl }
            });
          }

          console.log(`Debug mode: sending ${imageDataList.length} screenshots to Zhipu API`);

          const zhipuMessages = [
            {
              role: "user",
              content: contentArray
            }
          ];

          // Increase timeout for multiple images (60s per image, minimum 120s)
          const debugTimeout = Math.max(120000, imageDataList.length * 60000);
          console.log(`Debug mode timeout: ${debugTimeout / 1000}s for ${imageDataList.length} images`);
          const zhipuResponse = await this.callZhipuAPI(zhipuMessages, debuggingModel, debugTimeout);
          debugContent = zhipuResponse.choices[0].message.content;
        } else {
          // OpenAI/Deepseek: Use OpenAI SDK
          const debugMessages = [
            {
              role: "system" as const,
              content: systemPrompt
            },
            {
              role: "user" as const,
              content: [
                {
                  type: "text" as const,
                  text: userPrompt
                },
                ...imageDataList.map(data => ({
                  type: "image_url" as const,
                  image_url: { url: `data:image/png;base64,${data}` }
                }))
              ]
            }
          ];

          const debugResponse = await this.openaiClient.chat.completions.create({
            model: debuggingModel,
            messages: debugMessages,
            max_tokens: 4000,
            temperature: 0.2
          });

          debugContent = debugResponse.choices[0].message.content;
        }
      } else if (config.apiProvider === "gemini") {
        if (!this.geminiApiKey) {
          return {
            success: false,
            error: "Gemini API key not configured. Please check your settings."
          };
        }
        
        try {
          const debugPrompt = `
You are a coding interview assistant helping debug and improve solutions. Analyze these screenshots which include either error messages, incorrect outputs, or test cases, and provide detailed debugging help.

I'm solving this coding problem: "${problemInfo.problem_statement}" in ${language}. I need help with debugging or improving my solution.

YOUR RESPONSE MUST FOLLOW THIS EXACT STRUCTURE WITH THESE SECTION HEADERS:
### Issues Identified
- List each issue as a bullet point with clear explanation

### Specific Improvements and Corrections
- List specific code changes needed as bullet points

### Optimizations
- List any performance optimizations if applicable

### Explanation of Changes Needed
Here provide a clear explanation of why the changes are needed

### Key Points
- Summary bullet points of the most important takeaways

If you include code examples, use proper markdown code blocks with language specification (e.g. \`\`\`java).
`;

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
              message: "Analyzing code and generating debug feedback with Gemini...",
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
            throw new Error("Empty response from Gemini API");
          }
          
          debugContent = responseData.candidates[0].content.parts[0].text;
        } catch (error) {
          console.error("Error using Gemini API for debugging:", error);
          return {
            success: false,
            error: "Failed to process debug request with Gemini API. Please check your API key or try again later."
          };
        }
      } else if (config.apiProvider === "anthropic") {
        if (!this.anthropicClient) {
          return {
            success: false,
            error: "Anthropic API key not configured. Please check your settings."
          };
        }
        
        try {
          const debugPrompt = `
You are a coding interview assistant helping debug and improve solutions. Analyze these screenshots which include either error messages, incorrect outputs, or test cases, and provide detailed debugging help.

I'm solving this coding problem: "${problemInfo.problem_statement}" in ${language}. I need help with debugging or improving my solution.

YOUR RESPONSE MUST FOLLOW THIS EXACT STRUCTURE WITH THESE SECTION HEADERS:
### Issues Identified
- List each issue as a bullet point with clear explanation

### Specific Improvements and Corrections
- List specific code changes needed as bullet points

### Optimizations
- List any performance optimizations if applicable

### Explanation of Changes Needed
Here provide a clear explanation of why the changes are needed

### Key Points
- Summary bullet points of the most important takeaways

If you include code examples, use proper markdown code blocks with language specification.
`;

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
              message: "Analyzing code and generating debug feedback with Claude...",
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
          console.error("Error using Anthropic API for debugging:", error);
          
          // Add specific handling for Claude's limitations
          if (error.status === 429) {
            return {
              success: false,
              error: "Claude API rate limit exceeded. Please wait a few minutes before trying again."
            };
          } else if (error.status === 413 || (error.message && error.message.includes("token"))) {
            return {
              success: false,
              error: "Your screenshots contain too much information for Claude to process. Switch to OpenAI or Gemini in settings which can handle larger inputs."
            };
          }
          
          return {
            success: false,
            error: "Failed to process debug request with Anthropic API. Please check your API key or try again later."
          };
        }
      }
      
      
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Debug analysis complete",
          progress: 100
        });
      }

      // Try to parse JSON response from debug mode
      let extractedCode = "// 调试模式 - 见下方分析";
      let thoughts: string[] = ["基于截图的调试分析"];
      let formattedDebugContent = debugContent;

      // Helper function to extract code from markdown code block
      const extractCodeFromMarkdown = (text: string): string => {
        const codeMatch = text.match(/```(?:[a-zA-Z]+)?\s*([\s\S]*?)```/);
        if (codeMatch && codeMatch[1]) {
          return codeMatch[1].trim();
        }
        // Try with double backticks (AI sometimes returns ``go instead of ```go)
        const codeMatch2 = text.match(/``(?:[a-zA-Z]+)?\s*([\s\S]*?)``/);
        if (codeMatch2 && codeMatch2[1]) {
          return codeMatch2[1].trim();
        }
        return text;
      };

      try {
        // First, try to find JSON object pattern directly (handles nested code blocks better)
        let debugData: any = null;

        // Try to extract JSON using a more robust pattern
        const jsonObjectMatch = debugContent.match(/\{[\s\S]*"fixed_code"[\s\S]*"explanation"[\s\S]*\}/);
        if (jsonObjectMatch) {
          let jsonStr = jsonObjectMatch[0];

          // Fix common JSON issues (Chinese quotes, etc.)
          jsonStr = this.fixChineseQuotesInJson(jsonStr);

          // Try to parse and repair JSON
          const { jsonrepair } = require('jsonrepair');
          const repairedJson = jsonrepair(jsonStr);
          debugData = JSON.parse(repairedJson);
        }

        if (debugData) {
          // Extract fixed code
          if (debugData.fixed_code) {
            // Remove markdown code block markers if present
            extractedCode = extractCodeFromMarkdown(debugData.fixed_code);
          }

          // Build formatted analysis content
          const sections: string[] = [];

          if (debugData.issues && debugData.issues.length > 0) {
            sections.push("## 发现的问题\n" + debugData.issues.map((issue: string) => `- ${issue}`).join("\n"));
            thoughts = debugData.issues.slice(0, 3);
          }

          if (debugData.changes && debugData.changes.length > 0) {
            sections.push("## 修改内容\n" + debugData.changes.map((change: string) => `- ${change}`).join("\n"));
          }

          if (debugData.explanation) {
            sections.push("## 详细解释\n" + debugData.explanation);
          }

          if (sections.length > 0) {
            formattedDebugContent = sections.join("\n\n");
          }

          console.log("Debug JSON parsed successfully");
        } else {
          throw new Error("No valid JSON object found");
        }
      } catch (parseError) {
        console.warn("Failed to parse debug JSON, falling back to regex extraction:", parseError);

        // Fallback: try to extract code from markdown code block
        extractedCode = extractCodeFromMarkdown(debugContent);

        // Fallback: extract bullet points as thoughts
        const bulletPoints = debugContent.match(/(?:^|\n)[ ]*(?:[-*•]|\d+\.)[ ]+([^\n]+)/g);
        if (bulletPoints) {
          thoughts = bulletPoints.map(point => point.replace(/^[ ]*(?:[-*•]|\d+\.)[ ]+/, '').trim()).slice(0, 5);
        }
      }

      const response = {
        code: extractedCode,
        debug_analysis: formattedDebugContent,
        thoughts: thoughts,
        time_complexity: "N/A - 调试模式",
        space_complexity: "N/A - 调试模式"
      };

      return { success: true, data: response };
    } catch (error: any) {
      console.error("Debug processing error:", error);
      return { success: false, error: error.message || "Failed to process debug request" };
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
