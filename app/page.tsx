"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/components/auth-provider";

export default function HomePage() {
  const { user, systemRole, workspaceMembership, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/auth");
      return;
    }
    if (systemRole?.role === "super_admin") {
      router.replace("/admin");
      return;
    }
    if (workspaceMembership?.workspaceId) {
      router.replace(`/workspaces/${workspaceMembership.workspaceId}`);
      return;
    }
  }, [loading, user, systemRole, workspaceMembership, router]);

  if (loading) {
    return <main className="stack">Loading...</main>;
  }

  if (!user) {
    return <main className="stack">Redirecting to sign in...</main>;
  }

  if (!workspaceMembership && systemRole?.role !== "super_admin") {
    return (
      <main className="stack">
        <h1>Workspace access required</h1>
        <p className="muted">
          You are signed in, but no workspace has been assigned to your account.
          Contact an Admin or Super Admin for access.
        </p>
      </main>
    );
  }

  return <main className="stack">Loading workspace...</main>;
}
