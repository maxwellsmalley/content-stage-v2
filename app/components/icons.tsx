"use client";

export function IconButton({
  label,
  icon,
  onClick,
  disabled,
  tone = "neutral"
}: {
  label: string;
  icon:
    | "chevron-right"
    | "chevron-down"
    | "edit"
    | "eye"
    | "trash"
    | "grip"
    | "folder";
  onClick: () => void;
  disabled?: boolean;
  tone?: "neutral" | "danger";
}) {
  const color = tone === "danger" ? "#a10d0d" : "#4b4b4b";
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      style={{
        border: "none",
        background: "transparent",
        padding: 4,
        cursor: disabled ? "not-allowed" : "pointer",
        color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <IconGlyph name={icon} />
    </button>
  );
}

export function IconGlyph({ name }: { name: string }) {
  const stroke = "currentColor";
  const common = {
    fill: "none",
    stroke,
    strokeWidth: 1.6,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  } as const;
  switch (name) {
    case "chevron-right":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
          <path d="M9 6l6 6-6 6" {...common} />
        </svg>
      );
    case "chevron-down":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
          <path d="M6 9l6 6 6-6" {...common} />
        </svg>
      );
    case "edit":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
          <path d="M4 17l4 3 12-12-4-3-12 12z" {...common} />
          <path d="M14 5l4 3" {...common} />
        </svg>
      );
    case "eye":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
          <path
            d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z"
            {...common}
          />
          <circle cx="12" cy="12" r="3" {...common} />
        </svg>
      );
    case "grip":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
          <circle cx="9" cy="7" r="1" {...common} />
          <circle cx="15" cy="7" r="1" {...common} />
          <circle cx="9" cy="12" r="1" {...common} />
          <circle cx="15" cy="12" r="1" {...common} />
          <circle cx="9" cy="17" r="1" {...common} />
          <circle cx="15" cy="17" r="1" {...common} />
        </svg>
      );
    case "folder":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
          <path d="M3 7h7l2 2h9v8H3z" {...common} />
          <path d="M3 7v10" {...common} />
        </svg>
      );
    case "trash":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
          <path d="M3 6h18" {...common} />
          <path d="M8 6V4h8v2" {...common} />
          <path d="M6 6l1 14h10l1-14" {...common} />
        </svg>
      );
    default:
      return null;
  }
}
