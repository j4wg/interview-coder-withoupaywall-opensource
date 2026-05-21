import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ScreenshotItem from './ScreenshotItem';
import { X } from 'lucide-react';

// Mock the X icon from lucide-react
jest.mock('lucide-react', () => ({
  X: jest.fn(() => null),
}));

// Define the Screenshot type
interface Screenshot {
  path: string;
  preview: string;
}

// Mock props
const mockScreenshot: Screenshot = {
  path: '/path/to/screenshot.png',
  preview: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
};

describe('ScreenshotItem', () => {
  const mockOnDelete = jest.fn();

  beforeEach(() => {
    mockOnDelete.mockClear();
  });

  it('renders the screenshot image', () => {
    render(
      <ScreenshotItem
        screenshot={mockScreenshot}
        onDelete={mockOnDelete}
        index={0}
        isLoading={false}
      />
    );

    const img = screen.getByAltText('Screenshot');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', mockScreenshot.preview);
  });

  it('shows loading spinner when isLoading is true', () => {
    render(
      <ScreenshotItem
        screenshot={mockScreenshot}
        onDelete={mockOnDelete}
        index={0}
        isLoading={true}
      />
    );

    // The spinner is the div with animate-spin class
    const spinnerElement = document.querySelector('.animate-spin');
    expect(spinnerElement).toBeInTheDocument();
  });

  it('does not show delete button when loading', () => {
    render(
      <ScreenshotItem
        screenshot={mockScreenshot}
        onDelete={mockOnDelete}
        index={0}
        isLoading={true}
      />
    );

    const deleteButton = screen.queryByLabelText('Delete screenshot');
    expect(deleteButton).not.toBeInTheDocument();
  });

  it('shows delete button when not loading', () => {
    render(
      <ScreenshotItem
        screenshot={mockScreenshot}
        onDelete={mockOnDelete}
        index={0}
        isLoading={false}
      />
    );

    const deleteButton = screen.getByLabelText('Delete screenshot');
    expect(deleteButton).toBeInTheDocument();
  });

  it('calls onDelete when delete button is clicked', async () => {
    render(
      <ScreenshotItem
        screenshot={mockScreenshot}
        onDelete={mockOnDelete}
        index={5}
        isLoading={false}
      />
    );

    const deleteButton = screen.getByLabelText('Delete screenshot');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(mockOnDelete).toHaveBeenCalledWith(5);
    });
  });

  it('stops event propagation when delete button is clicked', () => {
    render(
      <ScreenshotItem
        screenshot={mockScreenshot}
        onDelete={mockOnDelete}
        index={0}
        isLoading={false}
      />
    );

    const deleteButton = screen.getByLabelText('Delete screenshot');
    const mockStopPropagation = jest.fn();

    // Create a proper event object with stopPropagation
    const event = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(event, 'stopPropagation', {
      value: mockStopPropagation,
      writable: true,
    });

    fireEvent(deleteButton, event);

    expect(mockStopPropagation).toHaveBeenCalled();
  });

  it('applies correct CSS classes based on loading state', () => {
    const { container, rerender } = render(
      <ScreenshotItem
        screenshot={mockScreenshot}
        onDelete={mockOnDelete}
        index={0}
        isLoading={false}
      />
    );

    // The outermost div should have the 'group' class when not loading
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toHaveClass('group');

    rerender(
      <ScreenshotItem
        screenshot={mockScreenshot}
        onDelete={mockOnDelete}
        index={0}
        isLoading={true}
      />
    );

    // When loading, the outermost div should not have the 'group' class
    const loadingOuterDiv = container.firstChild as HTMLElement;
    expect(loadingOuterDiv).not.toHaveClass('group');
  });

  it('applies correct image classes based on loading state', () => {
    const { container, rerender } = render(
      <ScreenshotItem
        screenshot={mockScreenshot}
        onDelete={mockOnDelete}
        index={0}
        isLoading={false}
      />
    );

    const img = screen.getByAltText('Screenshot');
    expect(img).toHaveClass('cursor-pointer');
    expect(img).toHaveClass('group-hover:scale-105');
    expect(img).toHaveClass('group-hover:brightness-75');

    rerender(
      <ScreenshotItem
        screenshot={mockScreenshot}
        onDelete={mockOnDelete}
        index={0}
        isLoading={true}
      />
    );

    const loadingImg = screen.getByAltText('Screenshot');
    expect(loadingImg).toHaveClass('opacity-50');
    expect(loadingImg).not.toHaveClass('cursor-pointer');
    expect(loadingImg).not.toHaveClass('group-hover:scale-105');
    expect(loadingImg).not.toHaveClass('group-hover:brightness-75');
  });

  it('renders with correct dimensions', () => {
    const { container } = render(
      <ScreenshotItem
        screenshot={mockScreenshot}
        onDelete={mockOnDelete}
        index={0}
        isLoading={false}
      />
    );

    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toHaveClass('w-[128px]', 'h-[72px]');
  });

  it('has the correct border class', () => {
    const { container } = render(
      <ScreenshotItem
        screenshot={mockScreenshot}
        onDelete={mockOnDelete}
        index={0}
        isLoading={false}
      />
    );

    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toHaveClass('border', 'border-white');
  });
});