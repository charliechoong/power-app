import { ownerRoute, readJson, validate } from "@/lib/server/http";
import { readingServer } from "@/features/reading/server-repository";
import { validateNote } from "@/features/reading/model";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, { params }: Context) {
  return ownerRoute(request, async (context) => {
    const { content } = (await readJson(request)) as { content: string };
    return readingServer(context).saveNote(
      (await params).id,
      validate(() => validateNote(content)),
    );
  });
}
