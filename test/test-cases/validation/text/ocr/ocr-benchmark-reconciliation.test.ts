import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { OCR_ARCHIVE_PATH, OCR_COHORT_PLAN_PATH, OCR_EXPANSION_REPORT_PATH, inspectOcrArchive,
  ocrCurrentArchiveMarkdown, parseOcrArchiveArguments, updateOcrCurrentArchiveSection } from '~/tools/ocr-benchmark-reconciliation'

const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })
const targets = [{ provider: 'tesseract', model: 'tesseract' }, { provider: 'hosted', model: 'reader' }]
const provider = (index: number, status = 'succeeded') => ({ service: targets[index]!.provider, model: targets[index]!.model, status })
const manifest = (pageCount: number, providers: ReturnType<typeof provider>[], sourceCaseId?: string) => ({ command: 'extract', scope: 'single',
  ...(sourceCaseId ? { source: { sourceCaseId } } : {}),
  items: [{ extractRoute: 'document', metadata: { step1: { pageCount } }, providers }] })

const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-ocr-reconciliation-')); roots.push(root)
  const write = async (path: string, value: unknown) => {
    await mkdir(dirname(join(root, path)), { recursive: true })
    await Bun.write(join(root, path), typeof value === 'string' ? value : JSON.stringify(value))
  }
  const path = (id: string) => `${OCR_ARCHIVE_PATH}/${id}/manifest.json`
  const read = async (id: string) => Bun.file(join(root, path(id))).json()
  await write(OCR_COHORT_PLAN_PATH, { targets })
  await write(path('page-a'), manifest(2, [provider(1, 'failed')]))
  await write(path('bc-rerun-page-a'), manifest(2, [provider(0), provider(1)]))
  await write(path('page-b'), manifest(1, [provider(0), provider(1, 'missing')]))
  await write(path('original-easy'), manifest(1, [provider(1)]))
  await write(path('local-rerun-original-easy'), manifest(1, [provider(0)], 'original-easy'))
  await write(`${OCR_ARCHIVE_PATH}/unused/nested/manifest.json`, 'invalid nested JSON is outside the direct-child cohort')
  await write(OCR_EXPANSION_REPORT_PATH, '# Expansion\n\nFrozen history.\n\n<!-- newspaper-execution:start -->\nPaid history.\n<!-- newspaper-execution:end -->\n\n## Corpus\n\nFrozen corpus.\n')
  return { root, write, path, read, options: { projectRoot: root } }
}

