import {
  ownerRoute,
  publicReadRoute,
  readJson,
  validate,
} from "@/lib/server/http";
import { plansServer } from "@/features/plans/server-repository";
import { validatePlan, type PlanInput } from "@/features/plans/model";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  return publicReadRoute((context) => plansServer(context).get(id));
}
export async function PUT(request: Request, { params }: Context) {
  return ownerRoute(request, async (context) => {
    const { id } = await params;
    const body = await readJson(request);
    return plansServer(context).save(
      validate(() => validatePlan(body as PlanInput)),
      id,
    );
  });
}
export async function DELETE(request: Request, { params }: Context) {
  return ownerRoute(request, async (context) =>
    plansServer(context).remove((await params).id),
  );
}
