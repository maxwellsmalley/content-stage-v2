"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query
} from "firebase/firestore";
import AppShell from "@/app/components/app-shell";
import { useAuth } from "@/app/components/auth-provider";
import { IconGlyph } from "@/app/components/icons";
import { blockTypeLabels } from "@/lib/utils/block-templates";
import { db } from "@/lib/firebase";
import { Block, BlockFields, ButtonField, HeadingField } from "@/lib/models/types";

type ImageEntry = { src: string; fileName: string; label?: string };
type FieldItem = {
  id: string;
  label: string;
  value: any;
  type: "text" | "rich" | "url" | "object" | "list";
  copyable?: boolean;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function isHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase());
}

function fileNameFromUrl(url: string) {
  try {
    const decoded = decodeURIComponent(url.split("?")[0]);
    return decoded.split("/").pop() || "asset";
  } catch {
    return url.split("?")[0].split("/").pop() || "asset";
  }
}

function isEmptyValue(value: any): boolean {
  if (value === null || value === undefined || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") {
    return Object.values(value).every((entry) => isEmptyValue(entry));
  }
  return false;
}

function collectImages(fields: BlockFields) {
  const results: ImageEntry[] = [];
  const seen = new Set<string>();

  const visit = (value: any, label?: string) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, label));
      return;
    }
    if (typeof value === "object") {
      if (typeof value.src === "string") {
        if (value.type !== "video") {
          const src = value.src;
          if (!seen.has(src)) {
            seen.add(src);
            results.push({
              src,
              fileName: value.fileName || fileNameFromUrl(src),
              label
            });
          }
        }
      }
      if (typeof value.imageUrl === "string") {
        const src = value.imageUrl;
        if (!seen.has(src)) {
          seen.add(src);
          results.push({
            src,
            fileName: value.fileName || fileNameFromUrl(src),
            label
          });
        }
      }
      Object.entries(value).forEach(([key, entry]) => visit(entry, formatLabel(key)));
    }
  };

  visit(fields);
  return results;
}

function headingSummary(fields: BlockFields) {
  const heading = (fields as any).heading as HeadingField | undefined;
  const mainHeading = (fields as any).mainHeading as HeadingField | undefined;
  const tabs = (fields as any).tabs as Array<any> | undefined;
  const headingText =
    heading?.text ||
    mainHeading?.text ||
    (Array.isArray(tabs) ? tabs[0]?.heading?.text : "") ||
    "";
  return headingText ? `"${headingText}"` : "No heading";
}

function buildButtonFields(label: string, button?: ButtonField): FieldItem[] {
  return [
    {
      id: `${label}-label`,
      label: `${label} label`,
      value: button?.label || "",
      type: "text",
      copyable: true
    },
    {
      id: `${label}-url`,
      label: `${label} URL`,
      value: button?.url || "",
      type: "url",
      copyable: true
    }
  ];
}

