export const BILLING_CYCLES = ["weekly", "monthly", "yearly"] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];
export const CYCLE_LABELS: Record<BillingCycle, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};
export const SUBSCRIPTION_STATUSES = ["active", "paused", "canceled"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
export const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: "Active",
  paused: "Paused",
  canceled: "Canceled",
};
export type SubscriptionInput = {
  name: string;
  amount: number | null;
  currency: string;
  billingCycle: BillingCycle;
  nextRenewal: string | null;
  status: SubscriptionStatus;
  url: string;
  notes: string;
};
export type Subscription = SubscriptionInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function validateSubscription(
  input: SubscriptionInput,
): SubscriptionInput {
  if (typeof input.name !== "string" || !input.name.trim())
    throw new Error("Give this subscription a name.");
  if (input.name.trim().length > 200)
    throw new Error("Keep the name under 200 characters.");
  if (
    input.amount !== null &&
    (typeof input.amount !== "number" ||
      !Number.isFinite(input.amount) ||
      input.amount < 0 ||
      input.amount > 999999.99 ||
      Math.abs(Math.round(input.amount * 100) - input.amount * 100) > 1e-7)
  )
    throw new Error("Enter a valid price with up to two decimal places.");
  if (
    typeof input.currency !== "string" ||
    !/^[A-Za-z]{3}$/.test(input.currency.trim())
  )
    throw new Error("Use a three-letter currency code, such as SGD or USD.");
  if (!BILLING_CYCLES.includes(input.billingCycle))
    throw new Error("Choose a valid billing cycle.");
  if (
    input.nextRenewal !== null &&
    (typeof input.nextRenewal !== "string" || !validDate(input.nextRenewal))
  )
    throw new Error("Enter a valid renewal date.");
  if (!SUBSCRIPTION_STATUSES.includes(input.status))
    throw new Error("Choose a valid status.");
  if (typeof input.url !== "string" || input.url.length > 1000)
    throw new Error("Keep the link under 1,000 characters.");
  if (input.url.trim()) {
    try {
      const url = new URL(input.url.trim());
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    } catch {
      throw new Error("Use a full http or https link.");
    }
  }
  if (typeof input.notes !== "string" || input.notes.length > 2000)
    throw new Error("Keep notes under 2,000 characters.");
  return {
    name: input.name.trim(),
    amount: input.amount === null ? null : Math.round(input.amount * 100) / 100,
    currency: input.currency.trim().toUpperCase(),
    billingCycle: input.billingCycle,
    nextRenewal: input.nextRenewal,
    status: input.status,
    url: input.url.trim(),
    notes: input.notes.trim(),
  };
}

export function parseSubscription(value: unknown): Subscription {
  if (!value || typeof value !== "object")
    throw new Error("Invalid subscription.");
  const item = value as Subscription;
  if (
    typeof item.id !== "string" ||
    !item.id ||
    typeof item.createdAt !== "string" ||
    !Number.isFinite(Date.parse(item.createdAt)) ||
    typeof item.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(item.updatedAt))
  )
    throw new Error("Invalid subscription.");
  return {
    ...validateSubscription(item),
    id: item.id,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function sortSubscriptions(items: Subscription[]) {
  const rank: Record<SubscriptionStatus, number> = {
    active: 0,
    paused: 1,
    canceled: 2,
  };
  return [...items].sort(
    (a, b) =>
      (a.nextRenewal ?? "9999-12-31").localeCompare(
        b.nextRenewal ?? "9999-12-31",
      ) ||
      rank[a.status] - rank[b.status] ||
      Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

export function formatPrice(item: SubscriptionInput) {
  if (item.amount === null) return "Price not set";
  return `${new Intl.NumberFormat("en-SG", { style: "currency", currency: item.currency }).format(item.amount)} / ${item.billingCycle === "yearly" ? "year" : item.billingCycle === "monthly" ? "month" : "week"}`;
}
