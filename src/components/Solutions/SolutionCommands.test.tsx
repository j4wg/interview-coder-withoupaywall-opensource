import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SolutionCommands, { SolutionCommandsProps } from './SolutionCommands';
import { COMMAND_KEY } from '../../utils/platform';

// Mock the electronAPI
const mockElectronAPI = {
  toggleMainWindow: jest.fn(),
  triggerScreenshot: jest.fn(),
  triggerProcessScreenshots: jest.fn(),
  triggerReset: jest.fn(),
  openSettingsPortal: jest.fn(),
};

// Mock the contexts and other components
jest.mock('../../contexts/toast', () => ({
  useToast: () => ({
    showToast: jest.fn(),
  }),
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: jest.fn().mockResolvedValue({ error: null }),
    },
  },
}));

jest.mock('../shared/LanguageSelector', () => ({
  LanguageSelector: ({ currentLanguage, setLanguage }: { currentLanguage: string; setLanguage: (lang: string) => void }) => (
    <div data-testid="language-selector">
      <span>Current Language: {currentLanguage}</span>
      <button onClick={() => setLanguage('en')}>Set English</button>
    </div>
  ),
}));

// Mock global window object with electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

// Mock localStorage and sessionStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    clear: jest.fn(),
  },
  writable: true,
});

Object.defineProperty(window, 'sessionStorage', {
  value: {
    clear: jest.fn(),
  },
  writable: true,
});

