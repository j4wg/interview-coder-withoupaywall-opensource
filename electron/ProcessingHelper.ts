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
  zhipu: 'https://open.bigmodel.cn/api/paas/v4'
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

      // OpenAI, Deepseek, and Zhipu all use OpenAI-compatible API
      if (config.apiProvider === "openai" || config.apiProvider === "deepseek" || config.apiProvider === "zhipu") {
        // Verify OpenAI-compatible client
        if (!this.openaiClient) {
          this.initializeAIClient(); // Try to reinitialize

          if (!this.openaiClient) {
            const providerName = config.apiProvider === "deepseek" ? "Deepseek" :
                                 config.apiProvider === "zhipu" ? "Zhipu/GLM" : "OpenAI";
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
        } else {
          extractionModel = extractionModel || "gpt-4o";
        }

        // Build messages based on provider
        let messages;

        let extractionResponse;

        if (config.apiProvider === "zhipu") {
          // Zhipu GLM-4V: Use native HTTP request to bypass OpenAI SDK quirks
          const systemPrompt = "You are a coding challenge interpreter. Analyze the screenshot of the coding problem and extract all relevant information. Return the information in JSON format with these fields: problem_statement, constraints, example_input, example_output. Just return the structured JSON without any other text.";

          // For Zhipu, use only the first image if multiple
          const firstImage = imageDataList[0];
          const imageUrl = firstImage.startsWith('data:') ? firstImage : `data:image/png;base64,${firstImage}`;

          const zhipuMessages = [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `${systemPrompt}\n\nExtract the coding problem details from this screenshot. Return in JSON format. Preferred coding language we gonna use for this problem is ${language}.`
                },
                {
                  type: "image_url",
                  image_url: { url: imageUrl }
                }
              ]
            }
          ];

          extractionResponse = await this.callZhipuAPI(zhipuMessages, extractionModel, 60000);
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

请严格按以下格式回答：
1. **代码**：提供一个简洁、高效的 ${language} 实现（代码注释用中文）
2. **解题思路**：用中文列出你的关键思路和推理过程，例如：
   - **回溯法**：我们使用回溯法探索所有可能的组合...
   - **剪枝优化**：当某个条件不满足时提前终止...
3. **时间复杂度**：O(X)，用中文详细解释原因（至少2句话）
4. **空间复杂度**：O(X)，用中文详细解释原因（至少2句话）

