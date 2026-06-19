"use client";

import type { SelectHTMLAttributes } from "react";

/**
 * A <select> that submits its parent form the moment it changes — so picking
 * an option shows results immediately, no separate "go" button needed.
 * Works without JS too: wrap it in a normal GET form with a submit fallback.
 */
export function AutoSubmitSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      onChange={(e) => {
        props.onChange?.(e);
        e.currentTarget.form?.requestSubmit();
      }}
    />
  );
}
