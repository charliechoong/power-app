import { DataManager } from "@/data-transfer/data-manager";
import { requireOwner } from "@/lib/server/auth";
import { storageMode } from "@/lib/server/config";
import { redirect } from "next/navigation";
export const metadata = { title: "Data & backups" };
export default async function DataPage() {
  if (storageMode() === "cloud") {
    let isOwner = false;
    try {
      await requireOwner();
      isOwner = true;
    } catch {
      // The backup and import UI is never available to public readers.
    }
    if (!isOwner) redirect("/login");
  }
  return <DataManager />;
}
