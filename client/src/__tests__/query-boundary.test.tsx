import { describe, it, expect, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryBoundary } from "@/components/common/query-boundary";

const base = { isLoading: false, isError: false };

describe("QueryBoundary branch selection", () => {
  it("renders children on success", () => {
    render(
      <QueryBoundary query={base}>
        <p>content</p>
      </QueryBoundary>,
    );
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("shows loading, not children, while loading", () => {
    render(
      <QueryBoundary query={{ ...base, isLoading: true }}>
        <p>content</p>
      </QueryBoundary>,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("content")).not.toBeInTheDocument();
  });

  it("shows the error branch, not an infinite spinner, on error", () => {
    render(
      <QueryBoundary
        query={{ ...base, isError: true, error: new Error("boom") }}
      >
        <p>content</p>
      </QueryBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText("content")).not.toBeInTheDocument();
  });

  it("prefers the error branch even when loading is also true", () => {
    // A refetch-after-error sets isLoading && isError; error must win, or the
    // user is back to a spinner that never resolves.
    render(
      <QueryBoundary query={{ ...base, isLoading: true, isError: true }}>
        <p>content</p>
      </QueryBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("wires the retry button to refetch", async () => {
    const refetch = jest.fn();
    render(
      <QueryBoundary query={{ ...base, isError: true, refetch }}>
        <p>content</p>
      </QueryBoundary>,
    );
    await userEvent.click(screen.getByRole("button", { name: /qayta urinish/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("shows the empty branch when isEmpty and not loading/error", () => {
    render(
      <QueryBoundary query={base} isEmpty empty={<p>nothing here</p>}>
        <p>content</p>
      </QueryBoundary>,
    );
    expect(screen.getByText("nothing here")).toBeInTheDocument();
    expect(screen.queryByText("content")).not.toBeInTheDocument();
  });
});
