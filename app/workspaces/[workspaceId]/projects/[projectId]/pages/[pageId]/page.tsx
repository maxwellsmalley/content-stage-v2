"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { Button, Input, Select, Textarea } from "@/app/components/ui";
import { useAuth } from "@/app/components/auth-provider";
import { exportPage } from "@/lib/services/exports";
import { getPage, updatePageTitle } from "@/lib/services/pages";
import {
  addBlock,
  listBlocks,
  removeBlock,
  updateBlockFields,
  updateBlockOrder
} from "@/lib/services/blocks";
import { hasProjectAccess } from "@/lib/services/projects";
import { Block, BlockFields, BlockType } from "@/lib/models/types";
import { blockTypeLabels, createDefaultFields } from "@/lib/utils/block-templates";

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
  const [newBlockType, setNewBlockType] = useState<BlockType>("hero");
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

  const blockOptions = useMemo(
    () =>
      (Object.keys(blockTypeLabels) as BlockType[]).map((value) => ({
        value,
        label: blockTypeLabels[value]
      })),
    []
  );

  async function handleAddBlock() {
    const fields = createDefaultFields(newBlockType) as BlockFields;
    await addBlock(workspaceId, projectId, pageId, newBlockType, fields);
    const updated = await listBlocks(workspaceId, projectId, pageId);
    setBlocks(updated);
  }

  async function handleRemoveBlock(blockId: string) {
    const confirmed = window.confirm("Remove this block? This cannot be undone.");
    if (!confirmed) return;
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
                Export page
              </Button>
            </div>
          </div>
        </section>

        <section className="surface" style={{ padding: 20 }}>
          <div className="stack">
            <h2>Add block</h2>
            <div className="row">
              <Select
                label="Block type"
                value={newBlockType}
                onChange={(value) => setNewBlockType(value as BlockType)}
                options={blockOptions}
              />
              <Button variant="primary" onClick={handleAddBlock}>
                Add block
              </Button>
            </div>
          </div>
        </section>

        <section className="stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>Blocks</h2>
            <span className="tag">{blocks.length} blocks</span>
          </div>
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
              onMove={handleMoveBlock}
              onRemove={handleRemoveBlock}
              onUpdate={handleUpdateBlock}
            />
          ))}
        </section>
      </div>
    </AppShell>
  );
}

