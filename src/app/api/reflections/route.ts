import {
  ownerRoute,
  publicReadRoute,
  readJson,
  validate,
} from "@/lib/server/http";
import { reflectionsServer } from "@/features/reflections/server-repository";
import { validateInput, type EntryInput } from "@/features/reflections/model";
export async function GET() {
  return publicReadRoute((context) => reflectionsServer(context).list());
}
export async function POST(request: Request) {
  return ownerRoute(request, async (context) => {
    const body = await readJson(request);
    return reflectionsServer(context).save(
      validate(() => validateInput(body as EntryInput)),
    );
  });
}