function buildSections(fields: BlockFields) {
  const content: FieldItem[] = [];
  const actions: FieldItem[] = [];
  const media: FieldItem[] = [];
  const config: FieldItem[] = [];

  const heading = (fields as any).heading as HeadingField | undefined;
  const mainHeading = (fields as any).mainHeading as HeadingField | undefined;
  const body = (fields as any).body as string | undefined;
  const mainDescription = (fields as any).mainDescription as string | undefined;
  const eyebrow = (fields as any).eyebrow as string | undefined;

  if (heading) {
    content.push({
      id: "heading",
      label: "Heading",
      value: `${heading.text || ""} (${String(heading.level || "h2").toUpperCase()})`,
      type: "text",
      copyable: true
    });
  }
  if (mainHeading) {
    content.push({
      id: "mainHeading",
      label: "Main heading",
      value: `${mainHeading.text || ""} (${String(mainHeading.level || "h2").toUpperCase()})`,
      type: "text",
      copyable: true
    });
  }
  if (body !== undefined) {
    content.push({
      id: "body",
      label: "Body",
      value: body,
      type: isHtml(body) ? "rich" : "text",
      copyable: true
    });
  }
  if (mainDescription !== undefined) {
    content.push({
      id: "mainDescription",
      label: "Main description",
      value: mainDescription,
      type: isHtml(mainDescription) ? "rich" : "text",
      copyable: true
    });
  }
  if (eyebrow !== undefined) {
    content.push({
      id: "eyebrow",
      label: "Eyebrow",
      value: eyebrow,
      type: "text",
      copyable: true
    });
  }

  const primaryButton = (fields as any).primaryButton as ButtonField | undefined;
  const secondaryButton = (fields as any).secondaryButton as ButtonField | undefined;
  actions.push(...buildButtonFields("Primary", primaryButton));
  actions.push(...buildButtonFields("Secondary", secondaryButton));

  const cards = (fields as any).cards as Array<any> | undefined;
  if (Array.isArray(cards)) {
    content.push({
      id: "cards",
      label: "Cards",
      value: cards.map((card) => ({
        heading: card.heading || "",
        description: card.description || "",
        eyebrow: card.eyebrow || "",
        button: card.button || { label: "", url: "" }
      })),
      type: "list"
    });
  }

  const tabs = (fields as any).tabs as Array<any> | undefined;
  if (Array.isArray(tabs)) {
    content.push({
      id: "tabs",
      label: "Tabs",
      value: tabs.map((tab) => ({
        name: tab.name || "",
        heading: tab.heading?.text || "",
        body: tab.body || "",
        eyebrow: tab.eyebrow || "",
        button: tab.button || { label: "", url: "" }
      })),
      type: "list"
    });
  }

  const mediaField = (fields as any).media;
  if (mediaField) {
    media.push({
      id: "media-caption",
      label: "Caption",
      value: mediaField.caption || "",
      type: "text",
      copyable: true
    });
    media.push({
      id: "media-alt",
      label: "Alt text",
      value: mediaField.alt || "",
      type: "text",
      copyable: true
    });
  }

  const gallery = (fields as any).gallery as Array<any> | undefined;
  if (Array.isArray(gallery)) {
    media.push({
      id: "gallery",
      label: "Gallery",
      value: gallery.map((item) => item?.fileName || fileNameFromUrl(item?.src || "")),
      type: "list"
    });
  }

  const configKeys = [
    "variant",
    "textAlignment",
    "mediaAlignment",
    "textColor",
    "backgroundMode",
    "backgroundColor",
    "imagePosition",
    "displayMode",
    "columns",
    "imageAspectRatio"
  ];
  configKeys.forEach((key) => {
    const value = (fields as any)[key];
    if (value !== undefined) {
      config.push({
        id: `config-${key}`,
        label: formatLabel(key),
        value,
        type: "text"
      });
    }
  });

  return { content, actions, media, config };
}

