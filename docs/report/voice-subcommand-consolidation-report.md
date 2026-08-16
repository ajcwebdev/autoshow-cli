# Voice Subcommand Consolidation

Status: proposal only; no CLI surface changes in this pass

Date: 2026-08-16

## Problem

`voice` currently exposes 15 actions: `consent`, `revoke-consent`, `discover`, `import`, `design`, `materialize`, `clone`, `audition`, `approve`, `inspect`, `status`, `reconcile`, `retire`, `revoke`, and `delete`. `comic reference-voice` repeats the same 15 as a positional `<action>` plus one grouped flag wall.

That is too many verbs for one resource. The lifecycle is real, but the CLI flattened every state transition into a sibling command. Users have to memorize a pipeline instead of a small set of nouns with flags. Agents pay the same tax twice: once on `voice --help`, again on `comic reference-voice --help`.

The extra verbs are not extra capabilities. They are mostly mode switches, severity upgrades, or recovery steps that other AutoShow commands already express as flags.

This report proposes shrinking the public surface from 15 actions to 8 without moving voice creation into `tts` or `comic generate-audio`. ADR-014 still applies: synthesis cannot create or delete voices.

## Current Surface

| Action | What it actually does | Mutation class |
| --- | --- | --- |
| `consent` | Write a protected grant record. Omitted actions stay denied. | Local write |
| `revoke-consent` | Append a marker that makes that locator fail every gate. | Local write |
| `discover` | Page a provider or account catalog. | Provider read |
| `import` | Register an existing voice ID. Stock origin already auto-approves. | Local write, no remote create |
| `design` | Buy bounded protected preview candidates. Never saves a durable voice. | Provider create (preview) |
| `materialize` | Save exactly one selected candidate through a journal. | Provider create (resource) |
| `clone` | Instant clone from samples, or print the external professional workflow. | Provider create, or local help text |
| `audition` | Buy the canonical pre-approval take set. | Provider synth |
| `approve` | Atomically promote an auditioned generation to current. | Local write |
| `inspect` | Show one generation, optionally with a live provider check. | Provider read or local read |
| `status` | Dump the local catalog and current index. No provider calls. | Local read |
| `reconcile` | Finish an interrupted Fish create without repeating it. | Provider read + local complete |
| `retire` | Uncurrent a generation. No reason. No remote delete. | Local write |
| `revoke` | Uncurrent a generation, require a reason, maybe mark protected assets `deletion-required`. | Local write |
| `delete` | Delete a project-owned remote resource after `--confirm-voice-id`. | Provider delete |

The same 15 names are the shared contract for `VOICE_ACTIONS`, parent help, the comic alias, 16 command docs, and help/usage tests. Any shrink has to land on both CLIs together.

## What Is Actually Distinct

Keep a verb when the failure mode, consent class, or payment class is different. Fold a verb when it is the same object with a different selector, severity, or recovery step.

Distinct create paths:

- `import` registers an ID that already exists. It must never create a remote voice.
- `design` purchases previews. Selecting a candidate is a second paid or quota-bearing save.
- `clone` uploads biometric samples under consent. That is not an import with extra flags.

Distinct gates:

- `consent` is a legal record, not a registration field.
- `audition` is a paid canonical sample set.
- `approve` is a human or actor-attributed promote. Stock import already skips this; designed and cloned voices must not.

Distinct destroy path:

- `delete` is the only remote destructor. It needs an exact resource-ID confirmation and must stay impossible to reach by omitting a reason or adding `--force` to a local retire.

Everything else is a mode of one of those objects.

## Recommended Surface

15 actions become 8:

```text
voice list        # status + inspect + discover
voice consent     # grant + revoke-consent
voice import      # register an existing ID
voice design      # candidates + explicit --save
voice clone       # instant clone only
voice audition    # paid takes; optional --approve
voice approve     # local promote, kept as its own verb
voice retire      # retire + revoke
voice delete      # explicit remote delete
```

That is nine names if `approve` stays, eight if `--approve` on `audition` is enough for the common path. Keep standalone `approve`. Re-promoting an already-auditioned generation must not repurchase takes.