function BlockEditor({
  block,
  index,
  total,
  onMove,
  onRemove,
  onUpdate
}: {
  block: Block;
  index: number;
  total: number;
  onMove: (index: number, direction: "up" | "down") => void;
  onRemove: (blockId: string) => void;
  onUpdate: (blockId: string, fields: BlockFields) => void;
}) {
  const [fields, setFields] = useState<BlockFields>(block.fields);

  useEffect(() => {
    setFields(block.fields);
  }, [block.fields]);

  function updateField(path: string, value: string) {
    const updated = { ...fields } as Record<string, unknown>;
    updated[path] = value;
    setFields(updated as BlockFields);
    onUpdate(block.id, updated as BlockFields);
  }

  function updateCard(index: number, patch: Record<string, string>) {
    const current = fields as { cards: Array<Record<string, string>> };
    const cards = [...(current.cards || [])];
    cards[index] = { ...cards[index], ...patch };
    const updated = { ...fields, cards } as BlockFields;
    setFields(updated);
    onUpdate(block.id, updated);
  }

  function addCard() {
    const current = fields as { cards: Array<Record<string, string>> };
    const cards = [
      ...(current.cards || []),
      { title: "", body: "", linkLabel: "", linkUrl: "" }
    ];
    const updated = { ...fields, cards } as BlockFields;
    setFields(updated);
    onUpdate(block.id, updated);
  }

  function removeCard(cardIndex: number) {
    const current = fields as { cards: Array<Record<string, string>> };
    const cards = [...(current.cards || [])];
    cards.splice(cardIndex, 1);
    const updated = { ...fields, cards } as BlockFields;
    setFields(updated);
    onUpdate(block.id, updated);
  }

  function updateTab(index: number, patch: Record<string, string>) {
    const current = fields as { tabs: Array<Record<string, string>> };
    const tabs = [...(current.tabs || [])];
    tabs[index] = { ...tabs[index], ...patch };
    const updated = { ...fields, tabs } as BlockFields;
    setFields(updated);
    onUpdate(block.id, updated);
  }

  function addTab() {
    const current = fields as { tabs: Array<Record<string, string>> };
    const tabs = [...(current.tabs || []), { label: "", content: "" }];
    const updated = { ...fields, tabs } as BlockFields;
    setFields(updated);
    onUpdate(block.id, updated);
  }

  function removeTab(tabIndex: number) {
    const current = fields as { tabs: Array<Record<string, string>> };
    const tabs = [...(current.tabs || [])];
    tabs.splice(tabIndex, 1);
    const updated = { ...fields, tabs } as BlockFields;
    setFields(updated);
    onUpdate(block.id, updated);
  }

  return (
    <div className="surface" style={{ padding: 20 }}>
      <div className="stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="stack" style={{ gap: 4 }}>
            <strong>{blockTypeLabels[block.type]}</strong>
            <span className="muted" style={{ fontSize: 12 }}>
              Position {index + 1} of {total}
            </span>
          </div>
          <div className="row">
            <Button
              variant="secondary"
              onClick={() => onMove(index, "up")}
              disabled={index === 0}
            >
              Move up
            </Button>
            <Button
              variant="secondary"
              onClick={() => onMove(index, "down")}
              disabled={index === total - 1}
            >
              Move down
            </Button>
            <Button variant="danger" onClick={() => onRemove(block.id)}>
              Remove
            </Button>
          </div>
        </div>

        {block.type === "hero" && (
          <div className="stack">
            <Input
              label="Headline"
              value={(fields as any).headline || ""}
              onChange={(value) => updateField("headline", value)}
            />
            <Textarea
              label="Subheadline"
              value={(fields as any).subheadline || ""}
              onChange={(value) => updateField("subheadline", value)}
            />
            <Input
              label="Primary CTA label"
              value={(fields as any).primaryCtaLabel || ""}
              onChange={(value) => updateField("primaryCtaLabel", value)}
            />
            <Input
              label="Primary CTA URL"
              value={(fields as any).primaryCtaUrl || ""}
              onChange={(value) => updateField("primaryCtaUrl", value)}
            />
            <Input
              label="Media URL"
              value={(fields as any).mediaUrl || ""}
              onChange={(value) => updateField("mediaUrl", value)}
            />
          </div>
        )}

        {block.type === "banner" && (
          <div className="stack">
            <Textarea
              label="Banner text"
              value={(fields as any).text || ""}
              onChange={(value) => updateField("text", value)}
            />
            <Input
              label="Link label"
              value={(fields as any).linkLabel || ""}
              onChange={(value) => updateField("linkLabel", value)}
            />
            <Input
              label="Link URL"
              value={(fields as any).linkUrl || ""}
              onChange={(value) => updateField("linkUrl", value)}
            />
          </div>
        )}

        {block.type === "content" && (
          <div className="stack">
            <Input
              label="Heading"
              value={(fields as any).heading || ""}
              onChange={(value) => updateField("heading", value)}
            />
            <Textarea
              label="Body"
              value={(fields as any).body || ""}
              onChange={(value) => updateField("body", value)}
              rows={6}
            />
          </div>
        )}

        {block.type === "card_list" && (
          <div className="stack">
            <Input
              label="Heading"
              value={(fields as any).heading || ""}
              onChange={(value) => updateField("heading", value)}
            />
            <div className="stack">
              {(fields as any).cards?.map((card: any, cardIndex: number) => (
                <div key={cardIndex} className="surface" style={{ padding: 12 }}>
                  <div className="stack">
                    <Input
                      label="Card title"
                      value={card.title || ""}
                      onChange={(value) => updateCard(cardIndex, { title: value })}
                    />
                    <Textarea
                      label="Card body"
                      value={card.body || ""}
                      onChange={(value) => updateCard(cardIndex, { body: value })}
                    />
                    <Input
                      label="Link label"
                      value={card.linkLabel || ""}
                      onChange={(value) =>
                        updateCard(cardIndex, { linkLabel: value })
                      }
                    />
                    <Input
                      label="Link URL"
                      value={card.linkUrl || ""}
                      onChange={(value) =>
                        updateCard(cardIndex, { linkUrl: value })
                      }
                    />
                    <Button
                      variant="danger"
                      onClick={() => removeCard(cardIndex)}
                    >
                      Remove card
                    </Button>
                  </div>
                </div>
              ))}
              <Button variant="secondary" onClick={addCard}>
                Add card
              </Button>
            </div>
          </div>
        )}

        {block.type === "tab_content" && (
          <div className="stack">
            <Input
              label="Heading"
              value={(fields as any).heading || ""}
              onChange={(value) => updateField("heading", value)}
            />
            <div className="stack">
              {(fields as any).tabs?.map((tab: any, tabIndex: number) => (
                <div key={tabIndex} className="surface" style={{ padding: 12 }}>
                  <div className="stack">
                    <Input
                      label="Tab label"
                      value={tab.label || ""}
                      onChange={(value) => updateTab(tabIndex, { label: value })}
                    />
                    <Textarea
                      label="Tab content"
                      value={tab.content || ""}
                      onChange={(value) => updateTab(tabIndex, { content: value })}
                    />
                    <Button
                      variant="danger"
                      onClick={() => removeTab(tabIndex)}
                    >
                      Remove tab
                    </Button>
                  </div>
                </div>
              ))}
              <Button variant="secondary" onClick={addTab}>
                Add tab
              </Button>
            </div>
          </div>
        )}

        {block.type === "media" && (
          <div className="stack">
            <Select
              label="Media type"
              value={(fields as any).mediaType || "image"}
              onChange={(value) => updateField("mediaType", value)}
              options={[
                { value: "image", label: "Image" },
                { value: "video", label: "Video" }
              ]}
            />
            <Input
              label="Media URL"
              value={(fields as any).mediaUrl || ""}
              onChange={(value) => updateField("mediaUrl", value)}
            />
            <Textarea
              label="Caption"
              value={(fields as any).caption || ""}
              onChange={(value) => updateField("caption", value)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
