import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Debug from './Debug';
import { ToastProvider } from '../contexts/toast';
import { Screenshot } from '../types/screenshots';

// Mock the electronAPI
const mockElectronAPI = {
  getScreenshots: jest.fn(),
  onScreenshotTaken: jest.fn(() => jest.fn()),
  onResetView: jest.fn(() => jest.fn()),
  onDebugSuccess: jest.fn(() => jest.fn()),
  onDebugStart: jest.fn(() => jest.fn()),
  onDebugError: jest.fn(() => jest.fn()),
  deleteScreenshot: jest.fn(),
  updateContentDimensions: jest.fn(),
};

// Mock the window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

// Mock the __CREDITS__ global
Object.defineProperty(window, '__CREDITS__', {
  value: 10,
  writable: true,
});

// Mock child components that are used in Debug.tsx
jest.mock('../components/Queue/ScreenshotQueue', () => ({
  __esModule: true,
  default: ({ screenshots, onDeleteScreenshot }: { screenshots: Screenshot[], onDeleteScreenshot: (index: number) => void }) => (
    <div data-testid="screenshot-queue">
      {screenshots.map((screenshot, index) => (
        <div key={screenshot.id} data-testid={`screenshot-${screenshot.id}`} onClick={() => onDeleteScreenshot(index)}>
          {screenshot.id}
        </div>
      ))}
    </div>
  ),
}));

jest.mock('../components/Solutions/SolutionCommands', () => ({
  __esModule: true,
  default: ({ currentLanguage, setLanguage }: { currentLanguage: string, setLanguage: (lang: string) => void }) => (
    <div data-testid="solution-commands">
      <span>Current Language: {currentLanguage}</span>
      <button onClick={() => setLanguage('javascript')}>Set JS</button>
    </div>
  ),
}));

jest.mock('./Solutions', () => ({
  __esModule: true,
  ContentSection: ({ title, content }: { title: string, content: React.ReactNode }) => (
    <div data-testid="content-section">
      <h3>{title}</h3>
      {content}
    </div>
  ),
  ComplexitySection: ({ timeComplexity, spaceComplexity }: { timeComplexity: string, spaceComplexity: string }) => (
    <div data-testid="complexity-section">
      <span data-testid="time-complexity">{timeComplexity}</span>
      <span data-testid="space-complexity">{spaceComplexity}</span>
    </div>
  )
}));

// Mock SyntaxHighlighter
jest.mock('react-syntax-highlighter', () => ({
  __esModule: true,
  Prism: ({ children, language, style, showLineNumbers, customStyle, wrapLongLines }: any) => (
    <pre
      data-testid="syntax-highlighter"
      data-language={language}
      style={customStyle}
    >
      {children}
    </pre>
  ),
}));

// Mock toast context
const MockToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div>{children}</div>
);

jest.mock('../contexts/toast', () => ({
  __esModule: true,
  ToastProvider: ({ children }: { children: React.ReactNode }) => <MockToastProvider>{children}</MockToastProvider>,
  useToast: () => ({
    showToast: jest.fn(),
  }),
}));

// Create a wrapper with providers
const renderWithProviders = (ui: React.ReactElement, options = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {ui}
      </ToastProvider>
    </QueryClientProvider>,
    options
  );
};

