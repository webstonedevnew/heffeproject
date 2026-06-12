"use client";

import { useTransition } from "react";

/** Button that asks for confirmation, then runs a server action. */
export function ConfirmButton({
  action,
  confirmText,
  className = "text-xs text-accent underline",
  children,
}: {
  action: () => Promise<void>;
  confirmText: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      onClick={() => {
        if (window.confirm(confirmText)) {
          startTransition(async () => {
            await action();
          });
        }
      }}
    >
      {children}
    </button>
  );
}
