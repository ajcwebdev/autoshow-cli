import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { copyFile, mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { InfraError, UsageError, ValidationError } from '~/utils/error-handler'
import { writeCommandPayload } from '~/utils/app-logger/result-emitter'
import { buildTextDashboard, writeDashboardLinkRoot, WRITE_BENCHMARK_CASES, type WriteDashboardSample } from '../../.codex/skills/consensus/scripts/text/build_text_dashboard'
import { writePortableFileSync } from '../../.codex/skills/consensus/scripts/shared/portable_paths'

const dollars = (value: number | null): string => value === null ? 'unavailable' : `$${value.toFixed(6)}`
const total = (values: Array<number | null>): number | null => values.length && values.every(value => value !== null)
  ? values.reduce<number>((sum, value) => sum + value!, 0) : null
const escapeCell = (value: string): string => value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
const evidenceName = '2026-10-18-write.evidence.zip'

export async function archiveWriteBenchmarkEvidence(rootDir: string): Promise<void> {
  const zip = Bun.which('zip')
  if (!zip) throw InfraError('zip is required to package Write benchmark evidence.')
  const files = ['benchmark-plan.json', ...(existsSync(join(rootDir, 'rerun-plan.json')) ? ['rerun-plan.json'] : [])]
  for (const benchmark of WRITE_BENCHMARK_CASES) {
    const dir = join(rootDir, benchmark.directory)
    if (!existsSync(dir)) continue
    const rerunsDir = join(dir, 'reruns')
    const runDirs = [dir, ...(existsSync(rerunsDir) ? readdirSync(rerunsDir, { withFileTypes: true })
      .filter(entry => entry.name !== '.DS_Store' && entry.isDirectory()).map(entry => join(rerunsDir, entry.name)) : [])]
    for (const runDir of runDirs) {
      for (const name of readdirSync(runDir).filter(name => ['manifest.json', 'source.txt', 'prompt.md'].includes(name)
        || /^(slot-|raw-response-|failure-).*\.json$/.test(name))) {
        if (name.startsWith('slot-')) {
          const slot = JSON.parse(readFileSync(join(runDir, name), 'utf8')) as { status: string }
          if (slot.status === 'dispatch-started') throw ValidationError(`Cannot archive an in-flight slot: ${relative(rootDir, join(runDir, name))}`)
        }
        files.push(relative(rootDir, join(runDir, name)).split('\\').join('/'))
      }
    }
  }
  files.sort()
  const stage = await mkdtemp(join(tmpdir(), 'autoshow-write-evidence-'))
  try {
    const checksums = []
    for (const name of files) {
      const source = join(rootDir, name), target = join(stage, name)
      await mkdir(dirname(target), { recursive: true })
      await copyFile(source, target)
      checksums.push(`${createHash('sha256').update(readFileSync(source)).digest('hex')}  ${name}`)
    }
    await writeFile(join(stage, 'SHA256SUMS'), `${checksums.join('\n')}\n`)
    const archive = resolve(rootDir, evidenceName)
    const temporaryArchive = `${archive}.${crypto.randomUUID()}.tmp.zip`
    try {
      const child = Bun.spawn([zip, '-q', '-r', temporaryArchive, '.'], { cwd: stage, stdout: 'pipe', stderr: 'pipe' })
      const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
      if (exitCode !== 0) throw InfraError(`Evidence archive failed: ${stderr || stdout}`)
      await rename(temporaryArchive, archive)
    } finally { await rm(temporaryArchive, { force: true }) }
    writeCommandPayload(`Updated ${relative(process.cwd(), archive)} (${files.length} evidence files and SHA256SUMS)` + '\n')
  } finally {
    await rm(stage, { recursive: true, force: true })
  }
}

function table(headers: string[], rows: string[][]): string {
  const cells = [headers, ...rows].map(row => row.map(escapeCell))
  const widths = headers.map((_, index) => Math.max(3, ...cells.map(row => row[index]!.length)))
  const render = (row: string[]) => `| ${row.map((cell, index) => cell.padEnd(widths[index]!)).join(' | ')} |`
  return [render(cells[0]!), render(widths.map(width => '-'.repeat(width))), ...cells.slice(1).map(render)].join('\n')
}

function observedSeconds(sample: WriteDashboardSample): string {
  return sample.processingMs === null ? 'unavailable' : (sample.processingMs / 1000).toFixed(3)
}

export function buildWriteBenchmarkMarkdown(rootDir: string): string {
  const { dashboardModel, samples, attempts } = buildTextDashboard(rootDir)
  const planPath = join(rootDir, 'benchmark-plan.json')
  const plan = existsSync(planPath) ? JSON.parse(readFileSync(planPath, 'utf8')) as {
    providers?: unknown[]
    baseEstimatedCostCents?: number
    providerConcurrency?: number
    cases?: Array<{ id: string; prompt: string; input: string; runDir: string; sourceSha256?: string }>
  } : {}
  const previousReport = join(rootDir, 'benchmark-report.md')
  const verification = existsSync(previousReport)
    ? readFileSync(previousReport, 'utf8').match(/<!-- verification:start -->[\s\S]*?<!-- verification:end -->/)?.[0]
    : undefined
  const routeCount = new Set(samples.map(sample => sample.providerKey)).size
  const passed = samples.filter(sample => sample.status === 'succeeded')
  const attempted = attempts.filter(sample => !['missing', 'pending', 'not-started', 'skipped'].includes(sample.status))
  const firstPass = attempted.filter(sample => sample.attempt === '01')
  const reruns = attempted.filter(sample => sample.attempt !== '01')
  const knownSpend = attempts.filter(sample => sample.costDollars !== null).reduce((sum, sample) => sum + sample.costDollars!, 0)
  const unknown = attempted.filter(sample => sample.costDollars === null)
  const aggregate = dashboardModel.groups.find(group => group.key === 'all-five')!
  const complete = aggregate.providers.filter(provider => provider.cost.value !== null && provider.speed.value !== null)
  const cheapest = [...complete].sort((a, b) => a.cost.value! - b.cost.value!)[0]
  const fastest = [...complete].sort((a, b) => a.speed.value! - b.speed.value!)[0]
  const parts = [
    '# Five-prompt LLM speed and cost benchmark',
    '',
    `The current comparison has ${passed.length} valid structured outputs across ${routeCount * WRITE_BENCHMARK_CASES.length} prompt/model pairs, ${routeCount} model/provider routes, and five prompts. Recorded history contains ${attempted.length} attempts: ${firstPass.length} first-pass requests (${firstPass.filter(sample => sample.status === 'succeeded').length} valid) and ${reruns.length} reruns (${reruns.filter(sample => sample.status === 'succeeded').length} valid). Cumulative usage-based catalog costs total ${dollars(knownSpend)}${unknown.length ? `; ${unknown.length} attempted slots have unresolved or unavailable billing` : ''}.`,
    '',
    ...(cheapest && fastest ? [`Among routes with all five valid outputs, the lowest mean request cost is **${cheapest.providerKey}** (${cheapest.cost.display}) and the lowest mean request latency is **${fastest.providerKey}** (${fastest.speed.display}).`, ''] : []),
    '## Method and spending',
    '',
    `The approved batch is one pass of five fixed input/preset pairs across the ${Array.isArray(plan.providers) ? plan.providers.length : routeCount} routes captured in [benchmark-plan.json](benchmark-plan.json). The registry preflight estimated ${dollars(typeof plan.baseEstimatedCostCents === 'number' ? plan.baseEstimatedCostCents / 100 : null)} before additional reasoning usage or unreported failure charges. Each provider can run ${plan.providerConcurrency ?? 2} targets concurrently. The original batch used the CLI/model reasoning defaults available at execution time, including low reasoning for direct Kimi K3. Removed routes and their original settings remain historical evidence; current support comes from the live CLI catalog.`,
    '',
    'Each slot makes one inference attempt. The benchmark blocks schema-validation repurchases and adapter fallback requests; explicitly rejected admission requests may retry. Dispatch-started receipts are saved before network access, and existing receipts prevent repurchasing successful, invalid, failed, or ambiguous slots on replay. Raw responses and provider usage remain available beside each manifest.',
    '',
    ...(reruns.length ? ['Targeted reruns are pinned in [rerun-plan.json](rerun-plan.json) and saved separately beneath each affected case’s `reruns/` directory. The current comparison selects the latest completed attempt per prompt/model pair, including a latest failure. Earlier attempts and their costs remain preserved in request evidence. Rerunning selected failures does not establish repeated-run latency statistics.', ''] : []),
    'Latency is observed wall-clock seconds per request, including provider latency and generation. The aggregate gives each prompt equal weight and includes only routes with valid outputs for all five cases. It is not time to first token or decode throughput. One observation does not establish stable median performance.',
    '',
    'Cost multiplies recorded provider usage by the saved uncached catalog tariffs; cache discounts and Gemini Argon introductory pricing are excluded. Local token estimates remain labeled where provider usage is missing. Cumulative totals include every original and rerun attempt, including failed or invalid outputs; comparison ranks use only selected valid requests. Missing billing remains unavailable rather than zero, even after a later rerun succeeds. These are usage-based cost calculations, not provider invoices or confirmed amounts charged.',
    '',
    'At the user’s request, the temporary quality proxy is the listed USD price per million output tokens, with higher prices treated as the proxy for higher quality. This rate is separate from measured dollars per request, which also depends on input, output, reasoning, and caching. No text judge, human quality score, or instruction-compliance score was purchased or inferred.',
    '',
    '## Selected workloads',
    '',
    table(['Preset', 'Input', 'Current valid / routes', 'Cumulative usage-based cost'], WRITE_BENCHMARK_CASES.map(benchmark => {
      const rows = samples.filter(sample => sample.caseKey === benchmark.key)
      const history = attempts.filter(sample => sample.caseKey === benchmark.key)
      const planned = plan.cases?.find(entry => entry.prompt === benchmark.prompt)
      const unresolved = history.filter(row => row.costDollars === null && !['missing', 'pending', 'not-started', 'skipped'].includes(row.status)).length
      const known = history.reduce((sum, row) => sum + (row.costDollars ?? 0), 0)
      const cost = unresolved ? `${dollars(known)} known; ${unresolved} unresolved` : dollars(total(history.map(row => row.costDollars)))
      return [benchmark.prompt, planned ? `\`${planned.input}\`` : 'See source snapshot', `${rows.filter(row => row.status === 'succeeded').length}/${routeCount}`, cost]
    })),
    '',
    'The short summary produces at most 180 characters from the original 216-word input. The long summary compresses the saved 7,919-word transcript into roughly 100–200 words. Medium chapters extract timestamps and descriptions from the 1,637-word transcript. The blog uses that same transcript for an outline and a draft of at least 750 words. The chapter-song case adapts the original 838-word Harborlight field notes under extensive lyric constraints. Schema checks establish structured artifact validity; these requested prose lengths and creative constraints are not independently scored.',
    '',
    '## All-five comparison',
    '',
    table(['Model / provider', 'Valid cases', 'Mean seconds / request', 'Mean USD / request', 'Price proxy USD / 1M output'], aggregate.providers.map(provider => [provider.providerKey, provider.coverage ?? 'unavailable', provider.speed.display, provider.cost.display, provider.quality.display])),
    '',
  ]
  if (existsSync(join(rootDir, evidenceName))) {
    parts.push(`The [checksummed response evidence](${evidenceName}) preserves original saved bytes, including each case’s decoded \`raw-response-*.json\`, failure evidence, durable \`slot-*.json\` receipts, source and prompt snapshots, canonical manifests, and pinned plans. Nested rerun evidence is included when present. \`SHA256SUMS\` identifies every archived file. Standalone request artifacts remain inputs to hash-checked cache reuse.`, '',
      'The directory relocation under `docs/benchmarks/text/write` updated standalone path references, prompt source paths, dependent checksums, and plan fingerprints. The existing evidence ZIP remains unchanged and retains the original request snapshots, fingerprints, and approval provenance. The relocated rerun plan has no execution authorization; moving these records does not approve another paid request.', '')
  }
  for (const benchmark of WRITE_BENCHMARK_CASES) {
    const rows = samples.filter(sample => sample.caseKey === benchmark.key)
      .sort((a, b) => (a.status === 'succeeded' ? 0 : 1) - (b.status === 'succeeded' ? 0 : 1)
        || (a.processingMs ?? Infinity) - (b.processingMs ?? Infinity) || a.providerKey.localeCompare(b.providerKey))
    parts.push(
      `## ${benchmark.label}`, '',
      `[First-pass manifest](${benchmark.directory}/manifest.json) · [First-pass provider report](${benchmark.directory}/provider-comparison-report.md)`, '',
      table(['Model / provider', 'Attempt', 'Status', 'Seconds', 'USD', 'Input tokens', 'Billed output tokens', 'Cost basis', 'Evidence'], rows.map(row => [row.providerKey, row.attempt, row.status, observedSeconds(row), dollars(row.costDollars), row.inputTokens === null ? 'unavailable' : String(row.inputTokens), row.outputTokens === null ? 'unavailable' : String(row.outputTokens), row.costBasis, row.manifestHref ? `[Manifest](${row.run}/manifest.json)` : 'Not run'])), '',
    )
  }
  const nonpassing = attempts.filter(sample => !['succeeded', 'missing', 'pending', 'not-started', 'skipped', 'running', 'dispatch-started'].includes(sample.status))
  if (nonpassing.length) {
    parts.push('## Failed or schema-invalid request history', '',
      table(['Preset', 'Model / provider', 'Attempt', 'Current result', 'Status', 'Diagnostic', 'Evidence'], nonpassing.map(sample => {
        const benchmark = WRITE_BENCHMARK_CASES.find(entry => entry.key === sample.caseKey)!
        const stem = sample.providerKey.replace('/', '-').replace(/[/\\:*?"<>|]/g, '-')
        const receiptPath = `${sample.run}/slot-${stem}.json`
        const receipt = existsSync(join(rootDir, receiptPath)) ? JSON.parse(readFileSync(join(rootDir, receiptPath), 'utf8')) as { error?: string } : {}
        let diagnostic = receipt.error ?? sample.schema
        if (sample.outputHref && sample.schema === 'failed') {
          const artifact = JSON.parse(readFileSync(resolve(writeDashboardLinkRoot(rootDir), sample.outputHref), 'utf8')) as { _validationError?: string }
          diagnostic = artifact._validationError ?? diagnostic
        }
        const current = samples.find(row => row.caseKey === sample.caseKey && row.providerKey === sample.providerKey)
        return [benchmark.prompt, sample.providerKey, sample.attempt, sample.selected ? 'still selected' : current?.status ?? 'unavailable', sample.status, diagnostic,
          existsSync(join(rootDir, receiptPath)) ? `[Receipt](${receiptPath})` : `[Manifest](${sample.run}/manifest.json)`]
      })), '',
      `${samples.filter(sample => nonpassing.includes(sample)).length} failed or invalid requests remain in the current comparison. Earlier failures remain in this history after a successful rerun. Missing usage remains unresolved and is excluded from the known catalog-cost total.`, '',
    )
  }
  parts.push('## Reproduce and verify', '',
    'Inspect the current active inventory without provider calls: `bun src/tools/write-benchmark.ts --price`. Verify the pinned historical receipts with `bun src/tools/write-benchmark.ts --verify-cache`. The runner’s `--run` mode dispatches unattempted slots only when the exact plan still matches the live catalog and approval; reusing its existing receipts never repurchases an attempted slot. A fresh paid benchmark requires a new cost estimate and the repository’s spending authorization.', '',
    'Regenerate each standard provider report with `bun .codex/skills/consensus/scripts/run.ts text build-report <run-directory>`. Those compatibility reports retain their established token-normalized speed rankings and enumerate raw accounting metadata, including invalid outputs when usage is available. Use this five-prompt report and the Write dashboard for valid-output comparisons and observed seconds per request.', '',
    'Regenerate this report with `bun src/tools/write-benchmark-report.ts --write`; add `--archive` to rebuild its evidence ZIP after all slots have finished. Rebuild the dashboard with `bun .codex/skills/consensus/scripts/run.ts build-combined-dashboard docs/benchmarks`. Serve the repository benchmark directory over HTTP to use the dashboard.', '',
    verification ?? '<!-- verification:start -->\nVerification results have not been recorded. Run `bun run check`, `bun t --price`, and the targeted runner/dashboard/provider-usage contract tests before recording results here.\n<!-- verification:end -->', '',
    'Passing mocks verify dispatch and accounting behavior, not generated-text correctness or perceptual quality.', '',
  )
  return parts.join('\n')
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  if (args.some(arg => !['--write', '--archive'].includes(arg))) throw UsageError('Usage: bun src/tools/write-benchmark-report.ts [--write] [--archive]')
  const root = resolve('docs/benchmarks/text/write')
  if (args.includes('--archive')) await archiveWriteBenchmarkEvidence(root)
  const markdown = buildWriteBenchmarkMarkdown(root)
  if (args.includes('--write')) {
    writePortableFileSync(join(root, 'benchmark-report.md'), markdown)
    writeCommandPayload('Updated docs/benchmarks/text/write/benchmark-report.md' + '\n')
  } else writeCommandPayload(markdown)
}

if (import.meta.main) await main()
