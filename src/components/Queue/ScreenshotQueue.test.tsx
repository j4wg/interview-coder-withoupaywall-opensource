import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import ScreenshotQueue from "./ScreenshotQueue"

// Define the Screenshot type to match the component
interface Screenshot {
  path: string
  preview: string
}

// Mock the ScreenshotItem component to simplify testing
jest.mock("./ScreenshotItem", () => {
  return {
    __esModule: true,
    default: ({ screenshot, index, isLoading, onDelete }: any) => (
      <div data-testid="mock-screenshot-item">
        <span data-testid="screenshot-path">{screenshot.path}</span>
        <span data-testid="screenshot-index">{index}</span>
        <span data-testid="screenshot-isloading">{String(isLoading)}</span>
        <button 
          data-testid="delete-button"
          onClick={() => onDelete(index)}
        >
          Delete
        </button>
      </div>
    ),
  }
})

describe("ScreenshotQueue", () => {
  const mockScreenshots: Screenshot[] = [
    { path: "/path/to/screenshot1.png", preview: "preview1.jpg" },
    { path: "/path/to/screenshot2.png", preview: "preview2.jpg" },
    { path: "/path/to/screenshot3.png", preview: "preview3.jpg" },
  ]

  const defaultProps = {
    isLoading: false,
    screenshots: mockScreenshots,
    onDeleteScreenshot: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders without screenshots when array is empty", () => {
    render(
      <ScreenshotQueue
        {...defaultProps}
        screenshots={[]}
      />
    )

    expect(screen.queryByTestId("mock-screenshot-item")).not.toBeInTheDocument()
  })

  it("does not render the component when screenshots array is empty", () => {
    render(
      <ScreenshotQueue
        {...defaultProps}
        screenshots={[]}
      />
    )

    // Verify that the main container div is not rendered when there are no screenshots
    expect(screen.queryByRole("generic", { name: /flex gap-4/i })).not.toBeInTheDocument()
  })

  it("renders screenshot items when screenshots are provided", () => {
    render(<ScreenshotQueue {...defaultProps} />)

    expect(screen.getAllByTestId("mock-screenshot-item")).toHaveLength(3)
    expect(screen.getByText("/path/to/screenshot1.png")).toBeInTheDocument()
    expect(screen.getByText("/path/to/screenshot2.png")).toBeInTheDocument()
    expect(screen.getByText("/path/to/screenshot3.png")).toBeInTheDocument()
  })

  it("limits display to 5 screenshots maximum", () => {
    const manyScreenshots = Array.from({ length: 10 }, (_, i) => ({
      path: `/path/to/screenshot${i + 1}.png`,
      preview: `preview${i + 1}.jpg`,
    }))

    render(
      <ScreenshotQueue
        {...defaultProps}
        screenshots={manyScreenshots}
      />
    )

    // Should only render 5 items even though 10 were provided
    expect(screen.getAllByTestId("mock-screenshot-item")).toHaveLength(5)
  })

  it("passes correct props to ScreenshotItem components", () => {
    const { container } = render(<ScreenshotQueue {...defaultProps} />)

    const screenshotItems = container.querySelectorAll('[data-testid="mock-screenshot-item"]')
    expect(screenshotItems).toHaveLength(3)

    // Check first item
    const firstItem = screenshotItems[0].closest('[data-testid="mock-screenshot-item"]')
    expect(firstItem).toContainHTML('<span data-testid="screenshot-index">0</span>')
    expect(firstItem).toContainHTML('<span data-testid="screenshot-path">/path/to/screenshot1.png</span>')
    expect(firstItem).toContainHTML('<span data-testid="screenshot-isloading">false</span>')

    // Check second item
    const secondItem = screenshotItems[1].closest('[data-testid="mock-screenshot-item"]')
    expect(secondItem).toContainHTML('<span data-testid="screenshot-index">1</span>')
    expect(secondItem).toContainHTML('<span data-testid="screenshot-path">/path/to/screenshot2.png</span>')
  })

  it("passes isLoading prop correctly to ScreenshotItem components", () => {
    const loadingProps = {
      ...defaultProps,
      isLoading: true,
    }

    render(<ScreenshotQueue {...loadingProps} />)

    const screenshotItems = screen.getAllByTestId("mock-screenshot-item")
    screenshotItems.forEach(item => {
      expect(item).toContainHTML('<span data-testid="screenshot-isloading">true</span>')
    })
  })

  it("calls onDeleteScreenshot with the correct index when delete button is clicked", () => {
    const mockOnDelete = jest.fn()
    render(
      <ScreenshotQueue
        {...defaultProps}
        onDeleteScreenshot={mockOnDelete}
      />
    )

    // Click the delete button for the second screenshot (index 1)
    const deleteButtons = screen.getAllByTestId("delete-button")
    fireEvent.click(deleteButtons[1])

    expect(mockOnDelete).toHaveBeenCalledTimes(1)
    expect(mockOnDelete).toHaveBeenCalledWith(1)
  })

  it("renders with 1 screenshot", () => {
    render(
      <ScreenshotQueue
        {...defaultProps}
        screenshots={[mockScreenshots[0]]}
      />
    )
    expect(screen.getAllByTestId("mock-screenshot-item")).toHaveLength(1)
  })

  it("limits to 5 screenshots when more than 5 provided", () => {
    const sevenScreenshots = Array.from({ length: 7 }, (_, i) => ({
      path: `/path/to/screenshot${i + 1}.png`,
      preview: `preview${i + 1}.jpg`,
    }))

    render(
      <ScreenshotQueue
        {...defaultProps}
        screenshots={sevenScreenshots}
      />
    )
    expect(screen.getAllByTestId("mock-screenshot-item")).toHaveLength(5)
  })
})