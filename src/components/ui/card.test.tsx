import * as React from "react"
import { render, screen } from "@testing-library/react"
import { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from "./card"

describe("Card Components", () => {
  describe("Card", () => {
    it("should render correctly", () => {
      render(<Card>Card content</Card>)
      
      const card = screen.getByText("Card content")
      expect(card).toBeInTheDocument()
      expect(card.tagName).toBe("DIV")
    })

    it("should have default class names", () => {
      render(<Card>Card content</Card>)
      
      const card = screen.getByText("Card content")
      expect(card).toHaveClass("rounded-xl")
      expect(card).toHaveClass("border")
      expect(card).toHaveClass("bg-card")
      expect(card).toHaveClass("text-card-foreground")
      expect(card).toHaveClass("shadow")
    })

    it("should accept additional class names", () => {
      render(<Card className="custom-class">Card content</Card>)
      
      const card = screen.getByText("Card content")
      expect(card).toHaveClass("custom-class")
    })

    it("should forward ref correctly", () => {
      const ref = React.createRef<HTMLDivElement>()
      render(<Card ref={ref}>Card content</Card>)
      
      expect(ref.current).not.toBeNull()
      expect(ref.current).toBeInstanceOf(HTMLDivElement)
    })

    it("should spread additional props", () => {
      render(
        <Card data-testid="test-card" id="my-card">
          Card content
        </Card>
      )
      
      const card = screen.getByTestId("test-card")
      expect(card).toHaveAttribute("id", "my-card")
    })
  })

  describe("CardHeader", () => {
    it("should render correctly", () => {
      render(<CardHeader>Header content</CardHeader>)
      
      const header = screen.getByText("Header content")
      expect(header).toBeInTheDocument()
      expect(header.tagName).toBe("DIV")
    })

    it("should have default class names", () => {
      render(<CardHeader>Header content</CardHeader>)
      
      const header = screen.getByText("Header content")
      expect(header).toHaveClass("flex")
      expect(header).toHaveClass("flex-col")
      expect(header).toHaveClass("space-y-1.5")
      expect(header).toHaveClass("p-6")
    })

    it("should accept additional class names", () => {
      render(<CardHeader className="custom-header-class">Header content</CardHeader>)
      
      const header = screen.getByText("Header content")
      expect(header).toHaveClass("custom-header-class")
    })

    it("should forward ref correctly", () => {
      const ref = React.createRef<HTMLDivElement>()
      render(<CardHeader ref={ref}>Header content</CardHeader>)
      
      expect(ref.current).not.toBeNull()
      expect(ref.current).toBeInstanceOf(HTMLDivElement)
    })
  })

  describe("CardTitle", () => {
    it("should render as h3 element", () => {
      render(<CardTitle>Title text</CardTitle>)
      
      const title = screen.getByText("Title text")
      expect(title.tagName).toBe("H3")
    })

    it("should have default class names", () => {
      render(<CardTitle>Title text</CardTitle>)
      
      const title = screen.getByText("Title text")
      expect(title).toHaveClass("font-semibold")
      expect(title).toHaveClass("leading-none")
      expect(title).toHaveClass("tracking-tight")
    })

    it("should accept additional class names", () => {
      render(<CardTitle className="custom-title-class">Title text</CardTitle>)
      
      const title = screen.getByText("Title text")
      expect(title).toHaveClass("custom-title-class")
    })

    it("should forward ref correctly", () => {
      const ref = React.createRef<HTMLHeadingElement>()
      render(<CardTitle ref={ref}>Title text</CardTitle>)
      
      expect(ref.current).not.toBeNull()
      expect(ref.current).toBeInstanceOf(HTMLHeadingElement)
    })
  })

  describe("CardDescription", () => {
    it("should render as p element", () => {
      render(<CardDescription>Description text</CardDescription>)
      
      const description = screen.getByText("Description text")
      expect(description.tagName).toBe("P")
    })

    it("should have default class names", () => {
      render(<CardDescription>Description text</CardDescription>)
      
      const description = screen.getByText("Description text")
      expect(description).toHaveClass("text-sm")
      expect(description).toHaveClass("text-muted-foreground")
    })

    it("should accept additional class names", () => {
      render(<CardDescription className="custom-desc-class">Description text</CardDescription>)
      
      const description = screen.getByText("Description text")
      expect(description).toHaveClass("custom-desc-class")
    })

    it("should forward ref correctly", () => {
      const ref = React.createRef<HTMLParagraphElement>()
      render(<CardDescription ref={ref}>Description text</CardDescription>)
      
      expect(ref.current).not.toBeNull()
      expect(ref.current).toBeInstanceOf(HTMLParagraphElement)
    })
  })

  describe("CardContent", () => {
    it("should render correctly", () => {
      render(<CardContent>Content text</CardContent>)
      
      const content = screen.getByText("Content text")
      expect(content).toBeInTheDocument()
      expect(content.tagName).toBe("DIV")
    })

    it("should have default class names", () => {
      render(<CardContent>Content text</CardContent>)
      
      const content = screen.getByText("Content text")
      expect(content).toHaveClass("p-6")
      expect(content).toHaveClass("pt-0")
    })

    it("should accept additional class names", () => {
      render(<CardContent className="custom-content-class">Content text</CardContent>)
      
      const content = screen.getByText("Content text")
      expect(content).toHaveClass("custom-content-class")
    })

    it("should forward ref correctly", () => {
      const ref = React.createRef<HTMLDivElement>()
      render(<CardContent ref={ref}>Content text</CardContent>)
      
      expect(ref.current).not.toBeNull()
      expect(ref.current).toBeInstanceOf(HTMLDivElement)
    })
  })

  describe("CardFooter", () => {
    it("should render correctly", () => {
      render(<CardFooter>Footer content</CardFooter>)
      
      const footer = screen.getByText("Footer content")
      expect(footer).toBeInTheDocument()
      expect(footer.tagName).toBe("DIV")
    })

    it("should have default class names", () => {
      render(<CardFooter>Footer content</CardFooter>)
      
      const footer = screen.getByText("Footer content")
      expect(footer).toHaveClass("flex")
      expect(footer).toHaveClass("items-center")
      expect(footer).toHaveClass("p-6")
      expect(footer).toHaveClass("pt-0")
    })

    it("should accept additional class names", () => {
      render(<CardFooter className="custom-footer-class">Footer content</CardFooter>)
      
      const footer = screen.getByText("Footer content")
      expect(footer).toHaveClass("custom-footer-class")
    })

    it("should forward ref correctly", () => {
      const ref = React.createRef<HTMLDivElement>()
      render(<CardFooter ref={ref}>Footer content</CardFooter>)
      
      expect(ref.current).not.toBeNull()
      expect(ref.current).toBeInstanceOf(HTMLDivElement)
    })
  })

  describe("Card Composition", () => {
    it("should render all components together in a proper card structure", () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
            <CardDescription>Card Description</CardDescription>
          </CardHeader>
          <CardContent>Card Content</CardContent>
          <CardFooter>Card Footer</CardFooter>
        </Card>
      )

      expect(screen.getByText("Card Title")).toBeInTheDocument()
      expect(screen.getByText("Card Description")).toBeInTheDocument()
      expect(screen.getByText("Card Content")).toBeInTheDocument()
      expect(screen.getByText("Card Footer")).toBeInTheDocument()
    })
  })
})