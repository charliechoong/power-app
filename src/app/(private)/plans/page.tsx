import { PlansWorkspace } from "@/features/plans";
import { SubscriptionsWorkspace } from "@/features/subscriptions";
export const metadata = { title: "Plans" };
export default function PlansPage() {
  return (
    <>
      <PlansWorkspace />
      <SubscriptionsWorkspace />
    </>
  );
}
