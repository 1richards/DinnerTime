# Privacy Policy

**Last updated:** 2026-04-22

**DinnerTime** ("we", "our", "the app") provides an AI-powered meal planning
experience. This policy explains what data we collect, how we use it, who we
share it with, and the rights you have over it. By using DinnerTime, you agree
to the practices described below.

> **Note:** This document is a placeholder that reflects the app's actual data
> flows as of the date above. It has not yet been reviewed by legal counsel
> and must be finalized before public launch.

## Information we collect

**Account data**
- Email address — required to sign in and to send you password-recovery links.
- User ID — an opaque UUID we generate for you. Not personally identifying by
  itself.
- Optional display name, household size, cuisine preferences, dietary
  preferences, and skill level — all user-supplied during onboarding and
  editable in Settings.

**Content you create**
- Photos of your fridge or pantry that you explicitly submit for scanning.
  Photos are sent to Anthropic for AI vision and then discarded on our side;
  we do not store the raw image bytes longer than the duration of the
  processing request.
- Recipes you import, create, or save.
- Meal plans, cook history, and shopping lists.
- Voice input during cooking mode — processed on-device by iOS Speech
  Recognition by default; the resulting text transcription is sent to our
  servers only for the duration of the conversational turn.

**Device and diagnostic data**
- Crash reports and performance traces via Sentry. These are scrubbed of
  email addresses, names, tokens, transcripts, and prompt text before
  transmission.
- Anonymous product-interaction telemetry (tab switches, scans completed,
  cook sessions started) correlated to your user ID so we can debug flows
  that fail for specific users.

## How we use it

- **Core app functionality**: showing you recipes, building meal plans,
  generating grocery hand-offs, running cooking mode.
- **AI processing**: routing your photos and text to Anthropic Claude (and
  Google Gemini for some search queries) so the app can reason about your
  pantry, recipes, and cooking questions.
- **Error and performance monitoring**: diagnosing crashes and slow paths via
  Sentry. We do not use this data for advertising or user profiling.

## Who we share it with

DinnerTime uses the following sub-processors:

| Service | Purpose | Data shared |
|---|---|---|
| Supabase | Auth, database, storage | Email, user ID, recipes, meal plans, cook history |
| Anthropic Claude | AI vision + text | Photos you submit, recipe/cooking prompts |
| Google Gemini | AI text for some search queries | Search queries |
| Instacart | Grocery hand-off | Anonymous link containing your shopping list |
| Sentry | Crash + performance reporting | User ID, crash stack traces, performance traces (PII-scrubbed) |

We do not sell your data. We do not share it with advertisers.

## Your rights

You can, at any time, from **Settings**:

- **Export your data** — receive a JSON dump of your profile, pantry, recipes,
  meal plans, and cook history.
- **Delete your account** — permanently delete your account and all
  associated data. Deletion is soft for 30 days (recoverable by emailing
  support) and then becomes irreversible.
- **Change your password or email** — via the Account section.
- **Disconnect Instacart** — via the Connected Services section.

To reach a human about a privacy question, email
[support@dinnertime.app](mailto:support@dinnertime.app).

## Retention

- Active account data is retained indefinitely while your account exists.
- Deleted account data is purged permanently 30 days after you request
  deletion.
- Sentry crash data is retained by Sentry for 90 days per their default
  policy.

## Children's privacy

DinnerTime is not directed at children under 13. If you believe a child
under 13 has created an account, email
[support@dinnertime.app](mailto:support@dinnertime.app) and we will delete
it.

## Changes to this policy

We will update this page when our data practices change and notify active
users via email before material changes take effect.

## Contact

[support@dinnertime.app](mailto:support@dinnertime.app)
