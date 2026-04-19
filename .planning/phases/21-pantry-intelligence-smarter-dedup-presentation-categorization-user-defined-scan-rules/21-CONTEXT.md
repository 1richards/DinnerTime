# Phase 21: Pantry Intelligence - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

User-facing intelligence layered on top of Phase 24a's canonical-ingredient substrate. Ships four deliverables:
1. **Rules UI** — Settings-based list view for user-defined scan rules (name-mapping + location-mapping), with edit/delete/drag-to-reorder and 30-day preview.
2. **Staples list + auto-accept** — mark canonical ingredients as staples; staples auto-accept at lower confidence on future scans.
3. **Pantry-tab presentation** — 4-way grouping toggle, StickySearchPill, stale treatment, compact row density.
4. **Learning pipeline** — aggregates Phase 18 override events into a "Suggested rules" Settings list; silently writes per-user category overrides; auto-promotes candidate canonicals globally at M=5 scan occurrences.

**Fuzzy dedup (ROADMAP criterion #1) is DROPPED** — Phase 24a identity dedup (canonical_ingredient_id + source_location) supersedes it. Nothing to ship for that criterion.

**NOT in scope:**
- Admin UI for canonical ingredient review/promotion (future phase) — Phase 21 ships the promotion RPC only
- Fuzzy dedup algorithm — shipped as fallback in Phase 24a
- Canonical / alias schema changes — Phase 24a shipped
- New scan flow behavior — rules + staples modify scan review output, not camera/scan flow itself
- Multi-household shared staples/rules — each user has their own set
- Household-level category overrides — per-user only (matches Phase 24a CONTEXT)
- Interruptive toast/prompt flows for learning — everything goes through the Suggested rules Settings list

</domain>

<decisions>
## Implementation Decisions

### Rules UI (ROADMAP criteria #4, #6)
- **Two rule types:**
  - **Name-mapping** — "Treat X as Y" → writes to `ingredient_aliases(source='user_rule')` referencing the target canonical_ingredient_id.
  - **Location-mapping** — "X always goes in [fridge|pantry|freezer]" → writes to a new `user_location_rules(user_id, canonical_ingredient_id, source_location, precedence, created_at)` table.
  - Category overrides are handled by the learning pipeline (below), not as a manually-created rule type.
- **Creation entry: Settings-only.** Settings → "Pantry Rules" section has the list view, Add button, edit/delete/drag-to-reorder. No inline "Save as rule" on review screen; no auto-prompts that interrupt users.
- **Precedence: explicit user-defined order.** Drag-to-reorder in the list. First matching rule wins. Precedence stored as `int8 precedence` column on each rule table.
- **30-day preview:** When a user creates or edits a rule, a preview panel queries `scan_events` for the last 30 days and shows "N items would have been affected" + a tappable list of specific items. Uses Phase 24a `scan_events.final_items` JSONB for pattern matching. Non-editable list — purely informational.
- **Rule evaluation point:** during reconcileItems (server) after Phase 24a's canonical resolution. Rules apply BEFORE pantry commit so review screen shows the rule-applied result.

### Staples + auto-accept (ROADMAP criterion #5)
- **Staple keying:** `user_staples(user_id, canonical_ingredient_id, created_at)`. Canonical-ingredient-level, NOT per-item.
- **Auto-accept threshold: aggressive 0.3.** Default confidence acceptance threshold is 0.7 (Phase 14). Staples lower the bar to 0.3 — any detection of a canonical marked as staple at ≥0.3 auto-accepts (skips review screen entry for that item).
- **Entry point for marking:** Pantry tab ItemRow ellipsis menu (Phase 15 HeaderEllipsis + ActionSheetIOS pattern). Adds "Mark as staple" / "Remove from staples" action.
- **Management UI: two surfaces.**
  - Settings → "Staples" section: full management list (add, remove, browse). Uses Phase 15 list pattern.
  - Pantry tab filter chip: "Staples" added alongside "All / Fridge / Pantry / Freezer" Phase 19 filter chips. Read-only quick view of staples filtered from the main pantry list.

### Pantry-tab presentation (ROADMAP criterion #2)
- **4-way grouping toggle** at top of pantry tab: "Location / Category / Staples / Recently added". Phase 19 segmented control / filter chips pattern. User picks their default; persisted in Zustand.
- **Search: Phase 19 StickySearchPill** always visible at top. Tap expands to full-screen modal (already exists for Library segment from Phase 19). Consistent UX across Kitchen, Library, Pantry, future surfaces.
- **Stale treatment:** dashed border + muted text (opacity ~0.5) when item confidence < 0.5. Uses Phase 19 `border-dashed` + text token classes. No dedicated "might be gone" section — stale items fade inline within their natural group.
- **Row density: compact (~48pt).** Tighter than Phase 19 DayRow's 64pt. Uses Phase 19 ItemRow primitive with `size="compact"` variant (or Claude's Discretion if a new variant makes more sense). Small quantity + canonical name + stale chip + ellipsis.

