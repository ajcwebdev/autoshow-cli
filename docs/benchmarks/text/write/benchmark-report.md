# Five-prompt LLM speed and cost benchmark

The current comparison has 112 valid structured outputs across 115 prompt/model pairs, 23 model/provider routes, and five prompts. Recorded history contains 122 attempts: 115 first-pass requests (108 valid) and 7 reruns (4 valid). Cumulative usage-based catalog costs total $4.262358; 5 attempted slots have unresolved or unavailable billing.

Among routes with all five valid outputs, the lowest mean request cost is **openai/gpt-6-luna** ($0.000748) and the lowest mean request latency is **openai/gpt-5.6-luna** (4.458s).

## Method and spending

The approved batch is one pass of five fixed input/preset pairs across the 23 routes captured in [benchmark-plan.json](benchmark-plan.json). The registry preflight estimated $2.984054 before additional reasoning usage or unreported failure charges. Each provider can run 2 targets concurrently. The original batch used the CLI/model reasoning defaults available at execution time, including low reasoning for direct Kimi K3. Removed routes and their original settings remain historical evidence; current support comes from the live CLI catalog.

Each slot makes one inference attempt. The benchmark blocks schema-validation repurchases and adapter fallback requests; explicitly rejected admission requests may retry. Dispatch-started receipts are saved before network access, and existing receipts prevent repurchasing successful, invalid, failed, or ambiguous slots on replay. Raw responses and provider usage remain available beside each manifest.

Targeted reruns are pinned in [rerun-plan.json](rerun-plan.json) and saved separately beneath each affected case’s `reruns/` directory. The current comparison selects the latest completed attempt per prompt/model pair, including a latest failure. Earlier attempts and their costs remain preserved in request evidence. Rerunning selected failures does not establish repeated-run latency statistics.

Latency is observed wall-clock seconds per request, including provider latency and generation. The aggregate gives each prompt equal weight and includes only routes with valid outputs for all five cases. It is not time to first token or decode throughput. One observation does not establish stable median performance.

Cost multiplies recorded provider usage by the saved uncached catalog tariffs; cache discounts and Gemini Argon introductory pricing are excluded. Local token estimates remain labeled where provider usage is missing. Cumulative totals include every original and rerun attempt, including failed or invalid outputs; comparison ranks use only selected valid requests. Missing billing remains unavailable rather than zero, even after a later rerun succeeds. These are usage-based cost calculations, not provider invoices or confirmed amounts charged.

At the user’s request, the temporary quality proxy is the listed USD price per million output tokens, with higher prices treated as the proxy for higher quality. This rate is separate from measured dollars per request, which also depends on input, output, reasoning, and caching. No text judge, human quality score, or instruction-compliance score was purchased or inferred.

## Selected workloads

| Preset         | Input                                                                                                        | Current valid / routes | Cumulative usage-based cost   |
| -------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------- | ----------------------------- |
| shortSummary   | `docs/benchmarks/text/write/2026-09-16_06-51-18-238_1-audio/transcription.txt`                               | 22/23                  | $0.091028                     |
| longSummary    | `docs/benchmarks/stt/with-speakers/2022-09-30-widgets-fsjam-40-minutes/consensus-transcription.txt`          | 23/23                  | $0.901087                     |
| mediumChapters | `docs/benchmarks/stt/with-speakers/2023-04-05-jsjam-react-miami-2023-10-minutes/consensus-transcription.txt` | 23/23                  | $0.467989 known; 1 unresolved |
| blog           | `docs/benchmarks/stt/with-speakers/2023-04-05-jsjam-react-miami-2023-10-minutes/consensus-transcription.txt` | 23/23                  | $0.920668                     |
| rapSongChapter | `input/examples/document/harborlight-field-notes.md`                                                         | 21/23                  | $1.881586 known; 4 unresolved |

The short summary produces at most 180 characters from the original 216-word input. The long summary compresses the saved 7,919-word transcript into roughly 100–200 words. Medium chapters extract timestamps and descriptions from the 1,637-word transcript. The blog uses that same transcript for an outline and a draft of at least 750 words. The chapter-song case adapts the original 838-word Harborlight field notes under extensive lyric constraints. Schema checks establish structured artifact validity; these requested prose lengths and creative constraints are not independently scored.

## All-five comparison

