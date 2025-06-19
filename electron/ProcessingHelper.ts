// ProcessingHelper.ts
import fs from "node:fs";
import path from "node:path";
import { ScreenshotHelper } from "./ScreenshotHelper";
import { IProcessingHelperDeps } from "./main";
import * as axios from "axios";
import { app, BrowserWindow, dialog } from "electron";
import { OpenAI } from "openai";
import { configHelper } from "./ConfigHelper";
import Anthropic from "@anthropic-ai/sdk";

// Interface for Gemini API requests
interface GeminiMessage {
  role: string;
  parts: Array<{
    text?: string;
    inlineData?: {
      mimeType: string;
      data: string;
    };
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
  role: "user" | "assistant";
  content: Array<{
    type: "text" | "image";
    text?: string;
    source?: {
      type: "base64";
      media_type: string;
      data: string;
    };
  }>;
}
export class ProcessingHelper {
  private deps: IProcessingHelperDeps;
  private screenshotHelper: ScreenshotHelper;
  private openaiClient: OpenAI | null = null;
  private geminiApiKey: string | null = null;
  private anthropicClient: Anthropic | null = null;

  // AbortControllers for API requests
  private currentProcessingAbortController: AbortController | null = null;
  private currentExtraProcessingAbortController: AbortController | null = null;

  constructor(deps: IProcessingHelperDeps) {
    this.deps = deps;
    this.screenshotHelper = deps.getScreenshotHelper();

    // Initialize AI client based on config
    this.initializeAIClient();

    // Listen for config changes to re-initialize the AI client
    configHelper.on("config-updated", () => {
      this.initializeAIClient();
    });
  }

