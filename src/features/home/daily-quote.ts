const DAILY_QUOTES = [
  "A calmer life is built one deliberate choice at a time.",
  "You do not need to carry tomorrow before it arrives.",
  "The day becomes clearer when you give your attention to one thing at a time.",
  "What you practice in small moments becomes how you meet the large ones.",
  "Rest is part of a life well lived, not a reward for finishing it.",
  "Let the things you cannot control be lighter than the things you can.",
  "A good question can open a door that certainty keeps closed.",
  "Notice what remains steady when the day changes around you.",
  "The next kind action is often close enough to take now.",
  "Progress can be quiet and still be real.",
  "You can begin again without calling yesterday a failure.",
  "Give your energy to what is yours to do today.",
  "A pause can be the most useful part of a response.",
  "The ordinary moments are not waiting for life to begin.",
  "Make room for wonder, even on a familiar path.",
  "It is enough to be honest about where you are and keep going.",
  "Choose the next right step before trying to see the whole road.",
  "A generous interpretation can change the shape of a day.",
  "Keep what teaches you; release what only weighs you down.",
  "Attention is a way of saying that this moment matters.",
  "A difficult feeling may be present without making every decision.",
  "The measure of a day is not only what you finished, but how you lived it.",
  "Practice meeting uncertainty with curiosity instead of fear.",
  "There is strength in choosing patience when haste is available.",
  "Small acts of care have a way of outlasting the moment.",
  "You can hold an ambition gently and still move toward it.",
  "Look for what this moment asks, rather than what the whole future demands.",
  "Gratitude begins by noticing what you might have walked past.",
  "The mind grows quieter when it stops arguing with what has already happened.",
  "Be willing to learn from the day you actually had.",
  "What matters most deserves some of your unhurried attention.",
] as const;

const DAY_MS = 86_400_000;
const TIME_ZONE = "Asia/Singapore";

export function getDailyQuote(now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  const dayNumber = Math.floor(
    Date.UTC(value("year"), value("month") - 1, value("day")) / DAY_MS,
  );

  return {
    text: DAILY_QUOTES[dayNumber % DAILY_QUOTES.length],
    date: new Intl.DateTimeFormat("en-SG", {
      timeZone: TIME_ZONE,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(now),
  };
}
