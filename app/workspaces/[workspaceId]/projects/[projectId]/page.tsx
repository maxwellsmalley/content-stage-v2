"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { Button, Input } from "@/app/components/ui";
import { useAuth } from "@/app/components/auth-provider";
import { exportProject } from "@/lib/services/exports";
import {
  createPage,
  deletePage,
  listPages,
  updatePageTitle
} from "@/lib/services/pages";
import { getProject, hasProjectAccess } from "@/lib/services/projects";
import {
  createFolder,
  deleteFolder,
  listFolders,
  updateFolderName
} from "@/lib/services/folders";
import { Folder, Page, PageStatus } from "@/lib/models/types";
import { IconButton, IconGlyph } from "@/app/components/icons";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function ProjectOverviewPage() {
  const params = useParams<{ workspaceId: string; projectId: string }>();
  const router = useRouter();
  const { user, systemRole, workspaceMembership, loading } = useAuth();
  const [projectName, setProjectName] = useState("");
  const [pages, setPages] = useState<Page[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [newPageTitle, setNewPageTitle] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeRenamePageId, setActiveRenamePageId] = useState<string | null>(
    null
  );
  const [activeRenameFolderId, setActiveRenameFolderId] = useState<
    string | null
  >(null);
  const [renameValue, setRenameValue] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>(
    {}
  );
  const [draggingPageId, setDraggingPageId] = useState<string | null>(null);
  const [showAddPage, setShowAddPage] = useState(false);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [status, setStatus] = useState("");
  const [loadingPages, setLoadingPages] = useState(false);
  const [hasAccess, setHasAccess] = useState(true);

  const workspaceId = params.workspaceId;
  const projectId = params.projectId;
  const isSuperAdmin = systemRole?.role === "super_admin";
  const isWorkspaceAdmin = workspaceMembership?.role === "admin";

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [loading, user, router]);

  useEffect(() => {
    async function loadProject() {
      const project = await getProject(workspaceId, projectId);
      setProjectName(project?.name || "Project");
    }
    if (workspaceId && projectId) loadProject();
  }, [workspaceId, projectId]);

  useEffect(() => {
    async function loadPages() {
      if (!workspaceId || !projectId) return;
      setLoadingPages(true);
      const items = await listPages(workspaceId, projectId);
      setPages(items);
      setLoadingPages(false);
    }
    loadPages();
  }, [workspaceId, projectId]);

  useEffect(() => {
    async function loadFolders() {
      if (!workspaceId || !projectId) return;
      const items = await listFolders(workspaceId, projectId);
      setFolders(items);
    }
    loadFolders();
  }, [workspaceId, projectId]);

  async function handleCreatePage() {
    setStatus("");
    if (!newPageTitle.trim()) {
      setStatus("Page title is required.");
      return;
    }
    await createPage(workspaceId, projectId, newPageTitle.trim());
    setNewPageTitle("");
    setShowAddPage(false);
    const updated = await listPages(workspaceId, projectId);
    setPages(updated);
  }

  async function handleCreateFolder() {
    setStatus("");
    if (!newFolderName.trim()) {
      setStatus("Folder name is required.");
      return;
    }
    await createFolder(workspaceId, projectId, newFolderName.trim());
    setNewFolderName("");
    setShowAddFolder(false);
    const updated = await listFolders(workspaceId, projectId);
    setFolders(updated);
  }

  async function handleRenamePage(pageId: string) {
    if (!renameValue.trim()) {
      setActiveRenamePageId(null);
      setRenameValue("");
      return;
    }
    await updatePageTitle(workspaceId, projectId, pageId, renameValue.trim());
    setActiveRenamePageId(null);
    setRenameValue("");
    const updated = await listPages(workspaceId, projectId);
    setPages(updated);
  }

  async function handleRenameFolder(folderId: string) {
    if (!renameValue.trim()) {
      setActiveRenameFolderId(null);
      setRenameValue("");
      return;
    }
    await updateFolderName(workspaceId, projectId, folderId, renameValue.trim());
    setActiveRenameFolderId(null);
    setRenameValue("");
    const updated = await listFolders(workspaceId, projectId);
    setFolders(updated);
  }

  async function handleDeletePage(pageId: string) {
    const confirmed = window.confirm("Delete this page? This cannot be undone.");
    if (!confirmed) return;
    await deletePage(workspaceId, projectId, pageId);
    const updated = await listPages(workspaceId, projectId);
    setPages(updated);
  }

  async function handleDeleteFolder(folderId: string) {
    const confirmed = window.confirm("Delete this folder? This cannot be undone.");
    if (!confirmed) return;
    await deleteFolder(workspaceId, projectId, folderId);
    const updated = await listFolders(workspaceId, projectId);
    setFolders(updated);
  }

  async function handleExportProject() {
    setStatus("Exporting...");
    await exportProject(workspaceId, projectId);
    setStatus("Export complete.");
  }


  useEffect(() => {
    async function checkAccess() {
      if (!user) return;
      if (isSuperAdmin || isWorkspaceAdmin) {
        setHasAccess(true);
        return;
      }
      const ok = await hasProjectAccess(workspaceId, projectId, user.uid);
      setHasAccess(ok);
    }
    if (user) checkAccess();
  }, [isSuperAdmin, isWorkspaceAdmin, workspaceId, projectId, user]);

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

  const folderCount = folders.length;
  const pageCount = pages.length;
  const pageStatusOptions = [
    { value: "all", label: "All statuses" },
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

  const foldersByParent = folders.reduce<Record<string, Folder[]>>(
    (acc, folder) => {
      const key = folder.parentId || "root";
      acc[key] = acc[key] || [];
      acc[key].push(folder);
      return acc;
    },
    {}
  );

  const pagesByFolder = pages.reduce<Record<string, Page[]>>((acc, page) => {
    const key = page.folderId || "unassigned";
    acc[key] = acc[key] || [];
    acc[key].push(page);
    return acc;
  }, {});

  function renderPages(items: Page[], indent: number, folderId?: string | null) {
    return items
      .filter((page) => statusFilter === "all" || page.status === statusFilter)
      .map((page) => (
      <div
        key={page.id}
        className="row-item"
        style={{ marginLeft: indent }}
        draggable
        onDragStart={() => setDraggingPageId(page.id)}
        onDragEnd={() => setDraggingPageId(null)}
      >
        <div className="row" style={{ gap: 12 }}>
          <span className="row-grip" title="Drag">
            <IconGlyph name="grip" />
          </span>
          {activeRenamePageId === page.id ? (
            <input
              value={renameValue}
              autoFocus
              onChange={(event) => setRenameValue(event.target.value)}
              onBlur={() => handleRenamePage(page.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleRenamePage(page.id);
                }
                if (event.key === "Escape") {
                  setActiveRenamePageId(null);
                  setRenameValue("");
                }
              }}
              style={{
                padding: "6px 8px",
                borderRadius: 6,
                border: "1px solid #d0d0d0",
                background: "#ffffff"
              }}
            />
          ) : (
            <Link
              href={`/workspaces/${workspaceId}/projects/${projectId}/pages/${page.id}`}
            >
              {page.title}
            </Link>
          )}
          <span className={`status-pill ${statusPhase(page.status)}`}>
            {formatStatus(page.status)}
          </span>
        </div>
        <div className="row-actions">
          <IconButton
            label="Rename page"
            icon="edit"
            onClick={() => {
              setActiveRenamePageId(page.id);
              setRenameValue(page.title);
            }}
          />
          <IconButton
            label="Delete page"
            icon="trash"
            tone="danger"
            onClick={() => handleDeletePage(page.id)}
          />
          <IconButton
            label="Handover view"
            icon="eye"
            onClick={() =>
              router.push(
                `/workspaces/${workspaceId}/projects/${projectId}/pages/${page.id}/handover`
              )
            }
          />
        </div>
      </div>
      ));
  }

  function renderFolder(folder: Folder, indent: number) {
    const childFolders = foldersByParent[folder.id] || [];
    const childPages = pagesByFolder[folder.id] || [];
    const isExpanded =
      expandedFolders[folder.id] === undefined
        ? true
        : expandedFolders[folder.id];
    return (
      <div key={folder.id} className="stack">
        <div
          className="row-item"
          style={{ marginLeft: indent }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={async () => {
            if (!draggingPageId) return;
            await updateDoc(
              doc(
                db,
                "workspaces",
                workspaceId,
                "projects",
                projectId,
                "pages",
                draggingPageId
              ),
              { folderId: folder.id }
            );
            setPages((current) =>
              current.map((item) =>
                item.id === draggingPageId
                  ? { ...item, folderId: folder.id }
                  : item
              )
            );
            setDraggingPageId(null);
          }}
        >
          <div className="row" style={{ gap: 8 }}>
            <span className="row-grip" title="Drag">
              <IconGlyph name="grip" />
            </span>
            <IconButton
              label={isExpanded ? "Collapse folder" : "Expand folder"}
              icon={isExpanded ? "chevron-down" : "chevron-right"}
              onClick={() =>
                setExpandedFolders((current) => ({
                  ...current,
                  [folder.id]: !isExpanded
                }))
              }
            />
            <IconGlyph name="folder" />
            {activeRenameFolderId === folder.id ? (
              <input
                value={renameValue}
                autoFocus
                onChange={(event) => setRenameValue(event.target.value)}
                onBlur={() => handleRenameFolder(folder.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleRenameFolder(folder.id);
                  }
                  if (event.key === "Escape") {
                    setActiveRenameFolderId(null);
                    setRenameValue("");
                  }
                }}
                style={{
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: "1px solid #d0d0d0",
                  background: "#ffffff"
                }}
              />
            ) : (
              <strong>{folder.name}</strong>
            )}
          </div>
          <div className="row-actions">
            <IconButton
              label="Rename folder"
              icon="edit"
              onClick={() => {
                setActiveRenameFolderId(folder.id);
                setRenameValue(folder.name);
              }}
            />
            <IconButton
              label="Delete folder"
              icon="trash"
              tone="danger"
              onClick={() => handleDeleteFolder(folder.id)}
            />
          </div>
        </div>
        {isExpanded && childPages.length > 0 && renderPages(childPages, indent + 16)}
        {isExpanded && childFolders.map((child) => renderFolder(child, indent + 16))}
      </div>
    );
  }

  function formatStatus(status: PageStatus) {
    return status
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function statusPhase(status: PageStatus) {
    if (status === "approved" || status === "ready_for_cms") return "approved";
    if (status === "done") return "completed";
    if (
      status === "ready_for_review" ||
      status === "internal_review" ||
      status === "external_review" ||
      status === "feedback_added"
    ) {
      return "review";
    }
    return "early";
  }

  return (
    <AppShell>
      <div className="stack" style={{ gap: 10 }}>
        <div className="stack" style={{ gap: 0, alignItems: "center" }}>
          <h1 style={{ textAlign: "center" }}>{projectName}</h1>
          <p className="muted" style={{ fontSize: 12, marginTop: -6 }}>
            {pageCount} pages · {folderCount} folders
          </p>
        </div>
        <div className="header-divider" />

        <section className="surface" style={{ padding: 20 }}>
          <div className="stack">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2>Contents</h2>
            </div>
            {loadingPages && <p className="muted">Loading pages...</p>}
            <div className="stack">
              <div className="row">
                <Button
                  variant="secondary"
                  onClick={() => setShowAddPage((prev) => !prev)}
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
                  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
                    <path
                      d="M6 4h8l4 4v12H6z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M14 4v4h4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>Add New Page</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
                    <path
                      d="M12 5v14M5 12h14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setShowAddFolder((prev) => !prev)}
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
                  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
                    <path
                      d="M3 7h7l2 2h9v8H3z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>Add New Folder</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
                    <path
                      d="M12 5v14M5 12h14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Button>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid #e0e0e0",
                    background: "#ffffff",
                    color: "#4b4b4b",
                    fontSize: 12
                  }}
                >
                  {pageStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              {showAddPage && (
                <div className="row row-indent" style={{ alignItems: "flex-end" }}>
                  <Input
                    label="Page title"
                    value={newPageTitle}
                    onChange={setNewPageTitle}
                  />
                  <Button variant="primary" onClick={handleCreatePage}>
                    Add
                  </Button>
                </div>
              )}
              {showAddFolder && (
                <div className="row row-indent" style={{ alignItems: "flex-end" }}>
                  <Input
                    label="Folder name"
                    value={newFolderName}
                    onChange={setNewFolderName}
                  />
                  <Button variant="primary" onClick={handleCreateFolder}>
                    Add
                  </Button>
                </div>
              )}
              <div className="stack">
                {(foldersByParent.root || []).map((folder) => renderFolder(folder, 0))}
                {pagesByFolder.unassigned && pagesByFolder.unassigned.length > 0 && (
                  <div className="stack">
                    <div
                      className="row-item"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={async () => {
                        if (!draggingPageId) return;
                        await updateDoc(
                          doc(
                            db,
                            "workspaces",
                            workspaceId,
                            "projects",
                            projectId,
                            "pages",
                            draggingPageId
                          ),
                          { folderId: null }
                        );
                        setPages((current) =>
                          current.map((item) =>
                            item.id === draggingPageId
                              ? { ...item, folderId: null }
                              : item
                          )
                        );
                        setDraggingPageId(null);
                      }}
                    >
                      <div className="row" style={{ gap: 8 }}>
                        <span className="row-grip" title="Drag">
                          <IconGlyph name="grip" />
                        </span>
                        <strong>Unassigned</strong>
                      </div>
                    </div>
                    {renderPages(pagesByFolder.unassigned, 16)}
                  </div>
                )}
                {pages.length === 0 && folders.length === 0 && (
                  <div className="muted">No pages or folders yet.</div>
                )}
              </div>
            </div>
          </div>
        </section>

        {status && <p className="muted">{status}</p>}
      </div>
    </AppShell>
  );
}
