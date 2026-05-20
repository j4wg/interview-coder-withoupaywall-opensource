import { Solution, SolutionsResponse, ProblemStatementData } from './solutions';

describe('Solution Interface', () => {
  it('should match the expected structure', () => {
    const mockSolution: Solution = {
      initial_thoughts: ['Initial thought 1', 'Initial thought 2'],
      thought_steps: ['Step 1', 'Step 2', 'Step 3'],
      description: 'A sample solution description',
      code: 'console.log("Hello World");'
    };

    expect(mockSolution).toHaveProperty('initial_thoughts');
    expect(mockSolution).toHaveProperty('thought_steps');
    expect(mockSolution).toHaveProperty('description');
    expect(mockSolution).toHaveProperty('code');
    expect(Array.isArray(mockSolution.initial_thoughts)).toBe(true);
    expect(Array.isArray(mockSolution.thought_steps)).toBe(true);
    expect(typeof mockSolution.description).toBe('string');
    expect(typeof mockSolution.code).toBe('string');
  });

  it('should handle empty arrays and strings', () => {
    const mockSolution: Solution = {
      initial_thoughts: [],
      thought_steps: [],
      description: '',
      code: ''
    };

    expect(mockSolution.initial_thoughts).toEqual([]);
    expect(mockSolution.thought_steps).toEqual([]);
    expect(mockSolution.description).toBe('');
    expect(mockSolution.code).toBe('');
  });
});

describe('SolutionsResponse Interface', () => {
  it('should match the expected structure', () => {
    const mockSolutionsResponse: SolutionsResponse = {
      solution1: {
        initial_thoughts: ['Thought 1'],
        thought_steps: ['Step 1'],
        description: 'Description 1',
        code: 'code 1'
      },
      solution2: {
        initial_thoughts: ['Thought 2'],
        thought_steps: ['Step 2'],
        description: 'Description 2',
        code: 'code 2'
      }
    };

    expect(mockSolutionsResponse).toHaveProperty('solution1');
    expect(mockSolutionsResponse).toHaveProperty('solution2');
    expect(mockSolutionsResponse.solution1).toHaveProperty('initial_thoughts');
    expect(mockSolutionsResponse.solution1).toHaveProperty('thought_steps');
    expect(mockSolutionsResponse.solution1).toHaveProperty('description');
    expect(mockSolutionsResponse.solution1).toHaveProperty('code');
    expect(mockSolutionsResponse.solution2).toHaveProperty('initial_thoughts');
    expect(mockSolutionsResponse.solution2).toHaveProperty('thought_steps');
    expect(mockSolutionsResponse.solution2).toHaveProperty('description');
    expect(mockSolutionsResponse.solution2).toHaveProperty('code');
  });

  it('should handle empty response object', () => {
    const mockSolutionsResponse: SolutionsResponse = {};
    expect(mockSolutionsResponse).toEqual({});
  });
});

describe('ProblemStatementData Interface', () => {
  it('should match the expected structure', () => {
    const mockProblemStatementData: ProblemStatementData = {
      problem_statement: 'This is the problem statement',
      input_format: {
        description: 'Input description',
        parameters: [
          {
            name: 'param1',
            type: 'string',
            description: 'First parameter'
          }
        ]
      },
      output_format: {
        description: 'Output description',
        type: 'string',
        subtype: 'array'
      },
      complexity: {
        time: 'O(n)',
        space: 'O(1)'
      },
      test_cases: [
        {
          input: 'input1',
          output: 'output1'
        }
      ],
      validation_type: 'exact',
      difficulty: 'medium'
    };

    expect(mockProblemStatementData).toHaveProperty('problem_statement');
    expect(mockProblemStatementData).toHaveProperty('input_format');
    expect(mockProblemStatementData).toHaveProperty('output_format');
    expect(mockProblemStatementData).toHaveProperty('complexity');
    expect(mockProblemStatementData).toHaveProperty('test_cases');
    expect(mockProblemStatementData).toHaveProperty('validation_type');
    expect(mockProblemStatementData).toHaveProperty('difficulty');

    expect(typeof mockProblemStatementData.problem_statement).toBe('string');
    expect(typeof mockProblemStatementData.validation_type).toBe('string');
    expect(typeof mockProblemStatementData.difficulty).toBe('string');
    expect(Array.isArray(mockProblemStatementData.test_cases)).toBe(true);
    expect(typeof mockProblemStatementData.input_format).toBe('object');
    expect(typeof mockProblemStatementData.output_format).toBe('object');
    expect(typeof mockProblemStatementData.complexity).toBe('object');
  });

  it('should handle minimal data structure', () => {
    const mockProblemStatementData: ProblemStatementData = {
      problem_statement: 'Simple problem',
      input_format: {
        description: 'Simple input',
        parameters: []
      },
      output_format: {
        description: 'Simple output',
        type: 'string',
        subtype: ''
      },
      complexity: {
        time: '',
        space: ''
      },
      test_cases: [],
      validation_type: 'exact',
      difficulty: 'easy'
    };

    expect(mockProblemStatementData.problem_statement).toBe('Simple problem');
    expect(mockProblemStatementData.input_format.description).toBe('Simple input');
    expect(mockProblemStatementData.input_format.parameters).toEqual([]);
    expect(mockProblemStatementData.output_format.description).toBe('Simple output');
    expect(mockProblemStatementData.output_format.type).toBe('string');
    expect(mockProblemStatementData.output_format.subtype).toBe('');
    expect(mockProblemStatementData.complexity.time).toBe('');
    expect(mockProblemStatementData.complexity.space).toBe('');
    expect(mockProblemStatementData.test_cases).toEqual([]);
    expect(mockProblemStatementData.validation_type).toBe('exact');
    expect(mockProblemStatementData.difficulty).toBe('easy');
  });
});

describe('Type Compatibility Tests', () => {
  it('should verify Solution type compatibility with expected structure', () => {
    const validSolution: Solution = {
      initial_thoughts: ['thought1', 'thought2'],
      thought_steps: ['step1', 'step2'],
      description: 'A valid solution',
      code: 'console.log("valid code");'
    };

    // These checks ensure that our type definition matches the expected structure
    expect(Array.isArray(validSolution.initial_thoughts)).toBe(true);
    expect(Array.isArray(validSolution.thought_steps)).toBe(true);
    expect(typeof validSolution.description).toBe('string');
    expect(typeof validSolution.code).toBe('string');
  });

  it('should verify SolutionsResponse can contain multiple solutions', () => {
    const solutionsResponse: SolutionsResponse = {
      firstSolution: {
        initial_thoughts: ['init thought'],
        thought_steps: ['step'],
        description: 'desc',
        code: 'code'
      },
      secondSolution: {
        initial_thoughts: ['another init thought'],
        thought_steps: ['another step'],
        description: 'another desc',
        code: 'another code'
      }
    };

    expect(Object.keys(solutionsResponse).length).toBe(2);
    expect(solutionsResponse.firstSolution).toBeDefined();
    expect(solutionsResponse.secondSolution).toBeDefined();
  });
});