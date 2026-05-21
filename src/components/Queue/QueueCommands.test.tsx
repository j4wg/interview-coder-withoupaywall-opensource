import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import QueueCommands from './QueueCommands';

// Mock the window.electronAPI object
Object.defineProperty(window, 'electronAPI', {
  value: {
    triggerScreenshot: jest.fn(() => Promise.resolve({ success: true })),
    triggerProcessScreenshots: jest.fn(() => Promise.resolve({ success: true })),
    toggleMainWindow: jest.fn(() => Promise.resolve({ success: true })),
    deleteLastScreenshot: jest.fn(() => Promise.resolve({ success: true })),
    updateConfig: jest.fn(() => Promise.resolve({ success: true })),
    openSettingsPortal: jest.fn(),
  },
  writable: true,
});

// Mock the contexts and components
jest.mock('../../contexts/toast', () => ({
  useToast: () => ({
    showToast: jest.fn(),
  }),
}));

jest.mock('../shared/LanguageSelector', () => ({
  LanguageSelector: ({ currentLanguage, setLanguage }: { currentLanguage: string; setLanguage: (lang: string) => void }) => (
    <select data-testid="language-selector" value={currentLanguage} onChange={(e) => setLanguage(e.target.value)}>
      <option value="en">English</option>
      <option value="es">Spanish</option>
      <option value="fr">French</option>
    </select>
  ),
}));

// Mock createRoot
jest.mock('react-dom/client', () => ({
  createRoot: jest.fn(() => ({
    render: jest.fn(),
    unmount: jest.fn(),
  })),
}));

describe('QueueCommands', () => {
  const defaultProps = {
    onTooltipVisibilityChange: jest.fn(),
    credits: 10,
    currentLanguage: 'en',
    setLanguage: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { container } = render(<QueueCommands {...defaultProps} />);
    expect(container).toBeInTheDocument();
  });

  it('renders when screenshotCount is 0', () => {
    const { container } = render(<QueueCommands {...defaultProps} screenshotCount={0} />);
    expect(container).toBeInTheDocument();
  });

  it('renders when screenshotCount is 1', () => {
    const { container } = render(<QueueCommands {...defaultProps} screenshotCount={1} />);
    expect(container).toBeInTheDocument();
  });

  it('renders with different credits values', () => {
    const { container: containerLowCredits } = render(<QueueCommands {...defaultProps} credits={0} />);
    expect(containerLowCredits).toBeInTheDocument();

    const { container: containerHighCredits } = render(<QueueCommands {...defaultProps} credits={100} />);
    expect(containerHighCredits).toBeInTheDocument();
  });

  it('renders with different language settings', () => {
    const { container } = render(<QueueCommands {...defaultProps} currentLanguage="es" />);
    expect(container).toBeInTheDocument();
  });
});