### Learning pipeline (ROADMAP criterion #3)
- **Mode: aggregate into "Suggested rules" Settings list.** No toasts, no auto-prompts, no silent rule writes. Override events accumulate; a background aggregator writes suggestions to a `suggested_rules` table. User browses Settings → "Pantry Rules" → "Suggestions" and accepts or dismisses manually.
- **Repeat threshold for suggestion: 2 in 30 days.** Overrides of the same name (or same canonical → location change) happening 2+ times within 30 days qualify for a suggestion.
- **Category override: silent on first override.** Review screen category change writes immediately to Phase 24a's per-user canonical_category_override. No confirmation, no toast. Next scan of the same canonical uses the overridden category. Matches Phase 24a criterion #11.
- **Candidate canonical auto-promotion: global M=5.** Phase 24a creates `status='candidate'` canonicals for unknown scan names. When a candidate has appeared in 5+ scan_events rows across all users, it auto-promotes to `status='active'`. Promotion is an RPC invoked on scan commit (cheap, no scheduled job needed). Admin UI for manual promotion is deferred.

### Schema additions (on top of Phase 24a substrate)
- `user_staples(user_id uuid, canonical_ingredient_id uuid, created_at timestamptz default now(), primary key(user_id, canonical_ingredient_id))` with RLS `user_id = auth.uid()`.
- `user_location_rules(id uuid pk, user_id uuid, canonical_ingredient_id uuid, source_location text, precedence int8, created_at timestamptz)` with RLS.
- `suggested_rules(id uuid pk, user_id uuid, rule_type text, payload jsonb, occurrence_count int, first_seen timestamptz, last_seen timestamptz, dismissed_at timestamptz null)` with RLS. `rule_type` enum: `'name_mapping' | 'location_mapping'`.
- `ingredient_aliases` table from Phase 24a gets new rows with `source='user_rule'` when user accepts a name-mapping suggestion.

### Claude's Discretion
- Exact UI layout of the Suggested rules section (inline in rules list vs separate section vs modal sheet) — propose during planning.
- Background aggregator timing: on-scan vs nightly job vs app-foreground trigger — pick lightest option during planning.
- Preview panel performance optimization (debounced query, cache, or live) — default simple re-query per rule edit; optimize only if slow.
- Exact copy / wording for Settings sections and rule-editor placeholder text.
- Whether the "Recently added" grouping mode shows last 7 days or last 14 days — default 7; tune in UAT.
- ItemRow `size="compact"` variant naming and implementation — create new variant or use className override of existing row.
- Whether rules preview caches scan_events aggregates per-user for speed — ship naive query first; optimize if needed.

</decisions>

<specifics>
## Specific Ideas

