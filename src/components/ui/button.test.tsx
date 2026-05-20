import * as React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { Button, buttonVariants } from "./button"
import { describe, expect, it } from "@jest/globals"

describe("Button", () => {
  it("renders correctly with default props", () => {
    render(<Button>Click me</Button>)
    const button = screen.getByRole("button", { name: /click me/i })
    expect(button).toBeInTheDocument()
    expect(button).toHaveClass("bg-primary text-primary-foreground shadow hover:bg-primary/90")
  })

  it("renders correctly with variant prop", () => {
    render(<Button variant="destructive">Delete</Button>)
    const button = screen.getByRole("button", { name: /delete/i })
    expect(button).toHaveClass("bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90")
  })

  it("renders correctly with size prop", () => {
    render(<Button size="lg">Large Button</Button>)
    const button = screen.getByRole("button", { name: /large button/i })
    expect(button).toHaveClass("h-10 rounded-md px-8")
  })

  it("applies custom className", () => {
    render(<Button className="custom-class">Custom Button</Button>)
    const button = screen.getByRole("button", { name: /custom button/i })
    expect(button).toHaveClass("custom-class")
  })

  it("forwards ref correctly", () => {
    const ref = React.createRef<HTMLButtonElement>()
    render(<Button ref={ref}>Ref Button</Button>)
    expect(ref.current).not.toBeNull()
  })

  it("handles click events", () => {
    const mockOnClick = jest.fn()
    render(<Button onClick={mockOnClick}>Clickable</Button>)
    const button = screen.getByRole("button", { name: /clickable/i })
    fireEvent.click(button)
    expect(mockOnClick).toHaveBeenCalledTimes(1)
  })

  it("is disabled when disabled prop is passed", () => {
    render(<Button disabled>Disabled Button</Button>)
    const button = screen.getByRole("button", { name: /disabled button/i })
    expect(button).toBeDisabled()
  })

  it("renders as child when asChild prop is true", () => {
    const { container } = render(
      <Button asChild>
        <a href="#">Link Button</a>
      </Button>
    )
    expect(container.querySelector("a")).toBeInTheDocument()
  })

  it("applies multiple variant classes correctly", () => {
    const { container } = render(
      <Button variant="outline" size="sm">
        Outline Small
      </Button>
    )
    const button = screen.getByRole("button", { name: /outline small/i })
    expect(button).toHaveClass(
      "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground"
    )
    expect(button).toHaveClass("h-8 rounded-md px-3 text-xs")
  })

  it("has default variant and size when not specified", () => {
    render(<Button>Default Button</Button>)
    const button = screen.getByRole("button", { name: /default button/i })
    expect(button).toHaveClass("bg-primary text-primary-foreground shadow hover:bg-primary/90")
    expect(button).toHaveClass("h-9 px-4 py-2")
  })
})

describe("buttonVariants", () => {
  it("generates correct classes for default variant", () => {
    const classes = buttonVariants({ variant: "default" })
    expect(classes).toContain("bg-primary text-primary-foreground shadow hover:bg-primary/90")
  })

  it("generates correct classes for outline variant", () => {
    const classes = buttonVariants({ variant: "outline" })
    expect(classes).toContain("border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground")
  })

  it("generates correct classes for small size", () => {
    const classes = buttonVariants({ size: "sm" })
    expect(classes).toContain("h-8 rounded-md px-3 text-xs")
  })

  it("generates correct classes when combining variant and size", () => {
    const classes = buttonVariants({ variant: "secondary", size: "lg" })
    expect(classes).toContain("bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80")
    expect(classes).toContain("h-10 rounded-md px-8")
  })

  it("uses default variants when none specified", () => {
    const classes = buttonVariants()
    expect(classes).toContain("bg-primary text-primary-foreground shadow hover:bg-primary/90")
    expect(classes).toContain("h-9 px-4 py-2")
  })
})