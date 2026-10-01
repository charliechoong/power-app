export const PLAN_KINDS = [
  "book",
  "course",
  "question",
  "project",
  "task",
] as const;
export type PlanKind = (typeof PLAN_KINDS)[number];
export const KIND_LABELS: Record<PlanKind, string> = {
  book: "Book",
  course: "Course",
  question: "Question",
  project: "Project",
  task: "Task",
};
export const PLAN_STATUSES = ["planned", "doing", "done"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];
export const STATUS_LABELS: Record<PlanStatus, string> = {
  planned: "To do",
  doing: "In progress",
  done: "Done",
};
export type PlanInput = {
  title: string;
  kind: PlanKind;
  details: string;
  url: string;
  status: PlanStatus;
  current: number;
  target: number | null;
  unit: string;
};
export type Plan = PlanInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export function validatePlan(input: PlanInput): PlanInput {
  if (typeof input.title !== "string" || !input.title.trim())
    throw new Error("Give this plan a title.");
  if (input.title.trim().length > 300)
    throw new Error("Keep the title under 300 characters.");
  if (!PLAN_KINDS.includes(input.kind)) throw new Error("Choose a valid type.");
  if (typeof input.details !== "string" || input.details.length > 5000)
    throw new Error("Keep details under 5,000 characters.");
  if (typeof input.url !== "string" || input.url.length > 1000)
    throw new Error("Keep the link under 1,000 characters.");
  if (input.url.trim()) {
    try {
      const url = new URL(input.url.trim());
      if (url.protocol !== "https:" && url.protocol !== "http:")
        throw new Error();
    } catch {
      throw new Error("Use a full http or https link.");
    }
  }
  if (!PLAN_STATUSES.includes(input.status))
    throw new Error("Choose a valid status.");
  if (!Number.isSafeInteger(input.current) || input.current < 0)
    throw new Error("Progress must be a whole number, zero or higher.");
  if (
    input.target !== null &&
    (!Number.isSafeInteger(input.target) || input.target < 1)
  )
    throw new Error("Goal must be a positive whole number.");
  if (typeof input.unit !== "string" || input.unit.trim().length > 40)
    throw new Error("Keep the progress unit under 40 characters.");
  if (input.target === null && (input.current !== 0 || input.unit.trim()))
    throw new Error("Set a goal before tracking a number.");
  if (input.target !== null && input.current > input.target)
    throw new Error("Progress cannot exceed the goal.");
  let { status, current } = input;
  if (status === "done" && input.target !== null) current = input.target;
  else if (input.target !== null && current === input.target) status = "done";
  else if (current > 0 && status === "planned") status = "doing";
  return {
    title: input.title.trim(),
    kind: input.kind,
    details: input.details.trim(),
    url: input.url.trim(),
    status,
    current,
    target: input.target,
    unit: input.unit.trim(),
  };
}

export function parsePlan(value: unknown): Plan {
  if (!value || typeof value !== "object") throw new Error("Invalid plan.");
  const plan = value as Plan;
  if (
    typeof plan.id !== "string" ||
    !plan.id ||
    typeof plan.createdAt !== "string" ||
    !Number.isFinite(Date.parse(plan.createdAt)) ||
    typeof plan.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(plan.updatedAt))
  )
    throw new Error("Invalid plan.");
  return {
    ...validatePlan(plan),
    id: plan.id,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}

export function planPercent(plan: PlanInput): number | null {
  if (plan.status === "done") return 100;
  return plan.target === null
    ? null
    : Math.min(99, Math.floor((plan.current / plan.target) * 100));
}
