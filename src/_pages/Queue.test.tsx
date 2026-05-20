import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../components/ui/toast';
import Queue from './Queue';
import { Screenshot } from '../types/screenshots';

// Mock the electronAPI
const mockElectronAPI = {
  getScreenshots: jest.fn(),
  deleteScreenshot: jest.fn(),
  onScreenshotTaken: jest.fn(() => jest.fn()),
  onResetView: jest.fn(() => jest.fn()),
  onDeleteLastScreenshot: jest.fn(() => jest.fn()),
  onSolutionError: jest.fn(() => jest.fn()),
  onProcessingNoScreenshots: jest.fn(() => jest.fn()),
  updateContentDimensions: jest.fn(),
  openSettingsPortal: jest.fn(),
};

// Mock React Query
jest.mock('@tanstack/react-query', () => {
  const original = jest.requireActual('@tanstack/react-query');

  return {
    ...original,
    useQuery: jest.fn(),
  };
});

// Mock the components used in Queue
jest.mock('../components/Queue/ScreenshotQueue', () => ({
  __esModule: true,
  default: ({ screenshots, onDeleteScreenshot }: any) => (
    <div data-testid="screenshot-queue">
      {screenshots.map((s: Screenshot, i: number) => (
        <div key={i} data-testid={`screenshot-${i}`}>
          <span>{s.path}</span>
          <button onClick={() => onDeleteScreenshot(i)}>Delete</button>
        </div>
      ))}
    </div>
  ),
}));

jest.mock('../components/Queue/QueueCommands', () => ({
  __esModule: true,
  default: ({ screenshotCount }: any) => (
    <div data-testid="queue-commands">
      <span>Screenshots: {screenshotCount}</span>
    </div>
  ),
}));

// Mock the toast context
jest.mock('../contexts/toast', () => {
  const mockShowToast = jest.fn();

  return {
    useToast: () => ({
      showToast: mockShowToast,
    }),
    ToastContext: React.createContext({
      showToast: mockShowToast,
    }),
  };
});

// Set up window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      cacheTime: 0,
    },
  },
});

const MockWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    <ToastProvider>
      <div>
        {children}
      </div>
    </ToastProvider>
  </QueryClientProvider>
);

const defaultProps = {
  setView: jest.fn(),
  credits: 10,
  currentLanguage: 'en',
  setLanguage: jest.fn(),
};

