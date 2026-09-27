import type { Entry, EntryInput } from "./model";

// This is a domain boundary, not a generic application-wide repository.
export interface ReflectionsRepository {
  list(): Promise<Entry[]>;
  save(input: EntryInput, existing?: Entry): Promise<Entry>;
  remove(id: string): Promise<void>;
}
