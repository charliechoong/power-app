import { ownerRoute } from "@/lib/server/http";
import { reflectionsServer } from "@/features/reflections/server-repository";
import { readingServer } from "@/features/reading/server-repository";
import { gratitudeServer } from "@/features/gratitude/server-repository";
import { makeBackup } from "@/data-transfer/format";
export async function GET(request: Request) {
  return ownerRoute(request, async (context) => {
    const [entries, books, gratitudes] = await Promise.all([
      reflectionsServer(context).list(),
      readingServer(context).list(),
      gratitudeServer(context).list(),
    ]);
    return makeBackup({ entries, books, gratitudes });
  });
}
