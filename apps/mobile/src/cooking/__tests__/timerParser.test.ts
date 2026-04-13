import { describe, it, expect } from 'vitest';
import { parseTimerPhrase } from '../timerParser';

describe('parseTimerPhrase', () => {
  it('parses "set a timer for 10 minutes" as 600000ms', () => {
    expect(parseTimerPhrase('set a timer for 10 minutes')).toBe(600_000);
  });

  it('parses "timer 5 min" as 300000ms', () => {
    expect(parseTimerPhrase('timer 5 min')).toBe(300_000);
  });

  it('parses "timer for two minutes" as 120000ms', () => {
    expect(parseTimerPhrase('timer for two minutes')).toBe(120_000);
  });

  it('parses "set timer for half an hour" as 1800000ms', () => {
    expect(parseTimerPhrase('set timer for half an hour')).toBe(1_800_000);
  });

  it('parses "set a timer for 2 and a half minutes" as 150000ms', () => {
    expect(parseTimerPhrase('set a timer for 2 and a half minutes')).toBe(150_000);
  });

  it('parses "remind me in 30 seconds" as 30000ms', () => {
    expect(parseTimerPhrase('remind me in 30 seconds')).toBe(30_000);
  });

  it('returns null for "next step"', () => {
    expect(parseTimerPhrase('next step')).toBeNull();
  });

  it('returns null for "hello world"', () => {
    expect(parseTimerPhrase('hello world')).toBeNull();
  });

  it('is case-insensitive', () => {
    expect(parseTimerPhrase('SET A TIMER FOR 10 MINUTES')).toBe(600_000);
  });

  it('returns null for empty string', () => {
    expect(parseTimerPhrase('')).toBeNull();
  });
});
