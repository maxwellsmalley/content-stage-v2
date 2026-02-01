"use client";

import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from "react";
import type { CSSProperties } from "react";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { Button, Input, Select, Textarea } from "@/app/components/ui";
import { useAuth } from "@/app/components/auth-provider";
import { exportPage } from "@/lib/services/exports";
import { getPage, updatePageTitle, updatePageStatus } from "@/lib/services/pages";
import Link from "next/link";
import {
  addBlock,
  listBlocks,
  removeBlock,
  updateBlockFields,
  updateBlockOrder
} from "@/lib/services/blocks";
import { hasProjectAccess } from "@/lib/services/projects";
import { Block, BlockFields, BlockType, HeadingLevel, PageStatus } from "@/lib/models/types";
import { blockTypeLabels, createDefaultFields } from "@/lib/utils/block-templates";
import { storage } from "@/lib/firebase";

function hasText(value?: string) {
  return Boolean(value && value.trim().length > 0);
}

function hasMedia(media?: { src?: string }) {
  return Boolean(media?.src);
}

function normalizeMedia(media?: any) {
  return {
    src: "",
    alt: "",
    caption: "",
    type: "image",
    fileName: "",
    displayMode: "landscape",
    ...(media || {})
  };
}

function fileNameFromUrl(src?: string) {
  if (!src) return "";
  try {
    const url = new URL(src);
    const path = url.pathname.split("/").pop() || "";
    return decodeURIComponent(path);
  } catch {
    const parts = src.split("/").pop() || "";
    return parts;
  }
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_MEDIA_GALLERY = 6;
const RECOMMENDED_IMAGE_HINT = "Recommended: 1920×1080 px. Max file size 5MB.";
const PREVIEW_IMAGE_ASPECT = "16:9";
const PREVIEW_TEXT_MAX = 520;
const PREVIEW_SIDE_IMAGE = 180;
const PREVIEW_GAP = 14;
const PREVIEW_CARD_MIN = 200;

function displayModeAspect(mode?: "landscape" | "portrait" | "square") {
  switch (mode) {
    case "portrait":
      return "2 / 3";
    case "square":
      return "1 / 1";
    case "landscape":
    default:
      return "3 / 2";
  }
}

function previewPadding(mode?: "landscape" | "portrait" | "square") {
  if (mode === "portrait") return 8;
  return 6;
}

function previewRatioNumber(
  mode?: "landscape" | "portrait" | "square",
  aspectRatio?: string
) {
  if (mode === "portrait") return 2 / 3;
  if (mode === "square") return 1;
  if (mode === "landscape") return 3 / 2;
  if (aspectRatio === "4:3") return 4 / 3;
  if (aspectRatio === "1:1") return 1;
  if (aspectRatio === "3:4") return 3 / 4;
  return 16 / 9;
}

function aspectRatioValue(value?: string) {
  switch (value) {
    case "4:3":
      return "4 / 3";
    case "1:1":
      return "1 / 1";
    case "3:4":
      return "3 / 4";
    case "16:9":
    default:
      return "16 / 9";
  }
}

function PreviewImageFrame({
  src,
  alt,
  aspectRatio = PREVIEW_IMAGE_ASPECT,
  displayMode,
  backgroundColor,
  allowFlex
}: {
  src?: string;
  alt?: string;
  aspectRatio?: string;
  displayMode?: "landscape" | "portrait" | "square";
  backgroundColor?: string;
  allowFlex?: boolean;
}) {
  const baseRatio = previewRatioNumber(displayMode, aspectRatio);
  const ratio =
    allowFlex && displayMode === "landscape"
      ? baseRatio * 1.15
      : allowFlex && displayMode === "portrait"
        ? baseRatio * 0.85
        : baseRatio;
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: ratio,
        overflow: "hidden",
        borderRadius: 6,
        background: backgroundColor || "#f2f2f2",
        padding: previewPadding(displayMode)
      }}
    >
      {src ? (
        <img
          src={src}
          alt={alt || "Preview image"}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            objectPosition: "center"
          }}
        />
      ) : (
        <div style={{ width: "100%", height: "100%" }} />
      )}
    </div>
  );
}

function blockHasContent(blockType: BlockType, fields: BlockFields) {
  const data: any = fields;
  switch (blockType) {
    case "hero":
    case "banner":
    case "content":
      return (
        hasText(data.heading?.text) ||
        hasText(data.body) ||
        hasText(data.primaryButton?.label) ||
        hasMedia(data.media)
      );
    case "card_list":
      return hasText(data.heading?.text) || (data.cards || []).length > 0;
    case "tab_content":
      return hasText(data.mainHeading?.text) || (data.tabs || []).length > 0;
    case "media":
      return hasMedia(data.media);
    default:
      return false;
  }
}

function Section({
  title,
  children,
  defaultOpen = false,
  hasContent,
  sectionKey,
  autoOpenWhenContent = false
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  hasContent?: boolean;
  sectionKey: string;
  autoOpenWhenContent?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [didAutoOpen, setDidAutoOpen] = useState(false);

  useEffect(() => {
    setOpen(defaultOpen);
    setDidAutoOpen(false);
  }, [sectionKey, defaultOpen]);

  useEffect(() => {
    if (autoOpenWhenContent && hasContent && !didAutoOpen) {
      setOpen(true);
      setDidAutoOpen(true);
    }
  }, [autoOpenWhenContent, hasContent, didAutoOpen]);

  return (
    <details
      className="surface"
      style={{ padding: 16 }}
      open={open}
      onToggle={(event) => {
        const nextOpen = (event.currentTarget as HTMLDetailsElement).open;
        setOpen(nextOpen);
      }}
    >
      <summary>
        {title}
        {hasContent ? " • filled" : ""}
      </summary>
      <div className="stack" style={{ marginTop: 12 }}>
        {children}
      </div>
    </details>
  );
}

function previewLabel(blockType: BlockType, fields: BlockFields) {
  const data: any = fields;
  if (blockType === "media") {
    return hasMedia(data.media) ? "Media present" : "No media yet";
  }
  if (blockType === "card_list") {
    return (data.cards || []).length > 0 ? "Cards added" : "No cards yet";
  }
  if (blockType === "tab_content") {
    return (data.tabs || []).length > 0 ? "Tabs added" : "No tabs yet";
  }
  if (hasMedia(data.media)) return "Media present";
  return hasText(data.heading?.text) || hasText(data.body) ? "Content added" : "No content yet";
}

function ToggleRow({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="row" style={{ gap: 8 }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

async function uploadMediaFile(path: string, file: File) {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

function MediaUpload({
  label,
  media,
  allowVideo = true,
  uploadPath,
  onChange
}: {
  label: string;
  media: { src: string; type?: "image" | "video"; fileName?: string };
  allowVideo?: boolean;
  uploadPath: string;
  onChange: (next: { src: string; type?: "image" | "video"; fileName?: string }) => void;
}) {
  const accept = allowVideo ? "image/*,video/*" : "image/*";
  const mediaPresent = Boolean(media?.src);
  const displayName = media.fileName || fileNameFromUrl(media.src) || "No file selected";
  const [error, setError] = useState("");
  return (
    <div className="stack">
      <span style={{ fontSize: 13, color: "#4b4b4b" }}>{label}</span>
      <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <span className="muted file-name" style={{ fontSize: 12 }} title={displayName}>
          {displayName}
        </span>
        <div className="row">
          <label className="row" style={{ gap: 6, cursor: "pointer" }}>
            <input
              type="file"
              accept={accept}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (file.type.startsWith("image") && file.size > MAX_IMAGE_BYTES) {
                  setError("Image is too large. Max file size is 5MB.");
                  return;
                }
                setError("");
                const nextType = file.type.startsWith("video") ? "video" : "image";
                const uploadUrl = await uploadMediaFile(
                  `${uploadPath}/${Date.now()}-${file.name}`,
                  file
                );
                onChange({ src: uploadUrl, type: nextType, fileName: file.name });
              }}
              style={{ display: "none" }}
            />
            <span
              style={{
                padding: "8px 14px",
                borderRadius: 6,
                border: "1px solid #cfcfcf",
                background: "#ffffff",
                color: "#1b1b1b"
              }}
            >
              {mediaPresent ? "Replace" : "Upload"}
            </span>
          </label>
          {mediaPresent && (
            <Button
              variant="secondary"
              onClick={() => {
                setError("");
                onChange({ src: "", type: media.type || "image", fileName: "" });
              }}
            >
              Remove
            </Button>
          )}
        </div>
      </div>
      <span className="muted" style={{ fontSize: 12 }}>
        {RECOMMENDED_IMAGE_HINT}
      </span>
      {error && (
        <span style={{ color: "#a10d0d", fontSize: 12 }}>{error}</span>
      )}
      <p className="muted" style={{ fontSize: 12 }}>
        TODO: Wire media uploads to storage and save permanent URLs.
      </p>
    </div>
  );
}

function MediaGalleryUpload({
  label,
  items,
  uploadPath,
  onChange,
  maxItems = MAX_MEDIA_GALLERY
}: {
  label: string;
  items: Array<{ src: string; type?: "image" | "video"; fileName?: string }>;
  uploadPath: string;
  onChange: (nextItems: Array<{ src: string; type?: "image" | "video"; fileName?: string }>) => void;
  maxItems?: number;
}) {
  const [error, setError] = useState("");
  const remaining = Math.max(0, maxItems - items.length);
  const disabled = remaining === 0;
  return (
    <div className="stack">
      <span style={{ fontSize: 13, color: "#4b4b4b" }}>{label}</span>
      <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <span className="muted" style={{ fontSize: 12 }}>
          {items.length}/{maxItems} images
        </span>
        <label
          className="row"
          style={{ gap: 6, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 }}
        >
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={async (event) => {
              if (disabled) return;
              const files = Array.from(event.target.files || []);
              if (files.length === 0) return;
              if (files.length > remaining) {
                setError(`You can add up to ${maxItems} images.`);
                return;
              }
              const uploads: Array<{ src: string; type?: "image" | "video"; fileName?: string }> = [];
              for (const file of files) {
                if (!file.type.startsWith("image")) {
                  setError("Only images are supported for galleries.");
                  continue;
                }
                if (file.size > MAX_IMAGE_BYTES) {
                  setError("Image is too large. Max file size is 5MB.");
                  continue;
                }
                const uploadUrl = await uploadMediaFile(
                  `${uploadPath}/${Date.now()}-${file.name}`,
                  file
                );
                uploads.push({
                  src: uploadUrl,
                  type: "image",
                  fileName: file.name,
                  displayMode: "landscape"
                });
              }
              if (uploads.length > 0) {
                setError("");
                onChange([...items, ...uploads]);
              }
            }}
            style={{ display: "none" }}
          />
          <span
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              border: "1px solid #cfcfcf",
              background: "#ffffff",
              color: "#1b1b1b"
            }}
          >
            Add images
          </span>
        </label>
      </div>
      {items.length > 0 && (
        <div className="row" style={{ flexWrap: "wrap" }}>
          {items.map((item, idx) => (
            <div
              key={`${item.src}-${idx}`}
              style={{
                border: "1px solid #e1e1e1",
                borderRadius: 6,
                padding: 6,
                display: "flex",
                alignItems: "center",
                gap: 8
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 32,
                  borderRadius: 4,
                  background: item.src ? `url(${item.src}) center / cover` : "#efefef"
                }}
              />
              <span className="muted file-name" style={{ fontSize: 12 }} title={item.fileName}>
                {item.fileName || fileNameFromUrl(item.src) || "Image"}
              </span>
              <Button
                variant="secondary"
                onClick={() => {
                  setError("");
                  onChange(items.filter((_, itemIdx) => itemIdx !== idx));
                }}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}
      <span className="muted" style={{ fontSize: 12 }}>
        {RECOMMENDED_IMAGE_HINT}
      </span>
      {error && <span style={{ color: "#a10d0d", fontSize: 12 }}>{error}</span>}
    </div>
  );
}

function CardImageUpload({
  label,
  imageUrl,
  uploadPath,
  onChange
}: {
  label: string;
  imageUrl: string;
  uploadPath: string;
  onChange: (nextUrl: string) => void;
}) {
  const mediaPresent = Boolean(imageUrl);
  const displayName = fileNameFromUrl(imageUrl) || "No file selected";
  const [error, setError] = useState("");
  return (
    <div className="stack">
      <span style={{ fontSize: 13, color: "#4b4b4b" }}>{label}</span>
      <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <span className="muted file-name" style={{ fontSize: 12 }} title={displayName}>
          {displayName}
        </span>
        <div className="row">
          <label className="row" style={{ gap: 6, cursor: "pointer" }}>
            <input
              type="file"
              accept="image/*"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (file.size > MAX_IMAGE_BYTES) {
                  setError("Image is too large. Max file size is 5MB.");
                  return;
                }
                setError("");
                const uploadUrl = await uploadMediaFile(
                  `${uploadPath}/${Date.now()}-${file.name}`,
                  file
                );
                onChange(uploadUrl);
              }}
              style={{ display: "none" }}
            />
            <span
              style={{
                padding: "8px 14px",
                borderRadius: 6,
                border: "1px solid #cfcfcf",
                background: "#ffffff",
                color: "#1b1b1b"
              }}
            >
              {mediaPresent ? "Replace" : "Upload"}
            </span>
          </label>
          {mediaPresent && (
            <Button
              variant="secondary"
              onClick={() => {
                setError("");
                onChange("");
              }}
            >
              Remove
            </Button>
          )}
        </div>
      </div>
      <span className="muted" style={{ fontSize: 12 }}>
        {RECOMMENDED_IMAGE_HINT}
      </span>
      {error && (
        <span style={{ color: "#a10d0d", fontSize: 12 }}>{error}</span>
      )}
      <p className="muted" style={{ fontSize: 12 }}>
        TODO: Wire media uploads to storage and save permanent URLs.
      </p>
    </div>
  );
}

function IconButton({
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
    | "eye"
    | "eye-off"
    | "expand"
    | "shrink"
    | "arrow-up"
    | "arrow-down"
    | "trash";
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
      <Icon name={icon} />
    </button>
  );
}

function Icon({ name }: { name: string }) {
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
    case "eye":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
          <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z" {...common} />
          <circle cx="12" cy="12" r="3" {...common} />
        </svg>
      );
    case "eye-off":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
          <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z" {...common} />
          <path d="M3 3l18 18" {...common} />
        </svg>
      );
    case "expand":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
          <path d="M9 3H3v6M15 3h6v6M3 15v6h6M21 15v6h-6" {...common} />
        </svg>
      );
    case "shrink":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
          <path d="M9 9H3V3M15 9h6V3M3 21h6v-6M21 21h-6v-6" {...common} />
        </svg>
      );
    case "arrow-up":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
          <path d="M12 5l-6 6m6-6l6 6M12 5v14" {...common} />
        </svg>
      );
    case "arrow-down":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
          <path d="M12 19l6-6m-6 6l-6-6M12 19V5" {...common} />
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