| Model / provider            | Valid cases | Mean seconds / request | Mean USD / request | Price proxy USD / 1M output |
| --------------------------- | ----------- | ---------------------- | ------------------ | --------------------------- |
| anthropic/claude-fable-5-1  | 5/5         | 27.125s                | $0.157432          | $50.00                      |
| anthropic/claude-haiku-5-5  | 5/5         | 9.285s                 | $0.001485          | $0.50                       |
| anthropic/claude-opus-5     | 5/5         | 27.353s                | $0.075961          | $25.00                      |
| anthropic/claude-opus-5-5   | 5/5         | 15.794s                | $0.049433          | $20.00                      |
| anthropic/claude-sonnet-5   | 5/5         | 23.260s                | $0.032252          | $10.00                      |
| anthropic/claude-sonnet-5-5 | 4/5         | n/a                    | n/a                | n/a                         |
| gemini/gemini-3.7-flash     | 5/5         | 15.524s                | $0.019377          | $7.50                       |
| gemini/gemini-3.8-flash     | 5/5         | 15.837s                | $0.021681          | $7.50                       |
| gemini/gemini-4-argon       | 5/5         | 11.679s                | $0.030078          | $20.00                      |
| glm/glm-5.3                 | 4/5         | n/a                    | n/a                | n/a                         |
| glm/glm-5.3-flash           | 4/5         | n/a                    | n/a                | n/a                         |
| grok/grok-4.6               | 5/5         | 98.502s                | $0.043325          | $6.00                       |
| grok/grok-4.7               | 5/5         | 163.861s               | $0.081526          | $6.00                       |
| kimi/kimi-k3                | 5/5         | 25.933s                | $0.024204          | $15.00                      |
| openai/gpt-5.6-luna         | 5/5         | 4.458s                 | $0.001545          | $1.20                       |
| openai/gpt-5.6-sol          | 5/5         | 8.271s                 | $0.031188          | $20.00                      |
| openai/gpt-5.6-terra        | 5/5         | 7.048s                 | $0.015350          | $12.00                      |
| openai/gpt-6-astra          | 5/5         | 15.192s                | $0.077590          | $50.00                      |
| openai/gpt-6-luna           | 5/5         | 4.975s                 | $0.000748          | $0.50                       |
| openai/gpt-6.1-sol          | 5/5         | 12.211s                | $0.015260          | $10.00                      |
| together/glm-5.3            | 5/5         | 7.492s                 | $0.008139          | $4.40                       |
| together/glm-5.3-flash      | 5/5         | 37.663s                | $0.004844          | $0.50                       |
| together/kimi-k3            | 5/5         | 54.112s                | $0.054176          | $15.00                      |

The [checksummed response evidence](2026-10-18-write.evidence.zip) preserves original saved bytes, including each case’s decoded `raw-response-*.json`, failure evidence, durable `slot-*.json` receipts, source and prompt snapshots, canonical manifests, and pinned plans. Nested rerun evidence is included when present. `SHA256SUMS` identifies every archived file. Standalone request artifacts remain inputs to hash-checked cache reuse.

The directory relocation under `docs/benchmarks/text/write` updated standalone path references, prompt source paths, dependent checksums, and plan fingerprints. The existing evidence ZIP remains unchanged and retains the original request snapshots, fingerprints, and approval provenance. The relocated rerun plan has no execution authorization; moving these records does not approve another paid request.

## Short summary

[First-pass manifest](2026-10-18_01-short-summary/manifest.json) · [First-pass provider report](2026-10-18_01-short-summary/provider-comparison-report.md)