**注意**：解题思路、复杂度分析等所有说明文字必须是中文！代码中的注释也要用中文！
`;

      let responseContent;

      // OpenAI, Deepseek, and Zhipu all use OpenAI-compatible API
      if (config.apiProvider === "openai" || config.apiProvider === "deepseek" || config.apiProvider === "zhipu") {
        if (!this.openaiClient) {
          const providerName = config.apiProvider === "deepseek" ? "Deepseek" :
                               config.apiProvider === "zhipu" ? "Zhipu/GLM" : "OpenAI";
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
          // OpenAI/Deepseek: Use OpenAI SDK
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
      
      // Extract parts from the response
      const codeMatch = responseContent.match(/```(?:\w+)?\s*([\s\S]*?)```/);
      const code = codeMatch ? codeMatch[1].trim() : responseContent;
      
      // Extract thoughts, looking for bullet points or numbered lists (supports both English and Chinese)
      const thoughtsRegex = /(?:Thoughts:|Key Insights:|Reasoning:|Approach:|解题思路|思路|关键思路)[：:]?\s*([\s\S]*?)(?:Time complexity:|时间复杂度|$)/i;
      const thoughtsMatch = responseContent.match(thoughtsRegex);
      let thoughts: string[] = [];

      if (thoughtsMatch && thoughtsMatch[1]) {
        // Extract bullet points - be careful not to match markdown bold (**text**)
        // Only match single dash/asterisk at line start, not double asterisks
        const bulletPoints = thoughtsMatch[1].match(/(?:^|\n)\s*(?:[-•]|\d+\.)\s+(.+)/g);
        if (bulletPoints) {
          thoughts = bulletPoints.map(point =>
            point.replace(/^\s*(?:[-•]|\d+\.)\s+/, '').trim()
          ).filter(Boolean);
        } else {
          // If no bullet points found, split by newlines and filter empty lines
          // Keep markdown formatting intact
          thoughts = thoughtsMatch[1].split('\n')
            .map((line) => line.trim())
            .filter(line => {
              // Filter out empty lines, code blocks, and orphaned markdown markers
              if (!line || line.startsWith('```')) return false;
              // Filter out lines that are only asterisks or markdown markers
              if (/^[\*\-_]+$/.test(line)) return false;
              return true;
            });
        }
      }
      
      // Extract complexity information (supports both English and Chinese)
      const timeComplexityPattern = /(?:Time complexity|时间复杂度)[：:]?\s*([^\n]+(?:\n[^\n]+)*?)(?=\n\s*(?:Space complexity|空间复杂度|$))/i;
      const spaceComplexityPattern = /(?:Space complexity|空间复杂度)[：:]?\s*([^\n]+(?:\n[^\n]+)*?)(?=\n\s*(?:[A-Z#]|$))/i;
      
      let timeComplexity = "O(n) - 线性时间复杂度，因为我们只遍历数组一次。每个元素只处理一次，哈希表查找是 O(1) 操作。";
      let spaceComplexity = "O(n) - 线性空间复杂度，因为我们在哈希表中存储元素。最坏情况下需要存储所有元素。";
      
      const timeMatch = responseContent.match(timeComplexityPattern);
      if (timeMatch && timeMatch[1]) {
        timeComplexity = timeMatch[1].trim();
        if (!timeComplexity.match(/O\([^)]+\)/i)) {
          timeComplexity = `O(n) - ${timeComplexity}`;
        } else if (!timeComplexity.includes('-') && !timeComplexity.includes('because')) {
          const notationMatch = timeComplexity.match(/O\([^)]+\)/i);
          if (notationMatch) {
            const notation = notationMatch[0];
            const rest = timeComplexity.replace(notation, '').trim();
            timeComplexity = `${notation} - ${rest}`;
          }
        }
      }
      
      const spaceMatch = responseContent.match(spaceComplexityPattern);
      if (spaceMatch && spaceMatch[1]) {
        spaceComplexity = spaceMatch[1].trim();
        if (!spaceComplexity.match(/O\([^)]+\)/i)) {
          spaceComplexity = `O(n) - ${spaceComplexity}`;
        } else if (!spaceComplexity.includes('-') && !spaceComplexity.includes('because')) {
          const notationMatch = spaceComplexity.match(/O\([^)]+\)/i);
          if (notationMatch) {
            const notation = notationMatch[0];
            const rest = spaceComplexity.replace(notation, '').trim();
            spaceComplexity = `${notation} - ${rest}`;
          }
        }
      }

      const formattedResponse = {
        code: code,
        thoughts: thoughts.length > 0 ? thoughts : ["基于效率和可读性的解题方法"],
        time_complexity: timeComplexity,
        space_complexity: spaceComplexity
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

      // OpenAI, Deepseek, and Zhipu all use OpenAI-compatible API
      if (config.apiProvider === "openai" || config.apiProvider === "deepseek" || config.apiProvider === "zhipu") {
        if (!this.openaiClient) {
          const providerName = config.apiProvider === "deepseek" ? "Deepseek" :
                               config.apiProvider === "zhipu" ? "Zhipu/GLM" : "OpenAI";
          return {
            success: false,
            error: `${providerName} API key not configured. Please check your settings.`
          };
        }

        // Get the appropriate model for the provider
        let debuggingModel = config.debuggingModel;
        if (config.apiProvider === "deepseek") {
          debuggingModel = debuggingModel || "deepseek-chat";
        } else if (config.apiProvider === "zhipu") {
          // GLM-4V models support vision
          debuggingModel = debuggingModel || "glm-4v-flash";
        } else {
          debuggingModel = debuggingModel || "gpt-4o";
        }

        const systemPrompt = `You are a coding interview assistant helping debug and improve solutions. Analyze these screenshots which include either error messages, incorrect outputs, or test cases, and provide detailed debugging help.

Your response MUST follow this exact structure with these section headers (use ### for headers):
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

If you include code examples, use proper markdown code blocks with language specification (e.g. \`\`\`java).`;

        const userPrompt = `I'm solving this coding problem: "${problemInfo.problem_statement}" in ${language}. I need help with debugging or improving my solution. Here are screenshots of my code, the errors or test cases. Please provide a detailed analysis with:
1. What issues you found in my code
2. Specific improvements and corrections
3. Any optimizations that would make the solution better
4. A clear explanation of the changes needed`;

        if (mainWindow) {
          mainWindow.webContents.send("processing-status", {
            message: "Analyzing code and generating debug feedback...",
            progress: 60
          });
        }

        if (config.apiProvider === "zhipu") {
          // Zhipu: Use native HTTP request for vision
          const firstImage = imageDataList[0];
          const imageUrl = firstImage.startsWith('data:') ? firstImage : `data:image/png;base64,${firstImage}`;

          const zhipuMessages = [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `${systemPrompt}\n\n${userPrompt}`
                },
                {
                  type: "image_url",
                  image_url: { url: imageUrl }
                }
              ]
            }
          ];

          const zhipuResponse = await this.callZhipuAPI(zhipuMessages, debuggingModel, 120000);
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

      let extractedCode = "// Debug mode - see analysis below";
      const codeMatch = debugContent.match(/```(?:[a-zA-Z]+)?([\s\S]*?)```/);
      if (codeMatch && codeMatch[1]) {
        extractedCode = codeMatch[1].trim();
      }

      let formattedDebugContent = debugContent;
      
      if (!debugContent.includes('# ') && !debugContent.includes('## ')) {
        formattedDebugContent = debugContent
          .replace(/issues identified|problems found|bugs found/i, '## Issues Identified')
          .replace(/code improvements|improvements|suggested changes/i, '## Code Improvements')
          .replace(/optimizations|performance improvements/i, '## Optimizations')
          .replace(/explanation|detailed analysis/i, '## Explanation');
      }

      const bulletPoints = formattedDebugContent.match(/(?:^|\n)[ ]*(?:[-*•]|\d+\.)[ ]+([^\n]+)/g);
      const thoughts = bulletPoints 
        ? bulletPoints.map(point => point.replace(/^[ ]*(?:[-*•]|\d+\.)[ ]+/, '').trim()).slice(0, 5)
        : ["Debug analysis based on your screenshots"];
      
      const response = {
        code: extractedCode,
        debug_analysis: formattedDebugContent,
        thoughts: thoughts,
        time_complexity: "N/A - Debug mode",
        space_complexity: "N/A - Debug mode"
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
