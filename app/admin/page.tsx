"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { Button, Input, Select } from "@/app/components/ui";
import { useAuth } from "@/app/components/auth-provider";
import {
  createWorkspace,
  getWorkspace,
  listWorkspaces,
  upsertWorkspaceMember
} from "@/lib/services/workspaces";
import {
  listProjectsForWorkspace,
  upsertProjectMember
} from "@/lib/services/projects";
import { Workspace, Project } from "@/lib/models/types";

export default function AdminPage() {
  const router = useRouter();
  const { user, systemRole, workspaceMembership, loading } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [workspaceName, setWorkspaceName] = useState("");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState<"admin" | "user">("admin");
  const [projectMemberId, setProjectMemberId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [loading, user, router]);

  useEffect(() => {
    async function loadWorkspaces() {
      if (systemRole?.role !== "super_admin") return;
      const items = await listWorkspaces();
      setWorkspaces(items);
      if (items[0]) {
        setSelectedWorkspaceId(items[0].id);
      }
    }
    loadWorkspaces();
  }, [systemRole]);

  useEffect(() => {
    async function loadAdminWorkspace() {
      if (systemRole?.role === "super_admin") return;
      if (!workspaceMembership?.workspaceId) return;
      const workspace = await getWorkspace(workspaceMembership.workspaceId);
      if (workspace) {
        setWorkspaces([workspace]);
        setSelectedWorkspaceId(workspace.id);
      }
    }
    loadAdminWorkspace();
  }, [systemRole, workspaceMembership]);

  useEffect(() => {
    async function loadProjects() {
      if (!selectedWorkspaceId) return;
      const items = await listProjectsForWorkspace(selectedWorkspaceId);
      setProjects(items);
      if (items[0]) {
        setSelectedProjectId(items[0].id);
      }
    }
    loadProjects();
  }, [selectedWorkspaceId]);

  async function handleCreateWorkspace() {
    setStatus("");
    if (!workspaceName.trim()) {
      setStatus("Workspace name is required.");
      return;
    }
    const newId = await createWorkspace(workspaceName.trim());
    setWorkspaceName("");
    setStatus(`Workspace created: ${newId}`);
    const updated = await listWorkspaces();
    setWorkspaces(updated);
    setSelectedWorkspaceId(newId);
  }

  async function handleAssignWorkspaceMember() {
    setStatus("");
    if (!selectedWorkspaceId || !memberUserId.trim()) {
      setStatus("Workspace and user ID are required.");
      return;
    }
    try {
      setStatus("Saving workspace member...");
      await upsertWorkspaceMember(selectedWorkspaceId, {
        workspaceId: selectedWorkspaceId,
        userId: memberUserId.trim(),
        role: memberRole
      });
      setStatus("Workspace member updated.");
    } catch (error) {
      setStatus("Unable to save workspace member. Check permissions and try again.");
    }
  }

  async function handleAssignProjectMember() {
    setStatus("");
    if (!selectedWorkspaceId || !selectedProjectId || !projectMemberId.trim()) {
      setStatus("Project and user ID are required.");
      return;
    }
    await upsertProjectMember(selectedWorkspaceId, selectedProjectId, {
      userId: projectMemberId.trim(),
      assignedAt: new Date().toISOString()
    });
    setStatus("Project member assigned.");
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

  const isSuperAdmin = systemRole?.role === "super_admin";
  const isWorkspaceAdmin = workspaceMembership?.role === "admin";

  if (!isSuperAdmin && !isWorkspaceAdmin) {
    return (
      <AppShell>
        <div className="stack">
          <h1>Admin access required</h1>
          <p className="muted">
            You need Admin or Super Admin access to view this screen.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="stack">
        <div className="stack">
          <h1>Admin</h1>
          <p className="muted">
            Manage workspaces, access, and project assignments.
          </p>
        </div>

        {isSuperAdmin && (
          <section className="surface" style={{ padding: 20 }}>
            <div className="stack">
              <h2>Create workspace</h2>
              <Input
                label="Workspace name"
                value={workspaceName}
                onChange={setWorkspaceName}
              />
              <Button variant="primary" onClick={handleCreateWorkspace}>
                Create workspace
              </Button>
            </div>
          </section>
        )}

        <section className="surface" style={{ padding: 20 }}>
          <div className="stack">
            <h2>Workspace access</h2>
            <Select
              label="Workspace"
              value={selectedWorkspaceId}
              onChange={setSelectedWorkspaceId}
              options={workspaces.map((workspace) => ({
                value: workspace.id,
                label: workspace.name
              }))}
            />
            <Input
              label="User ID"
              value={memberUserId}
              onChange={setMemberUserId}
              placeholder="Firebase UID"
            />
            <Select
              label="Role"
              value={memberRole}
              onChange={(value) =>
                setMemberRole(value === "admin" ? "admin" : "user")
              }
              options={[
                { value: "admin", label: "Admin" },
                { value: "user", label: "User" }
              ]}
            />
            <Button variant="primary" onClick={handleAssignWorkspaceMember}>
              Save workspace member
            </Button>
            <p className="muted">
              TODO: Add invite flow based on email instead of raw UID.
            </p>
          </div>
        </section>

        <section className="surface" style={{ padding: 20 }}>
          <div className="stack">
            <h2>Project access</h2>
            <Select
              label="Project"
              value={selectedProjectId}
              onChange={setSelectedProjectId}
              options={projects.map((project) => ({
                value: project.id,
                label: project.name
              }))}
            />
            <Input
              label="User ID"
              value={projectMemberId}
              onChange={setProjectMemberId}
              placeholder="Firebase UID"
            />
            <Button variant="primary" onClick={handleAssignProjectMember}>
              Assign to project
            </Button>
          </div>
        </section>

        {status && <p className="muted">{status}</p>}
      </div>
    </AppShell>
  );
}
