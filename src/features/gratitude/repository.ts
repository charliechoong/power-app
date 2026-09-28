import type { GratitudeEntry, GratitudeInput } from "./model";

export interface GratitudeRepository {
  list(): Promise<GratitudeEntry[]>;
  save(
    input: GratitudeInput,
    existing?: GratitudeEntry,
  ): Promise<GratitudeEntry>;
  remove(id: string): Promise<void>;
}
