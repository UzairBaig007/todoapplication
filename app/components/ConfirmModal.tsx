"use client";

type ConfirmModalProps = {
  open: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "default" | "danger";
};

export function ConfirmModal({
  open,
  message,
  onConfirm,
  onCancel,
  confirmLabel = "Yes",
  cancelLabel = "No",
  confirmVariant = "default",
}: ConfirmModalProps) {
  if (!open) return null;

  const confirmButtonClass =
    confirmVariant === "danger"
      ? "rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:bg-red-700"
      : "rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      data-testid="confirm-modal"
    >
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
        <p id="confirm-modal-title" className="text-sm text-foreground">
          {message}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            data-testid="confirm-modal-cancel"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            data-testid="confirm-modal-confirm"
            className={confirmButtonClass}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
