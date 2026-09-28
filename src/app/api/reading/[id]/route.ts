import {
  ownerRoute,
  publicReadRoute,
  readJson,
  validate,
} from "@/lib/server/http";
import { readingServer } from "@/features/reading/server-repository";
import { validateBook, type BookInput } from "@/features/reading/model";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  return publicReadRoute(async (context) =>
    readingServer(context).get((await params).id),
  );
}
export async function PUT(request: Request, { params }: Context) {
  return ownerRoute(request, async (context) => {
    const { id } = await params;
    const body = await readJson(request);
    return readingServer(context).save(
      validate(() => validateBook(body as BookInput)),
      id,
    );
  });
}
export async function DELETE(request: Request, { params }: Context) {
  return ownerRoute(request, async (context) =>
    readingServer(context).remove((await params).id),
  );
}