const blockDescriptions: Record<BlockType, string> = {
  hero: "Primary page introduction with headline, body, and media.",
  banner: "Compact announcement with supporting media and button.",
  content: "Flexible content section with body copy and optional media.",
  card_list: "Repeatable cards for highlights, features, or collections.",
  tab_content: "Tabbed content for grouped sections with media support.",
  media: "Standalone image or video with supporting metadata."
};

const paletteBlocks: BlockType[] = [
  "hero",
  "banner",
  "content",
  "card_list",
  "tab_content",
  "media"
];

const BlockPalette = forwardRef<
  HTMLDivElement,
  {
    className?: string;
    expandedBlock: BlockType | null;
    onExpand: (block: BlockType | null) => void;
    onAdd: (block: BlockType) => void;
    style?: CSSProperties;
  }
>(function BlockPalette(
  { className, expandedBlock, onExpand, onAdd, style },
  ref
) {
  const selectedIndex = expandedBlock
    ? paletteBlocks.indexOf(expandedBlock)
    : -1;
  return (
    <div
      className={`palette ${className || ""}`}
      ref={ref}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        ...style
      }}
    >
      <div className="stack" style={{ gap: 8 }}>
        {paletteBlocks.map((blockType) => {
          const isExpanded = expandedBlock === blockType;
          return (
            <div
              key={blockType}
              className="surface"
              style={{
                padding: 6,
                width: 40,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <button
                type="button"
                aria-label={blockTypeLabels[blockType]}
                title={blockTypeLabels[blockType]}
                onClick={() => onExpand(isExpanded ? null : blockType)}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "100%",
                  cursor: "pointer"
                }}
              >
                <BlockPaletteIcon type={blockType} />
              </button>
            </div>
          );
        })}
      </div>
      {expandedBlock && (
        <div
          className="surface"
          style={{
            position: "absolute",
            left: 52,
            top: selectedIndex >= 0 ? selectedIndex * 48 : 0,
            width: 220,
            padding: 12
          }}
        >
          <div className="stack" style={{ gap: 8 }}>
            <strong>{blockTypeLabels[expandedBlock]}</strong>
            <span className="muted" style={{ fontSize: 12 }}>
              {blockDescriptions[expandedBlock]}
            </span>
            <Button variant="primary" onClick={() => onAdd(expandedBlock)}>
              Add
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});

function BlockPaletteIcon({ type }: { type: BlockType }) {
  const common = {
    stroke: "#4b4b4b",
    fill: "none",
    strokeWidth: 1.6,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  } as const;
  switch (type) {
    case "hero":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
          <rect x="4" y="5" width="16" height="14" rx="2" {...common} />
          <circle cx="9" cy="10" r="1.5" {...common} />
          <path d="M7 15l3-3 3 3 3-4 2 4" {...common} />
        </svg>
      );
    case "banner":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
          <path d="M5 12h14" {...common} />
        </svg>
      );
    case "content":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
          <path d="M5 8h14M5 12h14M5 16h10" {...common} />
        </svg>
      );
    case "card_list":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
          <rect x="5" y="5" width="6" height="6" rx="1" {...common} />
          <rect x="13" y="5" width="6" height="6" rx="1" {...common} />
          <rect x="5" y="13" width="6" height="6" rx="1" {...common} />
          <rect x="13" y="13" width="6" height="6" rx="1" {...common} />
        </svg>
      );
    case "tab_content":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
          <rect x="4" y="7" width="16" height="12" rx="2" {...common} />
          <path d="M4 11h16" {...common} />
        </svg>
      );
    case "media":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
          <rect x="4" y="5" width="16" height="14" rx="2" {...common} />
          <path d="M7 15l3-3 3 3 3-4 2 4" {...common} />
        </svg>
      );
    default:
      return null;
  }
}