| Model / provider            | Attempt | Status        | Seconds | USD       | Input tokens | Billed output tokens | Cost basis     | Evidence                                                        |
| --------------------------- | ------- | ------------- | ------- | --------- | ------------ | -------------------- | -------------- | --------------------------------------------------------------- |
| anthropic/claude-haiku-5-5  | 01      | succeeded     | 1.027   | $0.000107 | 817          | 51                   | provider_usage | [Manifest](2026-10-18_01-short-summary/manifest.json)           |
| openai/gpt-5.6-luna         | 01      | succeeded     | 1.229   | $0.000179 | 438          | 76                   | provider_usage | [Manifest](2026-10-18_01-short-summary/manifest.json)           |
| anthropic/claude-sonnet-5   | 01      | succeeded     | 1.422   | $0.002240 | 815          | 61                   | provider_usage | [Manifest](2026-10-18_01-short-summary/manifest.json)           |
| openai/gpt-5.6-terra        | 01      | succeeded     | 1.544   | $0.001296 | 438          | 35                   | provider_usage | [Manifest](2026-10-18_01-short-summary/manifest.json)           |
| anthropic/claude-opus-5     | 01      | succeeded     | 1.688   | $0.005550 | 815          | 59                   | provider_usage | [Manifest](2026-10-18_01-short-summary/manifest.json)           |
| openai/gpt-5.6-sol          | 01      | succeeded     | 1.740   | $0.002552 | 438          | 40                   | provider_usage | [Manifest](2026-10-18_01-short-summary/manifest.json)           |
| together/glm-5.3            | 01      | succeeded     | 2.780   | $0.000772 | 429          | 39                   | provider_usage | [Manifest](2026-10-18_01-short-summary/manifest.json)           |
| openai/gpt-6-luna           | 01      | succeeded     | 2.796   | $0.000088 | 438          | 88                   | provider_usage | [Manifest](2026-10-18_01-short-summary/manifest.json)           |
| together/glm-5.3-flash      | 01      | succeeded     | 2.800   | $0.000317 | 429          | 506                  | provider_usage | [Manifest](2026-10-18_01-short-summary/manifest.json)           |
| openai/gpt-6.1-sol          | 01      | succeeded     | 2.882   | $0.001296 | 438          | 42                   | provider_usage | [Manifest](2026-10-18_01-short-summary/manifest.json)           |
| anthropic/claude-opus-5-5   | 01      | succeeded     | 2.899   | $0.004628 | 817          | 68                   | provider_usage | [Manifest](2026-10-18_01-short-summary/manifest.json)           |
| openai/gpt-6-astra          | 01      | succeeded     | 2.957   | $0.009180 | 438          | 96                   | provider_usage | [Manifest](2026-10-18_01-short-summary/manifest.json)           |
| anthropic/claude-fable-5-1  | 01      | succeeded     | 3.529   | $0.011220 | 817          | 61                   | provider_usage | [Manifest](2026-10-18_01-short-summary/manifest.json)           |
| gemini/gemini-3.8-flash     | 01      | succeeded     | 3.783   | $0.003972 | 468          | 436                  | provider_usage | [Manifest](2026-10-18_01-short-summary/manifest.json)           |
| gemini/gemini-3.7-flash     | 01      | succeeded     | 4.013   | $0.003889 | 468          | 425                  | provider_usage | [Manifest](2026-10-18_01-short-summary/manifest.json)           |
| together/kimi-k3            | 01      | succeeded     | 4.620   | $0.003972 | 589          | 147                  | provider_usage | [Manifest](2026-10-18_01-short-summary/manifest.json)           |
| gemini/gemini-4-argon       | 01      | succeeded     | 5.559   | $0.003804 | 666          | 57                   | provider_usage | [Manifest](2026-10-18_01-short-summary/manifest.json)           |
| kimi/kimi-k3                | 01      | succeeded     | 5.571   | $0.003996 | 542          | 158                  | provider_usage | [Manifest](2026-10-18_01-short-summary/manifest.json)           |
| grok/grok-4.7               | 01      | succeeded     | 6.673   | $0.007886 | 1714         | 743                  | provider_usage | [Manifest](2026-10-18_01-short-summary/manifest.json)           |
| glm/glm-5.3                 | 01      | succeeded     | 7.614   | $0.003034 | 429          | 553                  | provider_usage | [Manifest](2026-10-18_01-short-summary/manifest.json)           |
| glm/glm-5.3-flash           | 01      | succeeded     | 8.387   | $0.000323 | 429          | 517                  | provider_usage | [Manifest](2026-10-18_01-short-summary/manifest.json)           |
| grok/grok-4.6               | 01      | succeeded     | 37.233  | $0.016118 | 1108         | 2317                 | provider_usage | [Manifest](2026-10-18_01-short-summary/manifest.json)           |
| anthropic/claude-sonnet-5-5 | 02      | schema failed | 1.586   | $0.002294 | 817          | 66                   | provider_usage | [Manifest](2026-10-18_01-short-summary/reruns/02/manifest.json) |

## Long summary

[First-pass manifest](2026-10-18_02-long-summary/manifest.json) · [First-pass provider report](2026-10-18_02-long-summary/provider-comparison-report.md)

