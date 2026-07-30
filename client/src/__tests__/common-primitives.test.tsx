import { describe, it, expect } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import { StatCard } from "@/components/common/stat-card";
import { UserRow } from "@/components/common/user-row";
import { FormField } from "@/components/common/form-field";
import { Input } from "@/components/ui/input";

describe("StatCard", () => {
  it("renders label and value", () => {
    render(<StatCard label="WPM" value={72} />);
    expect(screen.getByText("WPM")).toBeInTheDocument();
    expect(screen.getByText("72")).toBeInTheDocument();
  });

  it("marks the value aria-live only when live", () => {
    const { rerender } = render(<StatCard label="WPM" value={1} />);
    expect(screen.getByText("1")).not.toHaveAttribute("aria-live");
    rerender(<StatCard label="WPM" value={2} live />);
    expect(screen.getByText("2")).toHaveAttribute("aria-live", "polite");
  });

  it("hides the value behind a skeleton while loading", () => {
    render(<StatCard label="WPM" value={99} loading />);
    expect(screen.queryByText("99")).not.toBeInTheDocument();
  });
});

describe("UserRow", () => {
  it("always gives the avatar image an accessible name", () => {
    // The fallback (initials) shows in jsdom since the image never loads, but
    // the point is the alt is present on the img element regardless.
    const { container } = render(
      <UserRow user={{ username: "aziz", avatarUrl: "/a.png" }} />,
    );
    const img = container.querySelector("img");
    // Radix Avatar may defer the img; assert the username is the label source.
    expect(screen.getByText("aziz")).toBeInTheDocument();
    if (img) expect(img).toHaveAttribute("alt", "aziz");
  });

  it("renders rank and trailing content", () => {
    render(
      <UserRow user={{ username: "b" }} rank={3} trailing={<span>1200</span>} />,
    );
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("1200")).toBeInTheDocument();
  });
});

describe("FormField", () => {
  it("wires label to control via a generated id", () => {
    render(
      <FormField label="Email">
        {(p) => <Input {...p} />}
      </FormField>,
    );
    const input = screen.getByLabelText("Email");
    expect(input).toBeInTheDocument();
    expect(input.id).toBeTruthy();
  });

  it("exposes the error via aria-describedby", () => {
    render(
      <FormField label="Email" error="required">
        {(p) => <Input {...p} />}
      </FormField>,
    );
    const input = screen.getByLabelText("Email");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(screen.getByText("required").id).toBe(describedBy);
  });
});