describe('current OCR archive reconciliation', () => {
  test('counts current selected slots and distinct source coverage across explicit and conventional reruns', async () => {
    const f = await fixture(), original = await Bun.file(join(f.root, f.path('page-a'))).text()
    await f.write(OCR_COHORT_PLAN_PATH, { targets: [...targets, { provider: 'retired', model: 'old' }], currentCohort: { targets } })
    const result = await inspectOcrArchive(f.options)
    expect(result).toMatchObject({ archivePath: OCR_ARCHIVE_PATH, cohortPlanPath: OCR_COHORT_PLAN_PATH, targetCount: 2,
      runCount: 5, pageInstances: 7, uniqueSources: 3, sourcePages: 4, selectedSlots: 7, completedSlots: 5,
      failedSlots: 1, notDispatchedSlots: 1, runningSlots: 0, unselectedSlots: 3, sourceSlots: 6, completedSourceSlots: 5, incompleteSourceCount: 1 })
    expect(result.sources.find(source => source.sourceCaseId === 'page-a')).toEqual({ sourceCaseId: 'page-a', pageCount: 2, runIds: ['bc-rerun-page-a', 'page-a'], gaps: [] })
    expect(result.sources.find(source => source.sourceCaseId === 'original-easy')?.runIds).toEqual(['local-rerun-original-easy', 'original-easy'])
    expect(result.sources.find(source => source.sourceCaseId === 'page-b')?.gaps).toEqual([{ providerKey: 'hosted/reader', status: 'missing' }])
    expect(result.incompleteOutputs).toContainEqual({ caseId: 'page-a', sourceCaseId: 'page-a', providerKey: 'hosted/reader', status: 'failed' })
    expect(result.completionSemantics).toContain('does not establish completion of every original dispatch protocol')
    expect(JSON.stringify(result)).not.toContain(f.root)
    expect(await Bun.file(join(f.root, f.path('page-a'))).text()).toBe(original)
  })

  test('falls back to the original target field and distinguishes running, failed and missing source gaps', async () => {
    const f = await fixture()
    await f.write(f.path('page-b'), manifest(1, [provider(0), provider(1, 'failed')]))
    expect((await inspectOcrArchive(f.options)).sources.find(source => source.sourceCaseId === 'page-b')?.gaps[0]?.status).toBe('failed')
    await f.write(f.path('efg-rerun-page-b'), manifest(1, [provider(1, 'running')]))
    const result = await inspectOcrArchive(f.options)
    expect(result.runningSlots).toBe(1)
    expect(result.sources.find(source => source.sourceCaseId === 'page-b')?.gaps[0]?.status).toBe('running')
    await f.write(f.path('d-rerun-page-b'), manifest(1, [provider(1)]))
    expect((await inspectOcrArchive(f.options)).completedSourceSlots).toBe(6)
  })

  for (const [label, broken] of [
    ['duplicate provider', manifest(1, [provider(0), provider(0)])],
    ['unretained provider', manifest(1, [{ service: 'retired', model: 'old', status: 'succeeded' }])],
    ['invalid provider status', manifest(1, [provider(0, 'complete')])],
    ['zero page count', manifest(0, [provider(0)])],
    ['multiple document items', { ...manifest(1, [provider(0)]), items: [manifest(1, [provider(0)]).items[0], manifest(1, [provider(0)]).items[0]] }],
    ['non-document item', { ...manifest(1, [provider(0)]), items: [{ ...manifest(1, [provider(0)]).items[0], extractRoute: 'video' }] }],
    ['invalid JSON', '{']
  ]) {
    test(`rejects ${label} artifacts without inventing usable outputs`, async () => {
      const f = await fixture()
      await f.write(f.path('page-b'), broken)
      await expect(inspectOcrArchive(f.options)).rejects.toThrow()
    })
  }

  test('rejects provider/document page disagreement and duplicate cohort targets', async () => {
    const f = await fixture()
    const item = manifest(1, [provider(0)])
    await f.write(f.path('page-b'), { ...item, items: [{ ...item.items[0], providers: [{ ...provider(0), metadata: { totalPages: 2 } }] }] })
    await expect(inspectOcrArchive(f.options)).rejects.toThrow('page count')
    await f.write(OCR_COHORT_PLAN_PATH, { targets: [...targets, targets[0]] })
    await expect(inspectOcrArchive(f.options)).rejects.toThrow('Duplicate retained')
  })

  test('requires a real original source with identical page count and rejects chained reruns', async () => {
    const f = await fixture()
    await f.write(f.path('local-rerun-original-easy'), manifest(1, [provider(0)], 'unknown-source'))
    await expect(inspectOcrArchive(f.options)).rejects.toThrow('matching original source')
    await f.write(f.path('local-rerun-original-easy'), manifest(2, [provider(0)], 'original-easy'))
    await expect(inspectOcrArchive(f.options)).rejects.toThrow('page count')
    await f.write(f.path('local-rerun-original-easy'), manifest(2, [provider(0)], 'bc-rerun-page-a'))
    await expect(inspectOcrArchive(f.options)).rejects.toThrow('matching original source')
  })

  test('supports explicit relative paths and rejects traversal and escaping artifact symlinks', async () => {
    const f = await fixture()
    await f.write('test/cohort.json', { targets })
    expect((await inspectOcrArchive({ ...f.options, planPath: 'test/cohort.json' })).targetCount).toBe(2)
    await expect(inspectOcrArchive({ ...f.options, planPath: '../cohort.json' })).rejects.toThrow('project-relative')
    const outside = await mkdtemp(join(tmpdir(), 'autoshow-ocr-outside-')); roots.push(outside)
    await Bun.write(join(outside, 'manifest.json'), JSON.stringify(await f.read('page-b')))
    await rm(join(f.root, f.path('page-b')))
    await symlink(join(outside, 'manifest.json'), join(f.root, f.path('page-b')))
    await expect(inspectOcrArchive(f.options)).rejects.toThrow('escapes project root')
  })

  test('reports missing, malformed and empty cohort artifacts', async () => {
    const f = await fixture()
    await expect(inspectOcrArchive({ ...f.options, planPath: 'test/absent.json' })).rejects.toThrow('Missing OCR artifact')
    await f.write(OCR_COHORT_PLAN_PATH, '{')
    await expect(inspectOcrArchive(f.options)).rejects.toThrow('Invalid OCR JSON')
    await f.write(OCR_COHORT_PLAN_PATH, { targets: [] })
    await expect(inspectOcrArchive(f.options)).rejects.toThrow()
    await f.write(OCR_COHORT_PLAN_PATH, { targets })
    await mkdir(join(f.root, 'test/empty'), { recursive: true })
    await expect(inspectOcrArchive({ ...f.options, archivePath: 'test/empty' })).rejects.toThrow('no direct child manifests')
  })
})