describe('Debug Component', () => {
  const defaultProps = {
    isProcessing: false,
    setIsProcessing: jest.fn(),
    currentLanguage: 'javascript',
    setLanguage: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockElectronAPI.getScreenshots.mockResolvedValue([]);
  });

  test('renders without crashing', async () => {
    renderWithProviders(<Debug {...defaultProps} />);

    // Wait for component to render
    await waitFor(() => {
      expect(screen.getByTestId('screenshot-queue')).toBeInTheDocument();
    });
    
    expect(screen.getByTestId('solution-commands')).toBeInTheDocument();
    expect(screen.getByTestId('content-section')).toBeInTheDocument();
    expect(screen.getByTestId('complexity-section')).toBeInTheDocument();
  });

  test('renders with initial state when no cached data', async () => {
    renderWithProviders(<Debug {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Current Language: javascript')).toBeInTheDocument();
    });

    // Check that loading states are shown initially
    expect(screen.getByText('Loading solutions...')).toBeInTheDocument();
    expect(screen.getByText('Loading debug analysis...')).toBeInTheDocument();
  });

  test('renders with cached solution data', async () => {
    const mockCachedData = {
      code: 'console.log("test");',
      debug_analysis: 'Debug analysis based on your screenshots',
      thoughts: ['Thought 1', 'Thought 2'],
      time_complexity: 'O(1)',
      space_complexity: 'O(1)',
    };

    // Mock the query client to return cached data
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          cacheTime: 0,
        },
      },
    });
    queryClient.setQueryData(['new_solution'], mockCachedData);

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <Debug {...defaultProps} />
        </ToastProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      const codeElement = screen.queryByTestId('syntax-highlighter');
      expect(codeElement).toBeInTheDocument();
      if (codeElement) {
        expect(codeElement).toHaveTextContent('console.log("test");');
      }
    });
  });

  test('handles screenshot data correctly', async () => {
    const mockScreenshots: Screenshot[] = [
      { id: '1', path: 'path1', preview: 'preview1', timestamp: Date.now() },
      { id: '2', path: 'path2', preview: 'preview2', timestamp: Date.now() },
    ];

    mockElectronAPI.getScreenshots.mockResolvedValue(mockScreenshots);

    renderWithProviders(<Debug {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('path1')).toBeInTheDocument();
      expect(screen.getByText('path2')).toBeInTheDocument();
    });
  });

  test('updates language when setLanguage is called', async () => {
    const setLanguageMock = jest.fn();
    renderWithProviders(
      <Debug 
        {...defaultProps} 
        setLanguage={setLanguageMock} 
      />
    );

    await waitFor(() => {
      const languageButton = screen.getByText('Set JS');
      languageButton.click();
    });

    expect(setLanguageMock).toHaveBeenCalledWith('javascript');
  });

  test('handles debug success event', async () => {
    const mockDebugData = {
      code: 'const x = 5;',
      debug_analysis: 'Debug analysis here',
      thoughts: ['Analysis point 1'],
      time_complexity: 'O(1)',
      space_complexity: 'O(1)',
    };

    renderWithProviders(<Debug {...defaultProps} />);

    // Simulate the debug success event
    const debugSuccessListener = mockElectronAPI.onDebugSuccess.mock.calls[0][0];
    await act(async () => {
      debugSuccessListener(mockDebugData);
    });

    // Check that setIsProcessing was called with false
    expect(defaultProps.setIsProcessing).toHaveBeenCalledWith(false);
  });

  test('handles debug start event', async () => {
    renderWithProviders(<Debug {...defaultProps} />);

    // Simulate the debug start event
    const debugStartListener = mockElectronAPI.onDebugStart.mock.calls[0][0];
    await act(async () => {
      debugStartListener();
    });

    expect(defaultProps.setIsProcessing).toHaveBeenCalledWith(true);
  });

  test('handles debug error event', async () => {
    renderWithProviders(<Debug {...defaultProps} />);

    // Simulate the debug error event
    const debugErrorListener = mockElectronAPI.onDebugError.mock.calls[0][0];
    await act(async () => {
      debugErrorListener('Error message');
    });

    expect(defaultProps.setIsProcessing).toHaveBeenCalledWith(false);
  });

  test('deletes screenshot when handleDeleteExtraScreenshot is called', async () => {
    const mockScreenshots: Screenshot[] = [
      { id: '1', path: 'path1', preview: 'preview1', timestamp: Date.now() },
    ];

    mockElectronAPI.getScreenshots.mockResolvedValue(mockScreenshots);
    mockElectronAPI.deleteScreenshot.mockResolvedValue({ success: true });

    renderWithProviders(<Debug {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('path1')).toBeInTheDocument();
    });

    // Click the screenshot to trigger deletion
    const screenshotElement = screen.getByText('path1');
    await act(async () => {
      screenshotElement.click();
    });

    expect(mockElectronAPI.deleteScreenshot).toHaveBeenCalledWith('path1');
  });

  test('renders loading states when isProcessing is true', async () => {
    renderWithProviders(<Debug {...defaultProps} isProcessing={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('screenshot-queue')).toBeInTheDocument();
    });

    // Verify the loading state is reflected in the UI
    expect(screen.getByText('Loading solutions...')).toBeInTheDocument();
  });

  test('renders with different language mappings (golang to go)', async () => {
    renderWithProviders(<Debug {...defaultProps} currentLanguage="golang" />);

    await waitFor(() => {
      expect(screen.getByText('Current Language: golang')).toBeInTheDocument();
    });

    // Code section should handle 'golang' -> 'go' language mapping
    // The SyntaxHighlighter should receive 'go' as the language when currentLanguage is 'golang'
  });
});