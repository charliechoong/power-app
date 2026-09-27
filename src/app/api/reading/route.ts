import { ownerRoute, readJson, validate } from "@/lib/server/http";
import { readingServer } from "@/features/reading/server-repository";
import { validateBook, type BookInput } from "@/features/reading/model";
export async function GET(request: Request) {
  return ownerRoute(request, (context) => readingServer(context).list());
}
export async function POST(request: Request) {
  return ownerRoute(request, async (context) => {
    const body = await readJson(request);
    return readingServer(context).save(
      validate(() => validateBook(body as BookInput)),
    );
  });
}
