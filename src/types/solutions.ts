export interface Solution {
  initial_thoughts: string[];
  thought_steps: string[];
  description: string;
  code: string;
}

export interface SolutionsResponse {
  [key: string]: Solution;
}

// New interface for general question data
export interface GeneralQuestionData {
  question: string;
  question_type:
    | "multiple_choice"
    | "true_false"
    | "short_answer"
    | "essay"
    | "explanation";
  options?: string[]; // For multiple choice questions
  context?: string; // Additional context if needed
  topic?: string; // Subject area (e.g., "Node.js", "React", "JavaScript")
}

// New interface for general answers
export interface GeneralAnswer {
  answer: string;
  explanation: string;
  reasoning: string[];
  confidence?: string; // High/Medium/Low
  additional_notes?: string;
}

export interface ProblemStatementData {
  problem_statement: string;
  input_format: {
    description: string;
    parameters: any[];
  };
  output_format: {
    description: string;
    type: string;
    subtype: string;
  };
  complexity: {
    time: string;
    space: string;
  };
  test_cases: any[];
  validation_type: string;
  difficulty: string;
}
