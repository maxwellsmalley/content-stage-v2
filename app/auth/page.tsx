"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, register } from "@/lib/services/auth";
import { Button, Input } from "@/app/components/ui";
import { useAuth } from "@/app/components/auth-provider";

export default function AuthPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
      router.replace("/");
    } catch (err) {
      setError("Unable to sign in. Check your credentials and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    setError("");
    setLoading(true);
    try {
      await register(email, password);
      router.replace("/");
    } catch (err) {
      setError("Unable to create account. Check your details and try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user) {
      router.replace("/");
    }
  }, [user, router]);

  return (
    <main className="stack">
      <div className="stack">
        <h1>Sign in</h1>
        <p className="muted">
          Content Stage uses Firebase Authentication. Use your workspace email.
        </p>
      </div>

      <div className="surface" style={{ padding: 20 }}>
        <div className="stack">
          <Input
            label="Email"
            value={email}
            onChange={setEmail}
            placeholder="you@company.com"
            type="email"
          />
          <Input
            label="Password"
            value={password}
            onChange={setPassword}
            placeholder="Password"
            type="password"
          />
          {error && <p style={{ color: "#a10d0d" }}>{error}</p>}
          <div className="row">
            <Button variant="primary" onClick={handleSignIn} disabled={loading}>
              Sign in
            </Button>
            <Button variant="secondary" onClick={handleRegister} disabled={loading}>
              Create account
            </Button>
          </div>
        </div>
      </div>

      <p className="muted">
        TODO: Define the official onboarding workflow for new accounts.
      </p>
    </main>
  );
}