| Model / provider            | Attempt | Status    | Seconds | USD       | Input tokens | Billed output tokens | Cost basis     | Evidence                                             |
| --------------------------- | ------- | --------- | ------- | --------- | ------------ | -------------------- | -------------- | ---------------------------------------------------- |
| openai/gpt-6-luna           | 01      | succeeded | 2.292   | $0.001145 | 10205        | 249                  | provider_usage | [Manifest](2026-10-18_02-long-summary/manifest.json) |
| openai/gpt-5.6-luna         | 01      | succeeded | 2.436   | $0.002379 | 10205        | 282                  | provider_usage | [Manifest](2026-10-18_02-long-summary/manifest.json) |
| anthropic/claude-haiku-5-5  | 01      | succeeded | 3.554   | $0.001645 | 14152        | 459                  | provider_usage | [Manifest](2026-10-18_02-long-summary/manifest.json) |
| openai/gpt-6-astra          | 01      | succeeded | 3.754   | $0.112150 | 10205        | 202                  | provider_usage | [Manifest](2026-10-18_02-long-summary/manifest.json) |
| openai/gpt-5.6-terra        | 01      | succeeded | 3.866   | $0.023446 | 10205        | 253                  | provider_usage | [Manifest](2026-10-18_02-long-summary/manifest.json) |
| openai/gpt-6.1-sol          | 01      | succeeded | 3.964   | $0.022410 | 10205        | 200                  | provider_usage | [Manifest](2026-10-18_02-long-summary/manifest.json) |
| openai/gpt-5.6-sol          | 01      | succeeded | 4.021   | $0.046060 | 10205        | 262                  | provider_usage | [Manifest](2026-10-18_02-long-summary/manifest.json) |
| anthropic/claude-sonnet-5-5 | 01      | succeeded | 4.570   | $0.031754 | 14152        | 345                  | provider_usage | [Manifest](2026-10-18_02-long-summary/manifest.json) |
| gemini/gemini-4-argon       | 01      | succeeded | 5.440   | $0.049484 | 11336        | 207                  | provider_usage | [Manifest](2026-10-18_02-long-summary/manifest.json) |
| anthropic/claude-sonnet-5   | 01      | succeeded | 5.856   | $0.033270 | 14150        | 497                  | provider_usage | [Manifest](2026-10-18_02-long-summary/manifest.json) |
| anthropic/claude-opus-5-5   | 01      | succeeded | 6.471   | $0.066428 | 14152        | 491                  | provider_usage | [Manifest](2026-10-18_02-long-summary/manifest.json) |
| together/glm-5.3            | 01      | succeeded | 7.509   | $0.016528 | 10489        | 419                  | provider_usage | [Manifest](2026-10-18_02-long-summary/manifest.json) |
| anthropic/claude-fable-5-1  | 01      | succeeded | 7.518   | $0.165270 | 14152        | 475                  | provider_usage | [Manifest](2026-10-18_02-long-summary/manifest.json) |
| gemini/gemini-3.7-flash     | 01      | succeeded | 8.424   | $0.024110 | 11103        | 994                  | provider_usage | [Manifest](2026-10-18_02-long-summary/manifest.json) |
| anthropic/claude-opus-5     | 01      | succeeded | 8.766   | $0.084250 | 14150        | 540                  | provider_usage | [Manifest](2026-10-18_02-long-summary/manifest.json) |
| gemini/gemini-3.8-flash     | 01      | succeeded | 9.153   | $0.025804 | 11103        | 1220                 | provider_usage | [Manifest](2026-10-18_02-long-summary/manifest.json) |
| grok/grok-4.7               | 01      | succeeded | 11.355  | $0.028128 | 11502        | 854                  | provider_usage | [Manifest](2026-10-18_02-long-summary/manifest.json) |
| kimi/kimi-k3                | 01      | succeeded | 12.704  | $0.035469 | 10323        | 300                  | provider_usage | [Manifest](2026-10-18_02-long-summary/manifest.json) |
| together/glm-5.3-flash      | 01      | succeeded | 15.812  | $0.002792 | 10489        | 2438                 | provider_usage | [Manifest](2026-10-18_02-long-summary/manifest.json) |
| together/kimi-k3            | 01      | succeeded | 20.417  | $0.049833 | 10371        | 1248                 | provider_usage | [Manifest](2026-10-18_02-long-summary/manifest.json) |
| glm/glm-5.3-flash           | 01      | succeeded | 21.045  | $0.002575 | 10489        | 2003                 | provider_usage | [Manifest](2026-10-18_02-long-summary/manifest.json) |
| glm/glm-5.3                 | 01      | succeeded | 44.178  | $0.024563 | 10489        | 2245                 | provider_usage | [Manifest](2026-10-18_02-long-summary/manifest.json) |
| grok/grok-4.6               | 01      | succeeded | 75.473  | $0.051594 | 10896        | 4967                 | provider_usage | [Manifest](2026-10-18_02-long-summary/manifest.json) |

## Medium chapters

[First-pass manifest](2026-10-18_03-medium-chapters/manifest.json) · [First-pass provider report](2026-10-18_03-medium-chapters/provider-comparison-report.md)

