# Evidence Review

Use this reference when research starts from supplied link collections or encounters uncertain host availability, pricing, or lifecycle evidence. Keep working indexes temporary; the deliverable remains the requested report and, when useful, one adjacent evidence archive.

## Supplied collections

Read every supplied file and inventory its embedded source sections, including source markers such as `<!-- Source: URL -->`. Map each section to its original repository-relative path and source URL. Repeated URLs can be fetched once, while the index preserves every original occurrence. Count input files, source sections, and unique URLs separately.

Screen all sections for scope. Follow relevant model, endpoint, control, voice, pricing, and lifecycle links; record unrelated workflow coverage as screened rather than freshly researched. Treat collection timestamps as capture dates, not model launches. A historical capture may explain an earlier decision while current official evidence changes the recommendation.

If preserving the supplied evidence, copy original bytes into the adjacent `.evidence.zip` and include `SOURCE-INDEX.md` plus `SHA256SUMS`. The index should map original paths, archive entries, and embedded URLs without absolute checkout paths. Verify archive integrity, checksums, byte equality with the inputs, and source-section totals. Link the archive once from the report and identify useful entries. Do not automatically archive every fetched website or regenerate supplied captures in place.

## Resolve the exact host and endpoint

Use official catalogs, exact API schemas, dated release/lifecycle notices, and host pricing together. A model's upstream release does not establish a wrapper's availability, input limits, output encoding, voices, controls, price, or account access. A service-only selector, transport addition, snapshot, moving alias, and new model release are different findings.

For each material candidate, triangulate the exact host/operation page, release or lifecycle evidence and billing terms. Read access/retirement banners even when old examples remain. For conflicting pages retain language, page-update date, retrieval date and operation; a canonical locale is a comparison baseline rather than an automatic winner. Use linked official schemas, Markdown exports or embedded structured data when the visible page omits a fact, and identify that evidence form. A working example alone cannot resolve a conflicting retirement or access notice.

Prefer documented discovery surfaces such as provider indexes and model lists to repeated guessed URLs. When a Markdown variant fails, try the canonical page or its documented export. A missing guessed route is inconclusive; an HTTP 200 can contain a missing-page body. Distinguish a retired product from a moved reference, bot restriction, or incomplete documentation.

Keep launch dates, source update dates, capture/retrieval dates, scheduled future changes, and repository implementation dates separate. Use an observation date when public evidence establishes availability without a launch date. Public previews belong in the candidate set when relevant; ordinary paid account access is not the same as invitation-only eligibility.

## Preserve pricing semantics

For each material price, retain the exact host/model/operation, currency, billing unit, tier, effective date, and relevant subscription, minimum, promotion, setup, or retry terms. Preserve both text-input and audio-output units where applicable. Published duration approximations are not exact character conversions.

If readable page text omits pricing, inspect official structured FAQ data or active model billing configuration when available. Identify that evidence form in the finding. Treat hidden page data as corroborating evidence, not automatically authoritative: stale entries, generic hardware fallbacks, active fixed-output rates, and visible conflicting terms need reconciliation. Identical numbers with different unit labels remain a conflict.

For implemented models, inspect both the stored rate and the estimator's use of it. A registry field named for characters cannot be validated solely by a matching token-price number. Report confirmed unit mismatches separately from their unknown quantitative effect; research does not authorize a runtime fix.

Trace the stored rate and its unit through the getter, estimator and native tariff. For character-priced speech, identify whether the meter counts Unicode characters, bytes, tokens, generated audio tokens or duration; do not silently convert approximate duration examples into exact character rates. Preserve tier, effective dates, percentages, rounding, minimum durations and billable retries. New paid entries require `pricingSourceUrl`, `pricingCheckedAt`, `pricingCurrency`, `pricingTier` and `pricingNotes` in the proposed implementation contract; record unknown values as unresolved rather than inventing provenance.

Keep core nonrecurring billing eligibility, exact tariff, account entitlement, purchase minimum/expiry, optional add-ons and retry/minimum billing separate. New-user closure can coexist with eligible grandfathered accounts. Missing prices do not prove subscription gating or unavailability, and a partial add-on price is not total request cost. Do not change a current tuple's model category solely because a separate accounting or unqueried entitlement finding is unresolved.

Do not interpret an unexplained zero price as a durable free service or authorization for a paid call. Resolve effective billing before proposing execution. An unresolved tariff can coexist with verified public availability: keep the model's availability conclusion and the accounting prerequisite separate.

## Finish with bounded uncertainty

Each actionable candidate should establish exact host identity, relevant benefit, availability, request/response differences, implementation class, and pricing or an explicit gap. When those decision points are covered, stop expanding unrelated catalogs. Record a specific missing fact and the evidence needed to resolve it instead of repeatedly probing speculative routes.

Keep facts in their owning detailed finding and link from summaries, watchlists, and checklists. Describe a retired sibling's possible restoration as a capability/policy decision, not a new release. Keep current-tuple totals separate from the number of recommendations and evidence issues. Transport success, decoded artifact integrity, spoken/text correctness, and perceptual quality require different evidence; documentation or mocked requests do not establish the last two.
