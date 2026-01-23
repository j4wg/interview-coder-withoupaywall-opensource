/**
 * AnswerAssistant - Generates AI-powered answer suggestions based on conversation context
 * Follows Single Responsibility Principle - only handles answer suggestion generation
 * Uses Dependency Inversion Principle - depends on IConversationManager interface
 */
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import * as axios from 'axios';
import { configHelper, CandidateProfile } from './ConfigHelper';
import { IConversationManager } from './ConversationManager';
import {
  APIProvider,
  DEFAULT_ANSWER_MODELS,
} from "../shared/aiModels";

// Interface for Gemini API requests
interface GeminiMessage {
  role: string;
  parts: Array<{
    text?: string;
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

export interface AnswerSuggestion {
  suggestions: string[];
  reasoning: string;
}

export interface IAnswerAssistant {
  generateAnswerSuggestions(
    currentQuestion: string,
    conversationManager: IConversationManager,
    screenshotContext?: string
  ): Promise<AnswerSuggestion>;
}

export class AnswerAssistant implements IAnswerAssistant {
  private openai: OpenAI | null = null;
  private geminiApiKey: string | null = null;
  private anthropic: Anthropic | null = null;

  private formatProviderError(provider: "openai" | "gemini" | "anthropic", error: any, context: string): string {
    const status =
      typeof error?.status === "number"
        ? error.status
        : typeof error?.response?.status === "number"
          ? error.response.status
          : undefined;
    const message = error?.message || error?.response?.data?.error?.message || "Unknown error";
    const statusPart = status ? ` (status ${status})` : "";
    return `[${provider}] ${context} failed${statusPart}: ${message}`;
  }

  constructor() {
    this.initializeAIClients();
    
    // Listen for config changes to re-initialize the AI clients
    configHelper.on('config-updated', () => {
      this.initializeAIClients();
    });
  }

  /**
   * Initializes AI clients based on API provider from config
   */
  private initializeAIClients(): void {
    const config = configHelper.loadConfig();
    
    // Reset all clients
    this.openai = null;
    this.geminiApiKey = null;
    this.anthropic = null;
    
    if (!config.apiKey || config.apiKey.trim().length === 0) {
      return;
    }
    
    if (config.apiProvider === "openai") {
      this.openai = new OpenAI({ apiKey: config.apiKey });
    } else if (config.apiProvider === "gemini") {
      this.geminiApiKey = config.apiKey;
    } else if (config.apiProvider === "anthropic") {
      this.anthropic = new Anthropic({ apiKey: config.apiKey });
    }
  }

  /**
   * Generates answer suggestions based on conversation context
   * @param currentQuestion - The current interviewer question
   * @param conversationManager - Conversation manager instance (dependency injection)
   * @param screenshotContext - Optional screenshot context for coding interviews
   * @returns Promise resolving to answer suggestions
   * @throws Error if AI client not initialized or request fails
   */
  public async generateAnswerSuggestions(
    currentQuestion: string,
    conversationManager: IConversationManager,
    screenshotContext?: string,
    candidateProfile?: CandidateProfile
  ): Promise<AnswerSuggestion> {
    const config = configHelper.loadConfig();
    
    // Check if any AI client is initialized
    if (!this.openai && !this.geminiApiKey && !this.anthropic) {
      throw new Error('AI client not initialized. Please set API key in settings.');
    }

    if (!currentQuestion || currentQuestion.trim().length === 0) {
      throw new Error('Current question cannot be empty');
    }

    const conversationHistory = conversationManager.getConversationHistory();
    const previousAnswers = conversationManager.getIntervieweeAnswers();

    // Get candidate profile from config if not provided
    const profile = candidateProfile || configHelper.loadConfig().candidateProfile;
    
    const contextPrompt = this.buildContextPrompt(
      currentQuestion,
      conversationHistory,
      previousAnswers,
      screenshotContext,
      profile
    );

    const systemMessage = 'You are a helpful interview assistant supporting the candidate for this interview. Tailor suggestions to the job description when provided, and only use resume details when the question is about the candidate\'s background. Provide concise, actionable suggestions.';

    try {
      let suggestionsText = '';
      
      // Get the configured answer model, fallback to default if not set
      const answerModel = config.answerModel || DEFAULT_ANSWER_MODELS[config.apiProvider];

      if (config.apiProvider === "openai" && this.openai) {
        const response = await this.openai.chat.completions.create({
          model: answerModel,
          messages: [
            {
              role: 'system',
              content: systemMessage
            },
            {
              role: 'user',
              content: contextPrompt
            }
          ],
          temperature: 0.7,
          max_tokens: 500,
        });

        suggestionsText = response.choices[0]?.message?.content || '';
      } else if (config.apiProvider === "gemini" && this.geminiApiKey) {
        const geminiMessages: GeminiMessage[] = [
          {
            role: "user",
            parts: [
              {
                text: `${systemMessage}\n\n${contextPrompt}`
              }
            ]
          }
        ];

        const response = await axios.default.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${answerModel}:generateContent?key=${this.geminiApiKey}`,
          {
            contents: geminiMessages,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 500
            }
          }
        );

        const responseData = response.data as GeminiResponse;
        if (responseData.candidates && responseData.candidates.length > 0) {
          suggestionsText = responseData.candidates[0].content.parts[0].text;
        }
      } else if (config.apiProvider === "anthropic" && this.anthropic) {
        const response = await this.anthropic.messages.create({
          model: answerModel,
          max_tokens: 500,
          messages: [
            {
              role: 'user',
              content: `${systemMessage}\n\n${contextPrompt}`
            }
          ],
          temperature: 0.7
        });

        suggestionsText = (response.content[0] as { type: 'text', text: string }).text;
      } else {
        throw new Error('No AI client available. Please configure your API key in settings.');
      }

      const suggestions = this.parseSuggestions(suggestionsText);

      return {
        suggestions: suggestions.length > 0 
          ? suggestions 
          : ['Consider answering based on your experience and background.'],
        reasoning: 'Based on conversation history and previous answers',
      };
    } catch (error: any) {
      console.error('Error generating suggestions:', error);
      
      // Provide specific error messages based on provider
      const status = error?.status ?? error?.response?.status;
      if (status === 401) {
        throw new Error(this.formatProviderError(config.apiProvider, error, "Auth"));
      } else if (status === 429) {
        throw new Error(this.formatProviderError(config.apiProvider, error, "Rate limit"));
      }

      throw new Error(this.formatProviderError(config.apiProvider, error, "Answer suggestion generation"));
    }
  }

  /**
   * Builds the context prompt for the AI
   */
  private buildContextPrompt(
    currentQuestion: string,
    conversationHistory: string,
    previousAnswers: string[],
    screenshotContext?: string,
    candidateProfile?: CandidateProfile
  ): string {
    const shouldUseResume = this.isResumeRelevant(currentQuestion);
    let prompt = `You are an AI assistant helping someone during an interview. 
The interviewer just asked: "${currentQuestion}"

Previous conversation:
${conversationHistory || 'No previous conversation yet.'}

Previous answers the interviewee has given:
${previousAnswers.length > 0 ? previousAnswers.join('\n\n') : 'No previous answers yet.'}
`;

    if (candidateProfile?.jobDescription) {
      prompt += `\n\nJob Description (use to tailor answers to this interview):
${candidateProfile.jobDescription}`;
    }

    // Add candidate profile context if available
    if (candidateProfile && shouldUseResume) {
      const profileSections: string[] = [];
      
      if (candidateProfile.name) {
        profileSections.push(`Name: ${candidateProfile.name}`);
      }
      
      if (candidateProfile.resume) {
        profileSections.push(`Resume: ${candidateProfile.resume}`);
      }
      
      if (profileSections.length > 0) {
        prompt += `\n\nCandidate Profile (use this to personalize suggestions):
${profileSections.join('\n')}`;
      }
    }

    prompt += `\n\nBased on the current question and conversation history${shouldUseResume && candidateProfile ? ', and candidate profile (resume only when relevant)' : ''}, provide 3-5 bullet point suggestions that:
1. Directly answer the current question
2. Reference and build upon previous answers for consistency
3. Maintain a coherent narrative
4. Are specific and actionable

Format as simple bullet points, one per line starting with "-".`;

    if (screenshotContext) {
      prompt += `\n\nAdditional context from code screenshot: ${screenshotContext}`;
    }

    return prompt;
  }

  /**
   * Only treat resume as relevant when the question is about the candidate's background
   */
  private isResumeRelevant(question: string): boolean {
    if (!question) return false;
    const q = question.toLowerCase();
    const resumeKeywords = [
      'resume',
      'cv',
      'experience',
      'background',
      'work history',
      'employment',
      'projects',
      'portfolio',
      'skills',
      'education',
      'certification',
      'accomplishment',
      'achievement'
    ];
    return resumeKeywords.some(keyword => q.includes(keyword));
  }

  /**
   * Parses AI response into structured suggestions
   * Handles multi-line suggestions and text after colons (e.g., "Explain that: ...")
   */
  private parseSuggestions(suggestionsText: string): string[] {
    const lines = suggestionsText.split('\n').map(line => line.trim());
    const suggestions: string[] = [];
    let currentSuggestion = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip empty lines
      if (!line) {
        if (currentSuggestion) {
          suggestions.push(currentSuggestion.trim());
          currentSuggestion = '';
        }
        continue;
      }

      // Check if this line starts a new suggestion (bullet point, number, or starts with capital letter after empty line)
      const isNewSuggestion = 
        line.startsWith('-') || 
        line.startsWith('•') || 
        line.match(/^\d+\./) ||
        (i > 0 && !lines[i - 1] && line.length > 0 && line.length < 200);

      if (isNewSuggestion) {
        // Save previous suggestion if exists
        if (currentSuggestion) {
          suggestions.push(currentSuggestion.trim());
        }
        // Start new suggestion, removing bullet/number prefix
        currentSuggestion = line
          .replace(/^[-•]\s*/, '')
          .replace(/^\d+\.\s*/, '')
          .trim();
      } else if (currentSuggestion) {
        // Continue current suggestion (multi-line)
        currentSuggestion += ' ' + line;
      } else if (line.length > 0 && line.length < 200) {
        // Standalone line that might be a suggestion
        currentSuggestion = line;
      }
    }

    // Don't forget the last suggestion
    if (currentSuggestion) {
      suggestions.push(currentSuggestion.trim());
    }

    // Filter out empty or too long suggestions, and clean up
    return suggestions
      .map(s => s.trim())
      .filter(s => s.length > 0 && s.length < 500) // Increased limit for multi-line suggestions
      .map(s => {
        // Clean up any extra whitespace
        return s.replace(/\s+/g, ' ').trim();
      });
  }

  /**
   * Checks if any AI client is initialized
   */
  public isInitialized(): boolean {
    return this.openai !== null || this.geminiApiKey !== null || this.anthropic !== null;
  }
}
