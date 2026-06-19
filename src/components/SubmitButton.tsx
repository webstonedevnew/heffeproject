"use client";

import { useFormStatus } from "react-dom";
import { Spinner } from "@/components/Spinner";

/**
 * A submit button that shows a spinner and disables itself while its form's
 * server action is running — so the user always sees that something is
 * happening (login, invite acceptance, etc.). Must be rendered inside a
 * <form action={serverAction}>.
 */
export function SubmitButton({
  children,
  className = "",
  pendingText,
}: {
  children: React.ReactNode;
  className?: string;
  pendingText?: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`inline-flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait ${className}`}
    >
      {pending && <Spinner />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