`reconcile` is not a command. Unambiguous journals complete automatically; ambiguous ones require `--reconcile` on the original create or delete, matching TTS `--tts-allow-ambiguous-redispatch`.

`--kind professional` is not a command and should not stay a clone mode. It already refuses `--sample` and tells the user to import the approved ID. Make that the error from `clone` when the provider has no instant API.

Bare `voice` should run `voice list` instead of printing parent help.

### `voice list`

Replaces `status`, `inspect`, and `discover`.

```bash
bun autoshow voice list
bun autoshow voice list vr_ID
bun autoshow voice list vr_ID --live
bun autoshow voice list --provider elevenlabs --source account
bun autoshow voice list --provider elevenlabs --source shared-library --cursor OPAQUE_CURSOR
```

| Flag | Role |
| --- | --- |
| no args | Today's `status`: local catalog and current index. No provider calls. |
| `<registration-id>` | Today's `inspect` for one generation. |
| `--live` | Opt-in provider readiness check. Never implied. `--price` stays static-only. |
| `--provider` / `--source` / `--cursor` | Today's `discover`. |

Do not auto-live-inspect the whole catalog. That turns a free local dump into N provider calls.

Default `--generation-id` to the latest generation for that registration. Require it only when more than one generation could match. This removes more daily friction than deleting a verb.

### `voice consent`

Replaces `consent` and `revoke-consent`.

```bash
bun autoshow voice consent hero --allow upload,new-synthesis,retention,deletion --provenance-ref release:hero-v1 --actor-id casting_editor
bun autoshow voice consent --revoke protected-consent:v1:STORE:ASSET:SHA256 --reason "Authorization withdrawn" --actor-id casting_editor
```

Grant still requires `--allow` with at least one explicit action. Revoke still requires `--reason`. Do not infer grant vs revoke from whether the positional looks like a subject key or a locator.

Consent stays its own command. It is not a flag on `clone`. Auto-creating a grant record from clone flags would hide the deny-by-default policy.

### `voice import`

Unchanged purpose. Stock origin keeps today's automatic approve-and-promote. Non-stock origins stay `draft` and still need audition and approve.

Do not merge `import` with `clone` or `design`. The safety seam is "no remote create" vs "upload samples" vs "buy previews."

### `voice design`

Replaces `design` and `materialize`.

```bash
bun autoshow voice design hero --provider elevenlabs --model eleven_v3 --creation-model eleven_ttv_v3 --description "Warm, weathered guide" --preview-text "..." --price
bun autoshow voice design --save CANDIDATE_ID --provider elevenlabs --subject-key hero --voice-name HeroGuide --provenance-ref project:casting
```

`--save` is required to create the durable resource. Never pick a "best" candidate. Never save because `--candidates 1`. Fish still materializes from the exact protected preview bytes, not from a candidate ID treated as a remote voice.

The two-step payment class stays. Only the second verb goes away.

### `voice clone`

Instant clone only.

```bash
bun autoshow voice clone hero --provider elevenlabs --model eleven_v3 --voice-name HeroClone --sample input/voices/hero.wav --authorization-ref release:hero-v1 --consent-ref protected-consent:v1:... --provenance-ref project:casting
```

Drop `--kind`. Instant is the only implemented mutation. If the provider has no instant API, fail with the current professional-clone guidance: finish the external workflow, then `voice import --voice-id`.

Speechify name, email, locale, and gender stay as clone flags. They are provider payload, not a reason to keep a second command.

### `voice audition` and `voice approve`

Keep both.

```bash
bun autoshow voice audition vr_ID --representative-line "We leave at dawn." --takes 1
bun autoshow voice audition vr_ID --representative-line "We leave at dawn." --approve --actor-id casting_editor
bun autoshow voice approve vr_ID --actor-id casting_editor
```

`--approve` is sugar for the same-run path. It still requires `--actor-id`. It must not fire unless the audition succeeded.

Do not auto-approve after a paid audition. Stock import is the only auto-approve path, and that path never bought preview or clone resources.

