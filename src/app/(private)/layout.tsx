import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireOwner, AccessError } from "@/lib/server/auth";
import { storageMode } from "@/lib/server/config";

export const dynamic = "force-dynamic";

export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (storageMode() === "cloud") {
    try {
      await requireOwner();
    } catch (error) {
      if (error instanceof AccessError && error.status === 401)
        redirect("/login");
      return (
        <main className="account-page">
          <h1>Private space unavailable</h1>
          <p>
            Check your cloud configuration and account access, then try again.
          </p>
          <a className="text-button" href="/login">
            Go to sign in
          </a>
        </main>
      );
    }
  }
  return <AppShell>{children}</AppShell>;
}
