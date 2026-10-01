import type { Subscription, SubscriptionInput } from "./model";
export interface SubscriptionsRepository {
  list(): Promise<Subscription[]>;
  save(
    input: SubscriptionInput,
    existing?: Subscription,
  ): Promise<Subscription>;
  remove(id: string): Promise<void>;
}
