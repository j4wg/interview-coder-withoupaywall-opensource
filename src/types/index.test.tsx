import { Screenshot, Solution } from './index';

describe('Types', () => {
  describe('Screenshot', () => {
    it('should have the correct properties', () => {
      const screenshot: Screenshot = {
        id: 'test-id',
        path: '/path/to/screenshot.png',
        timestamp: 1634567890123,
        thumbnail: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
      };

      expect(screenshot).toHaveProperty('id');
      expect(screenshot).toHaveProperty('path');
      expect(screenshot).toHaveProperty('timestamp');
      expect(screenshot).toHaveProperty('thumbnail');
      
      expect(typeof screenshot.id).toBe('string');
      expect(typeof screenshot.path).toBe('string');
      expect(typeof screenshot.timestamp).toBe('number');
      expect(typeof screenshot.thumbnail).toBe('string');
    });

    it('should accept valid screenshot data', () => {
      const validScreenshot: Screenshot = {
        id: 'screenshot-123',
        path: '/screenshots/test.png',
        timestamp: Date.now(),
        thumbnail: 'base64-string-here'
      };

      expect(validScreenshot).toBeDefined();
      expect(validScreenshot.id).toBe('screenshot-123');
      expect(validScreenshot.path).toBe('/screenshots/test.png');
      expect(typeof validScreenshot.timestamp).toBe('number');
      expect(typeof validScreenshot.thumbnail).toBe('string');
    });
  });

  describe('Solution', () => {
    it('should have the correct properties', () => {
      const solution: Solution = {
        initial_thoughts: ['thought 1', 'thought 2'],
        thought_steps: ['step 1', 'step 2', 'step 3'],
        description: 'This is a solution description',
        code: 'console.log("hello world");'
      };

      expect(solution).toHaveProperty('initial_thoughts');
      expect(solution).toHaveProperty('thought_steps');
      expect(solution).toHaveProperty('description');
      expect(solution).toHaveProperty('code');
      
      expect(Array.isArray(solution.initial_thoughts)).toBe(true);
      expect(Array.isArray(solution.thought_steps)).toBe(true);
      expect(typeof solution.description).toBe('string');
      expect(typeof solution.code).toBe('string');
    });

    it('should accept valid solution data', () => {
      const validSolution: Solution = {
        initial_thoughts: [],
        thought_steps: ['First step', 'Second step'],
        description: 'A brief description of the solution',
        code: 'const x = 1;\nconsole.log(x);'
      };

      expect(validSolution).toBeDefined();
      expect(Array.isArray(validSolution.initial_thoughts)).toBe(true);
      expect(Array.isArray(validSolution.thought_steps)).toBe(true);
      expect(typeof validSolution.description).toBe('string');
      expect(typeof validSolution.code).toBe('string');
    });

    it('should allow empty initial_thoughts array', () => {
      const solutionWithEmptyInitialThoughts: Solution = {
        initial_thoughts: [],
        thought_steps: ['Only thought steps'],
        description: 'Description here',
        code: 'some code'
      };

      expect(solutionWithEmptyInitialThoughts.initial_thoughts).toEqual([]);
      expect(solutionWithEmptyInitialThoughts.thought_steps).toEqual(['Only thought steps']);
    });
  });
});