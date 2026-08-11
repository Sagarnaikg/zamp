import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorState } from "@/components/ui/error-state";
import { ApiError, ApiErrorKind } from "@/lib/api/errors";
import { ACTIONS, ERROR_STATES } from "@/constants";
import { HTTP_STATUS } from "@/server/constants";

/**
 * Offering "try again" on an error that can never succeed is a worse
 * experience than not offering it, so retry affordance is tied to the error's
 * own `retryable` flag rather than shown unconditionally.
 */
describe("ErrorState", () => {
  it("shows the server's own explanation instead of generic copy", () => {
    const message = "The AI provider is rate-limiting requests right now.";
    render(
      <ErrorState
        error={new ApiError(ApiErrorKind.Server, message, HTTP_STATUS.badGateway)}
      />,
    );
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it("announces itself to assistive tech", () => {
    render(<ErrorState error={new Error("boom")} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("offers retry for a transient server failure", async () => {
    const onRetry = vi.fn();
    render(
      <ErrorState
        error={new ApiError(ApiErrorKind.Server, "Upstream failed", 502)}
        onRetry={onRetry}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: ACTIONS.retry }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("hides retry for a 404, which retrying cannot fix", () => {
    render(
      <ErrorState
        error={
          new ApiError(ApiErrorKind.NotFound, "Document not found", HTTP_STATUS.notFound)
        }
        onRetry={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: ACTIONS.retry })).toBeNull();
    expect(screen.getByText(ERROR_STATES.notFound.title)).toBeInTheDocument();
  });

  it("treats an unknown thrown value as retryable rather than dead-ending", () => {
    render(<ErrorState error={new Error("render crash")} onRetry={vi.fn()} />);
    expect(screen.getByRole("button", { name: ACTIONS.retry })).toBeInTheDocument();
  });
});
