import {
  ownerRoute,
  publicReadRoute,
  readJson,
  validate,
} from "@/lib/server/http";
import { subscriptionsServer } from "@/features/subscriptions/server-repository";
import {
  validateSubscription,
  type SubscriptionInput,
} from "@/features/subscriptions/model";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  return publicReadRoute((context) => subscriptionsServer(context).get(id));
}
export async function PUT(request: Request, { params }: Context) {
  return ownerRoute(request, async (context) => {
    const { id } = await params;
    const body = await readJson(request);
    return subscriptionsServer(context).save(
      validate(() => validateSubscription(body as SubscriptionInput)),
      id,
    );
  });
}
export async function DELETE(request: Request, { params }: Context) {
  return ownerRoute(request, async (context) =>
    subscriptionsServer(context).remove((await params).id),
  );
}
