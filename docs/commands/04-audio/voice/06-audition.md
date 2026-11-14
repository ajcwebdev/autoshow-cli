# voice audition

Purchase the canonical neutral, representative, pronunciation, and comparison passages for a ready draft registration, retaining audio in protected storage.

```bash
bun autoshow voice audition vr_ID --representative-line "We leave at dawn." --price
bun autoshow voice audition vr_ID --representative-line "We leave at dawn."
bun autoshow voice approve vr_ID --generation-id AUDITIONED_GENERATION_SHA256 --actor-id casting_editor
```

`--representative-line` is required. `--takes` accepts 1–5 per passage, default 1. `--max-cents` rejects estimates above the specified nonnegative ceiling; omission adds no cap. `--concurrency-mode ramp|immediate` uses shared hosted admission, default ramp.

Select `--generation-id` when ambiguous; use the new generation printed by audition for subsequent approval. The registered `--approve` shortcut requires `--actor-id`; `--price` still only estimates. The examples keep approval separate for review. Consent-bound voices require current permission for new synthesis. Remove `--price` only when intending to buy the audition; review the audio before approving it.

[Approval](07-approve.md) makes the auditioned generation current.
