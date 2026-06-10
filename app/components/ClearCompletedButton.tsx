"use client";

import { useState, useTransition } from "react";
import { clearCompletedTodos } from "@/app/actions";
import { ConfirmModal } from "./ConfirmModal";

export function ClearCompletedButton({ count }: { count: number }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (count === 0) return null;

  function handleConfirm() {
    setShowConfirm(false);
    startTransition(() => {
      void clearCompletedTodos();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        disabled={isPending}
        data-testid="clear-completed-button"
        className="text-sm text-zinc-500 transition-colors hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
      >
        {isPending ? "Clearing…" : "Clear Completed"}
      </button>

      <ConfirmModal
        open={showConfirm}
        message="Are you sure you want to delete all completed tasks?"
        confirmLabel="Yes (Delete)"
        cancelLabel="No"
        confirmVariant="danger"
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