| Model / provider            | Attempt | Status    | Seconds | USD       | Input tokens | Billed output tokens | Cost basis     | Evidence                                                          |
| --------------------------- | ------- | --------- | ------- | --------- | ------------ | -------------------- | -------------- | ----------------------------------------------------------------- |
| openai/gpt-5.6-luna         | 01      | succeeded | 2.707   | $0.000934 | 2540         | 355                  | provider_usage | [Manifest](2026-10-18_03-medium-chapters/manifest.json)           |
| openai/gpt-6-luna           | 01      | succeeded | 2.813   | $0.000438 | 2540         | 368                  | provider_usage | [Manifest](2026-10-18_03-medium-chapters/manifest.json)           |
| openai/gpt-5.6-sol          | 01      | succeeded | 3.706   | $0.018720 | 2540         | 428                  | provider_usage | [Manifest](2026-10-18_03-medium-chapters/manifest.json)           |
| openai/gpt-5.6-terra        | 01      | succeeded | 4.234   | $0.010036 | 2540         | 413                  | provider_usage | [Manifest](2026-10-18_03-medium-chapters/manifest.json)           |
| together/glm-5.3            | 01      | succeeded | 4.879   | $0.005292 | 2554         | 390                  | provider_usage | [Manifest](2026-10-18_03-medium-chapters/manifest.json)           |
| openai/gpt-6-astra          | 01      | succeeded | 5.795   | $0.045400 | 2540         | 400                  | provider_usage | [Manifest](2026-10-18_03-medium-chapters/manifest.json)           |
| anthropic/claude-opus-5-5   | 01      | succeeded | 6.116   | $0.024928 | 3932         | 460                  | provider_usage | [Manifest](2026-10-18_03-medium-chapters/manifest.json)           |
| openai/gpt-6.1-sol          | 01      | succeeded | 6.263   | $0.008990 | 2540         | 391                  | provider_usage | [Manifest](2026-10-18_03-medium-chapters/manifest.json)           |
| gemini/gemini-4-argon       | 01      | succeeded | 6.451   | $0.019028 | 3067         | 338                  | provider_usage | [Manifest](2026-10-18_03-medium-chapters/manifest.json)           |
| anthropic/claude-sonnet-5-5 | 01      | succeeded | 6.974   | $0.015564 | 3932         | 770                  | provider_usage | [Manifest](2026-10-18_03-medium-chapters/manifest.json)           |
| anthropic/claude-haiku-5-5  | 01      | succeeded | 7.853   | $0.001157 | 3932         | 1528                 | provider_usage | [Manifest](2026-10-18_03-medium-chapters/manifest.json)           |
| glm/glm-5.3                 | 02      | succeeded | 7.991   | $0.005908 | 2554         | 530                  | provider_usage | [Manifest](2026-10-18_03-medium-chapters/reruns/02/manifest.json) |
| gemini/gemini-3.7-flash     | 01      | succeeded | 9.366   | $0.014163 | 2747         | 1339                 | provider_usage | [Manifest](2026-10-18_03-medium-chapters/manifest.json)           |
| anthropic/claude-fable-5-1  | 01      | succeeded | 10.938  | $0.081020 | 3932         | 834                  | provider_usage | [Manifest](2026-10-18_03-medium-chapters/manifest.json)           |
| anthropic/claude-opus-5     | 01      | succeeded | 12.159  | $0.041475 | 3930         | 873                  | provider_usage | [Manifest](2026-10-18_03-medium-chapters/manifest.json)           |
| gemini/gemini-3.8-flash     | 01      | succeeded | 13.433  | $0.018431 | 2747         | 1908                 | provider_usage | [Manifest](2026-10-18_03-medium-chapters/manifest.json)           |
| anthropic/claude-sonnet-5   | 01      | succeeded | 15.097  | $0.021520 | 3930         | 1366                 | provider_usage | [Manifest](2026-10-18_03-medium-chapters/manifest.json)           |
| kimi/kimi-k3                | 01      | succeeded | 17.159  | $0.017430 | 2615         | 639                  | provider_usage | [Manifest](2026-10-18_03-medium-chapters/manifest.json)           |
| together/glm-5.3-flash      | 01      | succeeded | 19.041  | $0.002673 | 2554         | 4580                 | provider_usage | [Manifest](2026-10-18_03-medium-chapters/manifest.json)           |
| grok/grok-4.7               | 01      | succeeded | 26.184  | $0.021388 | 3875         | 2273                 | provider_usage | [Manifest](2026-10-18_03-medium-chapters/manifest.json)           |
| together/kimi-k3            | 01      | succeeded | 40.421  | $0.040818 | 2726         | 2176                 | provider_usage | [Manifest](2026-10-18_03-medium-chapters/manifest.json)           |
| glm/glm-5.3-flash           | 01      | succeeded | 78.624  | $0.003995 | 2554         | 7223                 | provider_usage | [Manifest](2026-10-18_03-medium-chapters/manifest.json)           |
| grok/grok-4.6               | 01      | succeeded | 121.547 | $0.048682 | 3269         | 7024                 | provider_usage | [Manifest](2026-10-18_03-medium-chapters/manifest.json)           |

## Blog

[First-pass manifest](2026-10-18_04-blog/manifest.json) · [First-pass provider report](2026-10-18_04-blog/provider-comparison-report.md)

