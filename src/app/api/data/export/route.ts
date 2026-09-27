import { ownerRoute } from "@/lib/server/http";
import { reflectionsServer } from "@/features/reflections/server-repository";
import { readingServer } from "@/features/reading/server-repository";
import { makeBackup } from "@/data-transfer/format";
export async function GET(request: Request) {
  return ownerRoute(request, async (context) => {
    const [entries, books] = await Promise.all([
      reflectionsServer(context).list(),
      readingServer(context).list(),
    ]);
    return makeBackup({ entries, books });
  });
}
