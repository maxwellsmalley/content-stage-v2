"use client";

import { AuthProvider } from "@/app/components/auth-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
