import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Dialog, DialogTrigger, DialogContent, DialogClose, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from './dialog';

// Mock the cn function since it's used in the component
jest.mock('../../lib/utils', () => ({
  cn: (...classes: (string | boolean | undefined)[]) => 
    classes.filter(Boolean).join(' ')
}));

const MockDialog = ({ open = false, onOpenChange = jest.fn() }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogTrigger>Open Dialog</DialogTrigger>
    <DialogContent data-testid="dialog-content">
      <DialogTitle data-testid="dialog-title">Test Title</DialogTitle>
      <DialogDescription data-testid="dialog-description">Test Description</DialogDescription>
      <DialogHeader data-testid="dialog-header">
        <h2>Header Content</h2>
      </DialogHeader>
      <p>Dialog body content</p>
      <DialogFooter data-testid="dialog-footer">
        <button>Footer Button</button>
      </DialogFooter>
      <DialogClose data-testid="dialog-close">Close</DialogClose>
    </DialogContent>
  </Dialog>
);

describe('Dialog Components', () => {
  it('renders DialogTrigger correctly', () => {
    render(<MockDialog />);
    expect(screen.getByText('Open Dialog')).toBeInTheDocument();
  });

  it('does not show dialog content when closed', () => {
    render(<MockDialog open={false} />);
    expect(screen.queryByTestId('dialog-content')).not.toBeInTheDocument();
  });

  it('shows dialog content when open', () => {
    render(<MockDialog open={true} />);
    expect(screen.getByTestId('dialog-content')).toBeInTheDocument();
  });

  it('calls onOpenChange when dialog is opened', () => {
    const onOpenChange = jest.fn();
    render(<MockDialog onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByText('Open Dialog'));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it('calls onOpenChange when dialog is closed via close button', async () => {
    const onOpenChange = jest.fn();
    render(<MockDialog open={true} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByTestId('dialog-close'));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('DialogTitle renders with correct text', () => {
    render(<MockDialog open={true} />);
    expect(screen.getByTestId('dialog-title')).toHaveTextContent('Test Title');
  });

  it('DialogDescription renders with correct text', () => {
    render(<MockDialog open={true} />);
    expect(screen.getByTestId('dialog-description')).toHaveTextContent('Test Description');
  });

  it('DialogHeader renders children correctly', () => {
    render(<MockDialog open={true} />);
    expect(screen.getByTestId('dialog-header')).toContainHTML('<h2>Header Content</h2>');
  });

  it('DialogFooter renders children correctly', () => {
    render(<MockDialog open={true} />);
    expect(screen.getByTestId('dialog-footer')).toContainHTML('<button>Footer Button</button>');
  });

  it('DialogContent applies custom className', () => {
    const CustomDialogContent = () => (
      <Dialog open={true}>
        <DialogContent className="custom-class" data-testid="custom-dialog">
          <DialogTitle>Accessible Title</DialogTitle>
          <DialogDescription>Accessible Description</DialogDescription>
          Dialog content
        </DialogContent>
      </Dialog>
    );

    render(<CustomDialogContent />);
    expect(screen.getByTestId('custom-dialog')).toHaveClass('custom-class');
  });

  it('DialogTitle applies custom className', () => {
    const CustomDialogTitle = () => (
      <Dialog open={true}>
        <DialogContent data-testid="dialog-content">
          <DialogTitle className="custom-title-class" data-testid="custom-title">
            Title
          </DialogTitle>
          <DialogDescription>Description for accessibility</DialogDescription>
        </DialogContent>
      </Dialog>
    );

    render(<CustomDialogTitle />);
    expect(screen.getByTestId('custom-title')).toHaveClass('custom-title-class');
  });

  it('DialogDescription applies custom className', () => {
    const CustomDialogDescription = () => (
      <Dialog open={true}>
        <DialogContent data-testid="dialog-content">
          <DialogTitle>Title for accessibility</DialogTitle>
          <DialogDescription className="custom-desc-class" data-testid="custom-description">
            Description
          </DialogDescription>
        </DialogContent>
      </Dialog>
    );

    render(<CustomDialogDescription />);
    expect(screen.getByTestId('custom-description')).toHaveClass('custom-desc-class');
  });

  it('DialogHeader applies custom className', () => {
    const CustomDialogHeader = () => (
      <Dialog open={true}>
        <DialogContent data-testid="dialog-content">
          <DialogTitle>Title for accessibility</DialogTitle>
          <DialogDescription>Description for accessibility</DialogDescription>
          <DialogHeader className="custom-header-class" data-testid="custom-header">
            Header Content
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );

    render(<CustomDialogHeader />);
    expect(screen.getByTestId('custom-header')).toHaveClass('custom-header-class');
  });

  it('DialogFooter applies custom className', () => {
    const CustomDialogFooter = () => (
      <Dialog open={true}>
        <DialogContent data-testid="dialog-content">
          <DialogTitle>Title for accessibility</DialogTitle>
          <DialogDescription>Description for accessibility</DialogDescription>
          <DialogFooter className="custom-footer-class" data-testid="custom-footer">
            Footer Content
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );

    render(<CustomDialogFooter />);
    expect(screen.getByTestId('custom-footer')).toHaveClass('custom-footer-class');
  });
});