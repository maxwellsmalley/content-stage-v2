"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/app/components/app-shell";
import { Button, Input } from "@/app/components/ui";
import { useAuth } from "@/app/components/auth-provider";
import {
  createProject,
  listProjectsForUser,
  listProjectsForWorkspace
} from "@/lib/services/projects";
import { getWorkspace } from "@/lib/services/workspaces";
import { Project } from "@/lib/models/types";
import { listPages } from "@/lib/services/pages";
import { listFolders } from "@/lib/services/folders";

export default function WorkspacePage() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const { user, systemRole, workspaceMembership, loading } = useAuth();
  const [workspaceName, setWorkspaceName] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [newProjectName, setNewProjectName] = useState("");
  const [showAddProject, setShowAddProject] = useState(false);
  const [projectStats, setProjectStats] = useState<
    Record<string, { pages: number; folders: number }>
  >({});
  const [status, setStatus] = useState("");

  const workspaceId = params.workspaceId;

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [loading, user, router]);

  useEffect(() => {
    async function loadWorkspace() {
      const workspace = await getWorkspace(workspaceId);
      setWorkspaceName(workspace?.name || "Workspace");
    }
    if (workspaceId) loadWorkspace();
  }, [workspaceId]);

  useEffect(() => {
    async function loadProjects() {
      if (!user) return;
      const isAdmin =
        systemRole?.role === "super_admin" ||
        workspaceMembership?.role === "admin";
      const items = isAdmin
        ? await listProjectsForWorkspace(workspaceId)
        : await listProjectsForUser(workspaceId, user.uid);
      setProjects(items);
    }
    if (workspaceId && user) loadProjects();
  }, [workspaceId, user, systemRole, workspaceMembership]);

  useEffect(() => {
    async function loadStats() {
      if (!workspaceId || projects.length === 0) return;
      const stats: Record<string, { pages: number; folders: number }> = {};
      for (const project of projects) {
        const [pages, folders] = await Promise.all([
          listPages(workspaceId, project.id),
          listFolders(workspaceId, project.id)
        ]);
        stats[project.id] = { pages: pages.length, folders: folders.length };
      }
      setProjectStats(stats);
    }
    loadStats();
  }, [workspaceId, projects]);

  async function handleCreateProject() {
    setStatus("");
    if (!newProjectName.trim()) {
      setStatus("Project name is required.");
      return;
    }
    await createProject(workspaceId, newProjectName.trim());
    setNewProjectName("");
    setStatus("Project created.");
    const updated = await listProjectsForWorkspace(workspaceId);
    setProjects(updated);
  }

  if (loading) {
    return (
      <AppShell>
        <div>Loading...</div>
      </AppShell>
    );
  }

  const isSuperAdmin = systemRole?.role === "super_admin";
  const hasWorkspaceAccess =
    isSuperAdmin || workspaceMembership?.workspaceId === workspaceId;

  if (!hasWorkspaceAccess) {
    return (
      <AppShell>
        <div className="stack">
          <h1>Workspace access required</h1>
          <p className="muted">
            You do not have access to this workspace.
          </p>
        </div>
      </AppShell>
    );
  }

  const canCreateProject =
    isSuperAdmin || workspaceMembership?.role === "admin";

  return (
    <AppShell>
      <div className="stack" style={{ gap: 12 }}>
        <div className="stack" style={{ gap: 6 }}>
          <h1>{workspaceName}</h1>
          <p className="muted">
            This workspace includes {projects.length} projects.
          </p>
        </div>
        <div className="header-divider" />

        <section className="stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>Projects</h2>
            {canCreateProject && (
              <Button
                variant="secondary"
                onClick={() => setShowAddProject((prev) => !prev)}
              >
                Add project
              </Button>
            )}
          </div>
          {showAddProject && canCreateProject && (
            <div className="row" style={{ alignItems: "flex-end" }}>
              <Input
                label="Project name"
                value={newProjectName}
                onChange={setNewProjectName}
              />
              <Button variant="primary" onClick={handleCreateProject}>
                Add
              </Button>
            </div>
          )}
          <div className="stack">
            {projects.map((project) => {
              const stats = projectStats[project.id];
              return (
                <div
                  key={project.id}
                  className="project-row"
                  onClick={() =>
                    router.push(`/workspaces/${workspaceId}/projects/${project.id}`)
                  }
                >
                  <div className="stack" style={{ gap: 4 }}>
                    <strong>{project.name}</strong>
                    <span className="project-meta">
                      {stats
                        ? `${stats.pages} pages · ${stats.folders} folders`
                        : "Loading project details..."}
                    </span>
                  </div>
                </div>
              );
            })}
            {projects.length === 0 && (
              <div className="row-item muted">No projects yet.</div>
            )}
          </div>
        </section>

        {status && <p className="muted">{status}</p>}
      </div>
    </AppShell>
  );
}
