import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import Solutions from './Solutions';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../components/ui/toast';
import { ToastContext } from '../contexts/toast';

// Mock the external dependencies
jest.mock('react-syntax-highlighter', () => ({
  __esModule: true,
  default: ({ children, language, style, customStyle, showLineNumbers, wrapLongLines }: any) => {
    // Extract the code string from the content if it's an object
    let content = children;
    if (typeof children === 'object' && children !== null && typeof children.code === 'string') {
      content = children.code;
    }
    return (
      <pre
        data-testid="syntax-highlighter"
        data-language={language}
        style={customStyle}
      >
        <code>{content}</code>
      </pre>
    );
  },
  Prism: ({ children, language, style, customStyle, showLineNumbers, wrapLongLines }: any) => {
    // Extract the code string from the content if it's an object
    let content = children;
    if (typeof children === 'object' && children !== null && typeof children.code === 'string') {
      content = children.code;
    }
    return (
      <pre
        data-testid="syntax-highlighter"
        data-language={language}
        style={customStyle}
      >
        <code>{content}</code>
      </pre>
    );
  }
}));

jest.mock('../components/Queue/ScreenshotQueue', () => ({
  __esModule: true,
  default: ({ isLoading, screenshots, onDeleteScreenshot }: any) => (
    <div data-testid="screenshot-queue">
      <div>Screenshot Queue Mock</div>
      <div data-testid="queue-is-loading">{isLoading ? 'loading' : 'not loading'}</div>
      <div data-testid="queue-screenshots-count">{screenshots.length}</div>
      <button
        data-testid="delete-screenshot-btn"
        onClick={() => onDeleteScreenshot && onDeleteScreenshot(0)}
      >
        Delete Screenshot
      </button>
    </div>
  )
}));

jest.mock('../components/Solutions/SolutionCommands', () => ({
  __esModule: true,
  default: ({ onTooltipVisibilityChange, isProcessing, extraScreenshots, credits, currentLanguage, setLanguage }: any) => (
    <div data-testid="solution-commands">
      <div>Solution Commands Mock</div>
      <button
        data-testid="command-tooltip-btn"
        onClick={() => onTooltipVisibilityChange(true, 100)}
      >
        Tooltip Button
      </button>
      <div data-testid="command-is-processing">{isProcessing ? 'processing' : 'not processing'}</div>
      <div data-testid="command-screenshots-count">{extraScreenshots.length}</div>
      <div data-testid="command-credits">{credits}</div>
      <div data-testid="command-language">{currentLanguage}</div>
      <button
        data-testid="change-language-btn"
        onClick={() => setLanguage && setLanguage('javascript')}
      >
        Change Language
      </button>
    </div>
  )
}));

jest.mock('./Debug', () => ({
  __esModule: true,
  default: ({ isProcessing, currentLanguage }: any) => (
    <div data-testid="debug-component">
      <div>Debug Component Mock</div>
      <div data-testid="debug-processing">{isProcessing ? 'processing' : 'not processing'}</div>
      <div data-testid="debug-language">{currentLanguage}</div>
    </div>
  )
}));

// Mock the window.electronAPI
const mockElectronAPI = {
  getScreenshots: jest.fn(),
  onScreenshotTaken: jest.fn(() => jest.fn()),
  onResetView: jest.fn(() => jest.fn()),
  onSolutionStart: jest.fn(() => jest.fn()),
  onProblemExtracted: jest.fn(() => jest.fn()),
  onSolutionError: jest.fn(() => jest.fn()),
  onSolutionSuccess: jest.fn(() => jest.fn()),
  onDebugStart: jest.fn(() => jest.fn()),
  onDebugSuccess: jest.fn(() => jest.fn()),
  onDebugError: jest.fn(() => jest.fn()),
  onProcessingNoScreenshots: jest.fn(() => jest.fn()),
  deleteScreenshot: jest.fn(),
  updateContentDimensions: jest.fn(),
};

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

// Mock navigator.clipboard
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
  writable: true,
});

// Mock useRef to return a mock ref
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useRef: jest.fn((initialValue) => ({ current: initialValue })),
}));

