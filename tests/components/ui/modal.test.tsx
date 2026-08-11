import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "@/components/ui/modal";

/**
 * Keyboard behaviour is the part of a dialog that silently regresses, and the
 * review flow puts destructive actions (reject) behind one — so the focus
 * trap and Escape handling are pinned here rather than trusted.
 */
describe("Modal", () => {
  it("renders nothing while closed", () => {
    render(
      <Modal open={false} onClose={vi.fn()} title="Reject document">
        <button type="button">Confirm</button>
      </Modal>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("exposes itself as a modal dialog with an accessible name", () => {
    render(
      <Modal open onClose={vi.fn()} title="Reject document">
        <button type="button">Confirm</button>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("Reject document");
  });

  it("moves focus into the dialog on open", () => {
    render(
      <Modal open onClose={vi.fn()} title="Reject document">
        <button type="button">Confirm</button>
      </Modal>,
    );
    expect(screen.getByRole("button", { name: "Confirm" })).toHaveFocus();
  });

  it("closes on Escape, so a keyboard user is never trapped", async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Reject document">
        <button type="button">Confirm</button>
      </Modal>,
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("wraps Tab from the last focusable element back to the first", async () => {
    render(
      <Modal open onClose={vi.fn()} title="Reject document">
        <button type="button">Confirm</button>
      </Modal>,
    );
    const confirm = screen.getByRole("button", { name: "Confirm" });
    const close = screen.getByRole("button", { name: /close/i });

    await userEvent.tab();
    expect(close).toHaveFocus();

    // Close is the last control, so Tab must cycle rather than leave the dialog.
    await userEvent.tab();
    expect(confirm).toHaveFocus();
  });

  it("closes on a backdrop click but not on a click inside the panel", async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Reject document">
        <button type="button">Confirm</button>
      </Modal>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("dialog").parentElement!);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
