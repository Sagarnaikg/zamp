import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConfidenceBadge } from "@/components/domain/confidence-badge";
import { CONFIDENCE } from "@/server/constants";
import { CONFIDENCE_LABELS, ConfidenceLevel } from "@/constants";

/**
 * The badge is how a user decides whether to check a number, so the mapping
 * from score to wording is product behaviour, not styling. Bucket boundaries
 * are pinned against the server's own constants.
 */
describe("ConfidenceBadge", () => {
  it("never renders a bare score — a number alone tells a user nothing", () => {
    render(<ConfidenceBadge score={CONFIDENCE.unverified} />);
    expect(screen.queryByText(String(CONFIDENCE.unverified))).toBeNull();
    expect(
      screen.getByText(CONFIDENCE_LABELS[ConfidenceLevel.Unverified]),
    ).toBeInTheDocument();
  });

  it("maps each server bucket to its own wording", () => {
    const cases: Array<[number, ConfidenceLevel]> = [
      [CONFIDENCE.humanVerified, ConfidenceLevel.HumanVerified],
      [CONFIDENCE.strong, ConfidenceLevel.Strong],
      [CONFIDENCE.verified, ConfidenceLevel.Verified],
      [CONFIDENCE.unverified, ConfidenceLevel.Unverified],
      [CONFIDENCE.suspect, ConfidenceLevel.Suspect],
      [CONFIDENCE.missing, ConfidenceLevel.Missing],
    ];

    for (const [score, level] of cases) {
      const { unmount } = render(<ConfidenceBadge score={score} />);
      expect(screen.getByText(CONFIDENCE_LABELS[level])).toBeInTheDocument();
      unmount();
    }
  });

  it("surfaces the reasons, which are the whole trust story", () => {
    const reasons = ["Subtotal + tax = 836.00", "Both readings agree"];
    render(<ConfidenceBadge score={CONFIDENCE.strong} reasons={reasons} />);
    expect(
      screen.getByText(CONFIDENCE_LABELS[ConfidenceLevel.Strong]),
    ).toHaveAttribute("title", reasons.join(" · "));
  });

  it("falls back to the label when a field has no reasons attached", () => {
    render(<ConfidenceBadge score={CONFIDENCE.verified} />);
    expect(
      screen.getByText(CONFIDENCE_LABELS[ConfidenceLevel.Verified]),
    ).toHaveAttribute("title", CONFIDENCE_LABELS[ConfidenceLevel.Verified]);
  });
});