Successor-generation protection stays: a second purchase is refused with "inspect it instead."

### `voice retire`

Replaces `retire` and `revoke`.

```bash
bun autoshow voice retire vr_ID
bun autoshow voice retire vr_ID --reason "Casting changed"
```

No `--reason`: today's retire. Uncurrent, append-preserving, no remote delete.

With `--reason`: today's revoke. Same local uncurrent, plus the required reason and the `deletion-required` cleanup policy.

These already share `handleLifecycle` in `define-voice-command.ts`. The split is a required-reason switch, not two domains.

Do not add `--delete` here. Remote delete stays on `voice delete`.

### `voice delete`

Unchanged.

```bash
bun autoshow voice delete vr_ID --confirm-voice-id EXACT_RESOURCE_ID
```

Still eligibility-checked, project-owned, blocked when another current model-qualified registration shares the resource, and still two-phase (`deletion-pending` then tombstone). If a pending delete journal exists, the same command resumes it.

## What Should Become Automatic

| Behavior | Automatic? | How |
| --- | --- | --- |
| Stock import approve + current-index advance | Yes, already | Keep. No remote create happened. |
| Unambiguous provisioning journal completion | Yes | On the next `design --save`, `clone`, `delete`, or `list <id>` of that registration, finish the journal. Never recreate. |
| Ambiguous create after interrupt | No | Refuse unless `--reconcile` is set. Same rule as TTS `--tts-allow-ambiguous-redispatch`. |
| Default `--generation-id` to the sole latest match | Yes | Require the flag only when the request is ambiguous. |
| Bare `voice` | Yes | Run `list`. |
| Live provider inspect | No | `--live` only. |
| Save the only design candidate | No | Require `--save <candidate-id>`. |
| Approve after paid audition | No | Require `approve` or explicit `--approve`. |
| Create consent from clone flags | No | `voice consent` stays explicit. |
| Remote delete after revoke | No | `voice delete --confirm-voice-id` only. |
| Repeat an ambiguous create | No | Never. This is why `reconcile` exists today. |
| Professional clone as a workflow | No command | Error text pointing at import. |

`reconcile` is the strongest automatic-behavior win. It is Fish-only on the public CLI, it never repeats creation, and TTS already solved the same problem with a flag on the original command instead of a sibling verb. A dedicated `voice reconcile` teaches users the wrong lesson: that recovery is a different product.

## What Must Not Be Combined

Do not fold management into `tts` or `comic generate-audio`. ADR-014 splits `TtsSynthesisRuntimeOptions` from `VoiceManagementRuntimeOptions` so synthesis, resume, cleanup, and `--price` cannot express resource creation.

Do not merge `import`, `design`, and `clone` into `voice add --from ...`. That recreates the comic reference-voice flag wall: every create flag visible on every invocation, with hidden mutual exclusions.

Do not merge `delete` into `retire`. Local uncurrent and remote destruction must not share a verb.

Do not merge `revoke-consent` into `revoke`. One targets a consent locator; the other targets a registration generation. Same English word, different objects.

Do not auto-live-check during `list` with no args. Status is the cheap command. Inspect is the networked one.

## Mapping

| Today | Tomorrow | Mechanism |
| --- | --- | --- |
| `voice status` | `voice list` | Default read |
| `voice inspect <id>` | `voice list <id>` | Optional identity |
| `voice inspect --price` | `voice list <id> --price` | Static readiness |
| live inspect | `voice list <id> --live` | Opt-in provider GET |
| `voice discover` | `voice list --provider --source` | Remote catalog mode |
| `voice consent` | `voice consent` | Unchanged grant |
| `voice revoke-consent` | `voice consent --revoke` | Severity flag + required reason |
| `voice import` | `voice import` | Unchanged |
| `voice design` | `voice design` | Unchanged candidate create |
| `voice materialize` | `voice design --save` | Explicit save of one candidate |
| `voice clone --kind instant` | `voice clone` | Default and only kind |
| `voice clone --kind professional` | removed | Error: import the approved ID |
| `voice audition` | `voice audition` | Unchanged |
| `voice approve` | `voice approve` | Unchanged; `--approve` on audition is sugar |
| `voice retire` | `voice retire` | Unchanged |
| `voice revoke` | `voice retire --reason` | Same handler, required reason |
| `voice delete` | `voice delete` | Unchanged |
| `voice reconcile` | automatic / `--reconcile` | On create, delete, or `list <id>` |

