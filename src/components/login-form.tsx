"use client";
import { useState } from "react";
export function LoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="account-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        const form = new FormData(event.currentTarget);
        setBusy(true);
        setError("");
        try {
          const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: form.get("email"),
              password: form.get("password"),
            }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error);
          // A full navigation discards the previous account's client/router state.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign("/reflections");
        } catch (error) {
          setError(
            error instanceof Error
              ? error.message
              : "Sign in failed. Please try again.",
          );
          setBusy(false);
        }
      }}
    >
      <label>
        Email
        <input
          type="email"
          name="email"
          autoComplete="username"
          required
          disabled={busy}
        />
      </label>
      <label>
        Password
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          disabled={busy}
        />
      </label>
      <button className="button primary" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
      {error && (
        <p role="alert" className="account-error">
          {error}
        </p>
      )}
    </form>
  );
}
