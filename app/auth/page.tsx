"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, register } from "@/lib/services/auth";
import { Button, Input } from "@/app/components/ui";
import { useAuth } from "@/app/components/auth-provider";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function AuthPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

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

  async function handleForgotPassword() {
    setResetMessage("");
    setResetError("");
    if (!email.trim()) {
      setResetError("Enter your email to reset your password.");
      return;
    }
    try {
      setResetLoading(true);
      await sendPasswordResetEmail(auth, email.trim());
      setResetMessage("Password reset email sent. Check your inbox.");
    } catch (err) {
      setResetError("Unable to send reset email. Check the address and try again.");
    } finally {
      setResetLoading(false);
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
          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={resetLoading}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              color: "#1b1b1b",
              fontSize: 13,
              textDecoration: "underline",
              alignSelf: "flex-start",
              cursor: resetLoading ? "default" : "pointer",
              textAlign: "left"
            }}
          >
            {resetLoading ? "Sending reset email..." : "Forgot password?"}
          </button>
          {resetMessage && <p style={{ color: "#1b5e20" }}>{resetMessage}</p>}
          {resetError && <p style={{ color: "#a10d0d" }}>{resetError}</p>}
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
