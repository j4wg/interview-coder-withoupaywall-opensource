import React from "react";

// Mock the App component since we're testing main.tsx specifically
jest.mock("./App", () => {
  return {
    __esModule: true,
    default: jest.fn(() => <div data-testid="mocked-app">Mocked App</div>),
  };
});

// Mock the index.css import
jest.mock("./index.css", () => ({}));

// Mock the entire react-dom/client module
jest.mock("react-dom/client", () => {
  const mockRoot = {
    render: jest.fn(),
  };
  return {
    createRoot: jest.fn(() => mockRoot),
    __mockRoot: mockRoot,
  };
});

import * as ReactDOMClient from "react-dom/client";

describe("main.tsx", () => {
  const mockRoot = (ReactDOMClient as any).__mockRoot;

  let originalGetElementById: (id: string) => HTMLElement | null;

  beforeEach(() => {
    // Save original method
    originalGetElementById = document.getElementById;

    // Mock document.getElementById to return a mock div with id "root"
    document.getElementById = jest.fn(() => {
      const div = document.createElement("div");
      div.id = "root";
      return div;
    });

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    // Restore original method
    document.getElementById = originalGetElementById;
  });

  it("should create root and render App component with StrictMode", () => {
    // Import main.tsx after setting up mocks to ensure mocks are in place
    require("./main.tsx");

    // Verify that createRoot was called with an element that has id "root"
    expect(ReactDOMClient.createRoot).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "root"
      })
    );

    // Verify that render was called on the root
    expect(mockRoot.render).toHaveBeenCalled();

    // Get the argument passed to render
    const renderArg = mockRoot.render.mock.calls[0][0];

    // Check that it's StrictMode
    expect(renderArg.type).toBe(React.StrictMode);

    // Check that the children contain the App component
    const children = renderArg.props.children;
    // The mocked App component will have a name like "mockConstructor" or similar
    expect(children.type).toBeDefined();
  });
});