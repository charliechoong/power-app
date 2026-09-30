import test from "node:test";
import assert from "node:assert/strict";
import { getDailyQuote } from "../src/features/home/daily-quote";

test("daily quote stays stable within a Singapore day and changes at midnight", () => {
  const morning = getDailyQuote(new Date("2026-09-30T00:00:00Z"));
  const evening = getDailyQuote(new Date("2026-09-30T15:59:59Z"));
  const nextDay = getDailyQuote(new Date("2026-09-30T16:00:00Z"));

  assert.deepEqual(morning, evening);
  assert.notEqual(nextDay.text, morning.text);
  assert.notEqual(nextDay.date, morning.date);
});
