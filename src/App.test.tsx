import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { jest } from '@jest/globals';

// Mock the electronAPI
const mockElectronAPI = {
  checkApiKey: jest.fn(),
  onShowSettings: jest.fn(() => jest.fn()),
  getConfig: jest.fn(),
  updateConfig: jest.fn(),
  onApiKeyInvalid: jest.fn(() => jest.fn()),
  onSolutionSuccess: jest.fn(() => jest.fn()),
  removeListener: jest.fn(),
  showSettings: jest.fn(),
};

// Mock window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

// Mock child components to avoid dependency issues
jest.mock('./_pages/SubscribedApp', () => ({
  __esModule: true,
  default: ({ credits, currentLanguage }: { credits: number; currentLanguage: string }) => (
    <div data-testid="subscribed-app">
      Subscribed App - Credits: {credits}, Language: {currentLanguage}
    </div>
  )
}));

jest.mock('./components/UpdateNotification', () => ({
  __esModule: true,
  UpdateNotification: () => <div data-testid="update-notification">Update Notification</div>,
}));

jest.mock('./components/WelcomeScreen', () => ({
  __esModule: true,
  WelcomeScreen: ({ onOpenSettings }: { onOpenSettings: () => void }) => (
    <div data-testid="welcome-screen">
      Welcome Screen
      <button onClick={onOpenSettings}>Open Settings</button>
    </div>
  )
}));

jest.mock('./components/Settings/SettingsDialog', () => ({
  __esModule: true,
  SettingsDialog: ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => (
    <div data-testid="settings-dialog" data-open={open}>
      Settings Dialog
      <button onClick={() => onOpenChange(false)}>Close</button>
    </div>
  )
}));

jest.mock('./contexts/toast', () => ({
  __esModule: true,
  ToastContext: {
    Provider: ({ children }: { children: React.ReactNode }) => <div data-testid="toast-provider">{children}</div>,
  }
}));

// Mock UI components
jest.mock('./components/ui/toast', () => ({
  __esModule: true,
  ToastProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Toast: ({ children, open }: { children: React.ReactNode; open: boolean }) => (
    <div data-testid="toast" data-open={open}>
      {children}
    </div>
  ),
  ToastTitle: ({ children }: { children: React.ReactNode }) => <div data-testid="toast-title">{children}</div>,
  ToastDescription: ({ children }: { children: React.ReactNode }) => <div data-testid="toast-description">{children}</div>,
  ToastViewport: () => <div data-testid="toast-viewport">Toast Viewport</div>,
}));

