import {
  ownerRoute,
  publicReadRoute,
  readJson,
  validate,
} from "@/lib/server/http";
import { plansServer } from "@/features/plans/server-repository";
import { validatePlan, type PlanInput } from "@/features/plans/model";
export async function GET() {
  return publicReadRoute((context) => plansServer(context).list());
}
export async function POST(request: Request) {
  return ownerRoute(request, async (context) => {
    const body = await readJson(request);
    return plansServer(context).save(
      validate(() => validatePlan(body as PlanInput)),
    );
  });
}