Hidden aliases can keep the old verbs for one release. Help and docs should only advertise the 8/9 names.

## Comic Alias

`comic reference-voice` is the worse of the two surfaces: one leaf, 15 positional actions, and every flag in one wall. After the shrink it should either become a real subcommand tree that mirrors `voice`, or stay a thin alias of the same 8/9 names with per-action flags.

Do not keep the current "same actions, different parser shape" split. That is the duplication users feel, not just the verb count.

## Why Not Smaller Than 8

A five-command version (`list`, `consent`, `save`, `audition`, `remove`) looks tidy and is wrong.

`save --from import|design|clone` mixes three payment and consent classes behind one verb. `remove --mode retire|revoke|delete` puts remote destruction one forgotten flag away from a local uncurrent. The 8-command shape is the smallest surface that still makes the dangerous thing look different from the cheap thing.

## Implementation Plan

Do not start by merging create paths. Phases 1–4 are local or read-only. Phase 5 is the first paid-path fold. Phase 6 changes crash recovery. Phase 7 removes a non-mutating clone mode. Phase 8 changes the comic parser shape after the voice verbs are stable.

Each phase ships independently. Hidden aliases keep old argv working until a later removal window. Help, numbered command docs, and `VOICE_PUBLIC_ACTIONS` advertise only the surviving names. `comic reference-voice` keeps accepting both public and hidden names through Phase 7 so the alias does not break mid-migration.

Shared verification for every phase:

```bash
bun run check
bun t --price
bun test test/test-cases/validation/cli/cli-help-contracts.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors/voice-usage.test.ts
bun test test/test-cases/validation/cli/cli-usage-errors/comic-usage.test.ts
bun test test/test-cases/validation/cli/doc-command-flags-contract.test.ts
```

Do not run `bun run t` or any paid provider command.

### Cross-cutting work to land with Phase 2

The CLI can hide flags (`help.hidden` on a flag) but cannot hide subcommands. Parent help in `src/cli/native/help-renderer.ts` prints every child. `CliCommandDefinition.help` has no `hidden` field.

Add command-level `help.hidden` before the first fold, then:

- Filter hidden children out of `voice --help` and `VOICE_PUBLIC_ACTIONS`.
- Keep hidden children in the parser map so `voice inspect` and `comic reference-voice inspect` still dispatch.
- Split today's `VOICE_ACTIONS` (derived from every child) into `VOICE_PUBLIC_ACTIONS` for help/docs and `VOICE_ACTIONS` for accepted names including aliases.
- Teach `doc-command-flags-contract.test.ts` to resolve a folded doc onto the surviving command, or delete the folded doc in the same phase.

Do not invent a second parser. Hidden children are the compatibility layer.

### Phase 1 — Default generation and bare `voice`

Goal: remove the two highest-friction requirements without deleting a verb.

`audition`, `approve`, `inspect`, `reconcile`, `retire`, `revoke`, and `delete` all call `requiredFlag(ctx, 'generation-id')` and `findRegistration(registrationId, generationId)` in `define-voice-command.ts`. Bare `voice` is forced to help by `parseCommandTreeArgv` when no child token is present.

Implementation:

1. Add `resolveRegistrationGeneration(registrationId, requestedGenerationId)` next to `findRegistration`. If `--generation-id` is present, keep exact-match lookup. If it is omitted: use the current-index selection for that `registrationId` when one exists; otherwise use the sole catalog generation; otherwise use the sole tip generation (no append successor). If more than one generation could match, fail with the candidate IDs and require `--generation-id`.
2. Replace every `requiredFlag(..., 'generation-id')` call with that helper. Leave the flag documented as optional.
3. Add `defaultSubcommand` (or equivalent) on `CliCommandDefinition` so a parent with no child runs that child instead of flipping to help. Phase 1 sets it to `status`. `voice --help` and `voice help` stay help.
4. Add `voice audition --approve --actor-id <id>` as same-run sugar. It must run only after a successful audition and must call the existing approve writer. Standalone `voice approve` stays.

