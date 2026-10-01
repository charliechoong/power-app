import { ownerRoute, readJson, validate } from "@/lib/server/http";
import {
  MAX_BACKUP_BYTES,
  parseBackups,
  verifyImport,
} from "@/data-transfer/format";
import { reflectionsServer } from "@/features/reflections/server-repository";
import { readingServer } from "@/features/reading/server-repository";
import { gratitudeServer } from "@/features/gratitude/server-repository";
import { plansServer } from "@/features/plans/server-repository";
export async function POST(request: Request) {
  return ownerRoute(request, async (context) => {
    const body = (await readJson(request, MAX_BACKUP_BYTES)) as {
      backups: unknown;
    };
    const expected = validate(() => parseBackups(body.backups));
    const [entries, books, gratitudes, plans] = await Promise.all([
      reflectionsServer(context).list(),
      readingServer(context).list(),
      gratitudeServer(context).list(),
      plansServer(context).list(),
    ]);
    return verifyImport(expected, { entries, books, gratitudes, plans });
  });
}
