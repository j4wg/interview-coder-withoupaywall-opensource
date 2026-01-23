// shared/aiModels.ts
// Central configuration for AI providers, models, and related helpers.
// This module is the single source of truth for:
// - Supported providers
// - Available models per provider and category
// - Default models per provider and category
// - Model validation/sanitization
//
// Changing models or providers should only require edits in this file.

export type APIProvider = "openai" | "gemini" | "anthropic";

export type ModelCategoryKey =
  | "extractionModel"
  | "solutionModel"
  | "debuggingModel"
  | "answerModel";

export interface AIModel {
  id: string;
  name: string;
  description: string;
}

export interface ModelCategoryDefinition {
  key: ModelCategoryKey;
  title: string;
  description: string;
  modelsByProvider: Record<APIProvider, AIModel[]>;
}

/**
 * Default provider used when no provider is configured or an invalid provider is found.
 */
export const DEFAULT_PROVIDER: APIProvider = "gemini";

/**
 * Default models per provider and category.
 * These are used for:
 * - Initial config defaults
 * - Resetting models when provider changes
 * - Fallbacks when a model is missing in config
 */
export const DEFAULT_MODELS: Record<
  APIProvider,
  {
    extractionModel: string;
    solutionModel: string;
    debuggingModel: string;
    answerModel: string;
    // Speech recognition is supported for OpenAI (Whisper) and Gemini (Audio Understanding)
    speechRecognitionModel?: string;
  }
> = {
  openai: {
    extractionModel: "gpt-4o",
    solutionModel: "gpt-4o",
    debuggingModel: "gpt-4o",
    answerModel: "gpt-4o-mini",
    speechRecognitionModel: "whisper-1",
  },
  gemini: {
    extractionModel: "gemini-3-flash-preview",
    solutionModel: "gemini-3-flash-preview",
    debuggingModel: "gemini-3-flash-preview",
    answerModel: "gemini-3-flash-preview",
    speechRecognitionModel: "gemini-3-flash-preview",
  },
  anthropic: {
    extractionModel: "claude-3-7-sonnet-20250219",
    solutionModel: "claude-3-7-sonnet-20250219",
    debuggingModel: "claude-3-7-sonnet-20250219",
    answerModel: "claude-3-7-sonnet-20250219",
  },
};

/**
 * Default models specifically for the answer suggestion assistant.
 * This allows us to evolve those independently from the screenshot
 * processing defaults if needed.
 */
export const DEFAULT_ANSWER_MODELS: Record<APIProvider, string> = {
  openai: "gpt-4o-mini",
  gemini: "gemini-3-flash-preview",
  anthropic: "claude-3-7-sonnet-20250219",
};

/**
 * Allowed model ids per provider.
 * Used for validation/sanitization when reading or updating config.
 */
export const ALLOWED_MODELS: Record<APIProvider, string[]> = {
  openai: [
    "gpt-4o",
    "gpt-4o-mini",
  ],
  gemini: [
    // Current Gemini 3 models (preview)
    "gemini-3-pro-preview",
    "gemini-3-flash-preview",
    "gemini-3-pro-image-preview",
    // Legacy models kept for backwards compatibility
    "gemini-1.5-pro",
    "gemini-1.5-flash",
    "gemini-2.0-flash-exp",
  ],
  anthropic: [
    "claude-3-7-sonnet-20250219",
    "claude-3-5-sonnet-20241022",
    "claude-3-opus-20240229",
  ],
};

/**
 * Settings UI model catalogue, organized by functional category and provider.
 */