| Model / provider            | Attempt | Status    | Seconds | USD       | Input tokens | Billed output tokens | Cost basis     | Evidence                                     |
| --------------------------- | ------- | --------- | ------- | --------- | ------------ | -------------------- | -------------- | -------------------------------------------- |
| openai/gpt-6-luna           | 01      | succeeded | 9.130   | $0.001043 | 2409         | 1605                 | provider_usage | [Manifest](2026-10-18_04-blog/manifest.json) |
| openai/gpt-5.6-luna         | 01      | succeeded | 9.226   | $0.002266 | 2409         | 1487                 | provider_usage | [Manifest](2026-10-18_04-blog/manifest.json) |
| together/glm-5.3            | 01      | succeeded | 12.372  | $0.009066 | 2434         | 1286                 | provider_usage | [Manifest](2026-10-18_04-blog/manifest.json) |
| openai/gpt-5.6-terra        | 01      | succeeded | 14.821  | $0.023934 | 2409         | 1593                 | provider_usage | [Manifest](2026-10-18_04-blog/manifest.json) |
| anthropic/claude-haiku-5-5  | 01      | succeeded | 15.150  | $0.001701 | 3660         | 2670                 | provider_usage | [Manifest](2026-10-18_04-blog/manifest.json) |
| openai/gpt-5.6-sol          | 01      | succeeded | 17.055  | $0.047936 | 2409         | 1915                 | provider_usage | [Manifest](2026-10-18_04-blog/manifest.json) |
| gemini/gemini-4-argon       | 01      | succeeded | 18.846  | $0.035656 | 2879         | 1207                 | provider_usage | [Manifest](2026-10-18_04-blog/manifest.json) |
| gemini/gemini-3.7-flash     | 01      | succeeded | 20.599  | $0.019845 | 2620         | 2122                 | provider_usage | [Manifest](2026-10-18_04-blog/manifest.json) |
| openai/gpt-6-astra          | 01      | succeeded | 23.428  | $0.105790 | 2409         | 1634                 | provider_usage | [Manifest](2026-10-18_04-blog/manifest.json) |
| openai/gpt-6.1-sol          | 01      | succeeded | 25.054  | $0.022278 | 2409         | 1746                 | provider_usage | [Manifest](2026-10-18_04-blog/manifest.json) |
| anthropic/claude-opus-5-5   | 01      | succeeded | 25.736  | $0.061740 | 3660         | 2355                 | provider_usage | [Manifest](2026-10-18_04-blog/manifest.json) |
| anthropic/claude-sonnet-5-5 | 01      | succeeded | 25.924  | $0.033590 | 3660         | 2627                 | provider_usage | [Manifest](2026-10-18_04-blog/manifest.json) |
| gemini/gemini-3.8-flash     | 01      | succeeded | 27.687  | $0.030480 | 2620         | 3540                 | provider_usage | [Manifest](2026-10-18_04-blog/manifest.json) |
| anthropic/claude-sonnet-5   | 01      | succeeded | 28.233  | $0.029546 | 3658         | 2223                 | provider_usage | [Manifest](2026-10-18_04-blog/manifest.json) |
| kimi/kimi-k3                | 01      | succeeded | 39.900  | $0.028266 | 2497         | 1385                 | provider_usage | [Manifest](2026-10-18_04-blog/manifest.json) |
| anthropic/claude-fable-5-1  | 01      | succeeded | 40.455  | $0.164500 | 3660         | 2558                 | provider_usage | [Manifest](2026-10-18_04-blog/manifest.json) |
| together/glm-5.3-flash      | 01      | succeeded | 40.997  | $0.006593 | 2434         | 12455                | provider_usage | [Manifest](2026-10-18_04-blog/manifest.json) |
| anthropic/claude-opus-5     | 01      | succeeded | 48.785  | $0.092640 | 3658         | 2974                 | provider_usage | [Manifest](2026-10-18_04-blog/manifest.json) |
| together/kimi-k3            | 01      | succeeded | 59.771  | $0.061407 | 2569         | 3580                 | provider_usage | [Manifest](2026-10-18_04-blog/manifest.json) |
| grok/grok-4.6               | 01      | succeeded | 60.125  | $0.021550 | 3107         | 2556                 | provider_usage | [Manifest](2026-10-18_04-blog/manifest.json) |
| glm/glm-5.3                 | 01      | succeeded | 71.987  | $0.032562 | 2434         | 6626                 | provider_usage | [Manifest](2026-10-18_04-blog/manifest.json) |
| glm/glm-5.3-flash           | 01      | succeeded | 76.448  | $0.003831 | 2434         | 6932                 | provider_usage | [Manifest](2026-10-18_04-blog/manifest.json) |
| grok/grok-4.7               | 01      | succeeded | 132.759 | $0.084448 | 3713         | 12837                | provider_usage | [Manifest](2026-10-18_04-blog/manifest.json) |

## Rap song chapter

[First-pass manifest](2026-10-18_05-rap-song-chapter/manifest.json) · [First-pass provider report](2026-10-18_05-rap-song-chapter/provider-comparison-report.md)

