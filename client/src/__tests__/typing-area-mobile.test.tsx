import { render, screen } from "@testing-library/react";
import { TypingArea } from "@/components/typing-area";

const props = {
  words: ["alpha", "beta", "gamma", "delta"],
  userInput: "",
  onInputChange: () => {},
  isActive: false,
  currentIndex: 0,
};

describe("TypingArea on touch screens", () => {
  beforeEach(() => {
    Object.defineProperty(window, "ontouchstart", { configurable: true, value: null });
  });

  afterEach(() => {
    delete (window as Window & { ontouchstart?: unknown }).ontouchstart;
  });

  it("keeps the tappable instruction below the text instead of covering it", () => {
    render(<TypingArea {...props} />);

    const prompt = screen.getByText("Tap to start typing");
    expect(prompt.tagName).toBe("BUTTON");
    expect(screen.getByRole("button", { name: "Tap to start typing" })).toBeInTheDocument();
    expect(screen.getByTestId("typing-area")).toHaveStyle(
      "height: calc(4 * 1.55em + 3 * 0.6em)",
    );
  });
});
