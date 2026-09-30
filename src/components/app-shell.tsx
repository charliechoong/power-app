"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useStorageMode } from "@/lib/storage-mode";
import { useCanEdit } from "@/lib/edit-access";
import { cloudRequest } from "@/lib/cloud-client";
import { Icon } from "./icon";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mode = useStorageMode();
  const canEdit = useCanEdit();
  const [logoutError, setLogoutError] = useState("");
  const sections = [
    { href: "/", label: "Home", icon: "home" as const },
    { href: "/reflections", label: "Reflections", icon: "spark" as const },
    { href: "/reading", label: "Reading", icon: "book" as const },
    { href: "/gratitude", label: "Gratitude", icon: "heart" as const },
    ...(canEdit
      ? [
          {
            href: "/settings/data",
            label: "Data & backups",
            icon: "download" as const,
          },
        ]
      : []),
  ];
  const current = sections.find(
    (section) =>
      pathname === section.href ||
      (section.href !== "/" && pathname.startsWith(section.href + "/")),
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
              {mode === "local"
                ? "On this device"
                : canEdit
                  ? "Owner account"
                  : "Public collection"}
            </strong>
            <p>
              {mode === "local"
                ? "Local storage · no cloud sync"
                : canEdit
                  ? "Only you can edit"
                  : "Read reflections, books and gratitude"}
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
              {mode === "local"
                ? "LOCAL EDITION"
                : canEdit
                  ? "OWNER"
                  : "PUBLIC VIEW"}
            </span>
            {mode === "cloud" && !canEdit && (
              <Link className="text-button" href="/login">
                Owner sign in
              </Link>
            )}
            {mode === "cloud" && canEdit && (
              <button
                className="text-button"
                onClick={async () => {
                  try {
                    await cloudRequest("/api/auth/logout", "POST");
                    // Clear owner-only UI state after signing out.
                    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                    window.location.assign("/reflections");
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