describe('App Component', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 0,
      },
    },
  });

  const renderApp = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset window properties that App sets
    delete (window as any).__CREDITS__;
    delete (window as any).__LANGUAGE__;
    delete (window as any).__IS_INITIALIZED__;
  });

  it('renders loading state initially', () => {
    // Mock the getConfig to resolve after a delay to simulate initialization
    mockElectronAPI.getConfig.mockResolvedValue({
      language: 'python',
    });
    mockElectronAPI.checkApiKey.mockResolvedValue(true);

    renderApp();

    // Initially should show loading state
    expect(screen.getByText('Initializing...')).toBeInTheDocument();
  });

  it('renders SubscribedApp when initialized and has API key', async () => {
    mockElectronAPI.getConfig.mockResolvedValue({
      language: 'javascript',
    });
    mockElectronAPI.checkApiKey.mockResolvedValue(true);

    renderApp();

    // Wait for initialization to complete
    await waitFor(() => {
      expect(screen.getByTestId('subscribed-app')).toBeInTheDocument();
    });

    expect(screen.getByText(/Subscribed App - Credits: 999, Language: javascript/)).toBeInTheDocument();
  });

  it('renders WelcomeScreen when initialized and no API key', async () => {
    mockElectronAPI.getConfig.mockResolvedValue({
      language: 'python',
    });
    mockElectronAPI.checkApiKey.mockResolvedValue(false);

    renderApp();

    // Wait for initialization to complete
    await waitFor(() => {
      expect(screen.getByTestId('welcome-screen')).toBeInTheDocument();
    });

    expect(screen.getByText('Welcome Screen')).toBeInTheDocument();
  });

  it('updates credits to 999 on initialization', async () => {
    mockElectronAPI.getConfig.mockResolvedValue({
      language: 'python',
    });
    mockElectronAPI.checkApiKey.mockResolvedValue(true);

    renderApp();

    await waitFor(() => {
      expect(screen.getByTestId('subscribed-app')).toBeInTheDocument();
    });

    // Check that window.__CREDITS__ was set correctly
    expect((window as any).__CREDITS__).toBe(999);
  });

  it('sets initial language to python when no config is provided', async () => {
    mockElectronAPI.getConfig.mockResolvedValue(null);
    mockElectronAPI.checkApiKey.mockResolvedValue(true);

    renderApp();

    await waitFor(() => {
      expect(screen.getByTestId('subscribed-app')).toBeInTheDocument();
    });

    expect(screen.getByText(/Language: python/)).toBeInTheDocument();
    expect((window as any).__LANGUAGE__).toBe('python');
  });

  it('uses language from config when available', async () => {
    mockElectronAPI.getConfig.mockResolvedValue({
      language: 'typescript',
    });
    mockElectronAPI.checkApiKey.mockResolvedValue(true);

    renderApp();

    await waitFor(() => {
      expect(screen.getByTestId('subscribed-app')).toBeInTheDocument();
    });

    expect(screen.getByText(/Language: typescript/)).toBeInTheDocument();
    expect((window as any).__LANGUAGE__).toBe('typescript');
  });

  it('shows settings dialog when no API key is found', async () => {
    mockElectronAPI.getConfig.mockResolvedValue({
      language: 'python',
    });
    mockElectronAPI.checkApiKey.mockResolvedValue(false);

    renderApp();

    // Wait for initialization to complete and settings to open
    await waitFor(() => {
      const settingsDialog = screen.getByTestId('settings-dialog');
      expect(settingsDialog).toBeInTheDocument();
      expect(settingsDialog.getAttribute('data-open')).toBe('true');
    }, { timeout: 2000 });
  });

  it('shows settings dialog when requested via electronAPI', async () => {
    mockElectronAPI.getConfig.mockResolvedValue({
      language: 'python',
    });
    mockElectronAPI.checkApiKey.mockResolvedValue(true);

    renderApp();

    // Wait for initialization to complete
    await waitFor(() => {
      expect(screen.getByTestId('subscribed-app')).toBeInTheDocument();
    });

    // Simulate settings open request event
    const showSettingsCallback = mockElectronAPI.onShowSettings.mock.calls[0][0];
    showSettingsCallback();

    // Check that settings dialog is open
    await waitFor(() => {
      const settingsDialog = screen.getByTestId('settings-dialog');
      expect(settingsDialog).toBeInTheDocument();
      expect(settingsDialog.getAttribute('data-open')).toBe('true');
    });
  });

  it('should render UpdateNotification component', () => {
    mockElectronAPI.getConfig.mockResolvedValue({
      language: 'python',
    });
    mockElectronAPI.checkApiKey.mockResolvedValue(true);

    renderApp();

    expect(screen.getByTestId('update-notification')).toBeInTheDocument();
  });

  it('should render toast provider context', () => {
    mockElectronAPI.getConfig.mockResolvedValue({
      language: 'python',
    });
    mockElectronAPI.checkApiKey.mockResolvedValue(true);

    renderApp();

    expect(screen.getByTestId('toast-provider')).toBeInTheDocument();
  });

  it('should render toast viewport', () => {
    mockElectronAPI.getConfig.mockResolvedValue({
      language: 'python',
    });
    mockElectronAPI.checkApiKey.mockResolvedValue(true);

    renderApp();

    expect(screen.getByTestId('toast-viewport')).toBeInTheDocument();
  });

  it('handles config loading error gracefully', async () => {
    mockElectronAPI.getConfig.mockRejectedValue(new Error('Config load failed'));
    mockElectronAPI.checkApiKey.mockResolvedValue(true);

    renderApp();

    // Should still initialize with defaults despite config error
    await waitFor(() => {
      expect(screen.getByTestId('subscribed-app')).toBeInTheDocument();
    });

    // Should default to python language
    expect(screen.getByText(/Language: python/)).toBeInTheDocument();
  });

  it('should set __IS_INITIALIZED__ window property when initialized', async () => {
    mockElectronAPI.getConfig.mockResolvedValue({
      language: 'python',
    });
    mockElectronAPI.checkApiKey.mockResolvedValue(true);

    renderApp();

    await waitFor(() => {
      expect(screen.getByTestId('subscribed-app')).toBeInTheDocument();
    });

    expect((window as any).__IS_INITIALIZED__).toBe(true);
  });
});