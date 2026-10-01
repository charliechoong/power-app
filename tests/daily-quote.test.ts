import test from "node:test";
import assert from "node:assert/strict";
import {
  DAILY_QUOTE_COUNT,
  getDailyQuote,
} from "../src/features/home/daily-quote";
import {
  getMindfulnessQuote,
  MINDFULNESS_QUOTE_COUNT,
} from "../src/features/home/mindfulness-quote";

test("daily quote stays stable within a Singapore day and changes at midnight", () => {
  const morning = getDailyQuote(new Date("2026-09-30T00:00:00Z"));
  const evening = getDailyQuote(new Date("2026-09-30T15:59:59Z"));
  const nextDay = getDailyQuote(new Date("2026-09-30T16:00:00Z"));

  assert.deepEqual(morning, evening);
  assert.notEqual(nextDay.text, morning.text);
  assert.notEqual(nextDay.date, morning.date);
  assert.ok(morning.prompt.endsWith("?"));
  assert.ok(nextDay.prompt.endsWith("?"));
});

test("180 distinct quotes rotate before repeating", () => {
  assert.equal(DAILY_QUOTE_COUNT, 180);
  const start = Date.UTC(2027, 0, 1, 4);
  const day = 86_400_000;
  const quotes = Array.from({ length: DAILY_QUOTE_COUNT }, (_, index) =>
    getDailyQuote(new Date(start + index * day)),
  );
  assert.equal(new Set(quotes.map((quote) => quote.text)).size, 180);
  assert.ok(quotes.every((quote) => quote.prompt.endsWith("?")));
  assert.equal(
    getDailyQuote(new Date(start + DAILY_QUOTE_COUNT * day)).text,
    quotes[0].text,
  );
});

test("today's existing quote remains unchanged during the expansion", () => {
  assert.equal(
    getDailyQuote(new Date("2026-09-30T12:00:00Z")).text,
    "Keep what teaches you; release what only weighs you down.",
  );
});

test("mindfulness quote changes at Singapore midnight and rotates through 180 original lines", () => {
  const morning = getMindfulnessQuote(new Date("2026-09-30T00:00:00Z"));
  const evening = getMindfulnessQuote(new Date("2026-09-30T15:59:59Z"));
  const nextDay = getMindfulnessQuote(new Date("2026-09-30T16:00:00Z"));
  assert.equal(morning, evening);
  assert.notEqual(nextDay, morning);
  assert.equal(MINDFULNESS_QUOTE_COUNT, 180);
  const start = Date.UTC(2027, 0, 1, 4);
  const day = 86_400_000;
  const quotes = Array.from({ length: MINDFULNESS_QUOTE_COUNT }, (_, index) =>
    getMindfulnessQuote(new Date(start + index * day)),
  );
  const mainQuotes = new Set<string>(
    Array.from(
      { length: DAILY_QUOTE_COUNT },
      (_, index) => getDailyQuote(new Date(start + index * day)).text,
    ),
  );
  assert.equal(new Set(quotes).size, MINDFULNESS_QUOTE_COUNT);
  assert.equal(
    getMindfulnessQuote(new Date(start + MINDFULNESS_QUOTE_COUNT * day)),
    quotes[0],
  );
  assert.ok(quotes.every((text) => !mainQuotes.has(text)));
});