export default function HandoverViewPage() {
  const params = useParams<{
    workspaceId: string;
    projectId: string;
    pageId: string;
  }>();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [pageTitle, setPageTitle] = useState("");
  const [pageStatus, setPageStatus] = useState("");
  const [pageUpdatedAt, setPageUpdatedAt] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);
  const [expandAll, setExpandAll] = useState(false);
  const [showEmpty, setShowEmpty] = useState<Record<string, boolean>>({});
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

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
      if (!user || !workspaceId) return;
      const memberSnapshot = await getDoc(
        doc(db, "workspaces", workspaceId, "workspaceMembers", user.uid)
      );
      setHasAccess(memberSnapshot.exists());
    }
    checkAccess();
  }, [user, workspaceId]);

  useEffect(() => {
    async function loadPage() {
      if (!workspaceId || !projectId || !pageId) return;
      const snapshot = await getDoc(
        doc(db, "workspaces", workspaceId, "projects", projectId, "pages", pageId)
      );
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      setPageTitle(String(data.title || "Untitled page"));
      setPageStatus(String(data.status || "draft"));
      const updated =
        data.updatedAt?.toDate?.() ||
        data.statusUpdatedAt?.toDate?.() ||
        data.createdAt?.toDate?.() ||
        null;
      setPageUpdatedAt(updated ? updated.toISOString() : null);
    }
    loadPage();
  }, [workspaceId, projectId, pageId]);

  useEffect(() => {
    async function loadBlocks() {
      if (!workspaceId || !projectId || !pageId) return;
      const snapshot = await getDocs(
        query(
          collection(
            db,
            "workspaces",
            workspaceId,
            "projects",
            projectId,
            "pages",
            pageId,
            "blocks"
          ),
          orderBy("order")
        )
      );
      setBlocks(
        snapshot.docs.map((docItem) => ({
          id: docItem.id,
          type: docItem.data().type,
          order: docItem.data().order,
          fields: docItem.data().fields
        }))
      );
    }
    loadBlocks();
  }, [workspaceId, projectId, pageId]);

  const slug = useMemo(() => slugify(pageTitle), [pageTitle]);
  const jsonPayload = useMemo(
    () => ({
      page: {
        id: pageId,
        title: pageTitle,
        slug,
        status: pageStatus,
        updatedAt: pageUpdatedAt
      },
      blocks: blocks.map((block, index) => ({
        index: index + 1,
        type: block.type,
        fields: block.fields
      }))
    }),
    [pageId, pageTitle, slug, pageStatus, pageUpdatedAt, blocks]
  );

  if (loading || hasAccess === null) {
    return (
      <AppShell>
        <div>Loading...</div>
      </AppShell>
    );
  }

  if (!user || !hasAccess) {
    return (
      <AppShell>
        <div className="stack">
          <h1>Workspace access required</h1>
          <p className="muted">You do not have access to this workspace.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="stack" style={{ gap: 16 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="stack" style={{ gap: 6 }}>
            <h1 style={{ margin: 0 }}>{pageTitle}</h1>
            <div className="row" style={{ gap: 12 }}>
              <span className="muted" style={{ fontSize: 12 }}>
                Slug: {slug || "Not set"}
              </span>
              <span className="muted" style={{ fontSize: 12 }}>
                Status: {pageStatus || "draft"}
              </span>
              <span className="muted" style={{ fontSize: 12 }}>
                Last updated:{" "}
                {pageUpdatedAt ? new Date(pageUpdatedAt).toLocaleString() : "Not set"}
              </span>
            </div>
          </div>
          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <button
              type="button"
              onClick={() => {
                setExpandAll(true);
                setExpandedBlockId(null);
              }}
              style={{
                border: "1px solid #e0e0e0",
                borderRadius: 999,
                padding: "6px 12px",
                background: "#ffffff",
                color: "#4b4b4b",
                fontSize: 12,
                cursor: "pointer"
              }}
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={() => {
                setExpandAll(false);
                setExpandedBlockId(null);
              }}
              style={{
                border: "1px solid #e0e0e0",
                borderRadius: 999,
                padding: "6px 12px",
                background: "#ffffff",
                color: "#4b4b4b",
                fontSize: 12,
                cursor: "pointer"
              }}
            >
              Collapse All
            </button>
            <button
              type="button"
              onClick={() => setShowJson(true)}
              style={{
                border: "1px solid #e0e0e0",
                borderRadius: 999,
                padding: "6px 12px",
                background: "#ffffff",
                color: "#4b4b4b",
                fontSize: 12,
                cursor: "pointer"
              }}
            >
              View Structured Data
            </button>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(window.location.href);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              style={{
                border: "1px solid #e0e0e0",
                borderRadius: 999,
                padding: "6px 12px",
                background: "#ffffff",
                color: "#4b4b4b",
                fontSize: 12,
                cursor: "pointer"
              }}
            >
              Copy Handover Link
            </button>
            {copied && <span className="muted">Link copied</span>}
          </div>
        </div>

        <div className="stack" style={{ gap: 12 }}>
          {blocks.map((block, index) => {
            const { content, actions, media, config } = buildSections(block.fields);
            const images = collectImages(block.fields);
            const emptyCount = [
              ...content,
              ...actions,
              ...media,
              ...config
            ].filter((item) => isEmptyValue(item.value)).length;
            const imageCount = images.length;
            const expanded = expandAll || expandedBlockId === block.id;
            const showEmptyFields = showEmpty[block.id] ?? false;
            const summary = `${imageCount} image${imageCount === 1 ? "" : "s"} · ${emptyCount} empty fields`;
            const headingText = headingSummary(block.fields);

            return (
              <div key={block.id} className="surface" style={{ padding: 14 }}>
                <button
                  type="button"
                  onClick={() => {
                    if (expandAll) {
                      setExpandAll(false);
                      setExpandedBlockId(block.id);
                      return;
                    }
                    setExpandedBlockId((current) =>
                      current === block.id ? null : block.id
                    );
                  }}
                  className="row"
                  style={{
                    width: "100%",
                    border: "none",
                    background: "transparent",
                    padding: 0,
                    cursor: "pointer",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <div className="stack" style={{ gap: 4, textAlign: "left" }}>
                    <div className="row" style={{ gap: 8, alignItems: "center" }}>
                      <strong style={{ fontSize: 16 }}>Block {index + 1}</strong>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {blockTypeLabels[block.type] || block.type}
                      </span>
                      {expanded && emptyCount > 0 && (
                        <span
                          style={{
                            fontSize: 11,
                            padding: "2px 6px",
                            borderRadius: 999,
                            background: "#f8efe1",
                            color: "#7a5a2e"
                          }}
                        >
                          ⚠ {emptyCount} empty fields
                        </span>
                      )}
                    </div>
                    <div className="row" style={{ gap: 8, alignItems: "center" }}>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {headingText}
                      </span>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {summary}
                      </span>
                    </div>
                  </div>
                  <IconGlyph name={expanded ? "chevron-down" : "chevron-right"} />
                </button>

                {expanded && (
                  <div className="stack" style={{ gap: 12, marginTop: 12 }}>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span className="muted" style={{ fontSize: 11, letterSpacing: 1 }}>
                        CONTENT
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setShowEmpty((prev) => ({
                            ...prev,
                            [block.id]: !showEmptyFields
                          }))
                        }
                        style={{
                          border: "1px solid #e0e0e0",
                          borderRadius: 999,
                          padding: "4px 10px",
                          background: "#ffffff",
                          color: "#4b4b4b",
                          fontSize: 11,
                          cursor: "pointer"
                        }}
                      >
                        {showEmptyFields ? "Hide empty fields" : "Show empty fields"}
                      </button>
                    </div>
                    <SectionFields
                      items={content}
                      blockId={block.id}
                      showEmpty={showEmptyFields}
                      onCopy={(text, id) => {
                        navigator.clipboard.writeText(text);
                        setCopiedField(id);
                        setTimeout(() => setCopiedField(null), 1500);
                      }}
                      copiedField={copiedField}
                    />

                    <div className="header-divider" />
                    <span className="muted" style={{ fontSize: 11, letterSpacing: 1 }}>
                      ACTIONS
                    </span>
                    <SectionFields
                      items={actions}
                      blockId={block.id}
                      showEmpty={showEmptyFields}
                      onCopy={(text, id) => {
                        navigator.clipboard.writeText(text);
                        setCopiedField(id);
                        setTimeout(() => setCopiedField(null), 1500);
                      }}
                      copiedField={copiedField}
                    />

                    <div className="header-divider" />
                    <span className="muted" style={{ fontSize: 11, letterSpacing: 1 }}>
                      MEDIA
                    </span>
                    {images.length === 0 && !showEmptyFields ? (
                      <span className="muted">⚠ Empty</span>
                    ) : (
                      <div className="stack" style={{ gap: 8 }}>
                        {images.map((image) => (
                          <div
                            key={image.src}
                            className="row"
                            style={{ gap: 12, alignItems: "center" }}
                          >
                            <img
                              src={image.src}
                              alt={image.fileName}
                              style={{
                                width: 56,
                                height: 56,
                                objectFit: "cover",
                                borderRadius: 6,
                                border: "1px solid #e1e1e1"
                              }}
                            />
                            <div className="stack" style={{ gap: 2, flex: 1 }}>
                              <span>{image.fileName}</span>
                              {image.label && (
                                <span className="muted" style={{ fontSize: 11 }}>
                                  {image.label}
                                </span>
                              )}
                              <a
                                href={image.src}
                                target="_blank"
                                rel="noreferrer"
                                style={{ fontSize: 11, color: "#6b6b6b" }}
                              >
                                View source URL
                              </a>
                            </div>
                            <a
                              href={image.src}
                              download
                              style={{
                                border: "1px solid #e0e0e0",
                                borderRadius: 999,
                                padding: "6px 12px",
                                background: "#ffffff",
                                color: "#4b4b4b",
                                fontSize: 12
                              }}
                            >
                              Download
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                    <SectionFields
                      items={media}
                      blockId={block.id}
                      showEmpty={showEmptyFields}
                      onCopy={(text, id) => {
                        navigator.clipboard.writeText(text);
                        setCopiedField(id);
                        setTimeout(() => setCopiedField(null), 1500);
                      }}
                      copiedField={copiedField}
                    />

                    <div className="header-divider" />
                    <details>
                      <summary
                        style={{
                          fontSize: 11,
                          letterSpacing: 1,
                          color: "#6b6b6b",
                          cursor: "pointer"
                        }}
                      >
                        CONFIGURATION
                      </summary>
                      <div className="stack" style={{ gap: 8, marginTop: 8 }}>
                        <SectionFields
                          items={config}
                          blockId={block.id}
                          showEmpty={showEmptyFields}
                          onCopy={(text, id) => {
                            navigator.clipboard.writeText(text);
                            setCopiedField(id);
                            setTimeout(() => setCopiedField(null), 1500);
                          }}
                          copiedField={copiedField}
                        />
                      </div>
                    </details>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showJson && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50
          }}
        >
          <div
            className="surface"
            style={{
              width: "min(900px, 90vw)",
              maxHeight: "80vh",
              overflow: "auto",
              padding: 20
            }}
          >
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>Structured Data</strong>
              <button
                type="button"
                onClick={() => setShowJson(false)}
                style={{
                  border: "1px solid #e0e0e0",
                  borderRadius: 999,
                  padding: "6px 12px",
                  background: "#ffffff",
                  color: "#4b4b4b",
                  fontSize: 12,
                  cursor: "pointer"
                }}
              >
                Close
              </button>
            </div>
            <pre style={{ marginTop: 12, fontSize: 12, whiteSpace: "pre-wrap" }}>
              {JSON.stringify(jsonPayload, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function SectionFields({
  items,
  blockId,
  showEmpty,
  onCopy,
  copiedField
}: {
  items: FieldItem[];
  blockId: string;
  showEmpty: boolean;
  onCopy: (text: string, id: string) => void;
  copiedField: string | null;
}) {
  const filtered = showEmpty
    ? items
    : items.filter((item) => !isEmptyValue(item.value));

  if (filtered.length === 0) {
    return <span className="muted">⚠ Empty</span>;
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      {filtered.map((item) => {
        const empty = isEmptyValue(item.value);
        const value =
          item.type === "rich" && typeof item.value === "string" ? (
            <div
              style={{ lineHeight: 1.5 }}
              dangerouslySetInnerHTML={{ __html: item.value }}
            />
          ) : item.type === "list" ? (
            <div className="stack" style={{ gap: 6 }}>
              {(item.value as any[]).map((entry, idx) => (
                <div key={idx} className="surface" style={{ padding: 10 }}>
                  {typeof entry === "object" ? (
                    <pre
                      style={{
                        margin: 0,
                        fontSize: 12,
                        whiteSpace: "pre-wrap"
                      }}
                    >
                      {JSON.stringify(entry, null, 2)}
                    </pre>
                  ) : (
                    <span>{String(entry)}</span>
                  )}
                </div>
              ))}
            </div>
          ) : item.type === "object" && typeof item.value === "object" ? (
            <pre
              style={{
                margin: 0,
                fontSize: 12,
                whiteSpace: "pre-wrap"
              }}
            >
              {JSON.stringify(item.value, null, 2)}
            </pre>
          ) : (
            <span style={{ wordBreak: "break-word" }}>{String(item.value || "")}</span>
          );

        const fieldId = `${blockId}-${item.id}`;

        return (
          <div key={item.id} className="row" style={{ gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 180, fontSize: 12, color: "#6b6b6b" }}>
              {item.label}
            </div>
            <div style={{ flex: 1 }}>
              {empty ? <span className="muted">⚠ Empty</span> : value}
            </div>
            {item.copyable && !empty && (
              <button
                type="button"
                onClick={() => onCopy(String(item.value || ""), fieldId)}
                style={{
                  border: "1px solid #e0e0e0",
                  borderRadius: 999,
                  padding: "4px 8px",
                  background: "#ffffff",
                  color: "#4b4b4b",
                  fontSize: 11,
                  cursor: "pointer"
                }}
              >
                {copiedField === fieldId ? "Copied" : "Copy"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
