import { gratitudeServer } from "@/features/gratitude/server-repository";
import { validateGratitudeInput } from "@/features/gratitude/model";
import { ownerRoute, readJson, validate } from "@/lib/server/http";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  return ownerRoute(request, async (context) => {
    const { id } = await params;
    const body = await readJson(request);
    return gratitudeServer(context).save(
      validate(() => validateGratitudeInput(body)),
      id,
    );
  });
}

export async function DELETE(request: Request, { params }: Context) {
  return ownerRoute(request, async (context) =>
    gratitudeServer(context).remove((await params).id),
  );
}
