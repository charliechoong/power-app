import { ownerRoute, readJson, validate, InputError } from "@/lib/server/http";
import { MAX_BACKUP_BYTES, parseBackups } from "@/data-transfer/format";
export async function POST(request: Request) {
  return ownerRoute(request, async ({ db }) => {
    const body = (await readJson(request, MAX_BACKUP_BYTES)) as {
      backups: unknown;
      dryRun: unknown;
    };
    if (typeof body?.dryRun !== "boolean")
      throw new InputError("Choose a preview or confirmed import.");
    const payload = validate(() => parseBackups(body.backups));
    const { data, error } = await db.rpc("import_personal_data", {
      payload,
      dry_run: body.dryRun,
    });
    if (error) throw error;
    return data;
  });
}