export default function PageEditor() {
  const params = useParams<{
    workspaceId: string;
    projectId: string;
    pageId: string;
  }>();
  const router = useRouter();
  const { user, loading, systemRole, workspaceMembership } = useAuth();
  const [pageTitle, setPageTitle] = useState("");
  const [pageStatus, setPageStatus] = useState<PageStatus>("draft");
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [expandedBlockIds, setExpandedBlockIds] = useState<string[]>([]);
  const [expandedPaletteBlock, setExpandedPaletteBlock] =
    useState<BlockType | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [hasAccess, setHasAccess] = useState(true);
  const [paletteStyle, setPaletteStyle] = useState<CSSProperties>({});
  const [usePaletteFallback, setUsePaletteFallback] = useState(false);
  const paletteRef = useRef<HTMLDivElement | null>(null);
  const blocksContainerRef = useRef<HTMLDivElement | null>(null);
  const firstBlockRef = useRef<HTMLDivElement | null>(null);
  const paletteMetricsRef = useRef<{
    startTop: number;
    startTopDoc: number;
    left: number;
    width: number;
    blocksTopDoc: number;
    blocksBottomDoc: number;
  } | null>(null);

  const workspaceId = params.workspaceId;
  const projectId = params.projectId;
  const pageId = params.pageId;

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [loading, user, router]);

  useEffect(() => {
    async function checkAccess() {
      if (!user) return;
      const isSuperAdmin = systemRole?.role === "super_admin";
      const isWorkspaceAdmin = workspaceMembership?.role === "admin";
      if (isSuperAdmin || isWorkspaceAdmin) {
        setHasAccess(true);
        return;
      }
      const ok = await hasProjectAccess(workspaceId, projectId, user.uid);
      setHasAccess(ok);
    }
    checkAccess();
  }, [user, systemRole, workspaceMembership, workspaceId, projectId]);

  const PALETTE_TOP_OFFSET = 12;

  useLayoutEffect(() => {
    if (!paletteRef.current || !blocksContainerRef.current || !firstBlockRef.current) {
      return;
    }
    const paletteRect = paletteRef.current.getBoundingClientRect();
    const blocksRect = blocksContainerRef.current.getBoundingClientRect();
    const firstRect = firstBlockRef.current.getBoundingClientRect();
    const scrollY = window.scrollY;
    const startTop = Math.max(firstRect.top + PALETTE_TOP_OFFSET, PALETTE_TOP_OFFSET);

    paletteMetricsRef.current = {
      startTop,
      startTopDoc: firstRect.top + scrollY,
      left: paletteRect.left,
      width: paletteRect.width,
      blocksTopDoc: blocksRect.top + scrollY,
      blocksBottomDoc: blocksRect.bottom + scrollY
    };

    if (!usePaletteFallback) {
      setPaletteStyle({
        position: "sticky",
        top: startTop
      });
    }
  }, [blocks.length, paletteOpen, expandedPaletteBlock, usePaletteFallback]);

  useEffect(() => {
    function handleResize() {
      if (!paletteRef.current || !blocksContainerRef.current || !firstBlockRef.current) {
        return;
      }
      const paletteRect = paletteRef.current.getBoundingClientRect();
      const blocksRect = blocksContainerRef.current.getBoundingClientRect();
      const firstRect = firstBlockRef.current.getBoundingClientRect();
      const scrollY = window.scrollY;
      const startTop = Math.max(firstRect.top + PALETTE_TOP_OFFSET, PALETTE_TOP_OFFSET);

      paletteMetricsRef.current = {
        startTop,
        startTopDoc: firstRect.top + scrollY,
        left: paletteRect.left,
        width: paletteRect.width,
        blocksTopDoc: blocksRect.top + scrollY,
        blocksBottomDoc: blocksRect.bottom + scrollY
      };

      if (!usePaletteFallback) {
        setPaletteStyle({
          position: "sticky",
          top: startTop
        });
      }
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [usePaletteFallback]);

  useEffect(() => {
    function handleScroll() {
      const metrics = paletteMetricsRef.current;
      const paletteEl = paletteRef.current;
      if (!metrics || !paletteEl) return;

      if (!usePaletteFallback) {
        if (window.scrollY > metrics.startTopDoc + 8) {
          const rect = paletteEl.getBoundingClientRect();
          if (Math.abs(rect.top - metrics.startTop) > 4) {
            setUsePaletteFallback(true);
          }
        }
        return;
      }

      const paletteHeight = paletteEl.offsetHeight;
      const scrollY = window.scrollY;
      const startTop = metrics.startTop;

      let position: "absolute" | "fixed" = "absolute";
      let top = metrics.startTopDoc - metrics.blocksTopDoc;

      if (scrollY + startTop <= metrics.startTopDoc) {
        position = "absolute";
        top = metrics.startTopDoc - metrics.blocksTopDoc;
      } else if (scrollY + startTop + paletteHeight >= metrics.blocksBottomDoc) {
        position = "absolute";
        top = Math.max(
          metrics.blocksBottomDoc - metrics.blocksTopDoc - paletteHeight,
          0
        );
      } else {
        position = "fixed";
        top = startTop;
      }

      setPaletteStyle({
        position,
        top,
        left: position === "fixed" ? metrics.left : undefined,
        width: position === "fixed" ? metrics.width : undefined
      });
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [usePaletteFallback]);

  useEffect(() => {
    async function loadPage() {
      const page = await getPage(workspaceId, projectId, pageId);
      setPageTitle(page?.title || "Page");
      setPageStatus(page?.status || "draft");
    }
    if (workspaceId && projectId && pageId) loadPage();
  }, [workspaceId, projectId, pageId]);

  useEffect(() => {
    if (!isEditingTitle) {
      setTitleDraft(pageTitle);
    }
  }, [pageTitle, isEditingTitle]);

  useEffect(() => {
    async function loadBlocks() {
      const items = await listBlocks(workspaceId, projectId, pageId);
      setBlocks(items);
    }
    if (workspaceId && projectId && pageId) loadBlocks();
  }, [workspaceId, projectId, pageId]);


  async function handleAddBlock(type: BlockType) {
    const fields = createDefaultFields(type) as BlockFields;
    await addBlock(workspaceId, projectId, pageId, type, fields);
    const updated = await listBlocks(workspaceId, projectId, pageId);
    setBlocks(updated);
    const newest = updated[updated.length - 1];
    if (newest) {
      setExpandedBlockIds((current) =>
        current.includes(newest.id) ? current : [...current, newest.id]
      );
    }
    setExpandedPaletteBlock(null);
    setPaletteOpen(false);
  }

  async function handleRemoveBlock(blockId: string) {
    await removeBlock(workspaceId, projectId, pageId, blockId);
    const updated = await listBlocks(workspaceId, projectId, pageId);
    setBlocks(updated);
  }

  async function handleMoveBlock(index: number, direction: "up" | "down") {
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= blocks.length) return;
    const current = blocks[index];
    const target = blocks[nextIndex];
    await Promise.all([
      updateBlockOrder(workspaceId, projectId, pageId, current.id, target.order),
      updateBlockOrder(workspaceId, projectId, pageId, target.id, current.order)
    ]);
    const updated = await listBlocks(workspaceId, projectId, pageId);
    setBlocks(updated);
  }

  async function handleUpdateBlock(blockId: string, fields: BlockFields) {
    setStatusMessage("Saving...");
    await updateBlockFields(workspaceId, projectId, pageId, blockId, fields);
    setStatusMessage("Saved");
  }

  async function handleUpdateTitle(nextTitle: string) {
    setPageTitle(nextTitle);
    await updatePageTitle(workspaceId, projectId, pageId, nextTitle);
  }

  async function handleUpdateStatus(nextStatus: PageStatus) {
    setPageStatus(nextStatus);
    await updatePageStatus(workspaceId, projectId, pageId, nextStatus);
  }

  async function handleExport() {
    setStatusMessage("Exporting...");
    await exportPage(workspaceId, projectId, pageId);
    setStatusMessage("Export complete.");
  }

  if (loading) {
    return (
      <AppShell>
        <div>Loading...</div>
      </AppShell>
    );
  }

  if (!user) {
    return null;
  }

  if (!hasAccess) {
    return (
      <AppShell>
        <div className="stack">
          <h1>Project access required</h1>
          <p className="muted">You do not have access to this project.</p>
        </div>
      </AppShell>
    );
  }

  const pageStatusOptions = [
    { value: "not_started", label: "Not started" },
    { value: "draft", label: "Draft" },
    { value: "content_complete", label: "Content complete" },
    { value: "ready_for_review", label: "Ready for review" },
    { value: "internal_review", label: "Internal review" },
    { value: "external_review", label: "External review" },
    { value: "feedback_added", label: "Feedback added" },
    { value: "approved", label: "Approved" },
    { value: "ready_for_cms", label: "Ready for CMS" },
    { value: "done", label: "Done" }
  ];

  const statusPhase =
    pageStatus === "approved" || pageStatus === "ready_for_cms"
      ? "approved"
      : pageStatus === "done"
        ? "completed"
        : pageStatus === "ready_for_review" ||
            pageStatus === "internal_review" ||
            pageStatus === "external_review" ||
            pageStatus === "feedback_added"
          ? "review"
          : "early";

  return (
    <AppShell>
      <div className="stack">
        <div className="stack" style={{ gap: 10 }}>
          <div className="stack" style={{ gap: 6 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <Link
                href={`/workspaces/${workspaceId}/projects/${projectId}`}
                className="row"
                style={{
                  gap: 8,
                  border: "1px solid #e0e0e0",
                  borderRadius: 999,
                  padding: "6px 12px",
                  color: "#4b4b4b",
                  fontSize: 12,
                  background: "#ffffff"
                }}
              >
                <ArrowLeft />
                <span>Back to Project</span>
              </Link>
              <span className="muted" style={{ fontSize: 12 }}>
                Page Editor
              </span>
              <Button
                variant="secondary"
                onClick={handleExport}
                style={{
                  borderRadius: 999,
                  padding: "6px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: "#4b4b4b",
                  borderColor: "#e0e0e0",
                  background: "#ffffff",
                  fontSize: 12
                }}
              >
                <span>Export Page</span>
                <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
                  <path
                    d="M12 4v10m0 0l4-4m-4 4l-4-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M4 20h16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Button>
            </div>
            <div className="stack" style={{ alignItems: "center", gap: 6 }}>
              <div className="row" style={{ gap: 8, alignItems: "center" }}>
                {isEditingTitle ? (
                  <input
                    value={titleDraft}
                    onChange={(event) => setTitleDraft(event.target.value)}
                    onBlur={() => {
                      setIsEditingTitle(false);
                      if (titleDraft.trim()) {
                        handleUpdateTitle(titleDraft.trim());
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        setIsEditingTitle(false);
                        if (titleDraft.trim()) {
                          handleUpdateTitle(titleDraft.trim());
                        }
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        setIsEditingTitle(false);
                        setTitleDraft(pageTitle);
                      }
                    }}
                    style={{
                      border: "1px solid #e0e0e0",
                      borderRadius: 6,
                      padding: "6px 10px",
                      fontSize: 20,
                      fontWeight: 600,
                      color: "#1b1b1b",
                      minWidth: 240,
                      textAlign: "center"
                    }}
                    autoFocus
                  />
                ) : (
                  <>
                    <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>
                      {pageTitle}
                    </h1>
                    <button
                      type="button"
                      onClick={() => setIsEditingTitle(true)}
                      style={{
                        border: "1px solid #e0e0e0",
                        background: "#ffffff",
                        borderRadius: 999,
                        padding: "4px 8px",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        cursor: "pointer",
                        color: "#4b4b4b"
                      }}
                      title="Edit page title"
                      aria-label="Edit page title"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
                        <path
                          d="M4 17l4 3 12-12-4-3-12 12z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M14 5l4 3"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span style={{ fontSize: 12 }}>Edit</span>
                    </button>
                  </>
                )}
              </div>
              <div className="row" style={{ gap: 8, alignItems: "center" }}>
                <span className="muted" style={{ fontSize: 12 }}>
                  Status:
                </span>
                <button
                  type="button"
                  onClick={() => setIsStatusMenuOpen((open) => !open)}
                  className={`status-pill ${statusPhase}`}
                  style={{ position: "relative" }}
                  aria-label="Edit page status"
                >
                  <span>{pageStatusOptions.find((opt) => opt.value === pageStatus)?.label}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden>
                    <path
                      d="M6 9l6 6 6-6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {isStatusMenuOpen && (
                    <div
                      className="surface status-menu"
                      style={{
                        position: "absolute",
                        top: "calc(100% + 6px)",
                        left: "50%",
                        transform: "translateX(-50%)",
                        minWidth: 200,
                        padding: 8,
                        zIndex: 10
                      }}
                    >
                      <div className="stack" style={{ gap: 6 }}>
                        {pageStatusOptions.map((option) => {
                          const phase =
                            option.value === "approved" || option.value === "ready_for_cms"
                              ? "approved"
                              : option.value === "done"
                                ? "completed"
                                : option.value === "ready_for_review" ||
                                    option.value === "internal_review" ||
                                    option.value === "external_review" ||
                                    option.value === "feedback_added"
                                  ? "review"
                                  : "early";
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                setIsStatusMenuOpen(false);
                                handleUpdateStatus(option.value as PageStatus);
                              }}
                              className={`status-pill ${phase}`}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <div className="muted" style={{ fontSize: 13 }}>
              {statusMessage || "Changes are saved automatically."}
            </div>
          </div>
        </div>

        <section className="stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>Blocks</h2>
            <div className="row" style={{ gap: 8 }}>
              <Button
                variant="secondary"
                onClick={() => setPaletteOpen((open) => !open)}
                disabled={false}
                type="button"
                className="palette-toggle"
              >
                Blocks
              </Button>
              <span className="tag">{blocks.length} blocks</span>
            </div>
          </div>
          <div
            className={`editor-layout ${
              expandedPaletteBlock ? "palette-expanded" : "palette-collapsed"
            }`}
            ref={blocksContainerRef}
            style={{ position: "relative" }}
          >
            <div className="editor-gutter">
              <BlockPalette
                className={paletteOpen ? "is-open" : ""}
                style={paletteStyle}
                ref={paletteRef}
                expandedBlock={expandedPaletteBlock}
                onExpand={setExpandedPaletteBlock}
                onAdd={handleAddBlock}
              />
            </div>
            <div className="editor-canvas stack">
              {blocks.length === 0 && (
                <div className="surface" style={{ padding: 20 }}>
                  <p className="muted">No blocks yet.</p>
                </div>
              )}
              {blocks.map((block, index) => (
                <div
                  key={block.id}
                  ref={index === 0 ? firstBlockRef : undefined}
                >
                  <BlockEditor
                    block={block}
                    index={index}
                    total={blocks.length}
                    workspaceId={workspaceId}
                    projectId={projectId}
                    pageId={pageId}
                    isExpanded={expandedBlockIds.includes(block.id)}
                    onToggleExpanded={() =>
                      setExpandedBlockIds((current) =>
                        current.includes(block.id)
                          ? current.filter((id) => id !== block.id)
                          : [...current, block.id]
                      )
                    }
                    onMove={handleMoveBlock}
                    onRemove={handleRemoveBlock}
                    onUpdate={handleUpdateBlock}
                  />
                </div>
              ))}
            </div>
            <div className="editor-gutter" aria-hidden />
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function BlockEditor({
  block,
  index,
  total,
  workspaceId,
  projectId,
  pageId,
  isExpanded,
  onToggleExpanded,
  onMove,
  onRemove,
  onUpdate
}: {
  block: Block;
  index: number;
  total: number;
  workspaceId: string;
  projectId: string;
  pageId: string;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onMove: (index: number, direction: "up" | "down") => void;
  onRemove: (blockId: string) => void;
  onUpdate: (blockId: string, fields: BlockFields) => void;
}) {
  const [fields, setFields] = useState<BlockFields>(block.fields);

  useEffect(() => {
    setFields(block.fields);
  }, [block.fields]);

  function setNestedValue<T>(source: T, path: string, value: unknown): T {
    const segments = path.replace(/\[(\d+)\]/g, ".$1").split(".");
    const clone = Array.isArray(source) ? [...source] : { ...source };
    let cursor: any = clone;
    for (let i = 0; i < segments.length - 1; i += 1) {
      const key = segments[i];
      const nextValue = cursor[key];
      const nextClone = Array.isArray(nextValue) ? [...nextValue] : { ...nextValue };
      cursor[key] = nextClone;
      cursor = nextClone;
    }
    const lastKey = segments[segments.length - 1];
    cursor[lastKey] = value;
    return clone as T;
  }

  function updateField(path: string, value: unknown) {
    const updated = setNestedValue(fields, path, value);
    setFields(updated);
    onUpdate(block.id, updated);
  }

  function addArrayItem(path: string, item: unknown) {
    const current = path
      .replace(/\[(\d+)\]/g, ".$1")
      .split(".")
      .reduce((acc: any, key) => (acc ? acc[key] : undefined), fields as any);
    const next = Array.isArray(current) ? [...current, item] : [item];
    const updated = setNestedValue(fields, path, next);
    setFields(updated);
    onUpdate(block.id, updated);
  }

  function removeArrayItem(path: string, index: number) {
    const current = path
      .replace(/\[(\d+)\]/g, ".$1")
      .split(".")
      .reduce((acc: any, key) => (acc ? acc[key] : undefined), fields as any);
    if (!Array.isArray(current)) return;
    const next = [...current];
    next.splice(index, 1);
    const updated = setNestedValue(fields, path, next);
    setFields(updated);
    onUpdate(block.id, updated);
  }

  const headingLevels: Array<{ value: HeadingLevel; label: string }> = [
    { value: "h1", label: "H1" },
    { value: "h2", label: "H2" },
    { value: "h3", label: "H3" },
    { value: "h4", label: "H4" },
    { value: "h5", label: "H5" },
    { value: "h6", label: "H6" }
  ];

  const [openCardIndex, setOpenCardIndex] = useState<number | null>(null);
  const [openTabIndex, setOpenTabIndex] = useState<number | null>(null);
  const [showCardAdvanced, setShowCardAdvanced] = useState(false);
  const [showTabAdvanced, setShowTabAdvanced] = useState(false);
  const [fullPreview, setFullPreview] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showSecondaryActions, setShowSecondaryActions] = useState(
    Boolean((fields as any).secondaryButton?.label || (fields as any).secondaryButton?.url)
  );

  useEffect(() => {
    setShowSecondaryActions(
      Boolean((fields as any).secondaryButton?.label || (fields as any).secondaryButton?.url)
    );
  }, [block.id]);

  useEffect(() => {
    setShowCardAdvanced(false);
  }, [openCardIndex]);

  useEffect(() => {
    setShowTabAdvanced(false);
  }, [openTabIndex]);

  const [showPreview, setShowPreview] = useState(true);

  useEffect(() => {
    setShowPreview(true);
    setFullPreview(false);
    setConfirmDelete(false);
  }, [block.id, block.type]);

  return (
    <div
      className="surface"
      style={{
        padding: isExpanded ? 16 : 14,
        background: isExpanded ? "#ffffff" : "#fbfbfb",
        border: "1px solid #e1e1e1"
      }}
    >
      <div className="stack">
        <div
          className="row"
          style={{
            justifyContent: "space-between",
            paddingBottom: isExpanded ? 10 : 8,
            borderBottom: "1px solid #e5e5e5"
          }}
        >
          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <IconButton
              label={isExpanded ? "Collapse block" : "Expand block"}
              onClick={onToggleExpanded}
              icon={isExpanded ? "chevron-down" : "chevron-right"}
            />
            <div className="stack" style={{ gap: 2 }}>
              <strong>{blockTypeLabels[block.type]}</strong>
              <span className="muted" style={{ fontSize: 12 }}>
                Position {index + 1} of {total}
              </span>
            </div>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <IconButton
              label={showPreview ? "Hide preview" : "Show preview"}
              onClick={() =>
                setShowPreview((prev) => {
                  const next = !prev;
                  if (!next) setFullPreview(false);
                  return next;
                })
              }
              icon={showPreview ? "eye-off" : "eye"}
            />
            <IconButton
              label={fullPreview ? "Exit full preview" : "Full preview"}
              onClick={() =>
                setFullPreview((prev) => {
                  const next = !prev;
                  if (next) setShowPreview(true);
                  return next;
                })
              }
              icon={fullPreview ? "shrink" : "expand"}
            />
            <IconButton
              label="Move up"
              onClick={() => onMove(index, "up")}
              icon="arrow-up"
              disabled={index === 0}
            />
            <IconButton
              label="Move down"
              onClick={() => onMove(index, "down")}
              icon="arrow-down"
              disabled={index === total - 1}
            />
            <IconButton
              label="Remove block"
              onClick={() => setConfirmDelete(true)}
              icon="trash"
              tone="danger"
            />
          </div>
        </div>
        {confirmDelete && (
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="muted">
              Are you sure you want to delete this block?
            </span>
            <div className="row">
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => onRemove(block.id)}>
                Confirm
              </Button>
            </div>
          </div>
        )}

        {!isExpanded ? (
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="muted" style={{ fontSize: 13 }}>
              {previewLabel(block.type, fields)}
            </span>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: fullPreview
                ? "minmax(0, 1fr)"
                : showPreview
                  ? "minmax(0, 35%) minmax(0, 65%)"
                  : "minmax(0, 1fr)",
              gap: 16,
              alignItems: "start"
            }}
          >
          {!fullPreview && (
            <div
              className="stack edit-panel"
              style={{
                minWidth: 0,
                maxHeight: "70vh",
                overflowY: "auto",
                paddingRight: 4
              }}
            >
            {block.type === "hero" && (
              <div className="stack">
                <Section
                  title="Content"
                  sectionKey={`${block.id}-hero-content`}
                  defaultOpen
                  hasContent={hasText((fields as any).heading?.text) || hasText((fields as any).body)}
                >
              <Input
                label="Heading"
                value={(fields as any).heading?.text || ""}
                onChange={(value) => updateField("heading.text", value)}
              />
              <Select
                label="Heading level"
                value={(fields as any).heading?.level || "h1"}
                onChange={(value) => updateField("heading.level", value)}
                options={headingLevels}
              />
              <Textarea
                label="Body"
                value={(fields as any).body || ""}
                onChange={(value) => updateField("body", value)}
                rows={5}
              />
              <Select
                label="Text color"
                value={(fields as any).textColor || "black"}
                onChange={(value) => updateField("textColor", value)}
                options={[
                  { value: "black", label: "Black" },
                  { value: "white", label: "White" }
                ]}
              />
            </Section>
                <Section
                  title="Actions"
                  sectionKey={`${block.id}-hero-actions`}
                  defaultOpen={false}
                  hasContent={
                    hasText((fields as any).primaryButton?.label) ||
                    hasText((fields as any).primaryButton?.url) ||
                    hasText((fields as any).secondaryButton?.label) ||
                    hasText((fields as any).secondaryButton?.url)
                  }
                >
              <div className="row">
                <Input
                  label="Primary label"
                  value={(fields as any).primaryButton?.label || ""}
                  onChange={(value) => updateField("primaryButton.label", value)}
                />
                <Input
                  label="Primary link"
                  value={(fields as any).primaryButton?.url || ""}
                  onChange={(value) => updateField("primaryButton.url", value)}
                />
              </div>
              <ToggleRow
                label="Add secondary button"
                checked={showSecondaryActions}
                onChange={(next) => setShowSecondaryActions(next)}
              />
              {showSecondaryActions && (
                <div className="row">
                  <Input
                    label="Secondary label"
                    value={(fields as any).secondaryButton?.label || ""}
                    onChange={(value) =>
                      updateField("secondaryButton.label", value)
                    }
                  />
                  <Input
                    label="Secondary link"
                    value={(fields as any).secondaryButton?.url || ""}
                    onChange={(value) =>
                      updateField("secondaryButton.url", value)
                    }
                  />
                </div>
              )}
            </Section>
                <Section
                  title="Media"
                  sectionKey={`${block.id}-hero-media`}
                  defaultOpen={hasMedia((fields as any).media)}
                  hasContent={hasMedia((fields as any).media)}
                  autoOpenWhenContent
                >
              <MediaUpload
                label="Hero media"
                media={normalizeMedia((fields as any).media)}
                uploadPath={`workspaces/${workspaceId}/projects/${projectId}/pages/${pageId}/blocks/${block.id}/media`}
                onChange={(next) =>
                  updateField("media", { ...(fields as any).media, ...next })
                }
              />
              <Select
                label="Image display mode"
                value={(fields as any).media?.displayMode || "landscape"}
                onChange={(value) => updateField("media.displayMode", value)}
                options={[
                  { value: "landscape", label: "Landscape" },
                  { value: "portrait", label: "Portrait" },
                  { value: "square", label: "Square" }
                ]}
              />
              <div className="row">
                <Select
                  label="Text alignment"
                  value={(fields as any).textAlignment || "left"}
                  onChange={(value) => updateField("textAlignment", value)}
                  options={[
                    { value: "left", label: "Left" },
                    { value: "center", label: "Center" },
                    { value: "right", label: "Right" }
                  ]}
                />
                <Select
                  label="Media alignment"
                  value={(fields as any).mediaAlignment || "right"}
                  onChange={(value) => updateField("mediaAlignment", value)}
                  options={[
                    { value: "left", label: "Left" },
                    { value: "right", label: "Right" }
                  ]}
                />
              </div>
              {(fields as any).media?.src && (
                <ToggleRow
                  label="Behind-media overlay"
                  checked={Boolean((fields as any).behindMediaOverlay)}
                  onChange={(next) => updateField("behindMediaOverlay", next)}
                />
              )}
            </Section>
                <Section
                  title="Advanced"
                  sectionKey={`${block.id}-hero-advanced`}
                  defaultOpen={false}
                  hasContent={
                    hasText((fields as any).variant) || hasText((fields as any).media?.alt)
                  }
                >
              <Input
                label="Variant"
                value={(fields as any).variant || ""}
                onChange={(value) => updateField("variant", value)}
                placeholder="Optional"
              />
              <Input
                label="Image alt text"
                value={(fields as any).media?.alt || ""}
                onChange={(value) => updateField("media.alt", value)}
              />
            </Section>
              </div>
            )}

            {block.type === "banner" && (
              <div className="stack">
                <Section
                  title="Content"
                  sectionKey={`${block.id}-banner-content`}
                  defaultOpen
                  hasContent={hasText((fields as any).heading?.text) || hasText((fields as any).body)}
                >
              <Input
                label="Heading"
                value={(fields as any).heading?.text || ""}
                onChange={(value) => updateField("heading.text", value)}
              />
              <Select
                label="Heading level"
                value={(fields as any).heading?.level || "h2"}
                onChange={(value) => updateField("heading.level", value)}
                options={headingLevels}
              />
              <Textarea
                label="Body"
                value={(fields as any).body || ""}
                onChange={(value) => updateField("body", value)}
                rows={4}
              />
            </Section>
                <Section
                  title="Actions"
                  sectionKey={`${block.id}-banner-actions`}
                  defaultOpen={false}
                  hasContent={
                    hasText((fields as any).primaryButton?.label) ||
                    hasText((fields as any).primaryButton?.url) ||
                    hasText((fields as any).secondaryButton?.label) ||
                    hasText((fields as any).secondaryButton?.url)
                  }
                >
              <div className="row">
                <Input
                  label="Button label"
                  value={(fields as any).primaryButton?.label || ""}
                  onChange={(value) => updateField("primaryButton.label", value)}
                />
                <Input
                  label="Button link"
                  value={(fields as any).primaryButton?.url || ""}
                  onChange={(value) => updateField("primaryButton.url", value)}
                />
              </div>
              <ToggleRow
                label="Add secondary button"
                checked={showSecondaryActions}
                onChange={(next) => setShowSecondaryActions(next)}
              />
              {showSecondaryActions && (
                <div className="row">
                  <Input
                    label="Secondary label"
                    value={(fields as any).secondaryButton?.label || ""}
                    onChange={(value) =>
                      updateField("secondaryButton.label", value)
                    }
                  />
                  <Input
                    label="Secondary link"
                    value={(fields as any).secondaryButton?.url || ""}
                    onChange={(value) =>
                      updateField("secondaryButton.url", value)
                    }
                  />
                </div>
              )}
            </Section>
                <Section
                  title="Media"
                  sectionKey={`${block.id}-banner-media`}
                  defaultOpen={hasMedia((fields as any).media)}
                  hasContent={hasMedia((fields as any).media)}
                  autoOpenWhenContent
                >
              <MediaUpload
                label="Banner media"
                media={normalizeMedia((fields as any).media)}
                uploadPath={`workspaces/${workspaceId}/projects/${projectId}/pages/${pageId}/blocks/${block.id}/media`}
                onChange={(next) =>
                  updateField("media", { ...(fields as any).media, ...next })
                }
              />
              <Select
                label="Image display mode"
                value={(fields as any).media?.displayMode || "landscape"}
                onChange={(value) => updateField("media.displayMode", value)}
                options={[
                  { value: "landscape", label: "Landscape" },
                  { value: "portrait", label: "Portrait" },
                  { value: "square", label: "Square" }
                ]}
              />
              <div className="row">
                <label className="stack" style={{ gap: 6, flex: "0 0 auto" }}>
                  <span style={{ fontSize: "0.88em", color: "#4b4b4b" }}>
                    Background colour
                  </span>
                  <input
                    type="color"
                    value={(fields as any).backgroundColor || "#ffffff"}
                    onChange={(event) => updateField("backgroundColor", event.target.value)}
                    style={{
                      width: 42,
                      height: 34,
                      padding: 0,
                      borderRadius: 6,
                      border: "1px solid #d0d0d0",
                      background: "transparent",
                      cursor: "pointer"
                    }}
                  />
                </label>
                <Input
                  label="Hex value"
                  value={(fields as any).backgroundColor || ""}
                  onChange={(value) => updateField("backgroundColor", value)}
                  placeholder="#FFFFFF"
                />
              </div>
              <div className="row">
                <Select
                  label="Text alignment"
                  value={(fields as any).textAlignment || "left"}
                  onChange={(value) => updateField("textAlignment", value)}
                  options={[
                    { value: "left", label: "Left" },
                    { value: "center", label: "Center" },
                    { value: "right", label: "Right" }
                  ]}
                />
                <Select
                  label="Media alignment"
                  value={(fields as any).mediaAlignment || "right"}
                  onChange={(value) => updateField("mediaAlignment", value)}
                  options={[
                    { value: "left", label: "Left" },
                    { value: "right", label: "Right" }
                  ]}
                />
              </div>
              <Select
                label="Text color"
                value={(fields as any).textColor || "black"}
                onChange={(value) => updateField("textColor", value)}
                options={[
                  { value: "black", label: "Black" },
                  { value: "white", label: "White" }
                ]}
              />
            </Section>
              </div>
            )}

            {block.type === "content" && (
              <div className="stack">
                <Section
                  title="Content"
                  sectionKey={`${block.id}-content-content`}
                  defaultOpen
                  hasContent={hasText((fields as any).heading?.text) || hasText((fields as any).body)}
                >
              <Input
                label="Heading"
                value={(fields as any).heading?.text || ""}
                onChange={(value) => updateField("heading.text", value)}
              />
              <Select
                label="Heading level"
                value={(fields as any).heading?.level || "h2"}
                onChange={(value) => updateField("heading.level", value)}
                options={headingLevels}
              />
              <Textarea
                label="Body"
                value={(fields as any).body || ""}
                onChange={(value) => updateField("body", value)}
                rows={6}
              />
            </Section>
                <Section
                  title="Actions"
                  sectionKey={`${block.id}-content-actions`}
                  defaultOpen={false}
                  hasContent={
                    hasText((fields as any).primaryButton?.label) ||
                    hasText((fields as any).primaryButton?.url)
                  }
                >
              <div className="row">
                <Input
                  label="Button label"
                  value={(fields as any).primaryButton?.label || ""}
                  onChange={(value) => updateField("primaryButton.label", value)}
                />
                <Input
                  label="Button link"
                  value={(fields as any).primaryButton?.url || ""}
                  onChange={(value) => updateField("primaryButton.url", value)}
                />
              </div>
            </Section>
                <Section
                  title="Media"
                  sectionKey={`${block.id}-content-media`}
                  defaultOpen={hasMedia((fields as any).media)}
                  hasContent={hasMedia((fields as any).media)}
                  autoOpenWhenContent
                >
              <MediaUpload
                label="Content media"
                media={normalizeMedia((fields as any).media)}
                uploadPath={`workspaces/${workspaceId}/projects/${projectId}/pages/${pageId}/blocks/${block.id}/media`}
                onChange={(next) =>
                  updateField("media", { ...(fields as any).media, ...next })
                }
              />
              <Select
                label="Image display mode"
                value={(fields as any).media?.displayMode || "landscape"}
                onChange={(value) => updateField("media.displayMode", value)}
                options={[
                  { value: "landscape", label: "Landscape" },
                  { value: "portrait", label: "Portrait" },
                  { value: "square", label: "Square" }
                ]}
              />
              <Select
                label="Image position"
                value={(fields as any).imagePosition || "right"}
                onChange={(value) => updateField("imagePosition", value)}
                options={[
                  { value: "left", label: "Left" },
                  { value: "right", label: "Right" },
                  { value: "above", label: "Above" },
                  { value: "below", label: "Below" }
                ]}
              />
            </Section>
                <Section
                  title="Advanced"
                  sectionKey={`${block.id}-content-advanced`}
                  defaultOpen={false}
                  hasContent={
                    hasText((fields as any).eyebrow) ||
                    hasText((fields as any).media?.caption) ||
                    hasText((fields as any).media?.alt) ||
                    hasText((fields as any).secondaryButton?.label) ||
                    hasText((fields as any).secondaryButton?.url) ||
                    hasText((fields as any).variant)
                  }
                >
              <Input
                label="Eyebrow text"
                value={(fields as any).eyebrow || ""}
                onChange={(value) => updateField("eyebrow", value)}
              />
              <Input
                label="Image caption"
                value={(fields as any).media?.caption || ""}
                onChange={(value) => updateField("media.caption", value)}
              />
              <Input
                label="Image alt text"
                value={(fields as any).media?.alt || ""}
                onChange={(value) => updateField("media.alt", value)}
              />
              <ToggleRow
                label="Add secondary button"
                checked={showSecondaryActions}
                onChange={(next) => setShowSecondaryActions(next)}
              />
              {showSecondaryActions && (
                <div className="row">
                  <Input
                    label="Secondary label"
                    value={(fields as any).secondaryButton?.label || ""}
                    onChange={(value) =>
                      updateField("secondaryButton.label", value)
                    }
                  />
                  <Input
                    label="Secondary link"
                    value={(fields as any).secondaryButton?.url || ""}
                    onChange={(value) =>
                      updateField("secondaryButton.url", value)
                    }
                  />
                </div>
              )}
              <Input
                label="Variant"
                value={(fields as any).variant || ""}
                onChange={(value) => updateField("variant", value)}
                placeholder="Optional"
              />
            </Section>
              </div>
            )}

            {block.type === "card_list" && (
              <div className="stack">
                <Section
                  title="Content"
                  sectionKey={`${block.id}-cardlist-content`}
                  defaultOpen
                  hasContent={
                    hasText((fields as any).heading?.text) ||
                    hasText((fields as any).description)
                  }
                >
              <Input
                label="List heading"
                value={(fields as any).heading?.text || ""}
                onChange={(value) => updateField("heading.text", value)}
              />
              <Select
                label="Heading level"
                value={(fields as any).heading?.level || "h2"}
                onChange={(value) => updateField("heading.level", value)}
                options={headingLevels}
              />
              <Textarea
                label="List description"
                value={(fields as any).description || ""}
                onChange={(value) => updateField("description", value)}
                rows={4}
              />
            </Section>
                <Section
                  title="Actions"
                  sectionKey={`${block.id}-cardlist-actions`}
                  defaultOpen={false}
                  hasContent={
                    hasText((fields as any).primaryButton?.label) ||
                    hasText((fields as any).primaryButton?.url)
                  }
                >
              <div className="row">
                <Input
                  label="Main button label"
                  value={(fields as any).primaryButton?.label || ""}
                  onChange={(value) => updateField("primaryButton.label", value)}
                />
                <Input
                  label="Main button link"
                  value={(fields as any).primaryButton?.url || ""}
                  onChange={(value) => updateField("primaryButton.url", value)}
                />
              </div>
            </Section>
                <Section
                  title="Cards"
                  sectionKey={`${block.id}-cardlist-cards`}
                  defaultOpen
                  hasContent={Boolean((fields as any).cards?.length)}
                >
              {(fields as any).cards?.map((card: any, cardIndex: number) => {
                const isOpen = openCardIndex === cardIndex;
                return (
                  <div key={cardIndex} className="surface" style={{ padding: 12 }}>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <strong>{card.heading || `Card ${cardIndex + 1}`}</strong>
                      <div className="row">
                        <Button
                          variant="secondary"
                          onClick={() =>
                            setOpenCardIndex(isOpen ? null : cardIndex)
                          }
                        >
                          {isOpen ? "Collapse" : "Edit"}
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => removeArrayItem("cards", cardIndex)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="stack" style={{ marginTop: 12 }}>
                        <Input
                          label="Card heading"
                          value={card.heading || ""}
                          onChange={(value) =>
                            updateField(`cards[${cardIndex}].heading`, value)
                          }
                        />
                        <Textarea
                          label="Card description"
                          value={card.description || ""}
                          onChange={(value) =>
                            updateField(`cards[${cardIndex}].description`, value)
                          }
                        />
                        <CardImageUpload
                          label="Card image"
                          imageUrl={card.imageUrl || ""}
                          uploadPath={`workspaces/${workspaceId}/projects/${projectId}/pages/${pageId}/blocks/${block.id}/cards/${cardIndex}`}
                          onChange={(value) =>
                            updateField(`cards[${cardIndex}].imageUrl`, value)
                          }
                        />
                        <div className="row">
                          <Input
                            label="Card button label"
                            value={card.button?.label || ""}
                            onChange={(value) =>
                              updateField(`cards[${cardIndex}].button.label`, value)
                            }
                          />
                          <Input
                            label="Card button link"
                            value={card.button?.url || ""}
                            onChange={(value) =>
                              updateField(`cards[${cardIndex}].button.url`, value)
                            }
                          />
                        </div>
                        <ToggleRow
                          label="Show advanced card options"
                          checked={showCardAdvanced}
                          onChange={(next) => setShowCardAdvanced(next)}
                        />
                        {showCardAdvanced && (
                          <div className="stack">
                            <Input
                              label="Card eyebrow"
                              value={card.eyebrow || ""}
                              onChange={(value) =>
                                updateField(`cards[${cardIndex}].eyebrow`, value)
                              }
                            />
                            <Select
                              label="Image display mode"
                              value={card.displayMode || "landscape"}
                              onChange={(value) =>
                                updateField(`cards[${cardIndex}].displayMode`, value)
                              }
                              options={[
                                { value: "landscape", label: "Landscape" },
                                { value: "portrait", label: "Portrait" },
                                { value: "square", label: "Square" }
                              ]}
                            />
                            <Input
                              label="Card image alt text"
                              value={card.imageAlt || ""}
                              onChange={(value) =>
                                updateField(`cards[${cardIndex}].imageAlt`, value)
                              }
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <Button
                variant="secondary"
                onClick={() =>
                  addArrayItem("cards", {
                    heading: "",
                    description: "",
                    imageUrl: "",
                    imageAlt: "",
                    eyebrow: "",
                    button: { label: "", url: "" },
                    displayMode: "landscape"
                  })
                }
              >
                Add card
              </Button>
            </Section>
                <Section
                  title="Layout"
                  sectionKey={`${block.id}-cardlist-layout`}
                  defaultOpen={false}
                  hasContent
                >
              <Select
                label="Display mode"
                value={(fields as any).displayMode || "grid"}
                onChange={(value) => updateField("displayMode", value)}
                options={[
                  { value: "grid", label: "Grid" },
                  { value: "carousel", label: "Carousel" }
                ]}
              />
              <Select
                label="Columns"
                value={String((fields as any).columns || 3)}
                onChange={(value) => updateField("columns", Number(value))}
                options={[
                  { value: "2", label: "2" },
                  { value: "3", label: "3" },
                  { value: "4", label: "4" }
                ]}
              />
              <Select
                label="Image position"
                value={(fields as any).imagePosition || "top"}
                onChange={(value) => updateField("imagePosition", value)}
                options={[
                  { value: "top", label: "Top" },
                  { value: "left", label: "Left" },
                  { value: "background", label: "Background" }
                ]}
              />
              <Select
                label="Image aspect ratio"
                value={(fields as any).imageAspectRatio || "16:9"}
                onChange={(value) => updateField("imageAspectRatio", value)}
                options={[
                  { value: "16:9", label: "16:9" },
                  { value: "4:3", label: "4:3" },
                  { value: "1:1", label: "1:1" },
                  { value: "3:4", label: "3:4" }
                ]}
              />
            </Section>
              </div>
            )}

            {block.type === "tab_content" && (
              <div className="stack">
                <Section
                  title="Content"
                  sectionKey={`${block.id}-tabs-content`}
                  defaultOpen
                  hasContent={
                    hasText((fields as any).mainHeading?.text) ||
                    hasText((fields as any).mainDescription)
                  }
                >
              <Input
                label="Main heading"
                value={(fields as any).mainHeading?.text || ""}
                onChange={(value) => updateField("mainHeading.text", value)}
              />
              <Select
                label="Heading level"
                value={(fields as any).mainHeading?.level || "h2"}
                onChange={(value) => updateField("mainHeading.level", value)}
                options={headingLevels}
              />
              <Textarea
                label="Main description"
                value={(fields as any).mainDescription || ""}
                onChange={(value) => updateField("mainDescription", value)}
                rows={4}
              />
            </Section>
                <Section
                  title="Tabs"
                  sectionKey={`${block.id}-tabs-tabs`}
                  defaultOpen
                  hasContent={Boolean((fields as any).tabs?.length)}
                >
              {(fields as any).tabs?.map((tab: any, tabIndex: number) => {
                const isOpen = openTabIndex === tabIndex;
                return (
                  <div key={tabIndex} className="surface" style={{ padding: 12 }}>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <strong>{tab.name || `Tab ${tabIndex + 1}`}</strong>
                      <div className="row">
                        <Button
                          variant="secondary"
                          onClick={() => setOpenTabIndex(isOpen ? null : tabIndex)}
                        >
                          {isOpen ? "Collapse" : "Edit"}
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => removeArrayItem("tabs", tabIndex)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="stack" style={{ marginTop: 12 }}>
                        <Input
                          label="Tab name"
                          value={tab.name || ""}
                          onChange={(value) =>
                            updateField(`tabs[${tabIndex}].name`, value)
                          }
                        />
                        <Input
                          label="Tab heading"
                          value={tab.heading?.text || ""}
                          onChange={(value) =>
                            updateField(`tabs[${tabIndex}].heading.text`, value)
                          }
                        />
                        <Select
                          label="Heading level"
                          value={tab.heading?.level || "h3"}
                          onChange={(value) =>
                            updateField(`tabs[${tabIndex}].heading.level`, value)
                          }
                          options={headingLevels}
                        />
                        <Textarea
                          label="Tab body"
                          value={tab.body || ""}
                          onChange={(value) =>
                            updateField(`tabs[${tabIndex}].body`, value)
                          }
                        />
                        <div className="row">
                          <Input
                            label="Button label"
                            value={tab.button?.label || ""}
                            onChange={(value) =>
                              updateField(`tabs[${tabIndex}].button.label`, value)
                            }
                          />
                          <Input
                            label="Button link"
                            value={tab.button?.url || ""}
                            onChange={(value) =>
                              updateField(`tabs[${tabIndex}].button.url`, value)
                            }
                          />
                        </div>
                        <div className="surface" style={{ padding: 12 }}>
                          <div className="stack">
                            <strong>Media</strong>
                          <MediaUpload
                            label="Tab media"
                            media={normalizeMedia(tab.media)}
                            uploadPath={`workspaces/${workspaceId}/projects/${projectId}/pages/${pageId}/blocks/${block.id}/tabs/${tabIndex}/media`}
                            onChange={(next) =>
                              updateField(`tabs[${tabIndex}].media`, {
                                ...(tab.media || {}),
                                ...next
                              })
                            }
                          />
                          <Select
                            label="Image display mode"
                            value={tab.media?.displayMode || "landscape"}
                            onChange={(value) =>
                              updateField(`tabs[${tabIndex}].media.displayMode`, value)
                            }
                            options={[
                              { value: "landscape", label: "Landscape" },
                              { value: "portrait", label: "Portrait" },
                              { value: "square", label: "Square" }
                            ]}
                          />
                          <Select
                            label="Image position"
                            value={tab.imagePosition || "right"}
                            onChange={(value) =>
                              updateField(`tabs[${tabIndex}].imagePosition`, value)
                            }
                            options={[
                              { value: "left", label: "Left" },
                              { value: "right", label: "Right" },
                              { value: "above", label: "Above" },
                              { value: "below", label: "Below" }
                            ]}
                          />
                          </div>
                        </div>
                        <ToggleRow
                          label="Show advanced tab options"
                          checked={showTabAdvanced}
                          onChange={(next) => setShowTabAdvanced(next)}
                        />
                        {showTabAdvanced && (
                          <div className="stack">
                            <Input
                              label="Eyebrow text"
                              value={tab.eyebrow || ""}
                              onChange={(value) =>
                                updateField(`tabs[${tabIndex}].eyebrow`, value)
                              }
                            />
                            <Input
                              label="Image alt text"
                              value={tab.media?.alt || ""}
                              onChange={(value) =>
                                updateField(`tabs[${tabIndex}].media.alt`, value)
                              }
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <Button
                variant="secondary"
                onClick={() =>
                  addArrayItem("tabs", {
                    name: "",
                    heading: { text: "", level: "h3" },
                    body: "",
                    button: { label: "", url: "" },
                    media: { src: "", type: "image", alt: "", displayMode: "landscape" },
                    imagePosition: "right",
                    eyebrow: ""
                  })
                }
              >
                Add tab
              </Button>
            </Section>
              </div>
            )}

            {block.type === "media" && (
              <div className="stack">
                <Section
                  title="Media"
                  sectionKey={`${block.id}-media-media`}
                  defaultOpen
                  hasContent={hasMedia((fields as any).media)}
                >
              <MediaUpload
                label="Media upload"
                media={normalizeMedia((fields as any).media)}
                uploadPath={`workspaces/${workspaceId}/projects/${projectId}/pages/${pageId}/blocks/${block.id}/media`}
                onChange={(next) =>
                  updateField("media", { ...(fields as any).media, ...next })
                }
              />
              <Select
                label="Image display mode"
                value={(fields as any).media?.displayMode || "landscape"}
                onChange={(value) => updateField("media.displayMode", value)}
                options={[
                  { value: "landscape", label: "Landscape" },
                  { value: "portrait", label: "Portrait" },
                  { value: "square", label: "Square" }
                ]}
              />
              <MediaGalleryUpload
                label="Gallery images"
                items={Array.isArray((fields as any).gallery) ? (fields as any).gallery : []}
                uploadPath={`workspaces/${workspaceId}/projects/${projectId}/pages/${pageId}/blocks/${block.id}/gallery`}
                onChange={(nextItems) => updateField("gallery", nextItems)}
              />
            </Section>
                <Section
                  title="Advanced"
                  sectionKey={`${block.id}-media-advanced`}
                  defaultOpen={false}
                  hasContent={
                    hasText((fields as any).media?.alt) ||
                    hasText((fields as any).media?.caption) ||
                    Boolean((fields as any).media?.fullWidth)
                  }
                >
              <Input
                label="Image alt text"
                value={(fields as any).media?.alt || ""}
                onChange={(value) => updateField("media.alt", value)}
              />
              <Input
                label="Image caption"
                value={(fields as any).media?.caption || ""}
                onChange={(value) => updateField("media.caption", value)}
              />
              <Select
                label="Image aspect ratio"
                value={(fields as any).media?.aspectRatio || "16:9"}
                onChange={(value) => updateField("media.aspectRatio", value)}
                options={[
                  { value: "16:9", label: "16:9" },
                  { value: "4:3", label: "4:3" },
                  { value: "1:1", label: "1:1" },
                  { value: "3:4", label: "3:4" }
                ]}
              />
              <ToggleRow
                label="Full-width"
                checked={Boolean((fields as any).media?.fullWidth)}
                onChange={(next) => updateField("media.fullWidth", next)}
              />
            </Section>
              </div>
            )}
          </div>
          )}
          {showPreview && (
            <div
              style={{
                position: "sticky",
                top: 16,
                width: "100%",
                minWidth: 0
              }}
            >
              <div className="surface" style={{ padding: 16 }}>
                <div className="stack" style={{ gap: 12 }}>
                  <div className="stack" style={{ gap: 6 }}>
                    <strong>Preview</strong>
                    <div className="divider" />
                  </div>
                  <BlockPreview
                    blockType={block.type}
                    fields={fields}
                    previewMode={fullPreview ? "full" : "side"}
                  />
                </div>
              </div>
            </div>
          )}
          </div>
        )}
      </div>
    </div>
  );
}

function BlockPreview({
  blockType,
  fields,
  previewMode = "side"
}: {
  blockType: BlockType;
  fields: BlockFields;
  previewMode?: "side" | "full";
}) {
  const data: any = fields;
  const isSidePreview = previewMode === "side";
  const bodyScale = isSidePreview ? 0.9 : 1;
  const headingScale = isSidePreview ? 0.95 : 1;
  const bodyFont = (size: number) => size * bodyScale;
  const headingFont = (size: number) => size * headingScale;
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  useEffect(() => {
    if (blockType !== "tab_content") return;
    const total = Array.isArray(data.tabs) ? data.tabs.length : 0;
    setActiveTabIndex((current) => (current >= total ? 0 : current));
  }, [blockType, data.tabs]);
  if (blockType === "hero") {
    const textAlign = data.textAlignment || "left";
    const textColor = data.textColor === "white" ? "#ffffff" : "#111111";
    const buttonJustify =
      textAlign === "left" ? "flex-start" : textAlign === "center" ? "center" : "flex-end";
    const heroRatio = previewRatioNumber(data.media?.displayMode, PREVIEW_IMAGE_ASPECT);
    return (
      <div
        style={{
          border: "1px solid #e3e3e3",
          borderRadius: 8,
          overflow: "hidden",
          background: "#f9f9f9"
        }}
      >
        <div
          style={{
            position: "relative",
            padding: 20,
            background: data.media?.src ? "#d9e1ea" : "#f2f2f2",
            display: "flex",
            alignItems: "center",
            aspectRatio: heroRatio,
            overflow: "hidden"
          }}
        >
          {data.media?.src && (
            <img
              src={data.media.src}
              alt={data.media?.alt || "Hero media"}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                opacity: 0.6
              }}
            />
          )}
          {data.behindMediaOverlay && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0.1))"
              }}
            />
          )}
          <div
            style={{
              position: "relative",
              zIndex: 1,
              color: textColor,
              width: "100%",
              textAlign,
              maxWidth: PREVIEW_TEXT_MAX,
              margin: textAlign === "center" ? "0 auto" : undefined
            }}
          >
            <div style={{ fontSize: headingFont(19), fontWeight: 600 }}>
              {data.heading?.text || "Hero heading"}
            </div>
            <div style={{ marginTop: 8, fontSize: bodyFont(13) }}>
              {data.body || "Hero body text"}
            </div>
            <div
              className="row"
              style={{ gap: 6, marginTop: 12, justifyContent: buttonJustify, flexWrap: "wrap" }}
            >
              {data.primaryButton?.label && (
                <span
                  className="tag"
                  style={{
                    color: textColor,
                    borderColor: textColor,
                    background: "transparent",
                    fontSize: bodyFont(12)
                  }}
                >
                  {data.primaryButton.label}
                </span>
              )}
              {data.secondaryButton?.label && (
                <span
                  className="tag"
                  style={{
                    color: textColor,
                    borderColor: textColor,
                    background: "transparent",
                    fontSize: bodyFont(12)
                  }}
                >
                  {data.secondaryButton.label}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (blockType === "card_list") {
    const cards = Array.isArray(data.cards) ? data.cards : [];
    const allowScroll = cards.length > 3;
    return (
      <div className="stack" style={{ gap: PREVIEW_GAP }}>
        <strong style={{ fontSize: headingFont(14) }}>
          {data.heading?.text || "Card list heading"}
        </strong>
        <p className="muted" style={{ fontSize: bodyFont(12) }}>
          {data.description || "List description"}
        </p>
        <div
          style={{
            display: "flex",
            gap: PREVIEW_GAP,
            overflowX: allowScroll ? "auto" : "visible",
            paddingBottom: allowScroll ? 4 : 0
          }}
        >
          {cards.map((card: any, idx: number) => (
            <div
              key={idx}
              style={{
                border: "1px solid #e3e3e3",
                borderRadius: 6,
                padding: 10,
                background: "#ffffff",
                minWidth: PREVIEW_CARD_MIN,
                flex: "0 0 auto"
              }}
            >
              <div className="stack" style={{ gap: 6 }}>
                <PreviewImageFrame
                  src={card.imageUrl}
                  alt={card.imageAlt}
                  aspectRatio={data.imageAspectRatio || PREVIEW_IMAGE_ASPECT}
                  displayMode={card.displayMode}
                  allowFlex={isSidePreview}
                />
                {hasText(card.eyebrow) && (
                  <span
                    style={{
                      fontSize: bodyFont(10),
                      color: "#7a7a7a",
                      letterSpacing: 0.6,
                      textTransform: "uppercase"
                    }}
                  >
                    {card.eyebrow}
                  </span>
                )}
              </div>
              <div style={{ fontSize: headingFont(12), fontWeight: 600 }}>
                {card.heading || "Card title"}
              </div>
              <div style={{ fontSize: bodyFont(11), color: "#5c5c5c", marginTop: 4 }}>
                {card.description || "Card description"}
              </div>
              {card.button?.label && (
                <div className="row" style={{ gap: 6, marginTop: 6 }}>
                  <span className="tag" style={{ fontSize: bodyFont(12) }}>
                    {card.button.label}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (blockType === "tab_content") {
    const tabs = Array.isArray(data.tabs) ? data.tabs : [];
    const activeTab = tabs[activeTabIndex] || tabs[0];
    return (
      <div className="stack" style={{ gap: PREVIEW_GAP, maxWidth: PREVIEW_TEXT_MAX }}>
        <strong style={{ fontSize: headingFont(14) }}>
          {data.mainHeading?.text || "Tabs heading"}
        </strong>
        <p className="muted" style={{ fontSize: bodyFont(12) }}>
          {data.mainDescription || "Tabs description"}
        </p>
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          {tabs.map((tab: any, idx: number) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveTabIndex(idx)}
              style={{
                border: "1px solid #d8d8d8",
                borderRadius: 999,
                padding: "4px 10px",
                background: idx === activeTabIndex ? "#1b1b1b" : "#ffffff",
                color: idx === activeTabIndex ? "#ffffff" : "#1b1b1b",
                cursor: "pointer",
                fontSize: bodyFont(11)
              }}
            >
              {tab.name || `Tab ${idx + 1}`}
            </button>
          ))}
        </div>
        {activeTab && (
          <div className="stack" style={{ gap: 6 }}>
            <div style={{ fontSize: headingFont(13), fontWeight: 600 }}>
              {activeTab.heading?.text || "Tab heading"}
            </div>
            <div style={{ fontSize: bodyFont(12), color: "#5c5c5c" }}>
              {activeTab.body || "Tab body"}
            </div>
          </div>
        )}
      </div>
    );
  }
  if (blockType === "banner") {
    const textAlign = data.textAlignment || "left";
    const textColor = data.textColor === "white" ? "#ffffff" : "#111111";
    const buttonJustify =
      textAlign === "left" ? "flex-start" : textAlign === "center" ? "center" : "flex-end";
    const hasMedia = Boolean(data.media?.src);
    const hasBg = Boolean(data.backgroundColor);
    const bannerBg = hasBg ? data.backgroundColor : data.media?.src ? "#f2f2f2" : "#fafafa";
    const imageWeight = PREVIEW_SIDE_IMAGE + 40;
    const imageBlock = hasMedia ? (
      <div style={{ width: imageWeight }}>
        <PreviewImageFrame
          src={data.media.src}
          alt={data.media?.alt}
          displayMode={data.media?.displayMode}
          backgroundColor={bannerBg}
          allowFlex={isSidePreview}
        />
      </div>
    ) : null;
    return (
      <div
        style={{
          border: "1px solid #e3e3e3",
          borderRadius: 8,
          padding: 16,
          background: bannerBg
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: hasMedia ? "minmax(0, 0.9fr) minmax(0, 1.2fr)" : "1fr",
            gap: PREVIEW_GAP + 2,
            alignItems: "center"
          }}
        >
          {data.mediaAlignment === "left" && imageBlock}
          <div style={{ textAlign, color: textColor, maxWidth: PREVIEW_TEXT_MAX }}>
            <div style={{ fontSize: headingFont(15), fontWeight: 600 }}>
              {data.heading?.text || "Banner heading"}
            </div>
            <div style={{ fontSize: bodyFont(12), marginTop: 8 }}>
              {data.body || "Banner body"}
            </div>
            <div
              className="row"
              style={{
                gap: 6,
                marginTop: 10,
                justifyContent: buttonJustify,
                flexWrap: "wrap"
              }}
            >
              {data.primaryButton?.label && (
                <span
                  className="tag"
                  style={{
                    color: textColor,
                    borderColor: textColor,
                    background: "transparent",
                    fontSize: bodyFont(12)
                  }}
                >
                  {data.primaryButton.label}
                </span>
              )}
              {data.secondaryButton?.label && (
                <span
                  className="tag"
                  style={{
                    color: textColor,
                    borderColor: textColor,
                    background: "transparent",
                    fontSize: bodyFont(12)
                  }}
                >
                  {data.secondaryButton.label}
                </span>
              )}
            </div>
          </div>
          {data.mediaAlignment !== "left" && imageBlock}
        </div>
      </div>
    );
  }
  if (blockType === "content") {
    const contentGroup = (
      <div className="stack" style={{ gap: 6, maxWidth: PREVIEW_TEXT_MAX }}>
        {hasText(data.eyebrow) && (
          <span
            style={{
              fontSize: bodyFont(11),
              color: "#7a7a7a",
              letterSpacing: 0.6,
              textTransform: "uppercase"
            }}
          >
            {data.eyebrow}
          </span>
        )}
        <strong style={{ fontSize: headingFont(14) }}>
          {data.heading?.text || "Content heading"}
        </strong>
        <p className="muted" style={{ fontSize: bodyFont(12) }}>
          {data.body || "Content body"}
        </p>
        {data.primaryButton?.label && (
          <div className="row" style={{ gap: 6 }}>
            <span className="tag" style={{ fontSize: bodyFont(12) }}>
              {data.primaryButton.label}
            </span>
          </div>
        )}
      </div>
    );
    const imageBlock = (
      <div className="stack" style={{ gap: 6 }}>
        <PreviewImageFrame
          src={data.media?.src}
          alt={data.media?.alt}
          displayMode={data.media?.displayMode}
          allowFlex={isSidePreview}
        />
        {hasText(data.media?.caption) && (
          <span className="muted" style={{ fontSize: 11 }}>
            {data.media.caption}
          </span>
        )}
      </div>
    );
    return (
      <div className="stack">
        {data.imagePosition === "left" || data.imagePosition === "right" ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.25fr) minmax(0, 0.9fr)",
              gap: PREVIEW_GAP,
              alignItems: "center"
            }}
          >
            {data.imagePosition === "left" ? imageBlock : contentGroup}
            {data.imagePosition === "left" ? contentGroup : imageBlock}
          </div>
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            {data.imagePosition === "above" && imageBlock}
            {contentGroup}
            {data.imagePosition === "below" && imageBlock}
          </div>
        )}
      </div>
    );
  }
  if (blockType === "media") {
    const gallery = Array.isArray(data.gallery) ? data.gallery : [];
    const showGallery = gallery.length > 0;
    const ratio = previewRatioNumber(
      data.media?.displayMode,
      data.media?.aspectRatio || PREVIEW_IMAGE_ASPECT
    );
    return (
      <div className="stack" style={{ gap: PREVIEW_GAP, maxWidth: PREVIEW_TEXT_MAX }}>
        {showGallery ? (
          <div className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: bodyFont(12) }}>
              Gallery preview
            </span>
            <div
              style={{
                display: "flex",
                gap: 8,
                overflowX: "auto",
                paddingBottom: 4
              }}
            >
              {gallery.map((item: any, idx: number) => (
                <div
                  key={`${item.src}-${idx}`}
                  style={{
                    minWidth: 160,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <PreviewImageFrame
                    src={item?.src}
                    alt={item?.alt}
                    aspectRatio={data.media?.aspectRatio || PREVIEW_IMAGE_ASPECT}
                    displayMode={item?.displayMode || data.media?.displayMode}
                    allowFlex={isSidePreview}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ borderRadius: 8, overflow: "hidden" }}>
            {data.media?.type === "video" ? (
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: ratio,
                  overflow: "hidden",
                  background: "#efefef"
                }}
              >
                {data.media?.src ? (
                  <video
                    controls
                    src={data.media.src}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <span className="muted" style={{ fontSize: 12 }}>
                    No media
                  </span>
                )}
              </div>
            ) : (
              <PreviewImageFrame
                src={data.media?.src}
                alt={data.media?.alt}
                aspectRatio={data.media?.aspectRatio || PREVIEW_IMAGE_ASPECT}
                displayMode={data.media?.displayMode}
                allowFlex={isSidePreview}
              />
            )}
          </div>
        )}
        {hasText(data.media?.caption) && (
          <span className="muted" style={{ fontSize: bodyFont(12) }}>
            {data.media.caption}
          </span>
        )}
      </div>
    );
  }
  return (
    <div
      style={{
        border: "1px solid #e3e3e3",
        borderRadius: 8,
        height: 120,
        background: data.media?.src ? "#d9e1ea" : "#f2f2f2"
      }}
    />
  );
}

function ArrowLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M15 6l-6 6 6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
