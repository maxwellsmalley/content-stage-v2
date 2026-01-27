"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getSystemRole } from "@/lib/services/system-roles";
import { getWorkspaceMembershipForUser } from "@/lib/services/workspaces";
import { SystemRole, WorkspaceMember } from "@/lib/models/types";
import { signOut as signOutAction } from "@/lib/services/auth";

type AuthContextValue = {
  user: User | null;
  systemRole: SystemRole | null;
  workspaceMembership: WorkspaceMember | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [systemRole, setSystemRole] = useState<SystemRole | null>(null);
  const [workspaceMembership, setWorkspaceMembership] =
    useState<WorkspaceMember | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setLoading(true);
      setUser(nextUser);
      if (!nextUser) {
        setSystemRole(null);
        setWorkspaceMembership(null);
        setLoading(false);
        return;
      }
      const [role, membership] = await Promise.all([
        getSystemRole(nextUser.uid),
        getWorkspaceMembershipForUser(nextUser.uid)
      ]);
      setSystemRole(role);
      setWorkspaceMembership(membership);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  async function handleSignOut() {
    await signOutAction();
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        systemRole,
        workspaceMembership,
        loading,
        signOut: handleSignOut
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
