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
  const statusCounts = pages.reduce(
    (acc, page) => {
      acc[page.status] += 1;
      return acc;
    },
    { draft: 0, in_review: 0, approved: 0 } as Record<PageStatus, number>
  );

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
    return items.map((page) => (
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
          <span className={`tag status-${page.status}`}>
            {page.status.replace("_", " ")}
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

  return (
    <AppShell>
      <div className="stack" style={{ gap: 12 }}>
        <div className="stack" style={{ gap: 6 }}>
          <h1>{projectName}</h1>
          <p className="muted">
            This project includes {pageCount} pages across {folderCount} folders.
            {` `}Draft {statusCounts.draft}, in review {statusCounts.in_review},
            approved {statusCounts.approved}.
          </p>
        </div>
        <div className="header-divider" />

        <section className="surface" style={{ padding: 20 }}>
          <div className="stack">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2>Contents</h2>
              <Button variant="secondary" onClick={handleExportProject}>
                Export project
              </Button>
            </div>
            {loadingPages && <p className="muted">Loading pages...</p>}
            <div className="stack">
              <div className="row">
                <Button
                  variant="secondary"
                  onClick={() => setShowAddPage((prev) => !prev)}
                >
                  Add new page
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setShowAddFolder((prev) => !prev)}
                >
                  Add folder
                </Button>
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