  /**
   * Initialize or reinitialize the AI client with current config
   */
  private initializeAIClient(): void {
    console.log("🔄 Initializing AI client...");
    try {
      const config = configHelper.loadConfig();
      console.log(
        `📋 Config loaded - API Provider: ${
          config.apiProvider
        }, Has API Key: ${!!config.apiKey}`
      );

      if (config.apiProvider === "openai") {
        if (config.apiKey) {
          console.log("🔑 Initializing OpenAI client with provided API key");
          this.openaiClient = new OpenAI({
            apiKey: config.apiKey,
            timeout: 60000, // 60 second timeout
            maxRetries: 2, // Retry up to 2 times
          });
          this.geminiApiKey = null;
          this.anthropicClient = null;
          console.log("✅ OpenAI client initialized successfully");
        } else {
          this.openaiClient = null;
          this.geminiApiKey = null;
          this.anthropicClient = null;
          console.warn(
            "⚠️ No API key available, OpenAI client not initialized"
          );
        }
      } else if (config.apiProvider === "gemini") {
        // Gemini client initialization
        console.log("🔑 Initializing Gemini client");
        this.openaiClient = null;
        this.anthropicClient = null;
        if (config.apiKey) {
          this.geminiApiKey = config.apiKey;
          console.log("✅ Gemini API key set successfully");
        } else {
          this.openaiClient = null;
          this.geminiApiKey = null;
          this.anthropicClient = null;
          console.warn(
            "⚠️ No API key available, Gemini client not initialized"
          );
        }
      } else if (config.apiProvider === "anthropic") {
        // Reset other clients
        console.log("🔑 Initializing Anthropic client");
        this.openaiClient = null;
        this.geminiApiKey = null;
        if (config.apiKey) {
          this.anthropicClient = new Anthropic({
            apiKey: config.apiKey,
            timeout: 60000,
            maxRetries: 2,
          });
          console.log("✅ Anthropic client initialized successfully");
        } else {
          this.openaiClient = null;
          this.geminiApiKey = null;
          this.anthropicClient = null;
          console.warn(
            "⚠️ No API key available, Anthropic client not initialized"
          );
        }
      }
    } catch (error) {
      console.error("❌ Failed to initialize AI client:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      this.openaiClient = null;
      this.geminiApiKey = null;
      this.anthropicClient = null;
    }
  }

  private async waitForInitialization(
    mainWindow: BrowserWindow
  ): Promise<void> {
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds total

    while (attempts < maxAttempts) {
      const isInitialized = await mainWindow.webContents.executeJavaScript(
        "window.__IS_INITIALIZED__"
      );
      if (isInitialized) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }
    throw new Error("App failed to initialize after 5 seconds");
  }

  private async getCredits(): Promise<number> {
    const mainWindow = this.deps.getMainWindow();
    if (!mainWindow) return 999; // Unlimited credits in this version

    try {
      await this.waitForInitialization(mainWindow);
      return 999; // Always return sufficient credits to work
    } catch (error) {
      console.error("Error getting credits:", error);
      return 999; // Unlimited credits as fallback
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
      const mainWindow = this.deps.getMainWindow();
      if (mainWindow) {
        try {
          await this.waitForInitialization(mainWindow);
          const language = await mainWindow.webContents.executeJavaScript(
            "window.__LANGUAGE__"
          );

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
      console.error("Error getting language:", error);
      return "python";
    }
  }

  public async processScreenshots(): Promise<void> {
    console.log("🚀 Starting screenshot processing...");
    const mainWindow = this.deps.getMainWindow();
    if (!mainWindow) {
      console.error("❌ No main window available for processing");
      return;
    }

    const config = configHelper.loadConfig();
    console.log(
      `📋 Processing with config - Provider: ${config.apiProvider}, Mode: ${
        config.questionMode || "coding"
      }`
    );

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

    const view = this.deps.getView();
    console.log("Processing screenshots in view:", view);

    if (view === "queue") {
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.INITIAL_START);
      const screenshotQueue = this.screenshotHelper.getScreenshotQueue();
      console.log("Processing main queue screenshots:", screenshotQueue);

      // Check if the queue is empty
      if (!screenshotQueue || screenshotQueue.length === 0) {
        console.log("No screenshots found in queue");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }

      // Check that files actually exist
      const existingScreenshots = screenshotQueue.filter((path) =>
        fs.existsSync(path)
      );
      if (existingScreenshots.length === 0) {
        console.log("Screenshot files don't exist on disk");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }

      try {
        // Initialize AbortController
        this.currentProcessingAbortController = new AbortController();
        const { signal } = this.currentProcessingAbortController;

        const screenshots = await Promise.all(
          existingScreenshots.map(async (path) => {
            try {
              return {
                path,
                preview: await this.screenshotHelper.getImagePreview(path),
                data: fs.readFileSync(path).toString("base64"),
              };
            } catch (err) {
              console.error(`Error reading screenshot ${path}:`, err);
              return null;
            }
          })
        );

        // Filter out any nulls from failed screenshots
        const validScreenshots = screenshots.filter(Boolean);

        if (validScreenshots.length === 0) {
          throw new Error("Failed to load screenshot data");
        }

        const result = await this.processScreenshotsHelper(
          validScreenshots,
          signal
        );

        if (!result.success) {
          console.log("Processing failed:", result.error);
          if (
            result.error?.includes("API Key") ||
            result.error?.includes("OpenAI") ||
            result.error?.includes("Gemini")
          ) {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.API_KEY_INVALID
            );
          } else {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
              result.error
            );
          }
          // Reset view back to queue on error
          console.log("Resetting view to queue due to error");
          this.deps.setView("queue");
          return;
        }

        // Only set view to solutions if processing succeeded
        console.log("Setting view to solutions after successful processing");
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
          result.data
        );
        this.deps.setView("solutions");
      } catch (error: any) {
        console.error("❌ Critical processing error occurred:", error);
        console.error("🔍 Error details:", {
          message: error.message,
          stack: error.stack,
          name: error.name,
          code: error.code,
          status: error.status,
          response: error.response?.data,
        });

        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
          error
        );

        if (axios.isCancel(error)) {
          console.log("🚫 Processing was canceled by the user");
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            "Processing was canceled by the user."
          );
        } else {
          console.error(
            "🔴 Sending error to UI:",
            error.message || "Server error. Please try again."
          );
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            error.message || "Server error. Please try again."
          );
        }
        // Reset view back to queue on error
        console.log("🔄 Resetting view to queue due to error");
        this.deps.setView("queue");
      } finally {
        console.log("🧹 Cleaning up processing controller");
        this.currentProcessingAbortController = null;
      }
    } else {
      // view == 'solutions'
      const extraScreenshotQueue =
        this.screenshotHelper.getExtraScreenshotQueue();
      console.log("Processing extra queue screenshots:", extraScreenshotQueue);

      // Check if the extra queue is empty
      if (!extraScreenshotQueue || extraScreenshotQueue.length === 0) {
        console.log("No extra screenshots found in queue");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);

        return;
      }

      // Check that files actually exist
      const existingExtraScreenshots = extraScreenshotQueue.filter((path) =>
        fs.existsSync(path)
      );
      if (existingExtraScreenshots.length === 0) {
        console.log("Extra screenshot files don't exist on disk");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }

      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.DEBUG_START);

      // Initialize AbortController
      this.currentExtraProcessingAbortController = new AbortController();
      const { signal } = this.currentExtraProcessingAbortController;

      try {
        // Get all screenshots (both main and extra) for processing
        const allPaths = [
          ...this.screenshotHelper.getScreenshotQueue(),
          ...existingExtraScreenshots,
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
                data: fs.readFileSync(path).toString("base64"),
              };
            } catch (err) {
              console.error(`Error reading screenshot ${path}:`, err);
              return null;
            }
          })
        );

        // Filter out any nulls from failed screenshots
        const validScreenshots = screenshots.filter(Boolean);

        if (validScreenshots.length === 0) {
          throw new Error("Failed to load screenshot data for debugging");
        }

        console.log(
          "Combined screenshots for processing:",
          validScreenshots.map((s) => s.path)
        );

        const result = await this.processExtraScreenshotsHelper(
          validScreenshots,
          signal
        );

        if (result.success) {
          this.deps.setHasDebugged(true);
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_SUCCESS,
            result.data
          );
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            result.error
          );
        }
      } catch (error: any) {
        if (axios.isCancel(error)) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            "Extra processing was canceled by the user."
          );
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            error.message
          );
        }
      } finally {
        this.currentExtraProcessingAbortController = null;
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
      const imageDataList = screenshots.map((screenshot) => screenshot.data);

      // Update the user on progress
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Analyzing problem from screenshots...",
          progress: 20,
        });
      }

      let problemInfo;

      if (config.apiProvider === "openai") {
        // Verify OpenAI client
        if (!this.openaiClient) {
          this.initializeAIClient(); // Try to reinitialize

          if (!this.openaiClient) {
            return {
              success: false,
              error:
                "OpenAI API key not configured or invalid. Please check your settings.",
            };
          }
        }

        // Use OpenAI for processing
        let messages;

        if (config.questionMode === "general") {
          // Handle general questions
          messages = [
            {
              role: "system" as const,
              content:
                "You are an interview assistant. Analyze the screenshot and extract the interview question information. Return the information in JSON format with these fields: question, question_type (multiple_choice, true_false, short_answer, essay, or explanation), options (array of choices if multiple choice), context, topic. Just return the structured JSON without any other text.",
            },
            {
              role: "user" as const,
              content: [
                {
                  type: "text" as const,
                  text: "Extract the interview question details from these screenshots. Return in JSON format. Identify the question type and any multiple choice options if present.",
                },
                ...imageDataList.map((data) => ({
                  type: "image_url" as const,
                  image_url: { url: `data:image/png;base64,${data}` },
                })),
              ],
            },
          ];
        } else {
          // Handle coding problems (existing logic)
          messages = [
            {
              role: "system" as const,
              content:
                "You are a coding challenge interpreter. Analyze the screenshot of the coding problem and extract all relevant information. Return the information in JSON format with these fields: problem_statement, constraints, example_input, example_output. Just return the structured JSON without any other text.",
            },
            {
              role: "user" as const,
              content: [
                {
                  type: "text" as const,
                  text: `Extract the coding problem details from these screenshots. Return in JSON format. Preferred coding language we gonna use for this problem is ${language}.`,
                },
                ...imageDataList.map((data) => ({
                  type: "image_url" as const,
                  image_url: { url: `data:image/png;base64,${data}` },
                })),
              ],
            },
          ];
        }

        // Send to OpenAI Vision API
        console.log("📡 Sending request to OpenAI Vision API...");
        console.log(`🔧 Using model: ${config.extractionModel || "gpt-4o"}`);
        console.log(`📸 Processing ${imageDataList.length} screenshots`);

        try {
          const extractionResponse =
            await this.openaiClient.chat.completions.create({
              model: config.extractionModel || "gpt-4o",
              messages: messages,
              max_tokens: 4000,
              temperature: 0.2,
            });

          console.log("✅ OpenAI API response received");
          console.log(
            `📊 Response usage: ${JSON.stringify(extractionResponse.usage)}`
          );

          // Parse the response
          try {
            const responseText = extractionResponse.choices[0].message.content;
            console.log(
              "📝 Raw OpenAI response:",
              responseText?.substring(0, 200) + "..."
            );

            // Handle when OpenAI might wrap the JSON in markdown code blocks
            const jsonText = responseText.replace(/```json|```/g, "").trim();
            problemInfo = JSON.parse(jsonText);
            console.log(
              "✅ Successfully parsed problem information from OpenAI"
            );
            console.log("📋 Extracted fields:", Object.keys(problemInfo));
          } catch (parseError) {
            console.error("❌ Error parsing OpenAI response:", parseError);
            console.error(
              "🔍 Response content:",
              extractionResponse.choices[0].message.content
            );
            return {
              success: false,
              error:
                "Failed to parse problem information. Please try again or use clearer screenshots.",
            };
          }
        } catch (apiError) {
          console.error("❌ OpenAI API call failed:", apiError);
          console.error("🔍 Error details:", {
            message: apiError.message,
            status: apiError.status,
            code: apiError.code,
            type: apiError.type,
          });
          return {
            success: false,
            error: `OpenAI API error: ${apiError.message}. Please check your API key and try again.`,
          };
        }
      } else if (config.apiProvider === "gemini") {
        // Use Gemini API
        if (!this.geminiApiKey) {
          return {
            success: false,
            error: "Gemini API key not configured. Please check your settings.",
          };
        }

        try {
          // Create Gemini message structure
          let geminiMessages: GeminiMessage[];

          if (config.questionMode === "general") {
            geminiMessages = [
              {
                role: "user",
                parts: [
                  {
                    text: "You are an interview assistant. Analyze the screenshot and extract the interview question information. Return the information in JSON format with these fields: question, question_type (multiple_choice, true_false, short_answer, essay, or explanation), options (array of choices if multiple choice), context, topic. Just return the structured JSON without any other text.",
                  },
                  ...imageDataList.map((data) => ({
                    inlineData: {
                      mimeType: "image/png",
                      data: data,
                    },
                  })),
                ],
              },
            ];
          } else {
            geminiMessages = [
              {
                role: "user",
                parts: [
                  {
                    text: `You are a coding challenge interpreter. Analyze the screenshots of the coding problem and extract all relevant information. Return the information in JSON format with these fields: problem_statement, constraints, example_input, example_output. Just return the structured JSON without any other text. Preferred coding language we gonna use for this problem is ${language}.`,
                  },
                  ...imageDataList.map((data) => ({
                    inlineData: {
                      mimeType: "image/png",
                      data: data,
                    },
                  })),
                ],
              },
            ];
          }

          // Make API request to Gemini
          console.log("📡 Sending request to Gemini API...");
          console.log(
            `🔧 Using model: ${config.extractionModel || "gemini-2.0-flash"}`
          );
          console.log(`📸 Processing ${imageDataList.length} screenshots`);

          const response = await axios.default.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${
              config.extractionModel || "gemini-2.0-flash"
            }:generateContent?key=${this.geminiApiKey}`,
            {
              contents: geminiMessages,
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 4000,
              },
            },
            { signal }
          );

          console.log("✅ Gemini API response received");
          console.log(`📊 Response status: ${response.status}`);

          const responseData = response.data as GeminiResponse;

          if (
            !responseData.candidates ||
            responseData.candidates.length === 0
          ) {
            console.error("❌ Empty response from Gemini API");
            console.error(
              "🔍 Full response:",
              JSON.stringify(responseData, null, 2)
            );
            throw new Error("Empty response from Gemini API");
          }

          const responseText = responseData.candidates[0].content.parts[0].text;
          console.log(
            "📝 Raw Gemini response:",
            responseText?.substring(0, 200) + "..."
          );

          // Handle when Gemini might wrap the JSON in markdown code blocks
          const jsonText = responseText.replace(/```json|```/g, "").trim();
          problemInfo = JSON.parse(jsonText);
          console.log("✅ Successfully parsed problem information from Gemini");
          console.log("📋 Extracted fields:", Object.keys(problemInfo));
        } catch (error) {
          console.error("❌ Error using Gemini API:", error);
          console.error("🔍 Error details:", {
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
          });
          return {
            success: false,
            error:
              "Failed to process with Gemini API. Please check your API key or try again later.",
          };
        }
      } else if (config.apiProvider === "anthropic") {
        if (!this.anthropicClient) {
          console.error("❌ Anthropic client not available");
          return {
            success: false,
            error:
              "Anthropic API key not configured. Please check your settings.",
          };
        }

        console.log("📡 Sending request to Anthropic API...");
        console.log(
          `🔧 Using model: ${
            config.extractionModel || "claude-3-7-sonnet-20250219"
          }`
        );
        console.log(`📸 Processing ${imageDataList.length} screenshots`);
        console.log(`🎯 Question mode: ${config.questionMode || "coding"}`);

        try {
          let messages;

          if (config.questionMode === "general") {
            console.log(
              "🔍 Preparing general question extraction for Anthropic"
            );
            messages = [
              {
                role: "user" as const,
                content: [
                  {
                    type: "text" as const,
                    text: "Extract the interview question details from these screenshots. Return in JSON format with exactly these fields: question (string), question_type (string: multiple_choice, true_false, short_answer, essay, or explanation), options (array of strings if multiple choice, otherwise null), context (string or null), topic (string or null). Do not wrap in an array or add extra fields. Return only the flat JSON object.",
                  },
                  ...imageDataList.map((data) => ({
                    type: "image" as const,
                    source: {
                      type: "base64" as const,
                      media_type: "image/png" as const,
                      data: data,
                    },
                  })),
                ],
              },
            ];
          } else {
            console.log("🔍 Preparing coding problem extraction for Anthropic");
            messages = [
              {
                role: "user" as const,
                content: [
                  {
                    type: "text" as const,
                    text: `Extract the coding problem details from these screenshots. Return in JSON format with these fields: problem_statement, constraints, example_input, example_output. Preferred coding language is ${language}.`,
                  },
                  ...imageDataList.map((data) => ({
                    type: "image" as const,
                    source: {
                      type: "base64" as const,
                      media_type: "image/png" as const,
                      data: data,
                    },
                  })),
                ],
              },
            ];
          }

          console.log("⏳ Making Anthropic API call...");
          const response = await this.anthropicClient.messages.create({
            model: config.extractionModel || "claude-3-7-sonnet-20250219",
            max_tokens: 4000,
            messages: messages,
            temperature: 0.2,
          });

          console.log("✅ Anthropic API response received");
          console.log(`📊 Response usage: ${JSON.stringify(response.usage)}`);
          console.log(`🔤 Response type: ${response.content[0]?.type}`);

          const responseText = (
            response.content[0] as { type: "text"; text: string }
          ).text;
          console.log(
            "📝 Raw Anthropic response:",
            responseText?.substring(0, 200) + "..."
          );

          const jsonText = responseText.replace(/```json|```/g, "").trim();
          let parsedData = JSON.parse(jsonText);

          // Handle case where AI returns questions array instead of flat structure
          if (
            parsedData.questions &&
            Array.isArray(parsedData.questions) &&
            parsedData.questions.length > 0
          ) {
            console.log(
              "🔧 AI returned questions array, extracting first question"
            );
            problemInfo = parsedData.questions[0];
          } else {
            problemInfo = parsedData;
          }

          console.log(
            "✅ Successfully parsed problem information from Anthropic"
          );
          console.log("📋 Extracted fields:", Object.keys(problemInfo));
          console.log(
            "🔍 Question field:",
            problemInfo.question || "NOT FOUND"
          );
        } catch (error: any) {
          console.error("❌ Error using Anthropic API:", error);
          console.error("🔍 Anthropic error details:", {
            message: error.message,
            status: error.status,
            type: error.type,
            error_type: error.error?.type,
            error_message: error.error?.message,
            stack: error.stack,
          });

          // Add specific handling for Claude's limitations
          if (error.status === 429) {
            console.error("🚫 Anthropic rate limit hit");
            return {
              success: false,
              error:
                "Claude API rate limit exceeded. Please wait a few minutes before trying again.",
            };
          } else if (
            error.status === 413 ||
            (error.message && error.message.includes("token"))
          ) {
            console.error("📏 Anthropic token limit exceeded");
            return {
              success: false,
              error:
                "Your screenshots contain too much information for Claude to process. Switch to OpenAI or Gemini in settings which can handle larger inputs.",
            };
          }

          return {
            success: false,
            error:
              "Failed to process with Anthropic API. Please check your API key or try again later.",
          };
        }
      }

      // Update the user on progress
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message:
            "Problem analyzed successfully. Preparing to generate solution...",
          progress: 40,
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
        console.log("🎯 Starting solution generation...");
        const solutionsResult = await this.generateSolutionsHelper(signal);
        console.log(
          "🎯 Solution generation completed:",
          solutionsResult.success
        );

        if (solutionsResult.success) {
          console.log(
            "✅ Solution generation successful, preparing final response"
          );
          // Clear any existing extra screenshots before transitioning to solutions view
          this.screenshotHelper.clearExtraScreenshotQueue();

          // Final progress update
          console.log("📤 Sending final progress update to UI");
          mainWindow.webContents.send("processing-status", {
            message: "Solution generated successfully",
            progress: 100,
          });

          console.log("📤 Sending solution success event to UI");
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
            solutionsResult.data
          );
          console.log("✅ Processing pipeline completed successfully");
          return { success: true, data: solutionsResult.data };
        } else {
          console.error(
            "❌ Solution generation failed:",
            solutionsResult.error
          );
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
          error: "Processing was canceled by the user.",
        };
      }

      // Handle OpenAI API errors specifically
      if (error?.response?.status === 401) {
        return {
          success: false,
          error: "Invalid OpenAI API key. Please check your settings.",
        };
      } else if (error?.response?.status === 429) {
        return {
          success: false,
          error:
            "OpenAI API rate limit exceeded or insufficient credits. Please try again later.",
        };
      } else if (error?.response?.status === 500) {
        return {
          success: false,
          error: "OpenAI server error. Please try again later.",
        };
      }

      console.error("API Error Details:", error);
      return {
        success: false,
        error:
          error.message || "Failed to process screenshots. Please try again.",
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
          progress: 60,
        });
      }

      // Create prompt based on question mode
      let promptText;
      let systemPrompt;

      if (config.questionMode === "general") {
        // Handle general questions
        systemPrompt =
          "You are an expert interview assistant. Provide clear, detailed answers with explanations.";
        promptText = `
Answer the following interview question:

QUESTION: ${problemInfo.question || problemInfo.problem_statement}

QUESTION TYPE: ${problemInfo.question_type || "explanation"}

${
  problemInfo.options
    ? `OPTIONS:\n${problemInfo.options
        .map((opt: string, idx: number) => `${idx + 1}. ${opt}`)
        .join("\n")}`
    : ""
}

${problemInfo.context ? `CONTEXT: ${problemInfo.context}` : ""}

${problemInfo.topic ? `TOPIC: ${problemInfo.topic}` : ""}

I need the response in the following format:
1. Answer: The direct answer to the question
2. Explanation: A detailed explanation of why this is the correct answer
3. Reasoning: Key points that support your answer
4. Additional Notes: Any important context or related information

Your answer should be accurate, well-explained, and demonstrate deep understanding of the topic.
`;
      } else {
        // Handle coding problems (existing logic)
        systemPrompt =
          "You are an expert coding interview assistant. Provide clear, optimal solutions with detailed explanations.";
        promptText = `
Generate a detailed solution for the following coding problem:

PROBLEM STATEMENT:
${problemInfo.problem_statement}

CONSTRAINTS:
${problemInfo.constraints || "No specific constraints provided."}

EXAMPLE INPUT:
${problemInfo.example_input || "No example input provided."}

EXAMPLE OUTPUT:
${problemInfo.example_output || "No example output provided."}

LANGUAGE: ${language}

I need the response in the following format:
1. Code: A clean, optimized implementation in ${language}
2. Your Thoughts: A list of key insights and reasoning behind your approach
3. Time complexity: O(X) with a detailed explanation (at least 2 sentences)
4. Space complexity: O(X) with a detailed explanation (at least 2 sentences)

For complexity explanations, please be thorough. For example: "Time complexity: O(n) because we iterate through the array only once. This is optimal as we need to examine each element at least once to find the solution." or "Space complexity: O(n) because in the worst case, we store all elements in the hashmap. The additional space scales linearly with the input size."

Your solution should be efficient, well-commented, and handle edge cases.
`;
      }

      let responseContent;

      if (config.apiProvider === "openai") {
        // OpenAI processing
        if (!this.openaiClient) {
          return {
            success: false,
            error: "OpenAI API key not configured. Please check your settings.",
          };
        }

        // Send to OpenAI API
        console.log("📡 Sending solution request to OpenAI API...");
        console.log(
          `🔧 Using solution model: ${config.solutionModel || "gpt-4o"}`
        );
        console.log(`🎯 Question mode: ${config.questionMode || "coding"}`);

        try {
          const solutionResponse =
            await this.openaiClient.chat.completions.create({
              model: config.solutionModel || "gpt-4o",
              messages: [
                {
                  role: "system",
                  content: systemPrompt,
                },
                { role: "user", content: promptText },
              ],
              max_tokens: 4000,
              temperature: 0.2,
            });

          console.log("✅ OpenAI solution response received");
          console.log(
            `📊 Solution usage: ${JSON.stringify(solutionResponse.usage)}`
          );

          responseContent = solutionResponse.choices[0].message.content;
          console.log(
            "📝 Solution response length:",
            responseContent?.length || 0
          );
        } catch (solutionError) {
          console.error("❌ OpenAI solution API call failed:", solutionError);
          console.error("🔍 Solution error details:", {
            message: solutionError.message,
            status: solutionError.status,
            code: solutionError.code,
            type: solutionError.type,
          });
          return {
            success: false,
            error: `OpenAI solution error: ${solutionError.message}. Please check your API key and try again.`,
          };
        }
      } else if (config.apiProvider === "gemini") {
        // Gemini processing
        if (!this.geminiApiKey) {
          return {
            success: false,
            error: "Gemini API key not configured. Please check your settings.",
          };
        }

        try {
          // Create Gemini message structure
          const geminiMessages = [
            {
              role: "user",
              parts: [
                {
                  text: `${systemPrompt} ${promptText}`,
                },
              ],
            },
          ];

          // Make API request to Gemini
          const response = await axios.default.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${
              config.solutionModel || "gemini-2.0-flash"
            }:generateContent?key=${this.geminiApiKey}`,
            {
              contents: geminiMessages,
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 4000,
              },
            },
            { signal }
          );

          const responseData = response.data as GeminiResponse;

          if (
            !responseData.candidates ||
            responseData.candidates.length === 0
          ) {
            throw new Error("Empty response from Gemini API");
          }

          responseContent = responseData.candidates[0].content.parts[0].text;
        } catch (error) {
          console.error("Error using Gemini API for solution:", error);
          return {
            success: false,
            error:
              "Failed to generate solution with Gemini API. Please check your API key or try again later.",
          };
        }
      } else if (config.apiProvider === "anthropic") {
        // Anthropic processing
        if (!this.anthropicClient) {
          console.error("❌ Anthropic client not available for solution");
          return {
            success: false,
            error:
              "Anthropic API key not configured. Please check your settings.",
          };
        }

        console.log("📡 Sending solution request to Anthropic API...");
        console.log(
          `🔧 Using solution model: ${
            config.solutionModel || "claude-3-7-sonnet-20250219"
          }`
        );
        console.log(`🎯 Question mode: ${config.questionMode || "coding"}`);

        try {
          const messages = [
            {
              role: "user" as const,
              content: [
                {
                  type: "text" as const,
                  text: `${systemPrompt} ${promptText}`,
                },
              ],
            },
          ];

          console.log("⏳ Making Anthropic solution API call...");
          // Send to Anthropic API
          const response = await this.anthropicClient.messages.create({
            model: config.solutionModel || "claude-3-7-sonnet-20250219",
            max_tokens: 4000,
            messages: messages,
            temperature: 0.2,
          });

          console.log("✅ Anthropic solution response received");
          console.log(`📊 Solution usage: ${JSON.stringify(response.usage)}`);
          console.log(
            `🔤 Solution response type: ${response.content[0]?.type}`
          );

          responseContent = (
            response.content[0] as { type: "text"; text: string }
          ).text;
          console.log(
            "📝 Solution response length:",
            responseContent?.length || 0
          );
        } catch (error: any) {
          console.error("❌ Error using Anthropic API for solution:", error);
          console.error("🔍 Anthropic solution error details:", {
            message: error.message,
            status: error.status,
            type: error.type,
            error_type: error.error?.type,
            error_message: error.error?.message,
            stack: error.stack,
          });

          // Add specific handling for Claude's limitations
          if (error.status === 429) {
            console.error("🚫 Anthropic solution rate limit hit");
            return {
              success: false,
              error:
                "Claude API rate limit exceeded. Please wait a few minutes before trying again.",
            };
          } else if (
            error.status === 413 ||
            (error.message && error.message.includes("token"))
          ) {
            console.error("📏 Anthropic solution token limit exceeded");
            return {
              success: false,
              error:
                "Your screenshots contain too much information for Claude to process. Switch to OpenAI or Gemini in settings which can handle larger inputs.",
            };
          }

          return {
            success: false,
            error:
              "Failed to generate solution with Anthropic API. Please check your API key or try again later.",
          };
        }
      }

      // Parse response based on question mode
      let formattedResponse;

      if (config.questionMode === "general") {
        // Add debugging for general question response
        console.log("🔍 Raw general question response:");
        console.log("------- START RAW RESPONSE -------");
        console.log(responseContent);
        console.log("------- END RAW RESPONSE -------");

        // Parse general question response with flexible markdown and text patterns
        const answerMatch = responseContent.match(
          /(?:##\s*Answer|Answer:|1\.\s*Answer:)\s*([\s\S]*?)(?=\n\s*##\s*Explanation|\n\s*Explanation:|\n\s*2\.|$)/i
        );
        const explanationMatch = responseContent.match(
          /(?:##\s*Explanation|Explanation:|2\.\s*Explanation:)\s*([\s\S]*?)(?:##\s*Reasoning|Reasoning:|3\.|$)/i
        );
        const reasoningMatch = responseContent.match(
          /(?:##\s*Reasoning|Reasoning:|3\.\s*Reasoning:)\s*([\s\S]*?)(?:##\s*Additional Notes|Additional Notes:|4\.|$)/i
        );
        const notesMatch = responseContent.match(
          /(?:##\s*Additional Notes|Additional Notes:|4\.\s*Additional Notes:)\s*([\s\S]*?)$/i
        );

        // Add debugging for matches
        console.log("🎯 General question parsing results:");
        console.log("Answer match:", answerMatch ? "✅ Found" : "❌ Not found");
        console.log(
          "Explanation match:",
          explanationMatch ? "✅ Found" : "❌ Not found"
        );
        console.log(
          "Reasoning match:",
          reasoningMatch ? "✅ Found" : "❌ Not found"
        );
        console.log("Notes match:", notesMatch ? "✅ Found" : "❌ Not found");

        if (answerMatch) {
          console.log(
            "📝 Answer content preview:",
            answerMatch[1].substring(0, 100) + "..."
          );
        }
        if (explanationMatch) {
          console.log(
            "📝 Explanation content preview:",
            explanationMatch[1].substring(0, 100) + "..."
          );
        }

        // Extract reasoning points with better markdown handling
        let reasoning: string[] = [];
        if (reasoningMatch && reasoningMatch[1]) {
          // Split into lines and look for bullet points
          const lines = reasoningMatch[1].split("\n");
          const bulletLines = lines.filter((line) => {
            const trimmed = line.trim();
            return trimmed.match(/^[-*•]\s+/) || trimmed.match(/^\d+\.\s+/);
          });

          if (bulletLines.length > 0) {
            reasoning = bulletLines
              .map((line) => {
                // Clean up the line by removing bullet formatting and markdown
                return line
                  .replace(/^\s*[-*•]\s*/, "")
                  .replace(/^\s*\d+\.\s*/, "")
                  .replace(/\*\*(.*?)\*\*/g, "$1")
                  .replace(/`(.*?)`/g, "$1")
                  .trim();
              })
              .filter(Boolean);
          } else {
            // Fallback: split by lines and clean each line
            reasoning = reasoningMatch[1]
              .split("\n")
              .map((line) =>
                line
                  .replace(/\*\*(.*?)\*\*/g, "$1")
                  .replace(/`(.*?)`/g, "$1")
                  .trim()
              )
              .filter(Boolean)
              .filter((line) => line.length > 10); // Filter out very short lines
          }

          console.log("🔍 Extracted reasoning points:", reasoning.length);
          reasoning.forEach((point, idx) => {
            console.log(`  ${idx + 1}. ${point.substring(0, 50)}...`);
          });
        }

        // Clean up markdown formatting from extracted content
        const cleanMarkdown = (text: string) => {
          return text
            .replace(/\*\*(.*?)\*\*/g, "$1") // Remove bold markdown
            .replace(/\*(.*?)\*/g, "$1") // Remove italic markdown
            .replace(/`(.*?)`/g, "$1") // Remove code markdown
            .replace(
              /^\s*The correct answer is:\s*$/i,
              "The correct answer is: (Answer not properly extracted)"
            ) // Handle incomplete answer
            .trim();
        };

        // Special handling for answer text to preserve content after "The correct answer is:"
        const cleanAnswerText = (text: string) => {
          console.log(
            "🔍 Raw answer text for cleaning:",
            text.substring(0, 150) + "..."
          );

          // Simple approach: just clean the markdown from the entire text
          const cleaned = text
            .replace(/\*\*(.*?)\*\*/g, "$1") // Remove bold markdown
            .replace(/\*(.*?)\*/g, "$1") // Remove italic markdown
            .replace(/`(.*?)`/g, "$1") // Remove code markdown
            .trim();

          console.log("✅ Cleaned answer text:", cleaned);
          return cleaned;
        };

        const answerText = answerMatch
          ? cleanAnswerText(answerMatch[1])
          : responseContent.substring(0, 200) + "...";
        const explanationText = explanationMatch
          ? cleanMarkdown(explanationMatch[1])
          : "See full response above";
        const notesText = notesMatch ? cleanMarkdown(notesMatch[1]) : "";

        console.log(
          "🧹 Cleaned answer text:",
          answerText.substring(0, 100) + "..."
        );
        console.log(
          "🔍 Original answer match:",
          answerMatch ? answerMatch[1].substring(0, 100) + "..." : "No match"
        );
        console.log(
          "🧹 Cleaned explanation text:",
          explanationText.substring(0, 100) + "..."
        );

        formattedResponse = {
          code: answerText,
          thoughts:
            reasoning.length > 0
              ? reasoning
              : ["General interview question analysis"],
          time_complexity: "N/A - General Question",
          space_complexity: "N/A - General Question",
          answer: answerText,
          explanation: explanationText,
          reasoning: reasoning,
          additional_notes: notesText,
        };
      } else {
        // Parse coding question response (existing logic)
        const codeMatch = responseContent.match(/```(?:\w+)?\s*([\s\S]*?)```/);
        const code = codeMatch ? codeMatch[1].trim() : responseContent;

        // Extract thoughts, looking for bullet points or numbered lists
        const thoughtsRegex =
          /(?:Thoughts:|Key Insights:|Reasoning:|Approach:)([\s\S]*?)(?:Time complexity:|$)/i;
        const thoughtsMatch = responseContent.match(thoughtsRegex);
        let thoughts: string[] = [];

        if (thoughtsMatch && thoughtsMatch[1]) {
          // Extract bullet points or numbered items
          const bulletPoints = thoughtsMatch[1].match(
            /(?:^|\n)\s*(?:[-*•]|\d+\.)\s*(.*)/g
          );
          if (bulletPoints) {
            thoughts = bulletPoints
              .map((point) =>
                point.replace(/^\s*(?:[-*•]|\d+\.)\s*/, "").trim()
              )
              .filter(Boolean);
          } else {
            // If no bullet points found, split by newlines and filter empty lines
            thoughts = thoughtsMatch[1]
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean);
          }
        }

        // Extract complexity information
        const timeComplexityPattern =
          /Time complexity:?\s*([^\n]+(?:\n[^\n]+)*?)(?=\n\s*(?:Space complexity|$))/i;
        const spaceComplexityPattern =
          /Space complexity:?\s*([^\n]+(?:\n[^\n]+)*?)(?=\n\s*(?:[A-Z]|$))/i;

        let timeComplexity =
          "O(n) - Linear time complexity because we only iterate through the array once. Each element is processed exactly one time, and the hashmap lookups are O(1) operations.";
        let spaceComplexity =
          "O(n) - Linear space complexity because we store elements in the hashmap. In the worst case, we might need to store all elements before finding the solution pair.";

        const timeMatch = responseContent.match(timeComplexityPattern);
        if (timeMatch && timeMatch[1]) {
          timeComplexity = timeMatch[1].trim();
          if (!timeComplexity.match(/O\([^)]+\)/i)) {
            timeComplexity = `O(n) - ${timeComplexity}`;
          } else if (
            !timeComplexity.includes("-") &&
            !timeComplexity.includes("because")
          ) {
            const notationMatch = timeComplexity.match(/O\([^)]+\)/i);
            if (notationMatch) {
              const notation = notationMatch[0];
              const rest = timeComplexity.replace(notation, "").trim();
              timeComplexity = `${notation} - ${rest}`;
            }
          }
        }

        const spaceMatch = responseContent.match(spaceComplexityPattern);
        if (spaceMatch && spaceMatch[1]) {
          spaceComplexity = spaceMatch[1].trim();
          if (!spaceComplexity.match(/O\([^)]+\)/i)) {
            spaceComplexity = `O(n) - ${spaceComplexity}`;
          } else if (
            !spaceComplexity.includes("-") &&
            !spaceComplexity.includes("because")
          ) {
            const notationMatch = spaceComplexity.match(/O\([^)]+\)/i);
            if (notationMatch) {
              const notation = notationMatch[0];
              const rest = spaceComplexity.replace(notation, "").trim();
              spaceComplexity = `${notation} - ${rest}`;
            }
          }
        }

        formattedResponse = {
          code: code,
          thoughts:
            thoughts.length > 0
              ? thoughts
              : ["Solution approach based on efficiency and readability"],
          time_complexity: timeComplexity,
          space_complexity: spaceComplexity,
        };
      }

      return { success: true, data: formattedResponse };
    } catch (error: any) {
      if (axios.isCancel(error)) {
        return {
          success: false,
          error: "Processing was canceled by the user.",
        };
      }

      if (error?.response?.status === 401) {
        return {
          success: false,
          error: "Invalid OpenAI API key. Please check your settings.",
        };
      } else if (error?.response?.status === 429) {
        return {
          success: false,
          error:
            "OpenAI API rate limit exceeded or insufficient credits. Please try again later.",
        };
      }

      console.error("Solution generation error:", error);
      return {
        success: false,
        error: error.message || "Failed to generate solution",
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
        throw new Error("No problem info available");
      }

      // Update progress status
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Processing debug screenshots...",
          progress: 30,
        });
      }

      // Prepare the images for the API call
      const imageDataList = screenshots.map((screenshot) => screenshot.data);

      let debugContent;

      if (config.apiProvider === "openai") {
        if (!this.openaiClient) {
          return {
            success: false,
            error: "OpenAI API key not configured. Please check your settings.",
          };
        }

        const messages = [
          {
            role: "system" as const,
            content: `You are a coding interview assistant helping debug and improve solutions. Analyze these screenshots which include either error messages, incorrect outputs, or test cases, and provide detailed debugging help.

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

If you include code examples, use proper markdown code blocks with language specification (e.g. \`\`\`java).`,
          },
          {
            role: "user" as const,
            content: [
              {
                type: "text" as const,
                text: `I'm solving this coding problem: "${problemInfo.problem_statement}" in ${language}. I need help with debugging or improving my solution. Here are screenshots of my code, the errors or test cases. Please provide a detailed analysis with:
1. What issues you found in my code
2. Specific improvements and corrections
3. Any optimizations that would make the solution better
4. A clear explanation of the changes needed`,
              },
              ...imageDataList.map((data) => ({
                type: "image_url" as const,
                image_url: { url: `data:image/png;base64,${data}` },
              })),
            ],
          },
        ];

        if (mainWindow) {
          mainWindow.webContents.send("processing-status", {
            message: "Analyzing code and generating debug feedback...",
            progress: 60,
          });
        }

        const debugResponse = await this.openaiClient.chat.completions.create({
          model: config.debuggingModel || "gpt-4o",
          messages: messages,
          max_tokens: 4000,
          temperature: 0.2,
        });

        debugContent = debugResponse.choices[0].message.content;
      } else if (config.apiProvider === "gemini") {
        if (!this.geminiApiKey) {
          return {
            success: false,
            error: "Gemini API key not configured. Please check your settings.",
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
                ...imageDataList.map((data) => ({
                  inlineData: {
                    mimeType: "image/png",
                    data: data,
                  },
                })),
              ],
            },
          ];

          if (mainWindow) {
            mainWindow.webContents.send("processing-status", {
              message:
                "Analyzing code and generating debug feedback with Gemini...",
              progress: 60,
            });
          }

          const response = await axios.default.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${
              config.debuggingModel || "gemini-2.0-flash"
            }:generateContent?key=${this.geminiApiKey}`,
            {
              contents: geminiMessages,
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 4000,
              },
            },
            { signal }
          );

          const responseData = response.data as GeminiResponse;

          if (
            !responseData.candidates ||
            responseData.candidates.length === 0
          ) {
            throw new Error("Empty response from Gemini API");
          }

          debugContent = responseData.candidates[0].content.parts[0].text;
        } catch (error) {
          console.error("Error using Gemini API for debugging:", error);
          return {
            success: false,
            error:
              "Failed to process debug request with Gemini API. Please check your API key or try again later.",
          };
        }
      } else if (config.apiProvider === "anthropic") {
        if (!this.anthropicClient) {
          return {
            success: false,
            error:
              "Anthropic API key not configured. Please check your settings.",
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
                  text: debugPrompt,
                },
                ...imageDataList.map((data) => ({
                  type: "image" as const,
                  source: {
                    type: "base64" as const,
                    media_type: "image/png" as const,
                    data: data,
                  },
                })),
              ],
            },
          ];

          if (mainWindow) {
            mainWindow.webContents.send("processing-status", {
              message:
                "Analyzing code and generating debug feedback with Claude...",
              progress: 60,
            });
          }

          const response = await this.anthropicClient.messages.create({
            model: config.debuggingModel || "claude-3-7-sonnet-20250219",
            max_tokens: 4000,
            messages: messages,
            temperature: 0.2,
          });

          debugContent = (response.content[0] as { type: "text"; text: string })
            .text;
        } catch (error: any) {
          console.error("Error using Anthropic API for debugging:", error);

          // Add specific handling for Claude's limitations
          if (error.status === 429) {
            return {
              success: false,
              error:
                "Claude API rate limit exceeded. Please wait a few minutes before trying again.",
            };
          } else if (
            error.status === 413 ||
            (error.message && error.message.includes("token"))
          ) {
            return {
              success: false,
              error:
                "Your screenshots contain too much information for Claude to process. Switch to OpenAI or Gemini in settings which can handle larger inputs.",
            };
          }

          return {
            success: false,
            error:
              "Failed to process debug request with Anthropic API. Please check your API key or try again later.",
          };
        }
      }

      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Debug analysis complete",
          progress: 100,
        });
      }

      let extractedCode = "// Debug mode - see analysis below";
      const codeMatch = debugContent.match(/```(?:[a-zA-Z]+)?([\s\S]*?)```/);
      if (codeMatch && codeMatch[1]) {
        extractedCode = codeMatch[1].trim();
      }

      let formattedDebugContent = debugContent;

      if (!debugContent.includes("# ") && !debugContent.includes("## ")) {
        formattedDebugContent = debugContent
          .replace(
            /issues identified|problems found|bugs found/i,
            "## Issues Identified"
          )
          .replace(
            /code improvements|improvements|suggested changes/i,
            "## Code Improvements"
          )
          .replace(
            /optimizations|performance improvements/i,
            "## Optimizations"
          )
          .replace(/explanation|detailed analysis/i, "## Explanation");
      }

      const bulletPoints = formattedDebugContent.match(
        /(?:^|\n)[ ]*(?:[-*•]|\d+\.)[ ]+([^\n]+)/g
      );
      const thoughts = bulletPoints
        ? bulletPoints
            .map((point) =>
              point.replace(/^[ ]*(?:[-*•]|\d+\.)[ ]+/, "").trim()
            )
            .slice(0, 5)
        : ["Debug analysis based on your screenshots"];

      const response = {
        code: extractedCode,
        debug_analysis: formattedDebugContent,
        thoughts: thoughts,
        time_complexity: "N/A - Debug mode",
        space_complexity: "N/A - Debug mode",
      };

      return { success: true, data: response };
    } catch (error: any) {
      console.error("Debug processing error:", error);
      return {
        success: false,
        error: error.message || "Failed to process debug request",
      };
    }
  }

  public cancelOngoingRequests(): void {
    let wasCancelled = false;

    if (this.currentProcessingAbortController) {
      this.currentProcessingAbortController.abort();
      this.currentProcessingAbortController = null;
      wasCancelled = true;
    }

    if (this.currentExtraProcessingAbortController) {
      this.currentExtraProcessingAbortController.abort();
      this.currentExtraProcessingAbortController = null;
      wasCancelled = true;
    }

    this.deps.setHasDebugged(false);

    this.deps.setProblemInfo(null);

    const mainWindow = this.deps.getMainWindow();
    if (wasCancelled && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
    }
  }
}
