"use client";

import { useEffect, useState } from "react";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { Button, Input, Select, Textarea } from "@/app/components/ui";
import { useAuth } from "@/app/components/auth-provider";
import { exportPage } from "@/lib/services/exports";
import { getPage, updatePageTitle } from "@/lib/services/pages";
import Link from "next/link";
import {
  addBlock,
  listBlocks,
  removeBlock,
  updateBlockFields,
  updateBlockOrder
} from "@/lib/services/blocks";
import { hasProjectAccess } from "@/lib/services/projects";
import { Block, BlockFields, BlockType, HeadingLevel } from "@/lib/models/types";
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
                uploads.push({ src: uploadUrl, type: "image", fileName: file.name });
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

function BlockPalette({
  className,
  expandedBlock,
  onExpand,
  onAdd
}: {
  className?: string;
  expandedBlock: BlockType | null;
  onExpand: (block: BlockType | null) => void;
  onAdd: (block: BlockType) => void;
}) {
  const selectedIndex = expandedBlock
    ? paletteBlocks.indexOf(expandedBlock)
    : -1;
  return (
    <div
      className={`palette ${className || ""}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        position: "relative"
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
}

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
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [expandedBlockIds, setExpandedBlockIds] = useState<string[]>([]);
  const [expandedPaletteBlock, setExpandedPaletteBlock] =
    useState<BlockType | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [hasAccess, setHasAccess] = useState(true);

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

  useEffect(() => {
    async function loadPage() {
      const page = await getPage(workspaceId, projectId, pageId);
      setPageTitle(page?.title || "Page");
    }
    if (workspaceId && projectId && pageId) loadPage();
  }, [workspaceId, projectId, pageId]);

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

  return (
    <AppShell>
      <div className="stack">
        <div className="stack">
          <Link
            href={`/workspaces/${workspaceId}/projects/${projectId}`}
            className="muted"
          >
            Back to project
          </Link>
          <h1>Page editor</h1>
          <p className="muted">Edit structured blocks in page order.</p>
        </div>

        <section className="surface" style={{ padding: 20 }}>
          <div className="stack">
            <Input
              label="Page title"
              value={pageTitle}
              onChange={handleUpdateTitle}
            />
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div className="muted" style={{ fontSize: 13 }}>
                {statusMessage || "Changes are saved automatically."}
              </div>
              <Button variant="secondary" onClick={handleExport}>
                Export page (CMS handover)
              </Button>
            </div>
          </div>
        </section>

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
          >
            <div className="editor-gutter">
              <BlockPalette
                className={`palette ${paletteOpen ? "is-open" : ""}`}
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
                <BlockEditor
                  key={block.id}
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
                : "minmax(0, 1fr) 360px",
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
                    button: { label: "", url: "" }
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
                    media: { src: "", type: "image", alt: "" },
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
                width: fullPreview ? "100%" : 360,
                minWidth: fullPreview ? "100%" : 360
              }}
            >
              <div className="surface" style={{ padding: 16 }}>
                <div className="stack" style={{ gap: 12 }}>
                  <div className="stack" style={{ gap: 6 }}>
                    <strong>Preview</strong>
                    <div className="divider" />
                  </div>
                  <BlockPreview blockType={block.type} fields={fields} />
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
  fields
}: {
  blockType: BlockType;
  fields: BlockFields;
}) {
  const data: any = fields;
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
            padding: 16,
            minHeight: 160,
            background: data.media?.src ? "#d9e1ea" : "#f2f2f2",
            display: "flex",
            alignItems: "center"
          }}
        >
          {data.media?.src && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `url(${data.media.src})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
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
              textAlign
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 600 }}>
              {data.heading?.text || "Hero heading"}
            </div>
            <div style={{ marginTop: 6, fontSize: 13 }}>
              {data.body || "Hero body text"}
            </div>
            <div
              className="row"
              style={{ gap: 6, marginTop: 12, justifyContent: buttonJustify, flexWrap: "wrap" }}
            >
              {data.primaryButton?.label && (
                <span
                  className="tag"
                  style={{ color: textColor, borderColor: textColor, background: "transparent" }}
                >
                  {data.primaryButton.label}
                </span>
              )}
              {data.secondaryButton?.label && (
                <span
                  className="tag"
                  style={{ color: textColor, borderColor: textColor, background: "transparent" }}
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
      <div className="stack">
        <strong>{data.heading?.text || "Card list heading"}</strong>
        <p className="muted">{data.description || "List description"}</p>
        <div
          style={{
            display: "flex",
            gap: 8,
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
                padding: 8,
                background: "#ffffff",
                minWidth: 160,
                flex: "0 0 auto"
              }}
            >
              <div className="stack" style={{ gap: 6 }}>
                <div
                  style={{
                    borderRadius: 4,
                    background: card.imageUrl ? `url(${card.imageUrl}) center / cover` : "#eaeaea",
                    aspectRatio: aspectRatioValue(data.imageAspectRatio),
                    width: "100%"
                  }}
                />
                {hasText(card.eyebrow) && (
                  <span style={{ fontSize: 10, color: "#7a7a7a", letterSpacing: 0.6, textTransform: "uppercase" }}>
                    {card.eyebrow}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>
                {card.heading || "Card title"}
              </div>
              <div style={{ fontSize: 11, color: "#5c5c5c", marginTop: 4 }}>
                {card.description || "Card description"}
              </div>
              {card.button?.label && (
                <div className="row" style={{ gap: 6, marginTop: 6 }}>
                  <span className="tag">{card.button.label}</span>
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
      <div className="stack">
        <strong>{data.mainHeading?.text || "Tabs heading"}</strong>
        <p className="muted">{data.mainDescription || "Tabs description"}</p>
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
                fontSize: 11
              }}
            >
              {tab.name || `Tab ${idx + 1}`}
            </button>
          ))}
        </div>
        {activeTab && (
          <div className="stack" style={{ gap: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {activeTab.heading?.text || "Tab heading"}
            </div>
            <div style={{ fontSize: 12, color: "#5c5c5c" }}>
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
    const imageBlock = hasMedia ? (
      <div
        style={{
          width: 96,
          height: 72,
          borderRadius: 6,
          background: `url(${data.media.src}) center / cover no-repeat`
        }}
      />
    ) : null;
    return (
      <div
        style={{
          border: "1px solid #e3e3e3",
          borderRadius: 8,
          padding: 12,
          background: data.media?.src ? "#f2f2f2" : "#fafafa"
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: hasMedia ? "1fr 96px" : "1fr",
            gap: 12,
            alignItems: "center"
          }}
        >
          {data.mediaAlignment === "left" && imageBlock}
          <div style={{ textAlign, color: textColor }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {data.heading?.text || "Banner heading"}
            </div>
            <div style={{ fontSize: 12, marginTop: 6 }}>
              {data.body || "Banner body"}
            </div>
            <div
              className="row"
              style={{ gap: 6, marginTop: 8, justifyContent: buttonJustify, flexWrap: "wrap" }}
            >
              {data.primaryButton?.label && (
                <span
                  className="tag"
                  style={{ color: textColor, borderColor: textColor, background: "transparent" }}
                >
                  {data.primaryButton.label}
                </span>
              )}
              {data.secondaryButton?.label && (
                <span
                  className="tag"
                  style={{ color: textColor, borderColor: textColor, background: "transparent" }}
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
      <div className="stack" style={{ gap: 6 }}>
        {hasText(data.eyebrow) && (
          <span style={{ fontSize: 11, color: "#7a7a7a", letterSpacing: 0.6, textTransform: "uppercase" }}>
            {data.eyebrow}
          </span>
        )}
        <strong>{data.heading?.text || "Content heading"}</strong>
        <p className="muted">{data.body || "Content body"}</p>
        {data.primaryButton?.label && (
          <div className="row" style={{ gap: 6 }}>
            <span className="tag">{data.primaryButton.label}</span>
          </div>
        )}
      </div>
    );
    const imageBlock = (
      <div className="stack" style={{ gap: 6 }}>
        <div
          style={{
            height: 120,
            borderRadius: 6,
            background: data.media?.src ? `url(${data.media.src}) center / cover` : "#efefef"
          }}
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
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
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
    const ratio = aspectRatioValue(data.media?.aspectRatio);
    return (
      <div className="stack" style={{ gap: 8 }}>
        {showGallery ? (
          <div className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12 }}>
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
                    border: "1px solid #e3e3e3",
                    borderRadius: 8,
                    overflow: "hidden",
                    background: "#f2f2f2",
                    minWidth: 160,
                    aspectRatio: ratio,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  {item?.src ? (
                    <img
                      src={item.src}
                      alt={item?.alt || "Gallery image"}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <span className="muted" style={{ fontSize: 12 }}>
                      No media
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div
            style={{
              border: "1px solid #e3e3e3",
              borderRadius: 8,
              overflow: "hidden",
              background: "#f2f2f2",
              aspectRatio: ratio,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            {data.media?.src ? (
              data.media?.type === "video" ? (
                <video
                  controls
                  src={data.media.src}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <img
                  src={data.media.src}
                  alt={data.media?.alt || "Media preview"}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              )
            ) : (
              <span className="muted" style={{ fontSize: 12 }}>
                No media
              </span>
            )}
          </div>
        )}
        {hasText(data.media?.caption) && (
          <span className="muted" style={{ fontSize: 12 }}>
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
