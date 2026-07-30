// In ESM mode jest does not inject globals; they have to be imported.
import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { AppErrorBoundary } from "@/components/layout/error-boundary";

function Boom({ throwNow }: { throwNow: boolean }): React.ReactElement {
  if (throwNow) throw new Error("kaboom");
  return <p>alive</p>;
}

describe("AppErrorBoundary", () => {
  let spy: ReturnType<typeof jest.spyOn>;
  beforeEach(() => {
    // React logs the caught error itself; keep the test output readable.
    spy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => spy.mockRestore());

  it("renders children when nothing throws", () => {
    render(
      <AppErrorBoundary>
        <Boom throwNow={false} />
      </AppErrorBoundary>,
    );
    expect(screen.getByText("alive")).toBeInTheDocument();
  });

  it("shows the fallback instead of unmounting the tree on a throw", () => {
    render(
      <AppErrorBoundary>
        <Boom throwNow />
      </AppErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("alive")).not.toBeInTheDocument();
  });

  it("recovers when the retry button is pressed and the child stops throwing", async () => {
    function Harness() {
      const [broken, setBroken] = React.useState(true);
      return (
        <>
          <button onClick={() => setBroken(false)}>fix</button>
          <AppErrorBoundary>
            <Boom throwNow={broken} />
          </AppErrorBoundary>
        </>
      );
    }
    render(<Harness />);
    expect(screen.getByRole("alert")).toBeInTheDocument();

    await userEvent.click(screen.getByText("fix"));
    await userEvent.click(screen.getByRole("button", { name: /qayta urinish/i }));

    expect(screen.getByText("alive")).toBeInTheDocument();
  });

  it("resets automatically when a resetKey changes", () => {
    const { rerender } = render(
      <AppErrorBoundary resetKeys={["/a"]}>
        <Boom throwNow />
      </AppErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();

    rerender(
      <AppErrorBoundary resetKeys={["/b"]}>
        <Boom throwNow={false} />
      </AppErrorBoundary>,
    );
    expect(screen.getByText("alive")).toBeInTheDocument();
  });
});
