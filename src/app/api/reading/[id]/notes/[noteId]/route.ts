import { ownerRoute, readJson, validate } from "@/lib/server/http";
import { readingServer } from "@/features/reading/server-repository";
import { validateNote } from "@/features/reading/model";
type Context = { params: Promise<{ id: string; noteId: string }> };
export async function PUT(request: Request, { params }: Context) {
  return ownerRoute(request, async (context) => {
    const { id, noteId } = await params;
    const { content } = (await readJson(request)) as { content: string };
    return readingServer(context).saveNote(
      id,
      validate(() => validateNote(content)),
      noteId,
    );
  });
}
export async function DELETE(request: Request, { params }: Context) {
  return ownerRoute(request, async (context) => {
    const { id, noteId } = await params;
    return readingServer(context).removeNote(id, noteId);
  });
}
