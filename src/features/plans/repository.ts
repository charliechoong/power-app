import type { Plan, PlanInput } from "./model";
export interface PlansRepository {
  list(): Promise<Plan[]>;
  save(input: PlanInput, existing?: Plan): Promise<Plan>;
  remove(id: string): Promise<void>;
}