Files: `src/types/cli-surface/types-types.ts`, `src/cli/native/native-parser.ts`, `src/cli/commands/process-steps/step-4-tts/voice-management/define-voice-command.ts`, `src/cli/commands/process-steps/step-4-tts/voice-management/character-voice-registry.ts`, the seven step-9-voice docs that currently mark `--generation-id` required, `docs/commands/process-steps/step-8-comic/04-reference-voice.md`.

Tests: usage cases for omitted `--generation-id` with one generation, with a current-index hit, and with an ambiguous catalog; `voice` with no args runs status and is not help; `voice --help` is still help; `audition --approve` without `--actor-id` fails; `audition --approve` does not approve on `--price`. Update `comic-usage.test.ts`, which currently pins `--generation-id is required.`

Exit: no public verb added or removed. Agents can audition, approve, inspect, retire, and delete a single-generation registration without copying a SHA-256.

### Phase 2 — Fold reads into `voice list`

Goal: one read command for the local catalog, one registration, and a remote provider catalog.

Add `voice list` with three modes:

| Invocation | Behavior |
| --- | --- |
| `voice list` | Today's `status`. Local catalog and current index. No provider calls. |
| `voice list <registration-id>` | Today's static inspect. No provider call unless `--live`. |
| `voice list --provider <name> [--source] [--cursor]` | Today's `discover`. |

`--live` is opt-in and only valid with a registration id. `--price` stays static-only. `--provider` and a registration id are mutually exclusive. Do not live-inspect the whole catalog.

Hide `status`, `inspect`, and `discover` as aliases:

- `voice status` → `voice list`
- `voice inspect <id>` → `voice list <id> --live` so existing scripts keep the current ready-resource provider GET
- `voice discover --provider ...` → `voice list --provider ...`

Set `defaultSubcommand` to `list`.

Docs: add `02-list.md` from the three read pages. Delete or stub `02-discover.md`, `09-inspect.md`, and `10-status.md` and drop them from `doc-command-flags-contract.test.ts`. Update `00-voice-overview.md`, README, and `docs/commands.md` examples to `voice list`.

Tests: help lists `list` and does not list `status`, `inspect`, or `discover`. Hidden names still parse. `list <id>` does not call `lifecycle.inspect` without `--live`. `inspect <id>` still does. Discover provider and cursor errors move onto `list` unchanged.

Exit: public read surface is one verb. Old read argv still works.

### Phase 3 — Fold `revoke-consent` into `consent --revoke`

Goal: one consent command for grant and revoke.

`consent` currently requires `<subject-key>`. `revoke-consent` requires `<consent-ref>`. Do not guess which is which from string shape.

Make the positional optional. Grant remains `voice consent <subject-key> --allow ... --provenance-ref ... --actor-id ...`. Revoke becomes `voice consent --revoke <consent-ref> --reason ... --actor-id ...`. `--revoke` plus `--allow` is a usage error. `--revoke` without `--reason` is a usage error. Grant without `--allow` stays a usage error.

Hide `revoke-consent`. Its handler remaps the positional locator onto `--revoke` and calls the grant command's revoke path.

Files: `define-voice-command.ts` (`handleConsent`, `handleRevokeConsent`, `consentCommand`), `01-consent.md`, delete or stub `14-revoke-consent.md`, overview action list.

Tests: grant unchanged; revoke via `--revoke`; `revoke-consent` alias still works; mixed `--allow` and `--revoke` fails; comic accepts both `consent` and `revoke-consent`.

Exit: consent is one advertised verb. Deny-by-default grants are unchanged.

### Phase 4 — Fold `revoke` into `retire --reason`

Goal: one local uncurrent command. Remote delete stays separate.