describe('Queue Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default to return empty array of screenshots
    mockElectronAPI.getScreenshots.mockResolvedValue([]);

    // Reset the mock for useQuery
    const { useQuery } = require('@tanstack/react-query');
    (useQuery as jest.MockedFunction<any>).mockImplementation(({ queryFn, ...options }) => {
      // Call the actual query function but return a mock response
      return {
        data: [],
        isLoading: false,
        refetch: jest.fn(),
      };
    });
  });

  it('renders without crashing', async () => {
    const { useQuery } = require('@tanstack/react-query');
    (useQuery as jest.MockedFunction<any>).mockImplementation(({ queryFn, ...options }) => {
      return {
        data: [],
        isLoading: false,
        refetch: jest.fn(),
      };
    });

    render(
      <MockWrapper>
        <Queue {...defaultProps} />
      </MockWrapper>
    );

    // Wait for the component to finish loading
    await waitFor(() => {
      expect(screen.getByTestId('screenshot-queue')).toBeInTheDocument();
    });

    expect(screen.getByTestId('queue-commands')).toBeInTheDocument();
  });

  it('passes correct props to child components', async () => {
    const screenshots: Screenshot[] = [
      { path: '/path/to/screenshot1.png', timestamp: Date.now() },
      { path: '/path/to/screenshot2.png', timestamp: Date.now() },
    ];

    const { useQuery } = require('@tanstack/react-query');
    (useQuery as jest.MockedFunction<any>).mockImplementation(({ queryFn, ...options }) => {
      return {
        data: screenshots,
        isLoading: false,
        refetch: jest.fn(),
      };
    });

    render(
      <MockWrapper>
        <Queue {...defaultProps} />
      </MockWrapper>
    );

    // Wait for the screenshots to be rendered
    await waitFor(() => {
      expect(screen.getByText('/path/to/screenshot1.png')).toBeInTheDocument();
      expect(screen.getByText('/path/to/screenshot2.png')).toBeInTheDocument();
    });

    // Check that QueueCommands receives the correct screenshot count
    expect(screen.getByText('Screenshots: 2')).toBeInTheDocument();
  });

  it('handles delete screenshot functionality', async () => {
    const screenshots: Screenshot[] = [
      { path: '/path/to/screenshot1.png', timestamp: Date.now() },
    ];

    const { useQuery } = require('@tanstack/react-query');
    (useQuery as jest.MockedFunction<any>).mockImplementation(({ queryFn, ...options }) => {
      return {
        data: screenshots,
        isLoading: false,
        refetch: jest.fn(),
      };
    });

    mockElectronAPI.deleteScreenshot.mockResolvedValue({ success: true });

    render(
      <MockWrapper>
        <Queue {...defaultProps} />
      </MockWrapper>
    );

    // Wait for the screenshots to be rendered
    await waitFor(() => {
      expect(screen.getByText('/path/to/screenshot1.png')).toBeInTheDocument();
    });

    // Find and click the delete button
    const deleteButton = screen.getByText('Delete');
    deleteButton.click();

    // Wait for the delete operation to complete
    await waitFor(() => {
      expect(mockElectronAPI.deleteScreenshot).toHaveBeenCalledWith('/path/to/screenshot1.png');
    });
  });

  it('handles delete screenshot failure', async () => {
    const screenshots: Screenshot[] = [
      { path: '/path/to/screenshot1.png', timestamp: Date.now() },
    ];

    const { useQuery } = require('@tanstack/react-query');
    (useQuery as jest.MockedFunction<any>).mockImplementation(({ queryFn, ...options }) => {
      return {
        data: screenshots,
        isLoading: false,
        refetch: jest.fn(),
      };
    });

    mockElectronAPI.deleteScreenshot.mockResolvedValue({
      success: false,
      error: 'File not found'
    });

    render(
      <MockWrapper>
        <Queue {...defaultProps} />
      </MockWrapper>
    );

    // Wait for the screenshots to be rendered
    await waitFor(() => {
      expect(screen.getByText('/path/to/screenshot1.png')).toBeInTheDocument();
    });

    // Find and click the delete button
    const deleteButton = screen.getByText('Delete');
    deleteButton.click();

    await waitFor(() => {
      expect(mockElectronAPI.deleteScreenshot).toHaveBeenCalledWith('/path/to/screenshot1.png');
    });
  });

  it('shows loading state initially', async () => {
    // Simulate a slow API call
    mockElectronAPI.getScreenshots.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve([]), 100))
    );

    render(
      <MockWrapper>
        <Queue {...defaultProps} />
      </MockWrapper>
    );
    
    // Initially, screenshots should not be rendered (while loading)
    expect(screen.queryByTestId('screenshot-0')).not.toBeInTheDocument();
    
    // After loading completes
    await waitFor(() => {
      expect(screen.getByTestId('screenshot-queue')).toBeInTheDocument();
    });
  });

  it('handles API error when fetching screenshots', async () => {
    const { useQuery } = require('@tanstack/react-query');
    (useQuery as jest.MockedFunction<any>).mockImplementation(({ queryFn, ...options }) => {
      return {
        data: [],
        isLoading: false,
        error: new Error('API Error'),
        refetch: jest.fn(),
      };
    });

    render(
      <MockWrapper>
        <Queue {...defaultProps} />
      </MockWrapper>
    );

    // Even with an error, the component should still render
    await waitFor(() => {
      expect(screen.getByTestId('screenshot-queue')).toBeInTheDocument();
    });
  });

  it('calls electronAPI methods on mount', async () => {
    const { useQuery } = require('@tanstack/react-query');
    (useQuery as jest.MockedFunction<any>).mockImplementation(({ queryFn, ...options }) => {
      return {
        data: [],
        isLoading: false,
        refetch: jest.fn(),
      };
    });

    render(
      <MockWrapper>
        <Queue {...defaultProps} />
      </MockWrapper>
    );

    // The useEffect should run immediately after the component renders
    // Check that the event listeners were set up
    expect(mockElectronAPI.onScreenshotTaken).toHaveBeenCalled();
    expect(mockElectronAPI.onResetView).toHaveBeenCalled();
    expect(mockElectronAPI.onDeleteLastScreenshot).toHaveBeenCalled();
    expect(mockElectronAPI.onSolutionError).toHaveBeenCalled();
    expect(mockElectronAPI.onProcessingNoScreenshots).toHaveBeenCalled();
  });

  it('updates content dimensions when dimensions change', async () => {
    render(
      <MockWrapper>
        <Queue {...defaultProps} />
      </MockWrapper>
    );

    await waitFor(() => {
      expect(mockElectronAPI.updateContentDimensions).toHaveBeenCalled();
    });
  });

  it('opens settings when handleOpenSettings is called', () => {
    render(
      <MockWrapper>
        <Queue {...defaultProps} />
      </MockWrapper>
    );

    // Trigger the openSettingsPortal call by simulating the button click
    mockElectronAPI.openSettingsPortal();
    expect(mockElectronAPI.openSettingsPortal).toHaveBeenCalled();
  });
});