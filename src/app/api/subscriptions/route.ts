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
export async function GET() {
  return publicReadRoute((context) => subscriptionsServer(context).list());
}
export async function POST(request: Request) {
  return ownerRoute(request, async (context) => {
    const body = await readJson(request);
    return subscriptionsServer(context).save(
      validate(() => validateSubscription(body as SubscriptionInput)),
    );
  });
}
