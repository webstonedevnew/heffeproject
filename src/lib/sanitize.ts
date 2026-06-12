import sanitizeHtml from "sanitize-html";

/**
 * Server-side sanitization of rich text coming from the Tiptap editor.
 * Everything stored in body_html has passed through here.
 */
export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "h2", "h3", "p", "br", "strong", "b", "em", "i", "u", "s",
      "a", "ul", "ol", "li", "blockquote", "code", "pre", "img",
    ],
    allowedAttributes: {
      a: ["href", "rel", "target"],
      img: ["src", "alt"],
    },
    allowedSchemes: ["https", "http", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer nofollow",
        target: "_blank",
      }),
    },
  });
}

/** Plain text for search indexing and notification previews. */
export function htmlToText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
}

export function excerpt(html: string, max = 160): string {
  const text = htmlToText(html);
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}
