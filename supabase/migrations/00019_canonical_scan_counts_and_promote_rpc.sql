-- Phase 21: canonical_scan_counts + promote_candidate_canonicals RPC.
--
-- Counter-table pattern for candidate canonical auto-promotion.
--
-- Flow (per CONTEXT.md + RESEARCH.md § Pattern 3):
--   1. Phase 24a canonicalResolver creates canonical_ingredients rows with
--      status='candidate' when an unknown scan name has no exact/fuzzy match.
--   2. Phase 21 services/canonicalPromoter.ts increments the counter-table
--      row for each canonical_ingredient_id observed during a scan commit
--      (INSERT ... ON CONFLICT DO UPDATE SET scan_count = scan_count + 1).
--   3. services/canonicalPromoter.ts invokes promote_candidate_canonicals() RPC
--      fire-and-forget on scan commit. RPC flips status='candidate' → 'active'
--      for any canonical whose scan_count has reached the threshold (default 5).
--
-- Why a counter table (not JSONB path matching over scan_events)?
--   - O(1) increment + O(rows with status=candidate AND count>=5) promotion
--   - Cheap, indexed UPDATE instead of JSONB @? scan against thousands of events
--   - Simpler code path; no jsonpath syntax risk
--
-- RLS: global read (counter is non-sensitive metadata), writes via service_role
-- only (mirrors canonical_ingredients policy).

create table canonical_scan_counts (
  canonical_ingredient_id uuid primary key references canonical_ingredients(id) on delete cascade,
  scan_count bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table canonical_scan_counts enable row level security;

-- Public read so mobile can surface "how many scans until promotion?" if ever desired.
create policy "canonical_scan_counts_read_all"
  on canonical_scan_counts
  for select
  using (true);

-- Service-role write only (mirrors canonical_ingredients).
create policy "canonical_scan_counts_write_service_role"
  on canonical_scan_counts
  for all
  to service_role
  using (true)
  with check (true);

comment on table canonical_scan_counts is
  'Phase 21. Per-canonical scan counter used by promote_candidate_canonicals RPC. Incremented by services/canonicalPromoter on each scan commit. Read-all, service-role write.';

-- promote_candidate_canonicals(threshold)
--
-- Idempotent promotion pass. Updates canonical_ingredients rows where
--   status = 'candidate' AND canonical_scan_counts.scan_count >= threshold
-- to status = 'active'. Returns the number of rows promoted.
--
-- SECURITY DEFINER: runs under the migration owner so the call path
-- (invoked from services/canonicalPromoter.ts under the authed supabase
-- client) can touch the service-role-protected canonical_ingredients
-- write policy. search_path pinned to public to prevent schema hijacking.

create or replace function promote_candidate_canonicals(threshold int default 5)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  promoted int := 0;
begin
  update canonical_ingredients ci
  set status = 'active', updated_at = now()
  from canonical_scan_counts csc
  where ci.id = csc.canonical_ingredient_id
    and ci.status = 'candidate'
    and csc.scan_count >= threshold;
  get diagnostics promoted = row_count;
  return promoted;
end;
$$;

grant execute on function promote_candidate_canonicals(int) to authenticated, service_role;

comment on function promote_candidate_canonicals(int) is
  'Phase 21. Idempotent promotion pass: flips canonical_ingredients.status from candidate to active when scan_count >= threshold (default 5). Invoked fire-and-forget on scan commit by services/canonicalPromoter.ts. Returns number of rows promoted.';
