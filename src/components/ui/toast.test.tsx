import * as React from "react"
import { render, screen } from "@testing-library/react"
import { ToastProvider, ToastViewport, Toast, ToastAction, ToastTitle, ToastDescription } from "./toast"
import "@testing-library/jest-dom"

describe("Toast Component", () => {
  const TestToast = ({ variant = "neutral", children, ...props }: any) => (
    <ToastProvider>
      <Toast variant={variant} {...props}>
        {children || (
          <>
            <ToastTitle>Test Title</ToastTitle>
            <ToastDescription>Test Description</ToastDescription>
            <ToastAction altText="test">Test Action</ToastAction>
          </>
        )}
      </Toast>
      <ToastViewport />
    </ToastProvider>
  )

  it("renders toast with default neutral variant", () => {
    render(<TestToast />)

    const toast = screen.getAllByRole("status")[0] // Get the first toast, not the accessibility span
    expect(toast).toBeInTheDocument()
    expect(toast).toHaveClass("bg-amber-100")
  })

  it("renders toast with success variant", () => {
    render(<TestToast variant="success" />)

    const toast = screen.getAllByRole("status")[0]
    expect(toast).toBeInTheDocument()
    expect(toast).toHaveClass("bg-emerald-100")
  })

  it("renders toast with error variant", () => {
    render(<TestToast variant="error" />)

    const toast = screen.getAllByRole("status")[0]
    expect(toast).toBeInTheDocument()
    expect(toast).toHaveClass("bg-red-100")
  })

  it("renders toast title", () => {
    render(<TestToast />)

    const title = screen.getByText("Test Title")
    expect(title).toBeInTheDocument()
    expect(title).toHaveClass("text-[0.7rem] font-medium text-zinc-900")
  })

  it("renders toast description", () => {
    render(<TestToast />)

    const description = screen.getByText("Test Description")
    expect(description).toBeInTheDocument()
    expect(description).toHaveClass("text-[0.65rem] text-zinc-600")
  })

  it("renders toast action", () => {
    render(<TestToast />)

    const action = screen.getByText("Test Action")
    expect(action).toBeInTheDocument()
    expect(action).toHaveClass("text-[0.65rem] font-medium text-zinc-600 hover:text-zinc-900")
  })

  it("shows correct icon for neutral variant", () => {
    render(<TestToast variant="neutral" />)

    // Find the toast and check if it contains the correct icon
    const toast = screen.getAllByRole("status")[0]
    const icon = toast.querySelector("svg.lucide-info")
    expect(icon).toBeInTheDocument()
  })

  it("shows correct icon for success variant", () => {
    render(<TestToast variant="success" />)

    const toast = screen.getAllByRole("status")[0]
    // Look for the check-circle-2 icon by its path content or general structure
    // CheckCircle2 should have particular paths that identify it
    const icon = toast.querySelector("svg")
    expect(icon).toBeInTheDocument()
    // Find the specific success icon by filtering SVGs in the toast
    const allSvgs = toast.querySelectorAll("svg")
    const successIcon = Array.from(allSvgs).find(svg =>
      svg.classList.contains("text-emerald-700") // Success icon is emerald
    )
    expect(successIcon).toBeInTheDocument()
  })

  it("shows correct icon for error variant", () => {
    render(<TestToast variant="error" />)

    const toast = screen.getAllByRole("status")[0]
    const allSvgs = toast.querySelectorAll("svg")
    const errorIcon = Array.from(allSvgs).find(svg =>
      svg.classList.contains("text-red-700") // Error icon is red
    )
    expect(errorIcon).toBeInTheDocument()
  })

  it("renders with custom className", () => {
    render(<TestToast className="custom-class" />)

    const toast = screen.getAllByRole("status")[0]
    expect(toast).toHaveClass("custom-class")
  })

  it("renders close button", () => {
    render(<TestToast />)

    // There are 2 buttons: action button and close button. Get the close button by its specific class
    const closeButtons = screen.getAllByRole("button")
    // The close button has the specific class pattern
    const closeBtn = closeButtons.find(button =>
      button.classList.contains("absolute") &&
      button.classList.contains("right-1") &&
      button.classList.contains("top-1")
    )
    expect(closeBtn).toBeInTheDocument()
  })

  it("close button has correct classnames", () => {
    render(<TestToast />)

    const closeButtons = screen.getAllByRole("button")
    const closeBtn = closeButtons.find(button =>
      button.classList.contains("absolute") &&
      button.classList.contains("right-1") &&
      button.classList.contains("top-1")
    )
    expect(closeBtn).toHaveClass("absolute right-1 top-1 rounded-md p-0.5 text-zinc-500 opacity-0 transition-opacity hover:text-zinc-700 group-hover:opacity-100")
  })

  it("renders toast viewport with correct classes", () => {
    render(<TestToast />)

    // The actual viewport element is the <ol> that is inside the region, not the region itself
    const viewport = screen.getByRole("list") // The ToastViewport renders as an <ol> element
    expect(viewport).toHaveClass("fixed top-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-1 p-2 sm:top-0 sm:right-0 sm:flex-col md:max-w-[320px]")
  })

  it("should render toast with default duration", () => {
    render(<TestToast />)

    const toast = screen.getAllByRole("status")[0]
    expect(toast).toBeInTheDocument()
  })
})