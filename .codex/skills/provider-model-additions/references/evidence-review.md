# Evidence Review

Use this reference when research starts from supplied link collections, or when host availability, pricing or lifecycle evidence is uncertain. The deliverable stays the requested report plus, when useful, one adjacent `.evidence.zip`.

## What goes where

- **Report:** exact IDs, decisive dates, prices with units and tiers, the conflict or gap that sets a status, and three to six official source links per finding.
- **Archive:** working notes with every URL, retrieval times and quotations; runtime captures such as resolver output and command logs; review passes; supplied collections; and the original bytes of any report that was later shortened or replaced.

Include `SOURCE-INDEX.md`, mapping original repository-relative paths, archive entries and embedded URLs without absolute checkout paths, and a root `SHA256SUMS` covering every other entry. Build the ZIP without directory entries (`zip -D`). Verify integrity, checksums and byte equality with the inputs. Link the archive once from the report and name the entries a reader is likely to need.

## Supplied collections

Read every supplied file and inventory its embedded source sections, including markers such as `<!-- Source: URL -->`. Count input files, source sections and unique URLs separately; repeated URLs can be fetched once. Screen every section for scope, follow relevant model, endpoint, control, voice, pricing and lifecycle links, and record unrelated workflow coverage as screened rather than researched. Collection timestamps are capture dates, not launches.

## Resolve the exact host and endpoint

- Triangulate the exact host and operation page, release or lifecycle evidence and billing terms for each material candidate. An upstream model release does not establish a wrapper's availability, limits, encoding, voices, controls, price or account access.
- A service-only selector, transport addition, snapshot, moving alias and new model release are different findings.
- Read access and retirement banners even when old examples remain; a working example cannot override a conflicting retirement or access notice.
- For conflicting pages, keep each side's language, page date and operation. No page type wins automatically, and a canonical locale is a baseline rather than a winner.
- Prefer documented discovery surfaces (provider indexes, model lists, Markdown exports, linked schemas, embedded structured data) to guessed URLs, and name the evidence form when it limits confidence. A missing guessed route is inconclusive; an HTTP 200 can carry a missing-page body.
- Keep launch dates, page dates, retrieval dates, scheduled changes and repository implementation dates separate. Use an observation date when availability is established without a launch date. Ordinary paid account access is not invitation-only eligibility.

## Preserve pricing semantics

- Record host, model, operation, currency, billing unit, tier, effective date, and any subscription, minimum, promotion, setup or retry terms. Keep text-input and audio-output units separate; duration approximations are not exact character rates.
- When page text omits a price, official structured data or billing configuration can corroborate it; name that evidence form and reconcile stale or conflicting values. Identical numbers with different unit labels remain a conflict.
- For an implemented model, trace the stored rate through its getter and estimator to the native tariff, including what the meter counts (characters, bytes, tokens, audio tokens or duration), rounding, minimums and billable retries. Report a confirmed unit mismatch separately from its unquantified effect; research does not authorize a runtime fix.
- Keep nonrecurring billing eligibility, exact tariff, account entitlement, purchase minimum and expiry, optional add-ons and retry billing separate. Missing prices do not prove gating, a partial add-on price is not total request cost, and an unexplained zero price is neither a durable free tier nor authorization for a paid call.
- A separate accounting or entitlement issue does not change a current tuple's model category.

## Finish with bounded uncertainty

Stop expanding catalogs once each actionable candidate has exact host identity, benefit, availability, request and response differences, implementation class, and pricing or an explicit gap. Record the specific missing fact and the evidence that would resolve it instead of probing speculative routes. Restoring a retired sibling is a capability or policy decision, not a new release. Transport success, decoded integrity, text or spoken correctness and perceptual quality need different evidence; documentation and mocks establish neither of the last two.