export const MODEL_CATEGORIES: ModelCategoryDefinition[] = [
  {
    key: "extractionModel",
    title: "Problem Extraction",
    description:
      "Model used to analyze screenshots and extract problem details",
    modelsByProvider: {
      openai: [
        {
          id: "gpt-4o",
          name: "gpt-4o",
          description: "Best overall performance for problem extraction",
        },
        {
          id: "gpt-4o-mini",
          name: "gpt-4o-mini",
          description: "Faster, more cost-effective option",
        },
      ],
      gemini: [
        {
          id: "gemini-3-pro-preview",
          name: "Gemini 3 Pro (Preview)",
          description: "Best overall performance for complex tasks requiring advanced reasoning",
        },
        {
          id: "gemini-3-flash-preview",
          name: "Gemini 3 Flash (Preview)",
          description: "Pro-level intelligence at Flash speed and pricing",
        },
        {
          id: "gemini-1.5-pro",
          name: "Gemini 1.5 Pro",
          description: "Legacy model - use Gemini 3 for best results",
        },
        {
          id: "gemini-1.5-flash",
          name: "Gemini 1.5 Flash",
          description: "Legacy model - use Gemini 3 Flash for best results",
        },
      ],
      anthropic: [
        {
          id: "claude-3-7-sonnet-20250219",
          name: "Claude 3.7 Sonnet",
          description: "Best overall performance for problem extraction",
        },
        {
          id: "claude-3-5-sonnet-20241022",
          name: "Claude 3.5 Sonnet",
          description: "Balanced performance and speed",
        },
        {
          id: "claude-3-opus-20240229",
          name: "Claude 3 Opus",
          description:
            "Top-level intelligence, fluency, and understanding",
        },
      ],
    },
  },
  {
    key: "solutionModel",
    title: "Solution Generation",
    description: "Model used to generate coding solutions",
    modelsByProvider: {
      openai: [
        {
          id: "gpt-4o",
          name: "gpt-4o",
          description: "Strong overall performance for coding tasks",
        },
        {
          id: "gpt-4o-mini",
          name: "gpt-4o-mini",
          description: "Faster, more cost-effective option",
        },
      ],
      gemini: [
        {
          id: "gemini-3-pro-latest",
          name: "Gemini 3 Pro (Latest)",
          description: "Strong overall performance - latest version",
        },
        {
          id: "gemini-3-flash-latest",
          name: "Gemini 3 Flash (Latest)",
          description: "Faster, more cost-effective - latest version",
        },
        {
          id: "gemini-3-pro",
          name: "Gemini 3 Pro",
          description: "Stable version",
        },
        {
          id: "gemini-3-flash",
          name: "Gemini 3 Flash",
          description: "Stable version",
        },
        {
          id: "gemini-1.5-pro",
          name: "Gemini 1.5 Pro",
          description: "Legacy model - use Gemini 3 for best results",
        },
      ],
      anthropic: [
        {
          id: "claude-3-7-sonnet-20250219",
          name: "Claude 3.7 Sonnet",
          description: "Strong overall performance for coding tasks",
        },
        {
          id: "claude-3-5-sonnet-20241022",
          name: "Claude 3.5 Sonnet",
          description: "Balanced performance and speed",
        },
        {
          id: "claude-3-opus-20240229",
          name: "Claude 3 Opus",
          description:
            "Top-level intelligence, fluency, and understanding",
        },
      ],
    },
  },
  {
    key: "debuggingModel",
    title: "Debugging",
    description: "Model used to debug and improve solutions",
    modelsByProvider: {
      openai: [
        {
          id: "gpt-4o",
          name: "gpt-4o",
          description: "Best for analyzing code and error messages",
        },
        {
          id: "gpt-4o-mini",
          name: "gpt-4o-mini",
          description: "Faster, more cost-effective option",
        },
      ],
      gemini: [
        {
          id: "gemini-3-pro-latest",
          name: "Gemini 3 Pro (Latest)",
          description:
            "Best for analyzing code and error messages - latest version",
        },
        {
          id: "gemini-3-flash-latest",
          name: "Gemini 3 Flash (Latest)",
          description: "Faster, more cost-effective - latest version",
        },
        {
          id: "gemini-3-pro",
          name: "Gemini 3 Pro",
          description: "Stable version",
        },
        {
          id: "gemini-3-flash",
          name: "Gemini 3 Flash",
          description: "Stable version",
        },
        {
          id: "gemini-1.5-pro",
          name: "Gemini 1.5 Pro",
          description: "Legacy model - use Gemini 3 for best results",
        },
      ],
      anthropic: [
        {
          id: "claude-3-7-sonnet-20250219",
          name: "Claude 3.7 Sonnet",
          description: "Best for analyzing code and error messages",
        },
        {
          id: "claude-3-5-sonnet-20241022",
          name: "Claude 3.5 Sonnet",
          description: "Balanced performance and speed",
        },
        {
          id: "claude-3-opus-20240229",
          name: "Claude 3 Opus",
          description:
            "Top-level intelligence, fluency, and understanding",
        },
      ],
    },
  },
  {
    key: "answerModel",
    title: "Answer Suggestions",
    description: "Model used to generate AI answer suggestions for conversation questions",
    modelsByProvider: {
      openai: [
        {
          id: "gpt-4o-mini",
          name: "gpt-4o-mini",
          description: "Fast and cost-effective for conversation suggestions",
        },
        {
          id: "gpt-4o",
          name: "gpt-4o",
          description: "Best overall performance for answer suggestions",
        },
      ],
      gemini: [
        {
          id: "gemini-3-flash-preview",
          name: "Gemini 3 Flash (Preview)",
          description: "Fast and efficient for conversation suggestions",
        },
        {
          id: "gemini-3-pro-preview",
          name: "Gemini 3 Pro (Preview)",
          description: "Best performance for complex conversation contexts",
        },
        {
          id: "gemini-1.5-pro",
          name: "Gemini 1.5 Pro",
          description: "Legacy model - use Gemini 3 for best results",
        },
        {
          id: "gemini-1.5-flash",
          name: "Gemini 1.5 Flash",
          description: "Legacy model - use Gemini 3 Flash for best results",
        },
      ],
      anthropic: [
        {
          id: "claude-3-7-sonnet-20250219",
          name: "Claude 3.7 Sonnet",
          description: "Best overall performance for answer suggestions",
        },
        {
          id: "claude-3-5-sonnet-20241022",
          name: "Claude 3.5 Sonnet",
          description: "Balanced performance and speed",
        },
        {
          id: "claude-3-opus-20240229",
          name: "Claude 3 Opus",
          description:
            "Top-level intelligence, fluency, and understanding",
        },
      ],
    },
  },
];

/**
 * Sanitize a model selection to ensure only allowed models are used.
 * If the model is not allowed for the provider, the provider's default
 * model for the given category is returned.
 */
export function sanitizeModelSelection(
  model: string,
  provider: APIProvider,
  category: ModelCategoryKey
): string {
  const allowed = ALLOWED_MODELS[provider];
  if (allowed.includes(model)) {
    return model;
  }

  const fallback = DEFAULT_MODELS[provider][category];
  // eslint-disable-next-line no-console
  console.warn(
    `Invalid ${provider} model specified for ${category}: ${model}. Using default model: ${fallback}`
  );
  return fallback;
}

