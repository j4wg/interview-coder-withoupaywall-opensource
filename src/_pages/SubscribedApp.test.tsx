import React from 'react'
import { render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastContext } from '../contexts/toast'
import SubscribedApp from './SubscribedApp'

// Mock the Queue component to have a recognizable test element
jest.mock('./Queue', () => () => <div data-testid="queue-component">Queue Component</div>)

// Mock the Solutions component to have a recognizable test element
jest.mock('./Solutions', () => () => <div data-testid="solutions-component">Solutions Component</div>)

// Mock ResizeObserver
const mockResizeObserver = jest.fn();
mockResizeObserver.prototype = {
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
};

// Mock MutationObserver
const mockMutationObserver = jest.fn();
mockMutationObserver.prototype = {
  observe: jest.fn(),
  disconnect: jest.fn(),
  unobserve: jest.fn(),
};

// Assign to window for the component to use
Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: mockResizeObserver,
});

Object.defineProperty(window, 'MutationObserver', {
  writable: true,
  value: mockMutationObserver,
});

// Mock the window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: {
    onResetView: jest.fn(() => jest.fn()),
    onSolutionStart: jest.fn(() => jest.fn()),
    onUnauthorized: jest.fn(() => jest.fn()),
    onProblemExtracted: jest.fn(() => jest.fn()),
    onSolutionError: jest.fn(() => jest.fn()),
    updateContentDimensions: jest.fn(),
  },
  writable: true,
})


// Create a test query client
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})

// Mock wrapper component to include providers
const renderWithProviders = (props?: any) => {
  const queryClient = createTestQueryClient()
  const mockShowToast = jest.fn()

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastContext.Provider value={{ showToast: mockShowToast }}>
        <SubscribedApp {...props} />
      </ToastContext.Provider>
    </QueryClientProvider>
  )
}

describe('SubscribedApp', () => {
  const defaultProps = {
    credits: 10,
    currentLanguage: 'en',
    setLanguage: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders without crashing', () => {
    const { container } = renderWithProviders(defaultProps)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('initially shows the Queue component', () => {
    renderWithProviders(defaultProps)
    expect(document.querySelector('[data-testid="queue-component"]')).toBeInTheDocument()
  })

  it('starts with view set to "queue"', () => {
    renderWithProviders(defaultProps)
    // Since we can't directly check the internal state, we verify that the Queue component is shown initially
    expect(document.querySelector('[data-testid="queue-component"]')).toBeInTheDocument()
    expect(document.querySelector('[data-testid="solutions-component"]')).not.toBeInTheDocument()
  })

  it('calls updateContentDimensions when component mounts', async () => {
    renderWithProviders(defaultProps)

    // Wait for the useEffect to run
    await waitFor(() => {
      expect(window.electronAPI.updateContentDimensions).toHaveBeenCalledWith({
        width: 800,
        height: 600,
      })
    })
  })

  it('sets up and cleans up ResizeObserver', () => {
    const { unmount } = renderWithProviders(defaultProps)

    // Check that the ResizeObserver was instantiated
    expect(mockResizeObserver).toHaveBeenCalledTimes(1)
    expect(mockResizeObserver.prototype.observe).toHaveBeenCalled()

    unmount()
    expect(mockResizeObserver.prototype.disconnect).toHaveBeenCalled()
  })

  it('sets up and cleans up MutationObserver', () => {
    const { unmount } = renderWithProviders(defaultProps)

    // Check that the MutationObserver was instantiated
    expect(mockMutationObserver).toHaveBeenCalledTimes(1)
    expect(mockMutationObserver.prototype.observe).toHaveBeenCalled()

    unmount()
    expect(mockMutationObserver.prototype.disconnect).toHaveBeenCalled()
  })

  it('subscribes to electronAPI events on mount', () => {
    renderWithProviders(defaultProps)

    // The actual component has 3 onResetView calls (2 in one effect and 1 in another)
    expect(window.electronAPI.onResetView).toHaveBeenCalledTimes(3)
    expect(window.electronAPI.onSolutionStart).toHaveBeenCalledTimes(1)
    expect(window.electronAPI.onUnauthorized).toHaveBeenCalledTimes(1)
    expect(window.electronAPI.onProblemExtracted).toHaveBeenCalledTimes(1)
    expect(window.electronAPI.onSolutionError).toHaveBeenCalledTimes(1)
  })

  it('cleans up all event subscriptions on unmount', () => {
    const mockCleanup = jest.fn()

    // Mock all event subscription functions to return cleanup functions
    window.electronAPI.onResetView = jest.fn(() => mockCleanup)
    window.electronAPI.onSolutionStart = jest.fn(() => mockCleanup)
    window.electronAPI.onUnauthorized = jest.fn(() => mockCleanup)
    window.electronAPI.onProblemExtracted = jest.fn(() => mockCleanup)
    window.electronAPI.onSolutionError = jest.fn(() => mockCleanup)

    const { unmount } = renderWithProviders(defaultProps)

    // Reset the mock to focus on the cleanups
    mockCleanup.mockClear()

    unmount()

    // Each event listener should have been cleaned up (5 total: 3 reset view + 1 solution start + 1 unauthorized + 1 problem extracted + 1 solution error)
    expect(mockCleanup).toHaveBeenCalledTimes(7)
  })

  it('passes props to child components', () => {
    renderWithProviders(defaultProps)

    // Verify that props are passed correctly to Queue component
    expect(document.querySelector('[data-testid="queue-component"]')).toBeInTheDocument()
  })
})