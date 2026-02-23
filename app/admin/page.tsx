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
  listWorkspaceMembers,
  upsertWorkspaceMember
} from "@/lib/services/workspaces";
import {
  listProjectsForWorkspace,
  listProjectMembersForWorkspace,
  ProjectMemberAssignment
} from "@/lib/services/projects";
import { Workspace, Project, WorkspaceMember } from "@/lib/models/types";

export default function AdminPage() {
  const router = useRouter();
  const { user, systemRole, workspaceMembership, loading } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMemberAssignment[]>(
    []
  );
  const [workspaceName, setWorkspaceName] = useState("");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"admin" | "editor" | "viewer">(
    "editor"
  );
  const [manageMemberId, setManageMemberId] = useState("");
  const [manageMemberEmail, setManageMemberEmail] = useState("");
  const [manageAssignments, setManageAssignments] = useState<
    Record<string, { enabled: boolean; role: "editor" | "viewer" }>
  >({});
  const [manageInitialAssignments, setManageInitialAssignments] = useState<
    Record<string, { role: "editor" | "viewer" }>
  >({});
  const [manageLoading, setManageLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [loadingInvite, setLoadingInvite] = useState(false);

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
    }
    loadProjects();
  }, [selectedWorkspaceId]);

  useEffect(() => {
    async function loadMembers() {
      if (!selectedWorkspaceId) return;
      const members = await listWorkspaceMembers(selectedWorkspaceId);
      setWorkspaceMembers(members);
    }
    loadMembers();
  }, [selectedWorkspaceId]);

  useEffect(() => {
    async function loadProjectMembers() {
      if (!selectedWorkspaceId || projects.length === 0) {
        setProjectMembers([]);
        return;
      }
      const assignments = await listProjectMembersForWorkspace(
        selectedWorkspaceId,
        projects
      );
      setProjectMembers(assignments);
    }
    loadProjectMembers();
  }, [selectedWorkspaceId, projects]);

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
    if (!selectedWorkspaceId || !memberEmail.trim()) {
      setStatus("Workspace and email are required.");
      return;
    }
    try {
      setLoadingInvite(true);
      setStatus("Sending invite...");
      const response = await fetch("/api/admin/create-workspace-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: memberEmail.trim(),
          workspaceId: selectedWorkspaceId,
          role: memberRole
        })
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Unable to invite member.");
      }
      setMemberEmail("");
      setStatus("Invite sent.");
      const members = await listWorkspaceMembers(selectedWorkspaceId);
      setWorkspaceMembers(members);
    } catch (error) {
      setStatus("Unable to invite member. Check permissions and try again.");
    } finally {
      setLoadingInvite(false);
    }
  }

  function getProjectCountForMember(userId: string) {
    const ids = new Set(
      projectMembers
        .filter((assignment) => assignment.userId === userId)
        .map((assignment) => assignment.projectId)
    );
    return ids.size;
  }

  function getAssignmentsForMember(userId: string) {
    return projectMembers.filter((assignment) => assignment.userId === userId);
  }

  async function handleWorkspaceRoleChange(
    member: WorkspaceMember,
    nextRole: "admin" | "editor" | "viewer"
  ) {
    if (!selectedWorkspaceId) return;
    try {
      await upsertWorkspaceMember(selectedWorkspaceId, {
        workspaceId: selectedWorkspaceId,
        userId: member.userId,
        role: nextRole,
        email: member.email,
        displayName: member.displayName,
        status: member.status,
        createdAt: member.createdAt
      });
      setStatus("Workspace role updated.");
      const members = await listWorkspaceMembers(selectedWorkspaceId);
      setWorkspaceMembers(members);
    } catch (error) {
      setStatus("Unable to update workspace role. Check permissions and try again.");
    }
  }

  function handleOpenManageProjects(member: WorkspaceMember) {
    setManageMemberId(member.userId);
    setManageMemberEmail(member.email || member.userId);
    const initialAssignments = getAssignmentsForMember(member.userId);
    const initialMap: Record<string, { role: "editor" | "viewer" }> = {};
    const nextMap: Record<
      string,
      { enabled: boolean; role: "editor" | "viewer" }
    > = {};
    projects.forEach((project) => {
      const existing = initialAssignments.find(
        (assignment) => assignment.projectId === project.id
      );
      const role =
        existing?.role === "viewer" || existing?.role === "editor"
          ? existing.role
          : "editor";
      if (existing) {
        initialMap[project.id] = { role };
      }
      nextMap[project.id] = {
        enabled: Boolean(existing),
        role
      };
    });
    setManageInitialAssignments(initialMap);
    setManageAssignments(nextMap);
  }

  function handleCloseManageProjects() {
    setManageMemberId("");
    setManageMemberEmail("");
    setManageAssignments({});
    setManageInitialAssignments({});
  }

  async function handleSaveManageProjects() {
    if (!manageMemberId || !selectedWorkspaceId) return;
    setManageLoading(true);
    setStatus("");
    try {
      for (const project of projects) {
        const current = manageAssignments[project.id];
        const initial = manageInitialAssignments[project.id];
        const isAssigned = Boolean(current?.enabled);
        const wasAssigned = Boolean(initial);
        const role = current?.role || "editor";

        if (isAssigned && !wasAssigned) {
          await fetch("/api/admin/assign-project-member", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workspaceId: selectedWorkspaceId,
              projectId: project.id,
              userId: manageMemberId,
              role
            })
          });
        } else if (!isAssigned && wasAssigned) {
          await fetch("/api/admin/remove-project-member", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workspaceId: selectedWorkspaceId,
              projectId: project.id,
              userId: manageMemberId
            })
          });
        } else if (isAssigned && wasAssigned && initial?.role !== role) {
          await fetch("/api/admin/remove-project-member", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workspaceId: selectedWorkspaceId,
              projectId: project.id,
              userId: manageMemberId
            })
          });
          await fetch("/api/admin/assign-project-member", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workspaceId: selectedWorkspaceId,
              projectId: project.id,
              userId: manageMemberId,
              role
            })
          });
        }
      }

      const assignments = await listProjectMembersForWorkspace(
        selectedWorkspaceId,
        projects
      );
      setProjectMembers(assignments);
      setStatus("Project access updated.");
      handleCloseManageProjects();
    } catch (error) {
      setStatus("Unable to update project access. Check permissions and try again.");
    } finally {
      setManageLoading(false);
    }
  }

  async function handleRemoveWorkspaceMember(member: WorkspaceMember) {
    if (!selectedWorkspaceId) return;
    const confirmRemove = window.confirm(
      `Remove ${member.email || "this user"} from the workspace?`
    );
    if (!confirmRemove) return;
    setStatus("");
    try {
      const response = await fetch("/api/admin/remove-workspace-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: selectedWorkspaceId,
          userId: member.userId
        })
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Unable to remove workspace member.");
      }
      const members = await listWorkspaceMembers(selectedWorkspaceId);
      setWorkspaceMembers(members);
      const assignments = await listProjectMembersForWorkspace(
        selectedWorkspaceId,
        projects
      );
      setProjectMembers(assignments);
      setStatus("Workspace member removed.");
    } catch (error) {
      setStatus("Unable to remove workspace member. Check permissions and try again.");
    }
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
          <div className="stack" style={{ gap: 12 }}>
            <h2>Invite member</h2>
            <Select
              label="Workspace"
              value={selectedWorkspaceId}
              onChange={setSelectedWorkspaceId}
              options={workspaces.map((workspace) => ({
                value: workspace.id,
                label: workspace.name
              }))}
            />
            <div className="row" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
              <Input
                label="Email"
                value={memberEmail}
                onChange={setMemberEmail}
                placeholder="user@example.com"
              />
              <Select
                label="Role"
                value={memberRole}
                onChange={(value) =>
                  setMemberRole(
                    value === "admin"
                      ? "admin"
                      : value === "viewer"
                        ? "viewer"
                        : "editor"
                  )
                }
                options={[
                  { value: "admin", label: "Admin" },
                  { value: "editor", label: "Editor" }
                ]}
              />
              <Button variant="primary" onClick={handleAssignWorkspaceMember}>
                {loadingInvite ? "Sending..." : "Send invite"}
              </Button>
            </div>
          </div>
        </section>

        <section className="surface" style={{ padding: 20 }}>
          <div className="stack" style={{ gap: 12 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2>Workspace members</h2>
              <span className="muted" style={{ fontSize: 12 }}>
                {workspaceMembers.length} members
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(220px, 1.4fr) 150px 120px 220px",
                gap: 12,
                alignItems: "center",
                fontSize: 12,
                color: "#7a7a7a"
              }}
            >
              <span>Email</span>
              <span>Workspace role</span>
              <span>Projects</span>
              <span>Actions</span>
            </div>
            <div className="stack" style={{ gap: 8 }}>
              {workspaceMembers.map((member) => (
                <div
                  key={member.userId}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(220px, 1.4fr) 150px 120px 220px",
                    gap: 12,
                    alignItems: "center",
                    padding: "6px 0",
                    borderTop: "1px solid #efefef"
                  }}
                >
                  <div className="stack" style={{ gap: 2 }}>
                    <span>{member.email || member.userId}</span>
                    {member.status === "invited" && (
                      <span className="muted" style={{ fontSize: 12 }}>
                        Invited
                      </span>
                    )}
                  </div>
                  <select
                    value={member.role}
                    onChange={(event) =>
                      handleWorkspaceRoleChange(
                        member,
                        event.target.value === "admin"
                          ? "admin"
                          : event.target.value === "viewer"
                            ? "viewer"
                            : "editor"
                      )
                    }
                    style={{
                      padding: "6px 8px",
                      borderRadius: 999,
                      border: "1px solid #e1e1e1",
                      background: "#ffffff",
                      color: "#1b1b1b",
                      fontSize: 12,
                      height: 30
                    }}
                  >
                    <option value="admin">Admin</option>
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <span>{getProjectCountForMember(member.userId)}</span>
                  <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => handleOpenManageProjects(member)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        border: "1px solid #e3e3e3",
                        background: "#ffffff",
                        color: "#1b1b1b",
                        fontSize: 12,
                        cursor: "pointer"
                      }}
                    >
                      Manage projects
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveWorkspaceMember(member)}
                      style={{
                        padding: 0,
                        border: "none",
                        background: "transparent",
                        color: "#a10d0d",
                        fontSize: 12,
                        cursor: "pointer"
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              {workspaceMembers.length === 0 && (
                <p className="muted">No workspace members yet.</p>
              )}
            </div>
          </div>
        </section>

        {manageMemberId && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.2)",
              display: "flex",
              justifyContent: "flex-end",
              zIndex: 50
            }}
          >
            <div
              className="stack"
              style={{
                width: 420,
                background: "#ffffff",
                height: "100%",
                padding: 20,
                gap: 16,
                boxShadow: "0 10px 30px rgba(0,0,0,0.2)"
              }}
            >
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="stack" style={{ gap: 4 }}>
                  <h3 style={{ margin: 0 }}>Manage projects</h3>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {manageMemberEmail}
                  </span>
                </div>
                <Button variant="secondary" onClick={handleCloseManageProjects}>
                  Close
                </Button>
              </div>
              <div className="stack" style={{ gap: 10, overflowY: "auto" }}>
                {projects.map((project) => {
                  const assignment = manageAssignments[project.id];
                  return (
                    <div
                      key={project.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "24px 1fr 120px",
                        gap: 12,
                        alignItems: "center"
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(assignment?.enabled)}
                        onChange={(event) =>
                          setManageAssignments((current) => ({
                            ...current,
                            [project.id]: {
                              enabled: event.target.checked,
                              role: current[project.id]?.role || "editor"
                            }
                          }))
                        }
                      />
                      <span>{project.name}</span>
                      <select
                        value={assignment?.role || "editor"}
                        disabled={!assignment?.enabled}
                        onChange={(event) =>
                          setManageAssignments((current) => ({
                            ...current,
                            [project.id]: {
                              enabled: current[project.id]?.enabled || false,
                              role:
                                event.target.value === "viewer" ? "viewer" : "editor"
                            }
                          }))
                        }
                        style={{
                          padding: "8px 10px",
                          borderRadius: 6,
                          border: "1px solid #d0d0d0",
                          background: "#ffffff",
                          color: "#1b1b1b"
                        }}
                      >
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </div>
                  );
                })}
                {projects.length === 0 && (
                  <p className="muted">No projects in this workspace yet.</p>
                )}
              </div>
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <Button variant="secondary" onClick={handleCloseManageProjects}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSaveManageProjects}
                  disabled={manageLoading}
                >
                  {manageLoading ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {status && <p className="muted">{status}</p>}
      </div>
    </AppShell>
  );
}