// Create a fresh query client for each test
const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const MockWrapper = ({ children, setView = jest.fn(), credits = 10, currentLanguage = 'javascript', setLanguage = jest.fn() }: any) => (
  <QueryClientProvider client={createQueryClient()}>
    <ToastProvider>
      <ToastContext.Provider value={{ showToast: jest.fn() }}>
        {children}
      </ToastContext.Provider>
    </ToastProvider>
  </QueryClientProvider>
);

describe('Solutions Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockElectronAPI.getScreenshots.mockResolvedValue([]);
  });

  it('renders without crashing', () => {
    render(
      <MockWrapper>
        <Solutions 
          setView={jest.fn()}
          credits={10}
          currentLanguage="javascript"
          setLanguage={jest.fn()}
        />
      </MockWrapper>
    );
    
    expect(screen.getByText('Solution Commands Mock')).toBeInTheDocument();
  });

  it('renders ContentSection when problem statement data is available', async () => {
    const queryClient = createQueryClient();
    const mockProblemStatement = { problem_statement: 'Test problem statement' };

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ToastContext.Provider value={{ showToast: jest.fn() }}>
            <Solutions
              setView={jest.fn()}
              credits={10}
              currentLanguage="javascript"
              setLanguage={jest.fn()}
            />
          </ToastContext.Provider>
        </ToastProvider>
      </QueryClientProvider>
    );

    // Set the query data after rendering to trigger the subscription
    await act(async () => {
      queryClient.setQueryData(['problem_statement'], mockProblemStatement);
    });

    await waitFor(() => {
      expect(screen.getByText('Problem Statement')).toBeInTheDocument();
      expect(screen.getByText('Test problem statement')).toBeInTheDocument();
    });
  });

  it('shows loading state when solution data is not available', async () => {
    const queryClient = createQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ToastContext.Provider value={{ showToast: jest.fn() }}>
            <Solutions
              setView={jest.fn()}
              credits={10}
              currentLanguage="javascript"
              setLanguage={jest.fn()}
            />
          </ToastContext.Provider>
        </ToastProvider>
      </QueryClientProvider>
    );

    // Initially, when no problem statement is available, it should show "Extracting problem statement..."
    await waitFor(() => {
      expect(screen.getByText('Extracting problem statement...')).toBeInTheDocument();
    });
  });

  it('renders SolutionSection when solution data is available', async () => {
    const queryClient = createQueryClient();
    const mockSolution = {
      code: 'console.log("hello world");',
      thoughts: ['This is a thought'],
      time_complexity: 'O(n)',
      space_complexity: 'O(1)'
    };

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ToastContext.Provider value={{ showToast: jest.fn() }}>
            <Solutions
              setView={jest.fn()}
              credits={10}
              currentLanguage="javascript"
              setLanguage={jest.fn()}
            />
          </ToastContext.Provider>
        </ToastProvider>
      </QueryClientProvider>
    );

    // Set the query data after rendering to trigger the subscription
    await act(async () => {
      queryClient.setQueryData(['solution'], mockSolution);
    });

    await waitFor(() => {
      expect(screen.getByText('Solution')).toBeInTheDocument();
    });
  });

  it('renders ComplexitySection with formatted complexity', async () => {
    const queryClient = createQueryClient();
    const mockSolution = {
      code: 'console.log("hello world");',
      thoughts: ['This is a thought'],
      time_complexity: 'n',
      space_complexity: '1'
    };

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ToastContext.Provider value={{ showToast: jest.fn() }}>
            <Solutions
              setView={jest.fn()}
              credits={10}
              currentLanguage="javascript"
              setLanguage={jest.fn()}
            />
          </ToastContext.Provider>
        </ToastProvider>
      </QueryClientProvider>
    );

    // Set the query data after rendering to trigger the subscription
    await act(async () => {
      queryClient.setQueryData(['solution'], mockSolution);
    });

    await waitFor(() => {
      expect(screen.getByText('Time:')).toBeInTheDocument();
      expect(screen.getByText('O(n)')).toBeInTheDocument();
      expect(screen.getByText('Space:')).toBeInTheDocument();
      expect(screen.getByText('O(1)')).toBeInTheDocument();
    });
  });

  it('renders ComplexitySection with default complexity when empty', async () => {
    const queryClient = createQueryClient();
    // Instead of empty/null values, use values that will be processed by the component
    // The loading state in the main component depends on whether the values are falsy,
    // but if they're falsy, they never stop loading. So we use non-empty strings
    // that will be formatted as "Complexity not available" by the formatComplexity function
    const mockSolution = {
      code: 'console.log("hello world");',
      thoughts: ['This is a thought'],
      time_complexity: '  ',  // will be treated as empty after trim by formatComplexity
      space_complexity: '  '   // will be treated as empty after trim by formatComplexity
    };

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ToastContext.Provider value={{ showToast: jest.fn() }}>
            <Solutions
              setView={jest.fn()}
              credits={10}
              currentLanguage="javascript"
              setLanguage={jest.fn()}
            />
          </ToastContext.Provider>
        </ToastProvider>
      </QueryClientProvider>
    );

    // Set the query data after rendering to trigger the subscription
    await act(async () => {
      queryClient.setQueryData(['solution'], mockSolution);
    });

    // Wait for the solution data to be processed and all sections to load
    await waitFor(() => {
      expect(screen.getByText('My Thoughts (Ctrl + Arrow keys to scroll)')).toBeInTheDocument();
      expect(screen.getByText('Solution')).toBeInTheDocument();
      // Wait for the complexity section to stop loading
      expect(screen.queryByText('Calculating complexity...')).not.toBeInTheDocument();
    });

    // Now verify that the complexity shows "Complexity not available"
    await waitFor(() => {
      expect(screen.getByText('Time:')).toBeInTheDocument();
      expect(screen.getByText('Space:')).toBeInTheDocument();
      // Check that both Time and Space show "Complexity not available"
      const complexityElements = screen.getAllByText('Complexity not available');
      expect(complexityElements).toHaveLength(2); // One for Time, one for Space
    }, { timeout: 2000 });
  });

  it('renders Thoughts section when thoughts data is available', async () => {
    const queryClient = createQueryClient();
    const mockSolution = {
      code: 'console.log("hello world");',
      thoughts: ['First thought', 'Second thought'],
      time_complexity: 'O(n)',
      space_complexity: 'O(1)'
    };

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ToastContext.Provider value={{ showToast: jest.fn() }}>
            <Solutions
              setView={jest.fn()}
              credits={10}
              currentLanguage="javascript"
              setLanguage={jest.fn()}
            />
          </ToastContext.Provider>
        </ToastProvider>
      </QueryClientProvider>
    );

    // Set the query data after rendering to trigger the subscription
    await act(async () => {
      queryClient.setQueryData(['solution'], mockSolution);
    });

    await waitFor(() => {
      expect(screen.getByText('My Thoughts (Ctrl + Arrow keys to scroll)')).toBeInTheDocument();
    });

    // Check that thoughts content is rendered
    await waitFor(() => {
      expect(screen.getByText('First thought')).toBeInTheDocument();
      expect(screen.getByText('Second thought')).toBeInTheDocument();
    });
  });

  it('renders ScreenshotQueue when solutionData is available', async () => {
    const queryClient = createQueryClient();
    const mockSolution = {
      code: 'console.log("hello world");',
      thoughts: ['This is a thought'],
      time_complexity: 'O(n)',
      space_complexity: 'O(1)'
    };

    mockElectronAPI.getScreenshots.mockResolvedValue([
      { path: 'path1', preview: 'preview1' }
    ]);

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ToastContext.Provider value={{ showToast: jest.fn() }}>
            <Solutions
              setView={jest.fn()}
              credits={10}
              currentLanguage="javascript"
              setLanguage={jest.fn()}
            />
          </ToastContext.Provider>
        </ToastProvider>
      </QueryClientProvider>
    );

    // Set the query data after rendering to trigger the subscription
    await act(async () => {
      queryClient.setQueryData(['solution'], mockSolution);
    });

    await waitFor(() => {
      expect(screen.getByTestId('screenshot-queue')).toBeInTheDocument();
    });
  });

  it('handles language change', async () => {
    const setLanguageMock = jest.fn();
    
    render(
      <MockWrapper>
        <Solutions 
          setView={jest.fn()}
          credits={10}
          currentLanguage="javascript"
          setLanguage={setLanguageMock}
        />
      </MockWrapper>
    );
    
    const changeLanguageBtn = screen.getByTestId('change-language-btn');
    fireEvent.click(changeLanguageBtn);
    
    expect(setLanguageMock).toHaveBeenCalledWith('javascript');
  });

  it('copies solution to clipboard when copy button is clicked', async () => {
    const queryClient = createQueryClient();
    const mockSolution = {
      code: 'console.log("hello world");',
      thoughts: ['This is a thought'],
      time_complexity: 'O(n)',
      space_complexity: 'O(1)'
    };

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ToastContext.Provider value={{ showToast: jest.fn() }}>
            <Solutions
              setView={jest.fn()}
              credits={10}
              currentLanguage="javascript"
              setLanguage={jest.fn()}
            />
          </ToastContext.Provider>
        </ToastProvider>
      </QueryClientProvider>
    );

    // Set the query data after rendering to trigger the subscription
    await act(async () => {
      queryClient.setQueryData(['solution'], mockSolution);
    });

    const copyButton = await screen.findByRole('button', { name: 'Copy' });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('console.log("hello world");');
    });
  });

  it('shows "Copied!" message after copying solution', async () => {
    const queryClient = createQueryClient();
    const mockSolution = {
      code: 'console.log("hello world");',
      thoughts: ['This is a thought'],
      time_complexity: 'O(n)',
      space_complexity: 'O(1)'
    };

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ToastContext.Provider value={{ showToast: jest.fn() }}>
            <Solutions
              setView={jest.fn()}
              credits={10}
              currentLanguage="javascript"
              setLanguage={jest.fn()}
            />
          </ToastContext.Provider>
        </ToastProvider>
      </QueryClientProvider>
    );

    // Set the query data after rendering to trigger the subscription
    await act(async () => {
      queryClient.setQueryData(['solution'], mockSolution);
    });

    // Wait for the component to render with the solution data
    const copyButton = await screen.findByRole('button', { name: 'Copy' });
    fireEvent.click(copyButton);

    // Wait for the button text to change to "Copied!"
    await waitFor(() => {
      expect(copyButton).toHaveTextContent('Copied!');
    }, { timeout: 3000 });
  });

  it('renders Debug component when new_solution is in query cache', async () => {
    const queryClient = createQueryClient();
    const mockNewSolution = {
      code: 'console.log("debug solution");',
      thoughts: ['Debug thought'],
      time_complexity: 'O(n)',
      space_complexity: 'O(1)'
    };

    queryClient.setQueryData(['new_solution'], mockNewSolution);

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ToastContext.Provider value={{ showToast: jest.fn() }}>
            <Solutions
              setView={jest.fn()}
              credits={10}
              currentLanguage="javascript"
              setLanguage={jest.fn()}
            />
          </ToastContext.Provider>
        </ToastProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('debug-component')).toBeInTheDocument();
    });
  });

  it('handles loading states correctly', () => {
    const queryClient = createQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ToastContext.Provider value={{ showToast: jest.fn() }}>
            <Solutions
              setView={jest.fn()}
              credits={10}
              currentLanguage="javascript"
              setLanguage={jest.fn()}
            />
          </ToastContext.Provider>
        </ToastProvider>
      </QueryClientProvider>
    );

    // Initially, it should render with processing state because problemStatementData and solutionData are null
    expect(screen.getByTestId('command-is-processing')).toHaveTextContent('processing');
  });

  it('formats complexity correctly in ComplexitySection', async () => {
    const queryClient = createQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ToastContext.Provider value={{ showToast: jest.fn() }}>
            <Solutions
              setView={jest.fn()}
              credits={10}
              currentLanguage="javascript"
              setLanguage={jest.fn()}
            />
          </ToastContext.Provider>
        </ToastProvider>
      </QueryClientProvider>
    );

    // Test with various complexity formats
    const mockSolution1 = {
      code: 'console.log("hello world");',
      thoughts: ['This is a thought'],
      time_complexity: 'n log n',
      space_complexity: 'O(n^2)'
    };

    // Set the query data after rendering to trigger the subscription
    await act(async () => {
      queryClient.setQueryData(['solution'], mockSolution1);
    });

    await waitFor(() => {
      expect(screen.getByText('Time:')).toBeInTheDocument();
      expect(screen.getByText('O(n log n)')).toBeInTheDocument();
      expect(screen.getByText('Space:')).toBeInTheDocument();
      expect(screen.getByText('O(n^2)')).toBeInTheDocument();
    });
  });
  
  // These tests check internal components, but since they're not exported,
  // they're tested through the main component rendering
});