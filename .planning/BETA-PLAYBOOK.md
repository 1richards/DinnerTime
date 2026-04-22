# BETA-PLAYBOOK.md — Private Beta Runbook

**Audience:** Patrick (human executor).
**Purpose:** Day 0 through week 2+ playbook for running the DinnerTime private beta (5–15 family + friends + cooking friends, TestFlight).
**Cross-links:** [RELEASE.md](./RELEASE.md) (TestFlight upload flow), [DEPLOYMENT.md](./DEPLOYMENT.md) (backend backing the app).
**Addresses:** BETA-13.

---

## 1. Invite list target

**Target: 5–15 users.** Don't overshoot — more users ≠ more signal; it just multiplies the check-in workload.

Suggested composition (pick from the people already in your orbit — don't recruit strangers for MVP):

| Cohort | Suggested count | Why |
|---|---|---|
| Household | 2 | Captive audience; real daily usage; observed in-person. |
| Family (parents, siblings) | 3–5 | Varied tech comfort; honest feedback; motivated to help. |
| Cooking friends | 3–5 | Will actually cook from suggestions; compare to how they cook today. |
| Non-cooks | 1–3 | Stress-test the "what should I cook?" value prop on people who hate deciding. |

**Hard cap: 25.** Apple's Internal TestFlight group maxes at 25 testers. Phase 25 default is **Internal TestFlight cap 15** — keeps App Review out of the loop entirely and lets you push new builds instantly. See [RELEASE.md](./RELEASE.md) § 1 for TestFlight Internal vs External tradeoff.

---

## 2. Invite list template

Track invites in Supabase's `beta_invites` table (shipped in migration `00029_beta_invites.sql`). Patrick manages the list via SQL; there is no admin UI in Phase 25 (deliberate — see CONTEXT.md).

Draft the list in CSV first so you can edit in a spreadsheet:

```csv
email,invited_by,status,invited_at,onboarded_at,first_scan_at,first_cook_at,last_checkin_at,notes
alice@example.com,<YOUR_UUID>,invited,2026-04-22T10:00Z,,,,,"friend from college"
bob@example.com,<YOUR_UUID>,invited,2026-04-22T10:00Z,,,,,"sister"
charlie@example.com,<YOUR_UUID>,invited,2026-04-22T10:00Z,,,,,"cooking friend"
```

Status values (exactly, CHECK-constrained in migration 00029):
- `invited` — sent TestFlight invite, not yet opened app.
- `onboarded` — launched app, completed onboarding.
- `first_scan` — completed first pantry scan.
- `first_cook` — marked first recipe cooked.
- `week_1_checkin` — responded to day-7 check-in message.
- `lapsed` — no activity 14+ days after invite.

Find your own UUID (reused as `invited_by` for every row):

```sql
select id from auth.users where email = 'patrickrrichards@gmail.com';
```

Then bulk INSERT from the CSV:

```sql
INSERT INTO beta_invites (email, invited_by, status, notes) VALUES
  ('alice@example.com',   '<YOUR_UUID>', 'invited', 'friend from college'),
  ('bob@example.com',     '<YOUR_UUID>', 'invited', 'sister'),
  ('charlie@example.com', '<YOUR_UUID>', 'invited', 'cooking friend');
```

`invited_at` defaults to `now()` — no need to pass it unless backfilling.

---

## 3. Welcome email template

Paste the TestFlight invite URL from ASC → TestFlight → Public Link (or per-user invite) into the `<TESTFLIGHT_URL>` placeholder. Keep the tone personal — family/friends opt in because of *you*, not the app.

```
Subject: DinnerTime beta — would love your feedback

Hey <NAME>,

I've been building DinnerTime, an iPhone app that answers "what should we
cook tonight?" by looking at what's actually in your fridge. Snap a photo,
get dinner ideas, tap one to plan, tap again for the grocery list. The
goal is zero mental effort between opening the fridge and eating dinner.

I'm starting a small private beta this week and I'd love for you to be on
it. Here's what I'd need from you, honestly:

1. 10 minutes the first night — install via TestFlight, create an account,
   scan your pantry once, try a suggestion. That's it.
2. Any bugs you hit, please use Settings → Send feedback in the app. That
   sends me the context I need to fix it. Or just text me.
3. (Optional, week 2) A 20-min call where I watch you use it and you tell
   me what's dumb. This is the single most valuable thing you can do.

TestFlight install (iPhone only, iOS 17+):
  1. Install the TestFlight app from the App Store (if you don't have it).
  2. Tap this link on your iPhone: <TESTFLIGHT_URL>
  3. Accept the invite. DinnerTime will install alongside your other apps.

If DinnerTime isn't for you — totally fine, just reply "no thanks" and I'll
take you off the list. No hard feelings, no follow-ups.

Thanks for being on this with me.

— Patrick
```

---

## 4. Onboarding observation script (BETA-06 protocol)

This is the single highest-signal activity in the whole beta. Schedule it for week 2 of each tester's participation (give them time to form real impressions first). Budget 20 min. No substitute for watching someone use the thing.

**Pre-test (2 min):**
- Tester sits with iPhone.
- Confirm TestFlight install worked.
- Ask them to silence notifications.
- Start QuickTime iOS screen recording (connect iPhone → QuickTime → New Movie Recording → select iPhone as source → Record). Tell the tester you're recording; offer to delete after.
- Script: *"I'm going to give you a task and watch without helping. There's no wrong answer — if something confuses you, that's me failing, not you. Talk out loud about what you're doing and what you expect."*

**Test (15 min):**

Protocol — do NOT help unless they're fully stuck (>60s frustrated):

| Step | Task | Observe |
|---|---|---|
| 1 | "Launch DinnerTime and get to the home screen." | Sign up vs sign in friction; onboarding drop-offs; permission prompts. |
| 2 | "Add what's in your fridge right now." | Do they find /scan? Do they understand what the photo is for? What do they do when Claude misreads an item? |
| 3 | "Find something to cook tonight." | Do they tap Home? Suggestions? Do they understand the tabs? |
| 4 | "Pick one of those dinners and plan it for tonight." | Do they understand the day picker? Do they hit the "+ plan" affordance? |
| 5 | "What would you need to buy to make this?" | Do they find the shopping handoff? Do they understand Instacart link vs an in-app cart? |
| 6 (optional) | "Pretend you're cooking this recipe and you want hands-free help." | Do they discover voice mode? Does it actually work for them? |

**Post-test (3 min) — open questions, verbatim answers:**
- "Where did you get stuck?"
- "What did you expect to happen that didn't?"
- "Would you open this app again tomorrow? Why or why not?"
- "What one thing would make you keep using it past the beta?"
- "What felt good?"

Log verbatim answers in a Google Doc or Notion page named `beta-obs-{email}-{YYYY-MM-DD}`. Do NOT summarize during the test — quote, don't interpret. Summarization happens at Friday triage.

---

## 5. Check-in schedule

Don't overwhelm testers. One touchpoint per week is the sweet spot.

| Day | Channel | Message | Goal |
|---|---|---|---|
| Day 1 | DM / group chat | "Did TestFlight work?" | Install friction / auth issues / onboarding abandon. |
| Day 3 | DM | "Any first reactions? No wrong answers." | Soft-signal read (love/meh/hate) before usage biases set in. |
| Day 7 | DM | "Cooked from a suggestion yet? What happened?" | Usage signal — separates "tried once" from "actually using". |
| Week 2 | DM | "Up for a 20-min call this week? I'd love to watch you use it and hear what sucks." | Schedule § 4 Observation Script. |
| Week 4 | DM | "Still opening it? Be honest." | Retention + roadmap input. |

**Don't add notifications, email blasts, or auto-reminders.** These people opted into doing a favor for you, not becoming power users. Respect the minimum-viable-contact cadence.

---

## 6. SQL queries for status tracking

All queries target Supabase prod via the SQL editor (`supabase.com/dashboard/.../sql/new`) or `psql` if you've set up a direct connection. Each block is copy-pasteable.

### 6.1 List all invites + status (most recent first)

```sql
select email, status, invited_at, onboarded_at, first_scan_at, first_cook_at, last_checkin_at, notes
from public.beta_invites
order by invited_at desc;
```

### 6.2 Mark a tester onboarded

Run after a tester reports they created an account and opened the home screen.

```sql
update public.beta_invites
set status = 'onboarded',
    onboarded_at = now()
where email = 'alice@example.com';
```

### 6.3 Mark first scan completed

Run after the tester completes their first `/scan`. Cross-reference Sentry breadcrumbs or Supabase `scan_events` table for timestamp:

```sql
select profile_id, created_at
from public.scan_events
where profile_id = (select id from auth.users where email = 'alice@example.com')
order by created_at asc
limit 1;
```

Then:

```sql
update public.beta_invites
set status = 'first_scan',
    first_scan_at = now()
where email = 'alice@example.com';
```

### 6.4 Mark first cook completed

Run after `cooking_events` shows the first marked-cooked row:

```sql
select profile_id, created_at
from public.cooking_events
where event_type = 'cook_completed'
  and profile_id = (select id from auth.users where email = 'alice@example.com')
order by created_at asc
limit 1;
```

Then:

```sql
update public.beta_invites
set status = 'first_cook',
    first_cook_at = now()
where email = 'alice@example.com';
```

### 6.5 Log weekly check-in (append note, bump status)

```sql
update public.beta_invites
set status = 'week_1_checkin',
    last_checkin_at = now(),
    notes = coalesce(notes, '') || E'\n' || '[' || to_char(now(), 'YYYY-MM-DD') || '] ' || '<FREE_TEXT>'
where email = 'alice@example.com';
```

Replace `<FREE_TEXT>` with the actual check-in observation before running.

### 6.6 Feedback feed (in-app feedback, most recent 50)

Reads `feedback_submissions` (shipped in migration `00030_feedback_submissions.sql`) joined with `auth.users` for the email:

```sql
select fs.id,
       u.email,
       fs.message,
       fs.created_at
from public.feedback_submissions fs
join auth.users u on u.id = fs.profile_id
order by fs.created_at desc
limit 50;
```

### 6.7 Feedback volume per user

Spot-check who's engaged enough to be reporting bugs:

```sql
select u.email,
       count(*) as feedback_count,
       max(fs.created_at) as most_recent
from public.feedback_submissions fs
join auth.users u on u.id = fs.profile_id
group by u.email
order by feedback_count desc;
```

### 6.8 Activation funnel

Single query answers "of 15 invites, how many made it through each stage?":

```sql
select status, count(*) as n
from public.beta_invites
group by status
order by case status
  when 'invited'        then 1
  when 'onboarded'      then 2
  when 'first_scan'     then 3
  when 'first_cook'     then 4
  when 'week_1_checkin' then 5
  when 'lapsed'         then 6
end;
```

Run this every Friday. Sharp drops between stages = your biggest UX problem.

---

## 7. Feedback categorization template

Every Friday, triage the week's `feedback_submissions` + observation notes + DM quotes. Label each item:

| Label | Meaning | Action |
|---|---|---|
| **Bug** | Something is broken (crash, wrong data, failed API). | File in issue tracker. Prioritize by frequency. |
| **UX friction** | User confused by how to do something that already works. | Collect patterns. One-off → low priority; 3+ same complaint → fix next release. |
| **Missing feature** | "I wish it could X." | Add to roadmap; don't build immediately. |
| **Wrong mental model** | User expected the app to behave fundamentally differently. | Most valuable category. Signals a messaging or UX flow issue, not a feature gap. |
| **Nice-to-have** | "Could be cool if…" polish items. | Backlog. |

**P0 rule:** If 3+ testers report the same bug or friction within a single week, it's P0 for the next release. Don't wait for more data.

**P1 rule:** A single crash or data-loss report (from anyone) is P0 regardless of count.

---

## 8. When to promote TestFlight → public App Store

Do NOT submit to the App Store until all of these are true. Private beta is cheap; public launch with a broken app is expensive (1-star reviews stick).

- [ ] **Zero unhandled crashes in Sentry for 7 consecutive days** across all testers.
- [ ] **5+ non-builder users have completed the full flow** (scan → suggest → plan → cook → shopping handoff) end-to-end at least once.
- [ ] **Zero open P0 bugs** from § 7 triage.
- [ ] **App Review assets locked:** screenshots rendered + uploaded, description + keywords + privacy label confirmed (see [RELEASE.md](./RELEASE.md) § 9).
- [ ] **Patrick personally uses it daily for 2 weeks without friction** — "dogfood bar". If the builder still finds rough edges, the public will too.
- [ ] **Backend proven on Fly.io:** [DEPLOYMENT.md](./DEPLOYMENT.md) post-deploy smoke has been passing for 14+ days.
- [ ] **Privacy Policy + Terms hosted** at `https://dinnertime.app/privacy` and `https://dinnertime.app/terms` (ASC blocker — see DEPLOYMENT.md § 9).

When all boxes check, switch TestFlight group from Internal → External (triggers App Review), then follow RELEASE.md for the public submission cut.

---

## 9. Open questions (Patrick decides at execution)

- [ ] **Finalize 5–15 invite names this week** — sit down with a pen, list the household + family + cooking friends + non-cooks you trust to give honest feedback. Don't overshoot; don't recruit strangers.
- [ ] **Pick a group chat channel** — Slack, Signal, WhatsApp, SMS group. Pick one, stick to it. DinnerTime doesn't have in-app chat, so the group chat is where real-time feedback flows outside the formal `feedback_submissions` table.
- [ ] **Compensation** — no expectation of payment. Optional thank-you: a $25 gift card at the end of the beta, mailed handwritten-note style, is a nice touch. Budget: ~$400 for 15 testers. Not required.
- [ ] **Observation-test recording consent** — § 4 recommends QuickTime screen-recording the 15-min walkthrough. Ask verbally; delete after analysis unless they consent to retain.
- [ ] **Onboarding step-timing** — the Observation Script (§ 4) gives you 15 min to watch sign-up + pantry scan + suggestion + plan + shopping. If testers consistently run out of time at a specific step, that step is the UX P0 — cut it, streamline it, or move it later.

---

**Last updated:** 2026-04-22 (Phase 25 Plan 25-02).
**Owner:** Patrick.
**Next review:** After first 3 testers onboarded.
**See also:** [RELEASE.md](./RELEASE.md) for the TestFlight upload step that precedes sending invites.
