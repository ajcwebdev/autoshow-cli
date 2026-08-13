# voice

Manage durable provider voice references separately from speech synthesis. The comic-native `comic reference-voice` command delegates to the same implementation and protected store.

## Usage

```bash
bun autoshow voice <action> [identity] [flags]
bun autoshow comic reference-voice <action> [identity] [flags]
```

Available actions are `consent`, `revoke-consent`, `discover`, `import`, `design`, `materialize`, `save-reference`, `audition`, `approve`, `inspect`, `reconcile`, `retire`, `revoke`, `delete`, and `status`. Run `bun autoshow voice <action> --help` for the exact action flags.

Voice management reads authored profiles from `input/characters/character-voices.json`. Profiles are independent of the visual character catalog. A minimal catalog is:

```json
{
  "schemaVersion": 1,
  "briefs": [
    {
      "subjectKey": "hero",
      "profileKey": "default",
      "language": "en",
      "locale": "en-US",
      "timbre": "warm and grounded",
      "mannerisms": [],
      "prohibitedCaricatures": [],
      "pronunciations": [],
      "allowedOrigins": ["provider-stock", "saved-reference"]
    }
  ]
}
```

## Typical Flow

Register an existing provider voice without making a provider call:

```bash
bun autoshow voice import hero --provider openai --model gpt-4o-mini-tts-2025-12-15 --voice-id cedar --origin provider-stock --provenance-ref project:casting
```

ElevenLabs, Hume, MiniMax, Cartesia, and Speechify expose read-only catalog discovery through the same shared command. `--price` validates the operation and reports the dated capability fixture without reading the provider:

```bash
bun autoshow voice discover --provider elevenlabs --source account
bun autoshow voice discover --provider elevenlabs --source shared-library --cursor OPAQUE_CURSOR
bun autoshow voice discover --provider hume --source provider-library
bun autoshow voice discover --provider hume --source account --price
bun autoshow voice discover --provider minimax --source account
bun autoshow voice discover --provider cartesia --source provider-library --cursor OPAQUE_CURSOR
bun autoshow voice discover --provider speechify --source account --price
```

Advanced Voice Design is a two-step operation for ElevenLabs, Hume, and MiniMax. `design` creates a bounded set of protected, unapproved candidates; `materialize` creates exactly one selected provider resource through the crash-safe provisioning journal and appends a draft registration. Hume designs with Octave 1 even when the materialized voice will synthesize with Octave 2. ElevenLabs remix requires both the stable source ID and a dated eligibility snapshot hash before any provider call. MiniMax returns one candidate whose remote ID remains temporary until first successful synthesis and expires after seven days if it is not activated:

```bash
bun autoshow voice design hero --provider hume --model octave-2 --creation-model octave-1 --description "Warm, weathered guide" --preview-text "A representative passage of at least one hundred characters that exercises the intended voice..." --candidates 3 --price
bun autoshow voice design hero --provider elevenlabs --model eleven_v3 --creation-model eleven_ttv_v3 --description "Warm, weathered guide" --preview-text "A representative passage of at least one hundred characters that exercises the intended voice..." --price
bun autoshow voice design hero --provider minimax --model speech-2.8-hd --creation-model voice-design --description "Warm, weathered guide" --preview-text "A short representative passage." --candidates 1 --price
bun autoshow voice materialize CANDIDATE_ID --provider hume --subject-key hero --voice-name HeroGuide --provenance-ref project:casting --price
```

Remove `--price` from `design` only when you intend to purchase provider previews. Candidate audio stays in the owner-only protected store. Remove `--price` from `materialize` only after selecting one candidate and intending to create its remote voice. A materialized registration must still pass the canonical audition and explicit local approval flow below before comic rendering can use it.

For a consent-bound reference, first store an explicit per-action consent record. Omitted actions default to denied, and contact PII must not be used as the actor or provenance reference:

```bash
bun autoshow voice consent hero --provenance-ref release:hero-v1 --allow upload,new-synthesis,retention,deletion --actor-id casting_editor
```

The command prints an opaque `protected-consent:v1:...` locator. Use that locator when planning or explicitly executing Mistral saved-reference provisioning:

```bash
bun autoshow voice save-reference hero --model voxtral-mini-tts-2603 --voice-name HeroReference --reference-audio input/voices/hero.wav --authorization-ref release:hero-v1 --consent-ref protected-consent:v1:STORE:ASSET:SHA256 --provenance-ref project:casting --price
```

Remove `--price` only when you intend to execute the provider mutation. A provisioning journal is written before dispatch, records issued provider resources before the terminal outcome, and never automatically repeats an ambiguous create. Use `voice reconcile` with the pending registration generation after an interrupted request.

Consent records are immutable and content-addressed. Revoke one by appending a protected marker; the original locator then fails every consent gate:

```bash
bun autoshow voice revoke-consent protected-consent:v1:STORE:ASSET:SHA256 --reason "Authorization withdrawn" --actor-id casting_editor
```