describe('current OCR archive report section', () => {
  test('targets the unified action report and inserts within its OCR benchmark section without requiring Corpus', async () => {
    const f = await fixture(), analysis = await inspectOcrArchive(f.options)
    expect(OCR_EXPANSION_REPORT_PATH).toBe('docs/reports/repository-improvement-actions.md')
    const original = '# Repository improvement actions\n\n## Docker improvements\n\nPreserve these actions.\n\n## OCR benchmark\n\nPreserve benchmark actions.\n\n## Other improvements\n\nPreserve later actions.\n'
    await f.write(OCR_EXPANSION_REPORT_PATH, original)
    await updateOcrCurrentArchiveSection(analysis, f.options)
    const updated = await Bun.file(join(f.root, OCR_EXPANSION_REPORT_PATH)).text()
    expect(updated).toContain('### Current retained archive')
    expect(updated.indexOf('<!-- ocr-current-archive:start -->')).toBeGreaterThan(updated.indexOf('## OCR benchmark'))
    expect(updated.indexOf('<!-- ocr-current-archive:end -->')).toBeLessThan(updated.indexOf('Preserve benchmark actions.'))
    expect(updated.indexOf('### Current retained archive')).toBeLessThan(updated.indexOf('## Other improvements'))
    expect(updated.replace(/<!-- ocr-current-archive:start -->[\s\S]*?<!-- ocr-current-archive:end -->\n\n/, '')).toBe(original)
  })

  test('refreshes a reserved block inside the unified OCR section without moving surrounding actions', async () => {
    const f = await fixture(), analysis = await inspectOcrArchive(f.options)
    const prefix = '# Repository improvement actions\n\n## OCR benchmark\n\nPreserve pending work.\n\n'
    const suffix = '\n\n## Other repository actions\n\nPreserve these too.\n'
    await f.write(OCR_EXPANSION_REPORT_PATH, `${prefix}<!-- ocr-current-archive:start -->\nStale coverage.\n<!-- ocr-current-archive:end -->${suffix}`)
    await updateOcrCurrentArchiveSection(analysis, f.options)
    const updated = await Bun.file(join(f.root, OCR_EXPANSION_REPORT_PATH)).text()
    expect(updated.startsWith(prefix)).toBe(true); expect(updated.endsWith(suffix)).toBe(true)
    expect(updated).not.toContain('Stale coverage.')
    await updateOcrCurrentArchiveSection(analysis, f.options)
    expect(await Bun.file(join(f.root, OCR_EXPANSION_REPORT_PATH)).text()).toBe(updated)
  })

  test('inserts before Corpus and replaces only its block while preserving frozen history and source manifests', async () => {
    const f = await fixture(), analysis = await inspectOcrArchive(f.options)
    const originalReport = await Bun.file(join(f.root, OCR_EXPANSION_REPORT_PATH)).text()
    const originalManifest = await Bun.file(join(f.root, f.path('page-a'))).text()
    const section = ocrCurrentArchiveMarkdown(analysis)
    expect(section).toContain('**5/7**')
    expect(section).toContain('**5/6**')
    expect(section).toContain('`page-b`')
    await updateOcrCurrentArchiveSection(analysis, f.options)
    const first = await Bun.file(join(f.root, OCR_EXPANSION_REPORT_PATH)).text()
    expect(first.indexOf('<!-- ocr-current-archive:start -->')).toBeLessThan(first.indexOf('## Corpus'))
    expect(first.replace(/<!-- ocr-current-archive:start -->[\s\S]*?<!-- ocr-current-archive:end -->\n\n/, '')).toBe(originalReport)
    await updateOcrCurrentArchiveSection(analysis, f.options)
    expect(await Bun.file(join(f.root, OCR_EXPANSION_REPORT_PATH)).text()).toBe(first)
    expect(await Bun.file(join(f.root, f.path('page-a'))).text()).toBe(originalManifest)
  })

  for (const markers of ['<!-- ocr-current-archive:start -->', '<!-- ocr-current-archive:end -->',
    '<!-- ocr-current-archive:end --><!-- ocr-current-archive:start -->',
    '<!-- ocr-current-archive:start --><!-- ocr-current-archive:start --><!-- ocr-current-archive:end -->']) {
    test(`rejects malformed markers: ${markers}`, async () => {
      const f = await fixture()
      await f.write(OCR_EXPANSION_REPORT_PATH, `${markers}\n## Corpus\n`)
      await expect(updateOcrCurrentArchiveSection(await inspectOcrArchive(f.options), f.options)).rejects.toThrow('markers')
    })
  }

  test('requires an OCR benchmark or legacy Corpus insertion point and validates CLI arguments', async () => {
    const f = await fixture()
    await f.write('docs/reports/custom.md', '# No corpus\n')
    await expect(updateOcrCurrentArchiveSection(await inspectOcrArchive(f.options), { ...f.options, reportPath: 'docs/reports/custom.md' })).rejects.toThrow('OCR benchmark or Corpus')
    expect(parseOcrArchiveArguments([]).action).toBe('--analyze')
    expect(parseOcrArchiveArguments(['--generate']).action).toBe('--generate')
    expect(parseOcrArchiveArguments(['--help']).action).toBe('--help')
    expect(() => parseOcrArchiveArguments(['--run'])).toThrow('Usage:')
    expect(() => parseOcrArchiveArguments(['--generate', '--run'])).toThrow('Usage:')
    const child = Bun.spawn([process.execPath, '--no-env-file', resolve(import.meta.dir, '../../../../../src/tools/ocr-benchmark-reconciliation.ts'), '--generate'],
      { env: { AUTOSHOW_PROJECT_ROOT: f.root }, stdout: 'pipe', stderr: 'pipe' })
    const output = await new Response(child.stdout).json()
    expect(await child.exited).toBe(0)
    expect(output).toMatchObject({ cohort: 'current-retained', runCount: 5, completedSlots: 5, selectedSlots: 7, reportPath: 'docs/reports/repository-improvement-actions.md' })
    expect(output).not.toHaveProperty('entries')
  })
})
