/** Renders rich text that was sanitized server-side before storage. */
export function RichTextView({ html, className = "" }: { html: string; className?: string }) {
  return (
    <div
      className={`prose-tok ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
