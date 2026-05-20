import * as React from "react";
import { render, screen } from "@testing-library/react";
import { Input } from "./input";
import userEvent from "@testing-library/user-event";

describe("Input Component", () => {
  test("renders input element", () => {
    render(<Input />);
    const inputElement = screen.getByRole("textbox");
    expect(inputElement).toBeInTheDocument();
    expect(inputElement.tagName).toBe("INPUT");
  });

  test("applies default classes", () => {
    render(<Input />);
    const inputElement = screen.getByRole("textbox");
    expect(inputElement).toHaveClass("flex");
    expect(inputElement).toHaveClass("h-9");
    expect(inputElement).toHaveClass("w-full");
    expect(inputElement).toHaveClass("rounded-md");
    expect(inputElement).toHaveClass("border");
    expect(inputElement).toHaveClass("border-input");
    expect(inputElement).toHaveClass("bg-transparent");
    expect(inputElement).toHaveClass("px-3");
    expect(inputElement).toHaveClass("py-1");
    expect(inputElement).toHaveClass("text-sm");
    expect(inputElement).toHaveClass("shadow-sm");
    expect(inputElement).toHaveClass("transition-colors");
    expect(inputElement).toHaveClass("file:border-0");
    expect(inputElement).toHaveClass("file:bg-transparent");
    expect(inputElement).toHaveClass("file:text-sm");
    expect(inputElement).toHaveClass("file:font-medium");
    expect(inputElement).toHaveClass("placeholder:text-muted-foreground");
    expect(inputElement).toHaveClass("focus-visible:outline-none");
    expect(inputElement).toHaveClass("focus-visible:ring-1");
    expect(inputElement).toHaveClass("focus-visible:ring-ring");
    expect(inputElement).toHaveClass("disabled:cursor-not-allowed");
    expect(inputElement).toHaveClass("disabled:opacity-50");
  });

  test("applies custom className", () => {
    render(<Input className="custom-class" />);
    const inputElement = screen.getByRole("textbox");
    expect(inputElement).toHaveClass("custom-class");
  });

  test("renders with specified type", () => {
    render(<Input type="email" />);
    const inputElement = screen.getByRole("textbox");
    expect(inputElement).toHaveAttribute("type", "email");
  });

  test("renders without explicit type defaults to text", () => {
    render(<Input />);
    const inputElement = screen.getByRole("textbox");
    // When no type is specified, HTML input defaults to "text" type, so attribute may be null but behavior is text
    expect(inputElement.getAttribute("type")).toBeNull(); // Because React doesn't set the attribute if it's undefined
    // But the element should still behave as a textbox
    expect(inputElement).toBeInTheDocument();
  });

  test("can be controlled", () => {
    const handleChange = jest.fn();
    const { rerender } = render(<Input value="test value" onChange={handleChange} />);
    const inputElement = screen.getByRole("textbox");
    expect(inputElement).toHaveValue("test value");

    // Test that value can be updated
    rerender(<Input value="updated value" onChange={handleChange} />);
    expect(inputElement).toHaveValue("updated value");
  });

  test("handles onChange event", async () => {
    const user = userEvent.setup();
    const handleChange = jest.fn();
    render(<Input onChange={handleChange} />);

    const inputElement = screen.getByRole("textbox");
    await user.type(inputElement, "test input");

    expect(handleChange).toHaveBeenCalledTimes(10); // "t", "e", "s", "t", " ", "i", "n", "p", "u", "t"
  });

  test("can be disabled", () => {
    render(<Input disabled={true} />);
    const inputElement = screen.getByRole("textbox");
    expect(inputElement).toBeDisabled();
    expect(inputElement).toHaveClass("disabled:cursor-not-allowed");
    expect(inputElement).toHaveClass("disabled:opacity-50");
  });

  test("accepts placeholder text", () => {
    render(<Input placeholder="Enter text" />);
    const inputElement = screen.getByPlaceholderText("Enter text");
    expect(inputElement).toBeInTheDocument();
  });

  test("forwards ref properly", () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input ref={ref} />);
    
    expect(ref.current).not.toBeNull();
    expect(ref.current instanceof HTMLInputElement).toBe(true);
  });

  test("passes additional attributes", () => {
    render(<Input data-testid="test-input" aria-label="test input" />);
    const inputElement = screen.getByTestId("test-input");
    expect(inputElement).toHaveAccessibleName("test input");
  });

  test("renders with different input types", () => {
    // Test password type
    const { rerender } = render(<Input type="password" data-testid="input-element" />);
    let inputElement = screen.getByTestId("input-element");
    expect(inputElement).toHaveAttribute("type", "password");

    // Test number type
    rerender(<Input type="number" data-testid="input-element" />);
    inputElement = screen.getByTestId("input-element");
    expect(inputElement).toHaveAttribute("type", "number");

    // Test search type
    rerender(<Input type="search" data-testid="input-element" />);
    inputElement = screen.getByTestId("input-element");
    expect(inputElement).toHaveAttribute("type", "search");
  });
});