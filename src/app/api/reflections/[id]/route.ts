import { ownerRoute, readJson, validate } from "@/lib/server/http";
import { reflectionsServer } from "@/features/reflections/server-repository";
import { validateInput, type EntryInput } from "@/features/reflections/model";
type Context = { params: Promise<{ id: string }> };
export async function PUT(request: Request, { params }: Context) {
  return ownerRoute(request, async (context) => {
    const { id } = await params;
    const body = await readJson(request);
    return reflectionsServer(context).save(
      validate(() => validateInput(body as EntryInput)),
      id,
    );
  });
}
export async function DELETE(request: Request, { params }: Context) {
  return ownerRoute(request, async (context) =>
    reflectionsServer(context).remove((await params).id),
  );
}
