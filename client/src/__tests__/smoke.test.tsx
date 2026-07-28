import { render, screen } from "@testing-library/react";
import { cn } from "@/lib/utils";

describe("client test harness", () => {
  it("renders JSX in jsdom", () => {
    render(<p>hello</p>);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("resolves the @/ path alias and tailwind-merge conflicts", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});