| Model / provider            | Attempt | Status    | Seconds | USD       | Input tokens | Billed output tokens | Cost basis     | Evidence                                                           |
| --------------------------- | ------- | --------- | ------- | --------- | ------------ | -------------------- | -------------- | ------------------------------------------------------------------ |
| openai/gpt-5.6-luna         | 01      | succeeded | 6.692   | $0.001967 | 3518         | 1053                 | provider_usage | [Manifest](2026-10-18_05-rap-song-chapter/manifest.json)           |
| openai/gpt-6-luna           | 01      | succeeded | 7.844   | $0.001026 | 3518         | 1348                 | provider_usage | [Manifest](2026-10-18_05-rap-song-chapter/manifest.json)           |
| together/glm-5.3            | 01      | succeeded | 9.919   | $0.009038 | 3407         | 970                  | provider_usage | [Manifest](2026-10-18_05-rap-song-chapter/manifest.json)           |
| openai/gpt-5.6-terra        | 01      | succeeded | 10.775  | $0.018040 | 3518         | 917                  | provider_usage | [Manifest](2026-10-18_05-rap-song-chapter/manifest.json)           |
| openai/gpt-5.6-sol          | 01      | succeeded | 14.832  | $0.040672 | 3518         | 1330                 | provider_usage | [Manifest](2026-10-18_05-rap-song-chapter/manifest.json)           |
| anthropic/claude-haiku-5-5  | 01      | succeeded | 18.843  | $0.002816 | 6350         | 4361                 | provider_usage | [Manifest](2026-10-18_05-rap-song-chapter/manifest.json)           |
| gemini/gemini-4-argon       | 01      | succeeded | 22.100  | $0.042420 | 4155         | 1290                 | provider_usage | [Manifest](2026-10-18_05-rap-song-chapter/manifest.json)           |
| openai/gpt-6.1-sol          | 01      | succeeded | 22.894  | $0.021326 | 3518         | 1429                 | provider_usage | [Manifest](2026-10-18_05-rap-song-chapter/manifest.json)           |
| gemini/gemini-3.8-flash     | 01      | succeeded | 25.127  | $0.029719 | 3523         | 3258                 | provider_usage | [Manifest](2026-10-18_05-rap-song-chapter/manifest.json)           |
| gemini/gemini-3.7-flash     | 01      | succeeded | 35.217  | $0.034879 | 3523         | 3946                 | provider_usage | [Manifest](2026-10-18_05-rap-song-chapter/manifest.json)           |
| anthropic/claude-opus-5-5   | 01      | succeeded | 37.746  | $0.089440 | 6350         | 3202                 | provider_usage | [Manifest](2026-10-18_05-rap-song-chapter/manifest.json)           |
| anthropic/claude-sonnet-5-5 | 01      | succeeded | 39.058  | $0.063530 | 6350         | 5083                 | provider_usage | [Manifest](2026-10-18_05-rap-song-chapter/manifest.json)           |
| openai/gpt-6-astra          | 01      | succeeded | 40.027  | $0.115430 | 3518         | 1605                 | provider_usage | [Manifest](2026-10-18_05-rap-song-chapter/manifest.json)           |
| kimi/kimi-k3                | 01      | succeeded | 54.330  | $0.035859 | 3543         | 1682                 | provider_usage | [Manifest](2026-10-18_05-rap-song-chapter/manifest.json)           |
| anthropic/claude-opus-5     | 01      | succeeded | 65.368  | $0.155890 | 6348         | 4966                 | provider_usage | [Manifest](2026-10-18_05-rap-song-chapter/manifest.json)           |
| anthropic/claude-sonnet-5   | 01      | succeeded | 65.692  | $0.074686 | 6348         | 6199                 | provider_usage | [Manifest](2026-10-18_05-rap-song-chapter/manifest.json)           |
| anthropic/claude-fable-5-1  | 01      | succeeded | 73.186  | $0.365150 | 6350         | 6033                 | provider_usage | [Manifest](2026-10-18_05-rap-song-chapter/manifest.json)           |
| together/glm-5.3-flash      | 02      | succeeded | 109.665 | $0.011846 | 3407         | 22670                | provider_usage | [Manifest](2026-10-18_05-rap-song-chapter/reruns/02/manifest.json) |
| together/kimi-k3            | 01      | succeeded | 145.330 | $0.114849 | 3793         | 6898                 | provider_usage | [Manifest](2026-10-18_05-rap-song-chapter/manifest.json)           |
| grok/grok-4.6               | 02      | succeeded | 198.130 | $0.078680 | 4333         | 11669                | provider_usage | [Manifest](2026-10-18_05-rap-song-chapter/reruns/02/manifest.json) |
| grok/grok-4.7               | 02      | succeeded | 642.334 | $0.265778 | 4939         | 42650                | provider_usage | [Manifest](2026-10-18_05-rap-song-chapter/reruns/02/manifest.json) |
| glm/glm-5.3                 | 02      | failed    | 182.983 | $0.075170 | 3407         | 16000                | provider_usage | [Manifest](2026-10-18_05-rap-song-chapter/reruns/02/manifest.json) |
| glm/glm-5.3-flash           | 02      | failed    | 225.929 | $0.008511 | 3407         | 16000                | provider_usage | [Manifest](2026-10-18_05-rap-song-chapter/reruns/02/manifest.json) |

## Failed or schema-invalid request history

| Preset         | Model / provider            | Attempt | Current result | Status        | Diagnostic                                                                                                                  | Evidence                                                                               |
| -------------- | --------------------------- | ------- | -------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| shortSummary   | anthropic/claude-sonnet-5-5 | 01      | schema failed  | schema failed | {"nested":{"episodeDescription":["Invalid length: Expected <=180 but received 181"]}}                                       | [Receipt](2026-10-18_01-short-summary/slot-anthropic-claude-sonnet-5-5.json)           |
| shortSummary   | anthropic/claude-sonnet-5-5 | 02      | still selected | schema failed | {"nested":{"episodeDescription":["Invalid length: Expected <=180 but received 184"]}}                                       | [Receipt](2026-10-18_01-short-summary/reruns/02/slot-anthropic-claude-sonnet-5-5.json) |
| mediumChapters | glm/glm-5.3                 | 01      | succeeded      | failed        | No response text from model                                                                                                 | [Receipt](2026-10-18_03-medium-chapters/slot-glm-glm-5.3.json)                         |
| rapSongChapter | glm/glm-5.3                 | 01      | failed         | failed        | No response text from model                                                                                                 | [Receipt](2026-10-18_05-rap-song-chapter/slot-glm-glm-5.3.json)                        |
| rapSongChapter | glm/glm-5.3-flash           | 01      | failed         | failed        | No response text from model                                                                                                 | [Receipt](2026-10-18_05-rap-song-chapter/slot-glm-glm-5.3-flash.json)                  |
| rapSongChapter | grok/grok-4.6               | 01      | succeeded      | failed        | The socket connection was closed unexpectedly. For more information, pass `verbose: true` in the second argument to fetch() | [Receipt](2026-10-18_05-rap-song-chapter/slot-grok-grok-4.6.json)                      |
| rapSongChapter | grok/grok-4.7               | 01      | succeeded      | schema failed | {"nested":{"bridge":["Invalid length: Expected <=8 but received 9"]}}                                                       | [Receipt](2026-10-18_05-rap-song-chapter/slot-grok-grok-4.7.json)                      |
| rapSongChapter | together/glm-5.3-flash      | 01      | succeeded      | failed        | No response text from model                                                                                                 | [Receipt](2026-10-18_05-rap-song-chapter/slot-together-glm-5.3-flash.json)             |
| rapSongChapter | glm/glm-5.3                 | 02      | still selected | failed        | GLM returned no response text from model.                                                                                   | [Receipt](2026-10-18_05-rap-song-chapter/reruns/02/slot-glm-glm-5.3.json)              |
| rapSongChapter | glm/glm-5.3-flash           | 02      | still selected | failed        | GLM returned no response text from model.                                                                                   | [Receipt](2026-10-18_05-rap-song-chapter/reruns/02/slot-glm-glm-5.3-flash.json)        |

