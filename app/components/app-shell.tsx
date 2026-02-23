"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "./ui";
import { useAuth } from "./auth-provider";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, workspaceMembership, systemRole, signOut } = useAuth();
  const workspaceId = workspaceMembership?.workspaceId;
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const pathname = usePathname();
  const hideBackToWorkspace = Boolean(pathname?.match(/^\/workspaces\/[^/]+$/));

  const userEmail = useMemo(() => user?.email || "Signed out", [user?.email]);
  return (
    <div>
      <header
        style={{
          borderBottom: "1px solid #e4e4e4",
          background: "#ffffff"
        }}
      >
        <div className="app-shell-header">
          <div className="row" style={{ gap: 12 }}>
            {!hideBackToWorkspace && (
              <Link
                href={workspaceId ? `/workspaces/${workspaceId}` : "/"}
                className="row"
                style={{
                  gap: 8,
                  border: "1px solid #e0e0e0",
                  borderRadius: 999,
                  padding: "6px 10px"
                }}
              >
                <ArrowLeft />
                <span style={{ fontSize: 12 }}>Back to workspace</span>
              </Link>
            )}
            <strong style={{ fontSize: 15 }}>Content Stage</strong>
          </div>
          <div className="row" style={{ gap: 12, alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((open) => !open)}
                style={{
                  border: "1px solid #e0e0e0",
                  background: "#ffffff",
                  borderRadius: 999,
                  padding: "6px 10px",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  minHeight: 32,
                  cursor: "pointer"
                }}
              >
                <UserIcon />
                <span style={{ fontSize: 13, color: "#2f2f2f" }}>{userEmail}</span>
                <ChevronDown />
              </button>
              {userMenuOpen && (
                <div
                  className="surface"
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 44,
                    minWidth: 180,
                    padding: 8
                  }}
                >
                  <div className="stack" style={{ gap: 6 }}>
                    {(systemRole?.role === "super_admin" ||
                      workspaceMembership?.role === "admin") && (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setUserMenuOpen(false);
                          window.location.href = "/admin";
                        }}
                      >
                        Admin
                      </Button>
                    )}
                    <Button variant="secondary" onClick={signOut}>
                      Sign out
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

function ArrowLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M15 6l-6 6 6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 20a8 8 0 0 1 16 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M6 9l6 6 6-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

