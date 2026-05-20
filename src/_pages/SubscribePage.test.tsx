import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { User } from '@supabase/supabase-js';
import { act } from 'react-dom/test-utils';
import SubscribePage from './SubscribePage';

// Mock the electronAPI
const mockElectronAPI = {
  openSubscriptionPortal: jest.fn(),
  updateContentDimensions: jest.fn(),
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

// Mock the supabase module
jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: jest.fn().mockResolvedValue({ error: null }),
    },
  },
}));

describe('SubscribePage', () => {
  const mockUser: User = {
    id: 'test-user-id',
    email: 'test@example.com',
    user_metadata: {},
    app_metadata: {},
    aud: 'authenticated',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test 1: Component renders correctly with user props
  it('renders correctly with user props', () => {
    render(<SubscribePage user={mockUser} />);

    expect(screen.getByText('Welcome to Interview Coder')).toBeInTheDocument();
    expect(screen.getByText(/To continue using Interview Coder, you'll need to subscribe/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Subscribe/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Log Out/i })).toBeInTheDocument();
    
    // Check for the keyboard shortcuts section
    expect(screen.getByText('Toggle Visibility')).toBeInTheDocument();
    expect(screen.getByText('Quit App')).toBeInTheDocument();
  });

  // Test 2: Subscribe button functionality
  it('calls openSubscriptionPortal when subscribe button is clicked', async () => {
    render(<SubscribePage user={mockUser} />);

    const subscribeButton = screen.getByRole('button', { name: /Subscribe/i });
    fireEvent.click(subscribeButton);

    await waitFor(() => {
      expect(mockElectronAPI.openSubscriptionPortal).toHaveBeenCalledWith({
        id: mockUser.id,
        email: mockUser.email,
      });
    });
  });

  // Test 3: Sign out button functionality
  it('calls supabase.auth.signOut when sign out button is clicked', async () => {
    // Import the actual supabase module to access the mock
    const { supabase } = require('../lib/supabase');
    
    render(<SubscribePage user={mockUser} />);

    const signOutButton = screen.getByRole('button', { name: /Log Out/i });
    fireEvent.click(signOutButton);

    await waitFor(() => {
      expect(supabase.auth.signOut).toHaveBeenCalled();
    });
  });

  // Test 4: Error handling for sign out
  it('displays error message when sign out fails', async () => {
    // Mock supabase signOut to return an error
    const { supabase } = require('../lib/supabase');
    (supabase.auth.signOut as jest.MockedFunction<any>).mockResolvedValueOnce({ error: { message: 'Sign out error' } });

    render(<SubscribePage user={mockUser} />);

    const signOutButton = screen.getByRole('button', { name: /Log Out/i });
    fireEvent.click(signOutButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to sign out. Please try again.')).toBeInTheDocument();
    });
  });

  // Test 5: Error handling for subscription portal
  it('displays error message when subscription portal fails', async () => {
    mockElectronAPI.openSubscriptionPortal.mockResolvedValueOnce({ success: false, error: 'Portal error' });

    render(<SubscribePage user={mockUser} />);

    const subscribeButton = screen.getByRole('button', { name: /Subscribe/i });
    fireEvent.click(subscribeButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to open subscription portal. Please try again.')).toBeInTheDocument();
    });
  });

  // Test 6: useEffect for updating dimensions
  it('calls updateContentDimensions on mount', async () => {
    render(<SubscribePage user={mockUser} />);

    // Wait for the effect to run
    await waitFor(() => {
      expect(mockElectronAPI.updateContentDimensions).toHaveBeenCalledWith({
        width: 400,
        height: 400,
      });
    });
  });

  // Test 7: Component handles missing email gracefully
  it('handles user with no email gracefully', () => {
    const userWithoutEmail = {
      ...mockUser,
      email: undefined
    };
    
    render(<SubscribePage user={userWithoutEmail as User} />);

    const subscribeButton = screen.getByRole('button', { name: /Subscribe/i });
    fireEvent.click(subscribeButton);

    // This test ensures that the component doesn't crash when email is undefined
    // The actual call will contain undefined for email, which should be handled by the electronAPI
  });

  // Test 8: Error message disappears after timeout
  it('removes error message after timeout', async () => {
    jest.useFakeTimers();

    // Mock setTimeout to be synchronous for testing
    jest.spyOn(global.Date, 'now').mockImplementation(() => new Date('2023-01-01').getTime());

    mockElectronAPI.openSubscriptionPortal.mockResolvedValueOnce({ success: false, error: 'Portal error' });

    render(<SubscribePage user={mockUser} />);

    const subscribeButton = screen.getByRole('button', { name: /Subscribe/i });
    fireEvent.click(subscribeButton);

    // Check error is shown
    await waitFor(() => {
      expect(screen.getByText('Failed to open subscription portal. Please try again.')).toBeInTheDocument();
    });

    // Fast forward time to clear the timeout
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    // Wait for React to process the state update
    await waitFor(() => {
      expect(screen.queryByText('Failed to open subscription portal. Please try again.')).not.toBeInTheDocument();
    });

    jest.useRealTimers();
  });

  // Test 9: Sign out error also gets cleared after timeout
  it('removes sign out error message after timeout', async () => {
    jest.useFakeTimers();

    const { supabase } = require('../lib/supabase');
    (supabase.auth.signOut as jest.MockedFunction<any>).mockResolvedValueOnce({ error: { message: 'Sign out error' } });

    render(<SubscribePage user={mockUser} />);

    const signOutButton = screen.getByRole('button', { name: /Log Out/i });
    fireEvent.click(signOutButton);

    // Check error is shown
    await waitFor(() => {
      expect(screen.getByText('Failed to sign out. Please try again.')).toBeInTheDocument();
    });

    // Fast forward time to clear the timeout
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    // Wait for React to process the state update
    await waitFor(() => {
      expect(screen.queryByText('Failed to sign out. Please try again.')).not.toBeInTheDocument();
    });

    jest.useRealTimers();
  });
});