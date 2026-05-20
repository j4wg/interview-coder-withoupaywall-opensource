// jest-dom adds custom jest matchers for asserting on DOM nodes
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";

// Mock ResizeObserver
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.ResizeObserver = ResizeObserver;

// Mock IntersectionObserver
window.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as jest.MockedClass<typeof IntersectionObserver>;

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock window properties that might be used by the app
Object.defineProperty(window, '__CREDITS__', {
  value: null,
  writable: true,
});

Object.defineProperty(window, '__LANGUAGE__', {
  value: null,
  writable: true,
});

Object.defineProperty(window, '__IS_INITIALIZED__', {
  value: null,
  writable: true,
});

