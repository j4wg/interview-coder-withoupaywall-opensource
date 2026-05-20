import React from "react"
import { render, act } from "@testing-library/react"
import { ToastContext, useToast } from "./toast"

// Mock component to test the hook
const TestComponent: React.FC = () => {
  const { showToast } = useToast()
  return (
    <div>
      <button
        onClick={() => showToast("Test Title", "Test Description", "success")}
        data-testid="trigger-toast"
      >
        Show Toast
      </button>
    </div>
  )
}

describe("Toast Context", () => {
  it("should throw an error when useToast is used outside of ToastProvider", () => {
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {}) // Suppress console error in test

    expect(() => render(<TestComponent />)).toThrow(
      "useToast must be used within a ToastProvider"
    )

    consoleSpy.mockRestore()
  })

  it("should not throw an error when useToast is used within ToastProvider", () => {
    const mockShowToast = jest.fn()
    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <ToastContext.Provider value={{ showToast: mockShowToast }}>
        {children}
      </ToastContext.Provider>
    )

    const { getByTestId } = render(<TestComponent />, { wrapper })

    expect(() => getByTestId("trigger-toast")).not.toThrow()
  })

  it("should call showToast function with correct parameters", () => {
    const mockShowToast = jest.fn()
    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <ToastContext.Provider value={{ showToast: mockShowToast }}>
        {children}
      </ToastContext.Provider>
    )

    const { getByTestId } = render(<TestComponent />, { wrapper })
    const button = getByTestId("trigger-toast")

    act(() => {
      button.click()
    })

    expect(mockShowToast).toHaveBeenCalledWith(
      "Test Title",
      "Test Description",
      "success"
    )
  })

  it("should work with different toast variants", () => {
    const mockShowToast = jest.fn()
    
    // Create a component that tests different variants
    const VariantTestComponent: React.FC = () => {
      const { showToast } = useToast()
      return (
        <div>
          <button
            onClick={() => showToast("Title", "Desc", "neutral")}
            data-testid="neutral-toast"
          >
            Neutral Toast
          </button>
          <button
            onClick={() => showToast("Title", "Desc", "error")}
            data-testid="error-toast"
          >
            Error Toast
          </button>
        </div>
      )
    }

    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <ToastContext.Provider value={{ showToast: mockShowToast }}>
        {children}
      </ToastContext.Provider>
    )

    const { getByTestId } = render(<VariantTestComponent />, { wrapper })

    const neutralButton = getByTestId("neutral-toast")
    const errorButton = getByTestId("error-toast")

    act(() => {
      neutralButton.click()
    })
    expect(mockShowToast).toHaveBeenCalledWith("Title", "Desc", "neutral")

    act(() => {
      errorButton.click()
    })
    expect(mockShowToast).toHaveBeenCalledWith("Title", "Desc", "error")
  })
})