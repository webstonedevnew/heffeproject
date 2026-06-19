/** A round profile picture, or tidy initials when none is set. */
export function Avatar({
  name,
  path,
  size = 32,
}: {
  name: string;
  path?: string | null;
  size?: number;
}) {
  if (path) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/files/attachments/${path}`}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="inline-block rounded-full object-cover bg-paper-deep border border-line shrink-0"
      />
    );
  }
  const initials =
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      className="inline-flex items-center justify-center rounded-full bg-paper-deep text-ink-soft font-medium border border-line shrink-0"
    >
      {initials}
    </span>
  );
}