3 failed or invalid requests remain in the current comparison. Earlier failures remain in this history after a successful rerun. Missing usage remains unresolved and is excluded from the known catalog-cost total.

## Reproduce and verify

Inspect the current active inventory without provider calls: `bun src/tools/write-benchmark.ts --price`. Verify the pinned historical receipts with `bun src/tools/write-benchmark.ts --verify-cache`. The runner’s `--run` mode dispatches unattempted slots only when the exact plan still matches the live catalog and approval; reusing its existing receipts never repurchases an attempted slot. A fresh paid benchmark requires a new cost estimate and the repository’s spending authorization.

Regenerate each standard provider report with `bun .codex/skills/consensus/scripts/run.ts text build-report <run-directory>`. Those compatibility reports retain their established token-normalized speed rankings and enumerate raw accounting metadata, including invalid outputs when usage is available. Use this five-prompt report and the Write dashboard for valid-output comparisons and observed seconds per request.

Regenerate this report with `bun src/tools/write-benchmark-report.ts --write`; add `--archive` to rebuild its evidence ZIP after all slots have finished. Rebuild the dashboard with `bun .codex/skills/consensus/scripts/run.ts build-combined-dashboard docs/benchmarks`. Serve the repository benchmark directory over HTTP to use the dashboard.

<!-- verification:start -->
Verification recorded on 2026-10-18:

- `bun run check`: passed structure, naming, types, and documentation checks.
- `bun t --price`: 116/116 no-cost pricing commands passed.
- Initial batch targeted local tests: 48 passed, 0 failed, 613 assertions across five files.
- After the paid reruns, 101 local tests passed, 0 failed, 1,031 assertions across the nine files below. These tests used mocked provider responses and made no paid calls.
- The user approved `bun src/tools/rerun-write-benchmark.ts --run` for the seven pinned requests after reviewing the $0.6277138 scenario and uncapped reasoning/prior billing risks. Every rerun made exactly one network request. Four returned valid structured outputs, one failed schema validation, and two returned empty text at their output limit.
- Additional usage-based catalog cost was $0.4481865, with no new unresolved usage. Cumulative known cost is $4.2623577 plus five unresolved original charges. Failed and invalid attempts remain included in these totals.
- `bun src/tools/rerun-write-benchmark.ts --verify-cache` verified all seven saved rerun receipts and their artifacts with network access blocked.
- Actual receipt replay with all network access blocked: all 115 cached slots reused, zero network calls; canonical creation identities and recorded costs preserved.
- Independent paid-result audit: every slot had exactly one network attempt; all plan, source, prompt, schema and artifact hashes, available raw/receipt/manifest token counts, reasoning mappings, and known cost calculations reconciled. All 475 original files remain byte-identical.
- Regenerated evidence archive: all 270 SHA-256 entries match both extracted ZIP bytes and their saved files; the original 246 entries remain byte-identical to the saved initial archive.
- The three rerun provider reports expose the required price, speed, automated-quality, and human-quality surfaces, with unavailable quality explained. Independent dashboard verification reconciled all six groups, their ranks, all 237 artifact links, and the 20 routes eligible across all five prompts.

The three remaining failures are Sonnet 5.5's 184-character short summary against a 180-character limit and the direct GLM 5.3/5.3 Flash song requests. Both GLM responses reached the native 16,000-token completion limit with 15,995 reasoning tokens and no visible text. Prompts, schemas, native request controls, and the original attempt artifacts remain unchanged.

```bash
bun --no-env-file test \
  test/test-cases/validation/reports-pricing/write-benchmark-contracts.test.ts \
  test/test-cases/validation/reports-pricing/write-benchmark-rerun-contracts.test.ts \
  test/test-cases/validation/reports-pricing/write-dashboard-contracts.test.ts \
  test/test-cases/validation/reports-pricing/combined-report-weighted-ranking-contracts.test.ts \
  test/test-cases/validation/text/write/write-empty-usage-contracts.test.ts \
  test/test-cases/validation/text/write/write-provider-settings-contracts.test.ts \
  test/test-cases/validation/text/write/write-reasoning-dispatch-contracts.test.ts \
  test/test-cases/validation/text/write/structured-output-failure-contracts.test.ts \
  test/test-cases/validation/text/write/grok-47-contracts.test.ts
```
<!-- verification:end -->

Passing mocks verify dispatch and accounting behavior, not generated-text correctness or perceptual quality.
