export interface Solution {
  initial_thoughts: string[]
  thought_steps: string[]
  description: string
  code: string
}

export interface SolutionsResponse {
  [key: string]: Solution
}

// From previous type we was using only problem_statement and had duplication of types in electron/main.ts
export interface IProblemStatementData {
  problem_statement: string
  constraints: string
  example_input: string
  example_output: string
}
