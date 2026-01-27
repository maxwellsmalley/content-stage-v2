"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "./ui";
import { useAuth } from "./auth-provider";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, workspaceMembership, systemRole, signOut } = useAuth();
  const pathname = usePathname();
  const workspaceId = workspaceMembership?.workspaceId;
  return (
    <div>
      <header
        style={{
          borderBottom: "1px solid #e4e4e4",
          background: "#ffffff"
        }}
      >
        <div
          style={{
            maxWidth: 980,
            margin: "0 auto",
            padding: "16px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16
          }}
        >
          <div className="stack" style={{ gap: 4 }}>
            <strong>Content Stage</strong>
            <span className="muted" style={{ fontSize: 12 }}>
              {systemRole?.role === "super_admin"
                ? "Super Admin"
                : workspaceMembership
                  ? `Workspace role: ${workspaceMembership.role}`
                  : "No workspace assigned"}
            </span>
          </div>
          <nav className="row" style={{ gap: 12 }}>
            {(systemRole?.role === "super_admin" ||
              workspaceMembership?.role === "admin") && (
              <Link
                href="/admin"
                style={{
                  fontSize: 14,
                  color: pathname === "/admin" ? "#111" : "#555"
                }}
              >
                Admin
              </Link>
            )}
            {workspaceId && (
              <Link
                href={`/workspaces/${workspaceId}`}
                style={{
                  fontSize: 14,
                  color: pathname?.includes("/workspaces/") ? "#111" : "#555"
                }}
              >
                Workspace
              </Link>
            )}
          </nav>
          <div className="row" style={{ gap: 12 }}>
            <span className="muted" style={{ fontSize: 13 }}>
              {user?.email || "Signed out"}
            </span>
            {user && (
              <Button variant="secondary" onClick={signOut}>
                Sign out
              </Button>
            )}
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
