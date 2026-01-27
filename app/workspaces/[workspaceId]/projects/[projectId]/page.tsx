"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { Button, Input, Select } from "@/app/components/ui";
import { useAuth } from "@/app/components/auth-provider";
import { exportProject } from "@/lib/services/exports";
import { createPage, listPages, updatePageStatus } from "@/lib/services/pages";
import { getProject, hasProjectAccess } from "@/lib/services/projects";
import { Page, PageStatus } from "@/lib/models/types";

export default function ProjectOverviewPage() {
  const params = useParams<{ workspaceId: string; projectId: string }>();
  const router = useRouter();
  const { user, systemRole, workspaceMembership, loading } = useAuth();
  const [projectName, setProjectName] = useState("");
  const [pages, setPages] = useState<Page[]>([]);
  const [newPageTitle, setNewPageTitle] = useState("");
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

  async function handleCreatePage() {
    setStatus("");
    if (!newPageTitle.trim()) {
      setStatus("Page title is required.");
      return;
    }
    await createPage(workspaceId, projectId, newPageTitle.trim());
    setNewPageTitle("");
    const updated = await listPages(workspaceId, projectId);
    setPages(updated);
  }

  async function handleExportProject() {
    setStatus("Exporting...");
    await exportProject(workspaceId, projectId);
    setStatus("Export complete.");
  }

  async function handleStatusChange(pageId: string, nextStatus: PageStatus) {
    await updatePageStatus(workspaceId, projectId, pageId, nextStatus);
    const updated = await listPages(workspaceId, projectId);
    setPages(updated);
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

  return (
    <AppShell>
      <div className="stack">
        <div className="stack">
          <h1>{projectName}</h1>
          <p className="muted">Project overview and pages.</p>
        </div>

        <section className="surface" style={{ padding: 20 }}>
          <div className="stack">
            <h2>Create page</h2>
            <Input
              label="Page title"
              value={newPageTitle}
              onChange={setNewPageTitle}
            />
            <Button variant="primary" onClick={handleCreatePage}>
              Create page
            </Button>
          </div>
        </section>

        <section className="surface" style={{ padding: 20 }}>
          <div className="stack">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2>Pages</h2>
              <Button variant="secondary" onClick={handleExportProject}>
                Export project
              </Button>
            </div>
            {loadingPages && <p className="muted">Loading pages...</p>}
            <div className="list">
              {pages.map((page) => (
                <div key={page.id} className="list-item">
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <Link
                      href={`/workspaces/${workspaceId}/projects/${projectId}/pages/${page.id}`}
                    >
                      <strong>{page.title}</strong>
                    </Link>
                    <Select
                      label=""
                      value={page.status}
                      onChange={(value) =>
                        handleStatusChange(page.id, value as PageStatus)
                      }
                      options={[
                        { value: "draft", label: "Draft" },
                        { value: "in_review", label: "In review" },
                        { value: "approved", label: "Approved" }
                      ]}
                    />
                  </div>
                </div>
              ))}
              {pages.length === 0 && (
                <div className="list-item muted">No pages yet.</div>
              )}
            </div>
          </div>
        </section>

        {status && <p className="muted">{status}</p>}
      </div>
    </AppShell>
  );
}