Auditioning synthesizes a protected canonical set containing neutral, representative, emotional contrast, pronunciation, and comparison passages. It is a provider-backed action unless `--price` is supplied:

```bash
bun autoshow voice audition vr_ID --generation-id GENERATION_SHA256 --representative-line "We leave at dawn." --takes 1 --price
bun autoshow voice approve vr_ID --generation-id AUDITIONED_GENERATION_SHA256 --actor-id casting_editor
```

Approval appends a new content-identified registration generation and atomically advances the sole current pointer for `(subject, provider, provider model, profile)`. This model-qualified key permits one subject to hold independent approved Hume Octave 1 and Octave 2 selections that refer to the same provider voice resource. Version 1 current indexes are migrated in memory by resolving each selection's model from its registration, then rewritten as version 2 on the next mutation. Approval does not create a scene snapshot; scene snapshots belong to ADR-014 Phase 2.

## Lifecycle

`retire` and `revoke` are local append-preserving transitions that remove the exact approved generation from the current index. Revocation records a reason and moves protected assets to `deletion-required` when the registration policy requires it; it does not silently delete remote resources.

`inspect` performs a read-only provider check for ready ElevenLabs, Hume, MiniMax, Cartesia, Speechify, and Mistral account resources unless `--price` is supplied. MiniMax designed and cloned voices remain pending until activation makes them visible in the account catalog. Expired, missing, pending, or verification-required resources never become synthesis-ready merely because a local registration exists.

`delete` is an explicit provider-mutating action for eligibility-checked, project-owned Mistral, ElevenLabs, Hume, MiniMax, Cartesia, and Speechify resources and requires `--confirm-voice-id` to equal the exact resource ID. A resource cannot be deleted while another current model-qualified registration shares its provider/resource identity. Hume's endpoint deletes by mutable name, so Hume additionally requires `--expected-name`; AutoShow immediately refreshes the custom catalog and proceeds only when that name resolves uniquely to the expected ID. MiniMax deletion selects the clone or generated-voice resource class from the registered origin. Cartesia and Speechify delete only project-owned account/personal resources. AutoShow first appends a local `deletion-pending` generation, then records a terminal deleted tombstone after the provider confirms deletion.

## Advanced Provider Capabilities

| Provider | Catalog | Design | Clone facet | Native multi-speaker |
|---|---|---|---|---|
| ElevenLabs | Account and shared library | Design and eligibility-proved remix | Instant clone; Professional Voice Clone reports verification state | `eleven_v3` Text-to-Dialogue when the plan is exactly representable |
| Hume | Stock and custom account voices | Octave 1 design, compatible with Octave 1/2 synthesis | Subscription-gated dashboard action followed by stable-ID import | Octave 2 native utterances |
| MiniMax | System, generated, and cloned voices | One temporary generated candidate | One protected mp3/m4a/wav sample, 10 seconds–5 minutes and no larger than 20 MiB, through upload and clone APIs | No; segmented rendering |
| Cartesia | Public and account voices with cursor pagination | Not exposed | Instant API clone; Pro Voice Clone remains a gated dashboard action | No; segmented rendering |
| Speechify | Shared and personal voices with cursor pagination | Not exposed | Personal voice clone with protected 10–30 second sample and consent payload | No; segmented rendering |

Clone ports consume protected assets and explicit consent/provenance records and never place sample bytes or contact PII in ordinary artifacts. Synthesis commands cannot invoke them. Cartesia and Speechify text-prompt design, all three providers' native multi-speaker dialogue, MiniMax professional cloning, and Speechify professional cloning are explicitly unsupported rather than inferred from adjacent provider features.

## Protected and Ordinary Artifacts

Protected reference, preview, audition, consent, and reconciliation bytes live under the registered owner-only runtime store. Policies are content-addressed, workspaces are disposable, and the protected root must be disjoint from ordinary output roots.

Ordinary character artifacts contain only strict versioned metadata and opaque protected-asset locators:

- `input/characters/character-voices.json`
- `input/characters/character-voice-registrations.json`
- `input/characters/character-voice-current.json`
- `input/characters/voice-candidates/<candidate-id>.json`
- `input/characters/voice-references/<subject>/<provider>/<registration>/<generation>/registration-snapshot.json`
- `input/characters/voice-references/<subject>/<provider>/<registration>/<generation>/audition-manifest.json`

Registration and audition generations are create-only and content-identified. The catalog preserves every prior generation; the current index contains only approved, ready registrations.

## Price Safety

Management `--price` modes perform local validation and estimate only. They make no provider calls and write neither protected nor ordinary artifacts. Voice Design reports a numeric preview estimate from the exact provider, creation model, character count, and candidate count; ElevenLabs charges its preview text once while Hume charges it for each requested candidate. Materialization reports zero estimated provider cost because the supported design flows include saving the selected resource. Ordinary `tts`, `write`, resume, configuration loading, and synthesis price paths cannot express provider resource creation.

Provider prices and eligibility can change. Treat the estimate as a preflight derived from AutoShow's dated pricing configuration and use the provider console when account-specific terms matter.
