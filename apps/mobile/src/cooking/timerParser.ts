/**
 * Natural-language timer phrase parser.
 *
 * Pure function — no I/O, no mocks. Runs on every final STT transcript as part
 * of the local intent router (Pattern 3/4 from 09-RESEARCH.md). Hitting this
 * path instead of Claude is what makes VOIC-07 (<1s voice response) achievable.
 */

const UNIT_MS: Record<string, number> = {
  second: 1000,
  seconds: 1000,
  sec: 1000,
  secs: 1000,
  s: 1000,
  minute: 60_000,
  minutes: 60_000,
  min: 60_000,
  mins: 60_000,
  m: 60_000,
  hour: 3_600_000,
  hours: 3_600_000,
  hr: 3_600_000,
  hrs: 3_600_000,
  h: 3_600_000,
};

const WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  sixty: 60,
  half: 0.5,
};

// Gatekeeper — cheap bail-out for transcripts that clearly aren't timer phrases.
// Matches "timer" OR "remind" OR "set/in ... <unit>" so "remind me in 30 seconds"
// and "set a timer for 2 minutes" both get through while "next step" does not.
const TIMER_GATE =
  /\btimer\b|\bremind\b|\b(?:set|in|for)\b[^]*\b(?:second|seconds|sec|secs|minute|minutes|min|mins|hour|hours|hr|hrs)\b/i;

// Core matcher: <number|word> [and a half] <unit>
const DURATION_RE =
  /(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|sixty|half)\s*(?:and a half\s*)?(?:an?\s+)?(second|seconds|sec|secs|minute|minutes|min|mins|hour|hours|hr|hrs)/i;

export function parseTimerPhrase(transcript: string): number | null {
  if (!transcript) return null;
  const t = transcript.toLowerCase();
  if (!TIMER_GATE.test(t)) return null;

  const m = t.match(DURATION_RE);
  if (!m) return null;

  const rawNum = m[1].toLowerCase();
  const rawUnit = m[2].toLowerCase();
  const n = WORDS[rawNum] ?? Number(rawNum);
  if (Number.isNaN(n)) return null;
  const unit = UNIT_MS[rawUnit];
  if (!unit) return null;

  const half = /\band a half\b/i.test(t) && rawNum !== 'half' ? unit / 2 : 0;
  return n * unit + half;
}
