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

export default function WorkspacePage() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const { user, systemRole, workspaceMembership, loading } = useAuth();
  const [workspaceName, setWorkspaceName] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [newProjectName, setNewProjectName] = useState("");
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
      <div className="stack">
        <div className="stack">
          <h1>{workspaceName}</h1>
          <p className="muted">Projects in this workspace.</p>
        </div>

        {canCreateProject && (
          <section className="surface" style={{ padding: 20 }}>
            <div className="stack">
              <h2>Create project</h2>
              <Input
                label="Project name"
                value={newProjectName}
                onChange={setNewProjectName}
              />
              <Button variant="primary" onClick={handleCreateProject}>
                Create project
              </Button>
            </div>
          </section>
        )}

        <section className="stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>Project list</h2>
            <span className="tag">{projects.length} projects</span>
          </div>
          <div className="list">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/workspaces/${workspaceId}/projects/${project.id}`}
                className="list-item"
              >
                <strong>{project.name}</strong>
                {project.description && (
                  <p className="muted">{project.description}</p>
                )}
              </Link>
            ))}
            {projects.length === 0 && (
              <div className="list-item muted">No projects available.</div>
            )}
          </div>
        </section>

        {status && <p className="muted">{status}</p>}
      </div>
    </AppShell>
  );
}
