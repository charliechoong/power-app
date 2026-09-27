"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useStorageMode } from "@/lib/storage-mode";
import { cloudRequest } from "@/lib/cloud-client";
import { Icon } from "./icon";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mode = useStorageMode();
  const [logoutError, setLogoutError] = useState("");
  const sections = [
    { href: "/reflections", label: "Reflections", icon: "spark" as const },
    { href: "/reading", label: "Reading", icon: "book" as const },
    {
      href: "/settings/data",
      label: "Data & backups",
      icon: "download" as const,
    },
  ];
  const current = sections.find(
    (section) =>
      pathname === section.href || pathname.startsWith(section.href + "/"),
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <Icon name="spark" size={23} />
          </span>{" "}
          Commonplace<span className="brand-dot">.</span>
        </Link>
        <div className="sidebar-body">
          <p className="eyebrow sidebar-label">YOUR SPACE</p>
          <nav aria-label="Main navigation">
            {sections.map((section) => (
              <Link
                key={section.href}
                className="nav-link"
                href={section.href}
                aria-current={current === section ? "page" : undefined}
              >
                <Icon name={section.icon} /> {section.label}{" "}
                {current === section && <span className="nav-dot" />}
              </Link>
            ))}
          </nav>
          <div className="sidebar-note">
            <span className="little-line" />
            <p>
              A little space for
              <br />
              the things that stay.
            </p>
          </div>
        </div>
        <div className="storage-note">
          <Icon name="device" size={18} />
          <div>
            <strong>
              {mode === "cloud" ? "Private cloud storage" : "On this device"}
            </strong>
            <p>
              {mode === "cloud"
                ? "Sign in from any device"
                : "Local storage · no cloud sync"}
            </p>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            My personal space <span className="breadcrumb">/</span>{" "}
            <strong>{current?.label ?? "Commonplace"}</strong>
          </span>
          <div className="account-actions">
            <span className="local-badge">
              <span />
              {mode === "cloud" ? "PRIVATE ACCOUNT" : "LOCAL EDITION"}
            </span>
            {mode === "cloud" && (
              <button
                className="text-button"
                onClick={async () => {
                  try {
                    await cloudRequest("/api/auth/logout", "POST");
                    // Clear all in-memory private data after signing out.
                    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                    window.location.assign("/login");
                  } catch {
                    setLogoutError("Could not sign out. Try again.");
                  }
                }}
              >
                Sign out
              </button>
            )}
          </div>
        </header>
        <main id="main-content">
          {logoutError && (
            <p className="account-error" role="alert">
              {logoutError}
            </p>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