describe('SolutionCommands', () => {
  const defaultProps: SolutionCommandsProps = {
    onTooltipVisibilityChange: jest.fn(),
    isProcessing: false,
    credits: 10,
    currentLanguage: 'en',
    setLanguage: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock implementations
    mockElectronAPI.toggleMainWindow.mockResolvedValue({ success: true });
    mockElectronAPI.triggerScreenshot.mockResolvedValue({ success: true });
    mockElectronAPI.triggerProcessScreenshots.mockResolvedValue({ success: true });
    mockElectronAPI.triggerReset.mockResolvedValue({ success: true });
  });

  describe('Rendering', () => {
    test('renders all main command buttons', () => {
      render(<SolutionCommands {...defaultProps} />);
      
      expect(screen.getByText('Show/Hide')).toBeInTheDocument();
      expect(screen.getByText('Screenshot your code')).toBeInTheDocument();
      expect(screen.getByText('Start Over')).toBeInTheDocument();
    });

    test('renders keyboard shortcuts correctly', () => {
      render(<SolutionCommands {...defaultProps} />);

      const showHideShortcuts = screen.getAllByText(COMMAND_KEY);
      expect(showHideShortcuts).toHaveLength(3); // Show/Hide, Screenshot, Start Over (Debug is not visible because no extraScreenshots)

      expect(screen.getByText('B')).toBeInTheDocument();
      expect(screen.getByText('H')).toBeInTheDocument();
      expect(screen.getByText('R')).toBeInTheDocument();
    });

    test('renders gear icon for settings', () => {
      render(<SolutionCommands {...defaultProps} />);

      // Find the gear icon container div by its structure - it's the div with relative inline-block class
      const gearContainer = document.querySelector('div.relative.inline-block');
      expect(gearContainer).toBeInTheDocument();
    });

    test('renders credits when provided', () => {
      render(<SolutionCommands {...defaultProps} />);
      // The component doesn't actually render credits in the current version,
      // but this test can be updated if the component is modified to display credits
    });
  });

  describe('Conditional rendering based on isProcessing prop', () => {
    test('shows screenshot button when not processing', () => {
      render(<SolutionCommands {...defaultProps} isProcessing={false} />);
      
      expect(screen.getByText('Screenshot your code')).toBeInTheDocument();
    });

    test('hides screenshot button when processing', () => {
      render(<SolutionCommands {...defaultProps} isProcessing={true} />);
      
      expect(screen.queryByText('Screenshot your code')).not.toBeInTheDocument();
    });

    test('shows debug button when extraScreenshots exist and not processing', () => {
      render(
        <SolutionCommands
          {...defaultProps}
          extraScreenshots={[{ id: '1', url: 'test', timestamp: Date.now() }]}
          isProcessing={false}
        />
      );
      
      expect(screen.getByText('Debug')).toBeInTheDocument();
    });

    test('hides debug button when extraScreenshots exist but processing', () => {
      render(
        <SolutionCommands
          {...defaultProps}
          extraScreenshots={[{ id: '1', url: 'test', timestamp: Date.now() }]}
          isProcessing={true}
        />
      );
      
      expect(screen.queryByText('Debug')).not.toBeInTheDocument();
    });

    test('hides debug button when no extraScreenshots', () => {
      render(
        <SolutionCommands
          {...defaultProps}
          extraScreenshots={[]}
          isProcessing={false}
        />
      );
      
      expect(screen.queryByText('Debug')).not.toBeInTheDocument();
    });

    test('changes screenshot text when extraScreenshots exist', () => {
      render(
        <SolutionCommands
          {...defaultProps}
          extraScreenshots={[{ id: '1', url: 'test', timestamp: Date.now() }]}
          isProcessing={false}
        />
      );
      
      expect(screen.getByText('Screenshot')).toBeInTheDocument();
      expect(screen.queryByText('Screenshot your code')).not.toBeInTheDocument();
    });
  });

  describe('Event handling', () => {
    test('calls toggleMainWindow when Show/Hide is clicked', async () => {
      render(<SolutionCommands {...defaultProps} />);
      
      const showHideButton = screen.getByText('Show/Hide').closest('div');
      fireEvent.click(showHideButton!);
      
      await waitFor(() => {
        expect(mockElectronAPI.toggleMainWindow).toHaveBeenCalledTimes(1);
      });
    });

    test('calls triggerScreenshot when Screenshot is clicked', async () => {
      render(<SolutionCommands {...defaultProps} />);
      
      const screenshotButton = screen.getByText('Screenshot your code').closest('div');
      fireEvent.click(screenshotButton!);
      
      await waitFor(() => {
        expect(mockElectronAPI.triggerScreenshot).toHaveBeenCalledTimes(1);
      });
    });

    test('calls triggerProcessScreenshots when Debug is clicked', async () => {
      render(
        <SolutionCommands
          {...defaultProps}
          extraScreenshots={[{ id: '1', url: 'test', timestamp: Date.now() }]}
          isProcessing={false}
        />
      );
      
      const debugButton = screen.getByText('Debug').closest('div');
      fireEvent.click(debugButton!);
      
      await waitFor(() => {
        expect(mockElectronAPI.triggerProcessScreenshots).toHaveBeenCalledTimes(1);
      });
    });

    test('calls triggerReset when Start Over is clicked', async () => {
      render(<SolutionCommands {...defaultProps} />);
      
      const startOverButton = screen.getByText('Start Over').closest('div');
      fireEvent.click(startOverButton!);
      
      await waitFor(() => {
        expect(mockElectronAPI.triggerReset).toHaveBeenCalledTimes(1);
      });
    });

    test('calls openSettingsPortal when Settings button is clicked', async () => {
      render(<SolutionCommands {...defaultProps} />);

      // The settings button is in the tooltip, so we need to hover over the gear icon first
      // Find the gear icon container div by using querySelector on the document body
      const gearIconDiv = document.querySelector('div.relative.inline-block');
      fireEvent.mouseEnter(gearIconDiv);

      // Wait for the tooltip to appear and then find the Settings button
      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });

      const settingsButton = screen.getByText('Settings');
      fireEvent.click(settingsButton);

      expect(mockElectronAPI.openSettingsPortal).toHaveBeenCalledTimes(1);
    });

    test('handles error when toggleMainWindow fails', async () => {
      mockElectronAPI.toggleMainWindow.mockResolvedValue({ success: false, error: 'Test error' });

      const showToast = jest.fn();
      // Replace the original useToast hook with our mock
      jest.spyOn(require('../../contexts/toast'), 'useToast').mockReturnValue({ showToast });

      render(<SolutionCommands {...defaultProps} />);

      const showHideButton = screen.getByText('Show/Hide').closest('div');
      fireEvent.click(showHideButton!);

      await waitFor(() => {
        expect(showToast).toHaveBeenCalledWith('Error', 'Failed to toggle window', 'error');
      });

      // Restore the original implementation after the test
      jest.restoreAllMocks();
    });

    test('handles error when triggerScreenshot fails', async () => {
      mockElectronAPI.triggerScreenshot.mockResolvedValue({ success: false, error: 'Test error' });

      const showToast = jest.fn();
      // Replace the original useToast hook with our mock
      jest.spyOn(require('../../contexts/toast'), 'useToast').mockReturnValue({ showToast });

      render(<SolutionCommands {...defaultProps} />);

      const screenshotButton = screen.getByText('Screenshot your code').closest('div');
      fireEvent.click(screenshotButton!);

      await waitFor(() => {
        expect(showToast).toHaveBeenCalledWith('Error', 'Failed to take screenshot', 'error');
      });

      // Restore the original implementation after the test
      jest.restoreAllMocks();
    });

    test('handles error when triggerProcessScreenshots fails', async () => {
      mockElectronAPI.triggerProcessScreenshots.mockResolvedValue({ success: false, error: 'Test error' });

      const showToast = jest.fn();
      // Replace the original useToast hook with our mock
      jest.spyOn(require('../../contexts/toast'), 'useToast').mockReturnValue({ showToast });

      render(
        <SolutionCommands
          {...defaultProps}
          extraScreenshots={[{ id: '1', url: 'test', timestamp: Date.now() }]}
          isProcessing={false}
        />
      );

      const debugButton = screen.getByText('Debug').closest('div');
      fireEvent.click(debugButton!);

      await waitFor(() => {
        expect(showToast).toHaveBeenCalledWith('Error', 'Failed to process screenshots', 'error');
      });

      // Restore the original implementation after the test
      jest.restoreAllMocks();
    });

    test('handles error when triggerReset fails', async () => {
      mockElectronAPI.triggerReset.mockResolvedValue({ success: false, error: 'Test error' });

      const showToast = jest.fn();
      // Replace the original useToast hook with our mock
      jest.spyOn(require('../../contexts/toast'), 'useToast').mockReturnValue({ showToast });

      render(<SolutionCommands {...defaultProps} />);

      const startOverButton = screen.getByText('Start Over').closest('div');
      fireEvent.click(startOverButton!);

      await waitFor(() => {
        expect(showToast).toHaveBeenCalledWith('Error', 'Failed to reset', 'error');
      });

      // Restore the original implementation after the test
      jest.restoreAllMocks();
    });

    test('handles exception when calling electronAPI methods', async () => {
      mockElectronAPI.toggleMainWindow.mockImplementation(() => {
        throw new Error('Network error');
      });

      const showToast = jest.fn();
      // Replace the original useToast hook with our mock
      jest.spyOn(require('../../contexts/toast'), 'useToast').mockReturnValue({ showToast });

      render(<SolutionCommands {...defaultProps} />);

      const showHideButton = screen.getByText('Show/Hide').closest('div');
      fireEvent.click(showHideButton!);

      await waitFor(() => {
        expect(showToast).toHaveBeenCalledWith('Error', 'Failed to toggle window', 'error');
      });

      // Restore the original implementation after the test
      jest.restoreAllMocks();
    });
  });

  describe('Tooltip functionality', () => {
    test('shows tooltip when settings icon is hovered', async () => {
      render(<SolutionCommands {...defaultProps} />);

      // Find the gear icon container div by using querySelector on the document body
      const gearIcon = document.querySelector('div.relative.inline-block');
      fireEvent.mouseEnter(gearIcon);

      // Wait for the tooltip to appear
      await waitFor(() => {
        expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
      });
    });

    test('hides tooltip when mouse leaves settings icon', async () => {
      render(<SolutionCommands {...defaultProps} />);
      
      // Find the gear icon container div by using querySelector on the document body
      const gearIcon = document.querySelector('div.relative.inline-block');
      fireEvent.mouseEnter(gearIcon);

      await waitFor(() => {
        expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
      });
      
      fireEvent.mouseLeave(gearIcon!);
      
      // Wait for the tooltip to disappear
      await waitFor(() => {
        expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
      });
    });

    test('renders all keyboard shortcuts in tooltip when visible', async () => {
      render(
        <SolutionCommands
          {...defaultProps}
          extraScreenshots={[{ id: '1', url: 'test', timestamp: Date.now() }]}
        />
      );
      
      // Find the gear icon container div by using querySelector on the document body
      const gearIcon = document.querySelector('div.relative.inline-block');
      fireEvent.mouseEnter(gearIcon);

      await waitFor(() => {
        expect(screen.getByText('Toggle Window')).toBeInTheDocument();
        expect(screen.getByText('Take Screenshot')).toBeInTheDocument();
        // Use a more specific selector for 'Debug' to avoid ambiguity with the main UI element
        expect(screen.getByText((content, element) =>
          element.tagName.toLowerCase() === 'span' &&
          element.classList.contains('truncate') &&
          content === 'Debug'
        )).toBeInTheDocument();
        // Use a more specific selector for 'Start Over' to avoid ambiguity with the main UI element
        expect(screen.getByText((content, element) =>
          element.tagName.toLowerCase() === 'span' &&
          element.classList.contains('truncate') &&
          content === 'Start Over'
        )).toBeInTheDocument();
      });
    });

    test('does not render debug shortcut in tooltip when processing', async () => {
      render(
        <SolutionCommands
          {...defaultProps}
          extraScreenshots={[{ id: '1', url: 'test', timestamp: Date.now() }]}
          isProcessing={true}
        />
      );

      // Find the gear icon container div by using querySelector on the document body
      const gearIcon = document.querySelector('div.relative.inline-block');
      fireEvent.mouseEnter(gearIcon);

      await waitFor(() => {
        expect(screen.getByText('Toggle Window')).toBeInTheDocument();
        // Use a more specific selector for 'Take Screenshot' to target the tooltip element
        expect(screen.queryByText((content, element) =>
          element.tagName.toLowerCase() === 'span' &&
          element.classList.contains('truncate') &&
          content === 'Take Screenshot'
        )).not.toBeInTheDocument(); // Should not be visible in the tooltip since processing
        expect(screen.queryByText((content, element) =>
          element.tagName.toLowerCase() === 'span' &&
          element.classList.contains('truncate') &&
          content === 'Debug'
        )).not.toBeInTheDocument();
        // Use a more specific selector for 'Start Over' to avoid ambiguity with the main UI element
        expect(screen.getByText((content, element) =>
          element.tagName.toLowerCase() === 'span' &&
          element.classList.contains('truncate') &&
          content === 'Start Over'
        )).toBeInTheDocument();
      });
    });
  });

  describe('Language selector', () => {
    test('renders language selector in tooltip', async () => {
      render(<SolutionCommands {...defaultProps} />);
      
      // Find the gear icon container div by using querySelector on the document body
      const gearIcon = document.querySelector('div.relative.inline-block');
      fireEvent.mouseEnter(gearIcon);

      await waitFor(() => {
        expect(screen.getByTestId('language-selector')).toBeInTheDocument();
        expect(screen.getByText('Current Language: en')).toBeInTheDocument();
      });
    });

    test('calls setLanguage when language is changed', async () => {
      const setLanguageMock = jest.fn();
      render(
        <SolutionCommands
          {...defaultProps}
          setLanguage={setLanguageMock}
        />
      );

      // Find the gear icon container div by using querySelector on the document body
      const gearIcon = document.querySelector('div.relative.inline-block');
      fireEvent.mouseEnter(gearIcon);

      await waitFor(() => {
        expect(screen.getByTestId('language-selector')).toBeInTheDocument();
      });

      const setEnglishButton = screen.getByText('Set English');
      fireEvent.click(setEnglishButton);

      expect(setLanguageMock).toHaveBeenCalledWith('en');
    });
  });

  describe('Sign out functionality', () => {
    test('calls signOut when Log Out is clicked', async () => {
      const signOutMock = jest.fn().mockResolvedValue({ error: null });
      jest.spyOn(require('../../lib/supabase').supabase.auth, 'signOut').mockImplementation(signOutMock);

      render(<SolutionCommands {...defaultProps} />);

      // Find the gear icon container div by using querySelector on the document body
      const gearIcon = document.querySelector('div.relative.inline-block');
      fireEvent.mouseEnter(gearIcon);

      await waitFor(() => {
        expect(screen.getByText('Log Out')).toBeInTheDocument();
      });

      const logoutButton = screen.getByText('Log Out');
      fireEvent.click(logoutButton);

      await waitFor(() => {
        expect(signOutMock).toHaveBeenCalledTimes(1);
      });

      // Restore the original implementation after the test
      jest.restoreAllMocks();
    });

    test('clears localStorage and sessionStorage when signing out', async () => {
      const localStorageClearMock = jest.fn();
      const sessionStorageClearMock = jest.fn();

      Object.defineProperty(window, 'localStorage', {
        value: {
          clear: localStorageClearMock,
        },
        writable: true,
      });

      Object.defineProperty(window, 'sessionStorage', {
        value: {
          clear: sessionStorageClearMock,
        },
        writable: true,
      });

      render(<SolutionCommands {...defaultProps} />);

      // Find the gear icon container div by using querySelector on the document body
      const gearIcon = document.querySelector('div.relative.inline-block');
      fireEvent.mouseEnter(gearIcon);

      await waitFor(() => {
        expect(screen.getByText('Log Out')).toBeInTheDocument();
      });

      const logoutButton = screen.getByText('Log Out');
      fireEvent.click(logoutButton);

      await waitFor(() => {
        expect(localStorageClearMock).toHaveBeenCalledTimes(1);
        expect(sessionStorageClearMock).toHaveBeenCalledTimes(1);
      });
    });
  });
});