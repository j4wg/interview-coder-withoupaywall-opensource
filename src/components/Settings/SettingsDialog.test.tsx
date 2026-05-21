import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsDialog } from './SettingsDialog';
import { useToast } from '../../contexts/toast';

// Mock the electronAPI
const mockGetConfig = jest.fn();
const mockUpdateConfig = jest.fn();
const mockOpenLink = jest.fn();

// Mock the useToast hook
jest.mock('../../contexts/toast', () => ({
  useToast: jest.fn(),
}));

// Mock the ui components
jest.mock('../ui/dialog', () => {
  const Dialog = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const DialogContent = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const DialogDescription = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const DialogHeader = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const DialogTitle = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const DialogFooter = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
  };
});

jest.mock('../ui/input', () => {
  const Input = ({ id, value, onChange, placeholder, className }: any) => (
    <input
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
    />
  );
  return { Input };
});

jest.mock('../ui/button', () => {
  const Button = ({ children, onClick, disabled, variant }: any) => (
    <button onClick={onClick} disabled={disabled} variant={variant}>
      {children}
    </button>
  );
  return { Button };
});

// Mock window.electronAPI
(window as any).electronAPI = {
  getConfig: mockGetConfig,
  updateConfig: mockUpdateConfig,
  openLink: mockOpenLink,
};

describe('SettingsDialog', () => {
  const mockShowToast = jest.fn();
  
  beforeEach(() => {
    (useToast as jest.Mock).mockReturnValue({ showToast: mockShowToast });
    jest.clearAllMocks();
  });

  it('renders the dialog with correct title and description', () => {
    render(<SettingsDialog />);
    
    expect(screen.getByText('API Settings')).toBeInTheDocument();
    expect(screen.getByText(
      'Configure your API key and model preferences. You\'ll need your own API key to use this application.'
    )).toBeInTheDocument();
  });

  it('allows changing API key value', () => {
    render(<SettingsDialog />);
    
    const apiKeyInput = screen.getByPlaceholderText('sk-...');
    fireEvent.change(apiKeyInput, { target: { value: 'test-api-key' } });
    
    expect(apiKeyInput).toHaveValue('test-api-key');
  });

  it('shows keyboard shortcuts section', () => {
    render(<SettingsDialog />);
    
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+B / Cmd+B')).toBeInTheDocument();
    expect(screen.getByText('Take Screenshot')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+H / Cmd+H')).toBeInTheDocument();
  });

  it('loads config when dialog is opened', async () => {
    mockGetConfig.mockResolvedValue({
      apiKey: 'test-key',
      apiProvider: 'gemini',
      extractionModel: 'gemini-1.5-pro',
      solutionModel: 'gemini-1.5-pro',
      debuggingModel: 'gemini-1.5-pro',
    });

    render(<SettingsDialog open={true} />);
    
    await waitFor(() => {
      expect(mockGetConfig).toHaveBeenCalled();
    });
  });

  it('handles error when loading config fails', async () => {
    mockGetConfig.mockRejectedValue(new Error('Config load failed'));
    
    render(<SettingsDialog open={true} />);
    
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        'Error',
        'Failed to load settings',
        'error'
      );
    });
  });

  it('saves settings when save button is clicked', async () => {
    mockUpdateConfig.mockResolvedValue(true);
    
    render(<SettingsDialog />);
    
    // Change the API key
    const apiKeyInput = screen.getByPlaceholderText('sk-...');
    fireEvent.change(apiKeyInput, { target: { value: 'new-api-key' } });
    
    // Click save
    const saveButton = screen.getByText('Save Settings');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(mockUpdateConfig).toHaveBeenCalledWith({
        apiKey: 'new-api-key',
        apiProvider: 'openai',
        extractionModel: 'gpt-4o',
        solutionModel: 'gpt-4o',
        debuggingModel: 'gpt-4o',
      });
    });
  });

  it('shows success toast when settings are saved successfully', async () => {
    mockUpdateConfig.mockResolvedValue(true);
    
    render(<SettingsDialog />);
    
    const apiKeyInput = screen.getByPlaceholderText('sk-...');
    fireEvent.change(apiKeyInput, { target: { value: 'new-api-key' } });
    
    const saveButton = screen.getByText('Save Settings');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        'Success',
        'Settings saved successfully',
        'success'
      );
    });
  });

  it('shows error toast when settings save fails', async () => {
    mockUpdateConfig.mockRejectedValue(new Error('Save failed'));
    
    render(<SettingsDialog />);
    
    const apiKeyInput = screen.getByPlaceholderText('sk-...');
    fireEvent.change(apiKeyInput, { target: { value: 'new-api-key' } });
    
    const saveButton = screen.getByText('Save Settings');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        'Error',
        'Failed to save settings',
        'error'
      );
    });
  });

  it('disables save button when API key is empty', () => {
    render(<SettingsDialog />);
    
    const saveButton = screen.getByText('Save Settings');
    expect(saveButton).toBeDisabled();
  });

  it('enables save button when API key is provided', () => {
    render(<SettingsDialog />);
    
    const apiKeyInput = screen.getByPlaceholderText('sk-...');
    fireEvent.change(apiKeyInput, { target: { value: 'test-key' } });
    
    const saveButton = screen.getByText('Save Settings');
    expect(saveButton).not.toBeDisabled();
  });

  it('calls onOpenChange when dialog state changes', () => {
    const mockOnOpenChange = jest.fn();
    render(<SettingsDialog onOpenChange={mockOnOpenChange} />);
    
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('opens external links when buttons are clicked', () => {
    render(<SettingsDialog />);
    
    // Find the external link by its accessible name rather than text content that conflicts
    const links = screen.getAllByRole('button');
    const openaiSignupLink = Array.from(links).find(
      link => link.textContent === 'OpenAI' && link.closest('div.mt-2')
    ) || screen.getByRole('button', { name: /OpenAI/ });
    
    fireEvent.click(openaiSignupLink);
    
    expect(mockOpenLink).toHaveBeenCalledWith('https://platform.openai.com/signup');
  });
});