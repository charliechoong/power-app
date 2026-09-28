import { gratitudeServer } from "@/features/gratitude/server-repository";
import { validateGratitudeInput } from "@/features/gratitude/model";
import { ownerRoute, readJson, validate } from "@/lib/server/http";

export async function GET(request: Request) {
  return ownerRoute(request, (context) => gratitudeServer(context).list());
}

export async function POST(request: Request) {
  return ownerRoute(request, async (context) => {
    const body = await readJson(request);
    return gratitudeServer(context).save(
      validate(() => validateGratitudeInput(body)),
    );
  });
}
