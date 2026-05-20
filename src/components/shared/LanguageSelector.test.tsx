import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LanguageSelector } from './LanguageSelector';

// Mock the electronAPI
const mockUpdateConfig = jest.fn();
const mockElectronAPI = {
  updateConfig: mockUpdateConfig
};

// Mock window object
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

describe('LanguageSelector', () => {
  const mockSetLanguage = jest.fn();
  const defaultProps = {
    currentLanguage: 'javascript',
    setLanguage: mockSetLanguage
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Initialize the global variable for tests
    window.__LANGUAGE__ = 'javascript';
  });

  it('renders the component with the current language selected', () => {
    render(<LanguageSelector {...defaultProps} />);

    const selectElement = screen.getByRole('combobox');
    expect(selectElement).toBeInTheDocument();
    expect(selectElement).toHaveValue('javascript');

    const languageLabel = screen.getByText('Language');
    expect(languageLabel).toBeInTheDocument();
  });

  it('renders all expected language options', () => {
    render(<LanguageSelector {...defaultProps} />);

    const selectElement = screen.getByRole('combobox');

    expect(selectElement).toContainHTML('value="python"');
    expect(selectElement).toContainHTML('value="javascript"');
    expect(selectElement).toContainHTML('value="java"');
    expect(selectElement).toContainHTML('value="golang"');
    expect(selectElement).toContainHTML('value="cpp"');
    expect(selectElement).toContainHTML('value="swift"');
    expect(selectElement).toContainHTML('value="kotlin"');
    expect(selectElement).toContainHTML('value="ruby"');
    expect(selectElement).toContainHTML('value="sql"');
    expect(selectElement).toContainHTML('value="r"');
    expect(selectElement).toContainHTML('value="csharp"');
  });

  it('calls setLanguage with the new language when a different language is selected', async () => {
    render(<LanguageSelector {...defaultProps} />);

    const selectElement = screen.getByRole('combobox');
    
    // Change the selection to Python
    fireEvent.change(selectElement, { target: { value: 'python' } });

    // Wait for the async function to complete
    await waitFor(() => {
      expect(mockUpdateConfig).toHaveBeenCalledWith({ language: 'python' });
      expect(mockSetLanguage).toHaveBeenCalledWith('python');
      expect(window.__LANGUAGE__).toBe('python');
    });
  });

  it('updates the global language variable when language changes', async () => {
    render(<LanguageSelector {...defaultProps} />);
    
    expect(window.__LANGUAGE__).toBe('javascript');

    const selectElement = screen.getByRole('combobox');
    fireEvent.change(selectElement, { target: { value: 'java' } });

    await waitFor(() => {
      expect(window.__LANGUAGE__).toBe('java');
    });
  });

  it('logs the language change', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    render(<LanguageSelector {...defaultProps} />);

    const selectElement = screen.getByRole('combobox');
    fireEvent.change(selectElement, { target: { value: 'golang' } });

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Language changed to golang');
    });

    consoleSpy.mockRestore();
  });

  it('handles errors gracefully when updateConfig fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    mockUpdateConfig.mockRejectedValue(new Error('API Error'));

    render(<LanguageSelector {...defaultProps} />);

    const selectElement = screen.getByRole('combobox');
    fireEvent.change(selectElement, { target: { value: 'python' } });

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error updating language:', new Error('API Error'));
    });

    consoleSpy.mockRestore();
  });

  it('does not call setLanguage when updateConfig fails', async () => {
    mockUpdateConfig.mockRejectedValue(new Error('API Error'));

    render(<LanguageSelector {...defaultProps} />);

    const selectElement = screen.getByRole('combobox');
    fireEvent.change(selectElement, { target: { value: 'python' } });

    // Wait and check that setLanguage was not called
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(mockSetLanguage).not.toHaveBeenCalled();
    expect(window.__LANGUAGE__).toBe('javascript'); // Should remain unchanged
  });
});