- **"Pantry Rules" as the canonical Settings section name** — covers both user-defined rules AND the Suggestions subsection. Avoids confusing users with separate "Rules" + "Suggestions" + "Staples" top-level Settings items.
- **Staples thresholds are aggressive by design** — user explicitly picked 0.3 (not the conservative 0.5). Signal: user trusts the canonical-resolution layer more than raw AI confidence for known-recurring items.
- **No interruptive flows for learning** — user explicitly rejected toasts and auto-prompts in favor of a quiet Suggestions list. Signal: treat the pantry as a tool that gets smarter quietly, not one that pesters.
- **First-override category learning IS silent** (not deferred to N=2) — user wanted frictionless category correction, even at the risk of a single accidental override sticking. Matches "pantry should feel smart out of the gate."
- **Drag-to-reorder for rule precedence** — user explicitly picked manual order over specificity-based. Signal: user wants predictable, debuggable rule behavior, not magical matching.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/mobile/src/components/ui/ItemRow.tsx` (Phase 19) — pantry-tab row primitive. Needs a compact variant OR className override for 48pt.
- `apps/mobile/src/components/ui/SearchBar.tsx` (Phase 19 StickySearchPill) + `/search` modal route — reuse verbatim for pantry-tab search.
- `apps/mobile/src/components/ui/Chip.tsx` (Phase 19) — filter chips + display chips for 4-way grouping toggle + stale indicator.
- `apps/mobile/src/components/ui/HeaderEllipsis.tsx` + `ActionSheetIOS` pattern (Phase 15) — ItemRow "Mark as staple" action menu.
- `apps/mobile/src/components/ui/SymbolIcon.tsx` (Phase 15) — icons for rules list (reorder handle, add button, delete).
- `apps/mobile/src/app/(tabs)/settings.tsx` — Settings screen adds two new sections: "Pantry Rules" and "Staples".
- `packages/server/src/services/canonicalResolver.ts` (Phase 24a) — rule evaluation plugs into this AFTER canonical resolution, BEFORE reconcileItems commit.
- `packages/server/src/services/pantry.ts` (Phase 24a rewrite) — reconcileItems already has the canonical_ingredient_id path; rules modify the canonical-resolved output before commit.
- Phase 18 `item_override_events` table — learning pipeline reads this for aggregator.
- Phase 24a `scan_events` table — preview panel queries this for 30-day lookback.
- Phase 24a `ingredient_aliases` table — user-created name-mapping rules write rows here with `source='user_rule'`.

### Established Patterns
- Settings list sections using Phase 15 headers + Phase 19 tokens (MemberCard, IngredientSearch etc. already show the pattern).
- RLS via `user_id = auth.uid()` on all user-scoped tables (every phase).
- Supabase migration numbering continues from Phase 24a (last migration file: `00015_*`); Phase 21 adds `00016_user_staples.sql`, `00017_user_location_rules.sql`, `00018_suggested_rules.sql`.
- Service-layer rule evaluation (no Postgres triggers) — follows Phase 18 dual-write pattern preference.
- Canonical-ingredient-centric data model (not raw-string) — matches Phase 24a architecture.

### Integration Points
- `supabase/migrations/00016_user_staples.sql`, `00017_user_location_rules.sql`, `00018_suggested_rules.sql` — new migrations.
- `packages/server/src/services/ruleEvaluator.ts` (new) — evaluates user rules on post-canonical scan output; invoked by pantry service before commit.
- `packages/server/src/services/suggestionAggregator.ts` (new) — reads `item_override_events`, writes to `suggested_rules`. On-scan or scheduled.
- `packages/server/src/services/canonicalPromoter.ts` (new) — auto-promotes `status='candidate'` → `status='active'` when global scan_event count ≥ 5.
- `packages/server/src/routes/pantry.ts` — new endpoints: `GET/POST/PATCH/DELETE /rules`, `GET/POST/DELETE /staples`, `GET/POST /suggestions`.
- `apps/mobile/src/app/settings/pantry-rules.tsx` (new route) — rules list + editor + 30-day preview panel.
- `apps/mobile/src/app/settings/staples.tsx` (new route) — staples list + add/remove management.
- `apps/mobile/src/app/(tabs)/pantry.tsx` — 4-way grouping toggle, StickySearchPill, compact rows, stale treatment.
- `apps/mobile/src/components/pantry/PantryItemCard.tsx` — ellipsis menu gains "Mark as staple" action.
- `apps/mobile/src/stores/pantryStore.ts` — new actions: `createRule`, `updateRule`, `deleteRule`, `reorderRules`, `markStaple`, `unmarkStaple`, `dismissSuggestion`, `acceptSuggestion`.

</code_context>

<deferred>
## Deferred Ideas

- **Admin UI for canonical ingredient review/promotion** — future post-launch admin tooling phase. Phase 21 ships the RPC; no admin surface.
- **Household-level shared staples or rules** — each user has their own set. Multi-household support is out of scope project-wide.
- **Global rules marketplace** ("popular community rules") — out of scope for private beta.
- **Rule chains / conditional rules** — Phase 21 has only two flat rule types. Complex conditional logic ("apply X only when Y") is deliberately out.
- **Explicit rule-testing playground in Settings** — 30-day preview is the extent of this. A dedicated "test a rule against arbitrary input" screen is out.
- **Auto-dismissing Suggestions after N days** — suggestions persist until user acts. TTL policy can be added later if the list gets noisy.
- **Notification / email alerts for new suggestions** — no push notifications in this phase.
- **Learning from Instacart order history imports** specifically — Phase 13's Instacart-import variant already flows through the same override-event path; no special-case logic.
- **Smart reordering of pantry items based on usage frequency** — future polish.
- **Undo history for rule applications** (revert a 30-day scan batch) — no. Rules apply forward-only.
- **Toast / banner learning signals** — user explicitly rejected in favor of quiet Suggestions Settings list.

</deferred>

---

*Phase: 21-pantry-intelligence-smarter-dedup-presentation-categorization-user-defined-scan-rules*
*Context gathered: 2026-04-19*
