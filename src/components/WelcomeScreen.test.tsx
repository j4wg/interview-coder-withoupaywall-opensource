import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { WelcomeScreen } from './WelcomeScreen';

describe('WelcomeScreen', () => {
  const mockOnOpenSettings = jest.fn();

  beforeEach(() => {
    mockOnOpenSettings.mockClear();
  });

  it('renders the welcome screen with correct title', () => {
    render(<WelcomeScreen onOpenSettings={mockOnOpenSettings} />);
    
    expect(screen.getByText('Interview Coder')).toBeInTheDocument();
    expect(screen.getByText('Unlocked Edition')).toBeInTheDocument();
  });

  it('renders the welcome message and description', () => {
    render(<WelcomeScreen onOpenSettings={mockOnOpenSettings} />);
    
    expect(screen.getByText('Welcome to Interview Coder')).toBeInTheDocument();
    expect(screen.getByText(
      'This application helps you ace technical interviews by providing AI-powered solutions to coding problems.'
    )).toBeInTheDocument();
  });

  it('displays all global shortcuts', () => {
    render(<WelcomeScreen onOpenSettings={mockOnOpenSettings} />);
    
    expect(screen.getByText('Toggle Visibility')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+B / Cmd+B')).toBeInTheDocument();
    
    expect(screen.getByText('Take Screenshot')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+H / Cmd+H')).toBeInTheDocument();
    
    expect(screen.getByText('Delete Last Screenshot')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+L / Cmd+L')).toBeInTheDocument();
    
    expect(screen.getByText('Process Screenshots')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+Enter / Cmd+Enter')).toBeInTheDocument();
    
    expect(screen.getByText('Reset View')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+R / Cmd+R')).toBeInTheDocument();
    
    expect(screen.getByText('Quit App')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+Q / Cmd+Q')).toBeInTheDocument();
  });

  it('displays the getting started section', () => {
    render(<WelcomeScreen onOpenSettings={mockOnOpenSettings} />);
    
    expect(screen.getByText('Getting Started')).toBeInTheDocument();
    expect(screen.getByText(
      'Before using the application, you need to configure your OpenAI API key.'
    )).toBeInTheDocument();
  });

  it('has the Open Settings button', () => {
    render(<WelcomeScreen onOpenSettings={mockOnOpenSettings} />);
    
    const button = screen.getByRole('button', { name: 'Open Settings' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('px-4');
    expect(button).toHaveClass('py-3');
    expect(button).toHaveClass('bg-white');
    expect(button).toHaveClass('text-black');
  });

  it('calls onOpenSettings handler when the button is clicked', () => {
    render(<WelcomeScreen onOpenSettings={mockOnOpenSettings} />);
    
    const button = screen.getByRole('button', { name: 'Open Settings' });
    fireEvent.click(button);
    
    expect(mockOnOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('displays the footer text', () => {
    render(<WelcomeScreen onOpenSettings={mockOnOpenSettings} />);
    
    expect(screen.getByText(
      'Start by taking screenshots of your coding problem (Ctrl+H / Cmd+H)'
    )).toBeInTheDocument();
  });

  it('applies correct CSS classes to the main container', () => {
    const { container } = render(<WelcomeScreen onOpenSettings={mockOnOpenSettings} />);
    
    const mainDiv = container.firstChild;
    expect(mainDiv).toHaveClass('bg-black');
    expect(mainDiv).toHaveClass('min-h-screen');
    expect(mainDiv).toHaveClass('flex');
    expect(mainDiv).toHaveClass('flex-col');
    expect(mainDiv).toHaveClass('items-center');
    expect(mainDiv).toHaveClass('justify-center');
    expect(mainDiv).toHaveClass('p-6');
  });

  it('renders the settings button with correct styling', () => {
    render(<WelcomeScreen onOpenSettings={mockOnOpenSettings} />);
    
    const button = screen.getByRole('button', { name: 'Open Settings' });
    expect(button).toHaveClass('w-full');
    expect(button).toHaveClass('px-4');
    expect(button).toHaveClass('py-3');
    expect(button).toHaveClass('bg-white');
    expect(button).toHaveClass('text-black');
    expect(button).toHaveClass('rounded-xl');
    expect(button).toHaveClass('font-medium');
    expect(button).toHaveClass('hover:bg-white/90');
    expect(button).toHaveClass('transition-colors');
    expect(button).toHaveClass('flex');
    expect(button).toHaveClass('items-center');
    expect(button).toHaveClass('justify-center');
    expect(button).toHaveClass('gap-2');
  });
});