`handleLifecycle` already branches on `'retire' | 'revoke'`. `retire` with `--reason` should call the revoke transition. `retire` without `--reason` stays the current retire transition. Do not add `--delete`.

Hide `voice revoke` as an alias that requires `--reason` and calls the same revoke path.

Docs: fold `13-revoke.md` into `12-retire.md`. Keep the reason and `deletion-required` policy explicit.

Tests: retire without reason does not set `deletion-required`; retire with reason matches today's revoke; `voice revoke` still works; `voice retire --delete` is unknown.

Exit: local destroy is one verb. Remote destroy is still only `delete`.

### Phase 5 — Fold `materialize` into `design --save`

Goal: keep the two-step payment class, drop the second verb.

`design` requires `<subject-key>` and preview flags. `materialize` requires `<candidate-id>` plus `--subject-key` and `--voice-name`.

Add `--save <candidate-id>`. When `--save` is present, run today's materialize path and treat `<subject-key>` as optional because `--subject-key` already exists. When `--save` is absent, run today's design path and keep `<subject-key>` required. Reject preview flags (`--description`, `--preview-text`, `--candidates`, `--seed`, `--source-voice-id`, `--creation-model`) together with `--save`. Never infer `--save` from `--candidates 1`.

Hide `voice materialize`. Remap the positional candidate id onto `--save`.

Fish still materializes from the exact protected preview bytes. The journal and "no automatic repeat of an ambiguous create" rules stay in the materialize writer. Phase 6 adds `--reconcile`; this phase does not.

Docs: fold `05-materialize.md` into `04-design.md`. Update TTS docs that say "then `voice materialize`".

Tests: design without `--save` still only writes candidates; `--save` requires a real candidate id and voice name; `materialize` alias still provisions one candidate; `--price` on `--save` still reports zero provider cost; help no longer lists `materialize`.

Exit: designed voices still cannot become current without audition and approve. Users no longer need a second verb to save a chosen preview.

### Phase 6 — Replace `reconcile` with automatic completion plus `--reconcile`

Goal: recovery lives on the command that created the journal, matching TTS `--tts-allow-ambiguous-redispatch`.

Today `voice reconcile` is Fish-only, never recreates, and is never invoked by `status` or a retry of clone/materialize.

Implementation:

1. Extract the Fish journal completion in `fish-voice-reconciliation.ts` into a helper the CLI can call from multiple commands.
2. On `voice design --save`, `voice clone`, `voice delete`, and `voice list <id>`, if a pending or `reconciliation-required` journal exists for that registration: complete it when the lookup handle and issued resource are already in the journal (unambiguous). If the outcome is ambiguous, refuse with the same class of error TTS uses and tell the user to pass `--reconcile`.
3. `--reconcile` is valid only on those commands. It still must not recreate a missing Fish model. No handle means fail, same as today.
4. Hide `voice reconcile`. Alias remaps to `voice list <id> --reconcile` or to the pending create command when that is unambiguous from the journal.

Do not auto-reconcile during bare `voice list`. That would turn a local dump into provider calls.

Docs: fold `11-reconcile.md` into design, clone, delete, and list. Mention the TTS flag analogy once.

Tests: unambiguous pending journal completes on `list <id>` and on a retry of `--save`/clone/delete without `--reconcile`; ambiguous journal refuses until `--reconcile`; `--reconcile` still refuses recreate-without-handle; hidden `reconcile` still works; `--price` does not complete a journal.

Exit: no advertised `reconcile` verb. Ambiguous paid creates stay blocked by default.

### Phase 7 — Drop `--kind professional`

Goal: clone is instant clone. Professional workflow is an error that points at `voice import`.

`--kind` currently defaults to `instant` and accepts `professional`, which rejects `--sample` and prints the import guidance. Fish and Speechify already reject professional.

Remove `--kind` from advertised clone help and from `voiceReferenceAliasFlags`. If a user still passes `--kind professional`, fail with the current import guidance. If they pass `--kind instant`, accept it as a hidden leftover for one release, then reject it as unknown.

