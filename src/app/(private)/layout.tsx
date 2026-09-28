import { AppShell } from "@/components/app-shell";
import { requireOwner } from "@/lib/server/auth";
import { storageMode } from "@/lib/server/config";
import { EditAccessProvider } from "@/lib/edit-access";

export const dynamic = "force-dynamic";

export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let canEdit = storageMode() === "local";
  if (!canEdit) {
    try {
      await requireOwner();
      canEdit = true;
    } catch {
      // Visitors can read public content; only a verified owner can edit.
    }
  }
  return (
    <EditAccessProvider canEdit={canEdit}>
      <AppShell>{children}</AppShell>
    </EditAccessProvider>
  );
}