Do not delete adapter `cloneKind: 'professional'` support in this phase. ElevenLabs, Inworld, and Cartesia adapter tests still cover the external verification path. This phase is CLI surface only.

Docs: remove `--kind` from `06-clone.md` and the comic flag table. Keep one note: providers without instant clone use the provider console, then `voice import --voice-id`.

Tests: help does not advertise `--kind`; `clone --kind professional` still fails with the import message; clone without `--kind` is instant; adapter professional tests stay green.

Exit: clone has one workflow. Import remains the way to register a professionally approved ID.

### Phase 8 — Make `comic reference-voice` a real subcommand tree

Goal: same public verbs as `voice`, same per-command flags, no flag wall.

`comic reference-voice` is a leaf: required `<action>`, optional `[identity]`, and `voiceReferenceAliasFlags`. Help Phase 4 chose that shape so the alias could not drift. After Phases 2–7 the public set is small enough to nest for real.

Implementation:

1. Give `comic reference-voice` `subcommands` built from `VOICE_PUBLIC_ACTIONS` / the non-hidden voice children. Reuse the voice handlers. Rewrite `calledAs` to `comic reference-voice <action>` as today.
2. Parser becomes `comic reference-voice list`, `comic reference-voice design --save ...`, and so on. Identity positionals stay on the child, not on the parent.
3. Delete `voiceReferenceAliasFlags` from the parent once children carry their own flags. Keep the object only if a test still needs the group labels, then delete it.
4. Optionally keep hidden comic children for the old action names through the same alias window as `voice`. Do not keep the positional `<action>` parser.
5. Bare `comic reference-voice` should run `list`, matching bare `voice`.
6. Renumber `docs/commands/process-steps/step-9-voice/` to the surviving public commands and retarget `doc-command-flags-contract.test.ts`. Update `04-reference-voice.md` to the nested usage line.

Files: `reference-voice-command.ts`, `subcommand-help.ts`, `define-voice-command.ts` (stop exporting the flag wall if unused), `help-groups.ts` if the comic-only voice groups become unused, `cli-help-contracts.test.ts`, `comic-usage.test.ts`, `04-reference-voice.md`, `00-voice-overview.md`.

Tests: `comic reference-voice --help` lists the public children and does not dump `--sample` next to `--allow`. Each child help matches the sibling `voice` child flags. `comic reference-voice not-an-action` is `NativeNoSuchCommandError`, not the old joined-action string. `comic reference-voice clone` still requires a subject key. Hidden old names either parse as hidden children or are unknown, depending on the alias window chosen above.

Exit: both CLIs expose the same 8 advertised verbs (`list`, `consent`, `import`, `design`, `clone`, `audition`, `approve`, `retire`, `delete`) plus the parent default. The comic flag wall is gone.

### Phase dependency graph

```text
Phase 1  default generation-id, bare voice → status, audition --approve
   │
Phase 2  list + hidden command support + status/inspect/discover aliases
   │
   ├─ Phase 3  consent --revoke
   ├─ Phase 4  retire --reason
   ├─ Phase 5  design --save
   │
   └─ Phase 6  automatic / --reconcile   (wants Phase 5 so --save can resume)
          │
Phase 7  drop --kind professional        (independent of 3–6, after 2)
   │
Phase 8  comic subcommand tree           (after 2–7 public names are stable)
```

Phases 3, 4, and 5 can proceed in parallel after Phase 2. Phase 6 should follow Phase 5 so design save and clone share one recovery flag. Phase 7 can run anytime after Phase 2. Phase 8 waits until advertised `VOICE_PUBLIC_ACTIONS` is final.

### Removal window

Keep hidden aliases through Phase 8 and one release after it. Then delete hidden children, `voiceReferenceAliasFlags` if it remains, and any stub docs. Pin the tombstones the way `voice save-reference` is already pinned as an unknown command.

## Out of Scope

This report does not change protected-store policy, consent grant vocabulary, journal semantics, stock auto-approve, or the five managed models. It does not revive the removed `save-reference` action. It does not implement the shrink.
