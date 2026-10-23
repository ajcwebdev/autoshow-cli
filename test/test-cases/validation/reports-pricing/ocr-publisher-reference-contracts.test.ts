import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { toProjectRelativePath } from '~/utils/project-root'
import { writeMultiProviderManifestFixture } from '../../../test-utils/manifest-helpers'
import { withLocalTestDir } from '../../../test-utils/temp-dirs'

const canonicalText = 'alpha beta gamma\n'
const canonicalHash = createHash('sha256').update(canonicalText).digest('hex')

async function fixture(root: string) {
  const runDir = join(root, 'run')
  const referencePath = join(root, 'publisher', 'canonical-reference.txt')
  await mkdir(join(root, 'publisher'), { recursive: true })
  await writeFile(referencePath, canonicalText)
  await writeMultiProviderManifestFixture(runDir, {
    command: 'extract',
    extractRoute: 'document',
    metadata: {
      step2: [{ extractionMethod: 'ocr', totalPages: 1, ocrPages: 1, textPages: 0 }]
    },
    providers: [{
      dir: 'tesseract-tesseract',
      provider: 'tesseract',
      model: 'tesseract',
      processingTime: 1000,
      result: { text: 'alpha gamma', pages: [{ pageNumber: 1, method: 'ocr', text: 'alpha gamma' }], totalPages: 1 }
    }]
  })
  const manifestPath = join(runDir, 'manifest.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>
  const reference = {
    kind: 'publisher-canonical',
    path: toProjectRelativePath(referencePath),
    sha256: canonicalHash,
    sourceUrl: 'https://publisher.example/pinned/reference.txt',
    sourceRevision: 'fixture-revision-1',
    description: 'Publisher text copied byte for byte.'
  }
  manifest['reference'] = reference
  await writeFile(manifestPath, JSON.stringify(manifest))
  return { runDir, referencePath, manifestPath, manifest, reference }
}

function dispatch(runDir: string, args: string[] = []) {
  return Bun.spawnSync([
    process.execPath, '.codex/skills/consensus/scripts/run.ts', 'ocr', 'build-report', runDir, ...args
  ], { stdout: 'pipe', stderr: 'pipe' })
}

describe('OCR publisher canonical references', () => {
  test('default dispatch scores independently supplied text and labels its provenance without copying gold', async () => {
    await withLocalTestDir('ocr-publisher-default', async root => {
      const data = await fixture(root)
      const result = dispatch(data.runDir)
      expect(result.exitCode).toBe(0)
      const report = await Bun.file(join(data.runDir, 'provider-comparison-report.json')).json()
      expect(report.referenceProvenance).toEqual({ ...data.reference, independentOfProviders: true })
      expect(report.consensusExtractionPath).toBe(data.reference.path)
      expect(report.providerGroups.local.providers[0].metrics.wer).toBeCloseTo(1 / 3)
      expect(report.providerGroups.local.providers[0].metrics.score).toBeCloseTo(200 / 3)
      expect(JSON.stringify(report)).not.toContain('alpha beta gamma')
      const markdown = await Bun.file(join(data.runDir, 'provider-comparison-report.md')).text()
      expect(markdown).toContain('Publisher canonical reference: `canonical-reference.txt`')
      expect(markdown).toContain('provider agreement did not determine this text')
      expect(markdown).not.toContain('against consensus extraction')
      const variants = await Bun.file(join(data.runDir, 'variant-comparison-summary.json')).json()
      expect(variants.variants[0].variantId).toBe('publisher-canonical')
      expect(variants.variants[0].source).toBe('independent publisher canonical reference')
      expect(variants.pairwiseDistances[0].referenceVariantId).toBe('publisher-canonical')
      const summary = await Bun.file(join(data.runDir, 'ocr-benchmark-summary.md')).text()
      expect(summary).toContain('# OCR Canonical Reference Benchmark Summary')
      expect(summary).toContain('reference is immutable')
      expect(summary).not.toContain('status-quo-consensus')
    })
  })

  test('explicit dispatcher input accepts the declared reference and writes metric reports beside custom JSON output', async () => {
    await withLocalTestDir('ocr-publisher-explicit', async root => {
      const data = await fixture(root)
      const archive = join(root, 'archive')
      await mkdir(archive)
      const result = dispatch(data.runDir, [
        '--input-text', data.referencePath,
        '--markdown-out', join(archive, 'provider-comparison-report.md'),
        '--json-out', join(archive, 'provider-comparison-report.json')
      ])
      expect(result.exitCode).toBe(0)
      expect(await Bun.file(join(archive, 'page-metrics.json')).exists()).toBe(true)
      expect(await Bun.file(join(archive, 'ocr-benchmark-summary.md')).exists()).toBe(true)
      expect(await Bun.file(join(data.runDir, 'provider-comparison-report.json')).exists()).toBe(false)
      expect((await Bun.file(join(archive, 'provider-comparison-report.json')).json()).referenceProvenance.sha256).toBe(canonicalHash)
    })
  })

  test('changed gold bytes are rejected before any report is written', async () => {
    await withLocalTestDir('ocr-publisher-hash', async root => {
      const data = await fixture(root)
      await writeFile(data.referencePath, 'alpha gamma\n')
      const result = dispatch(data.runDir, ['--input-text', data.referencePath])
      expect(result.exitCode).not.toBe(0)
      expect(result.stderr.toString()).toContain('Publisher canonical reference SHA-256 mismatch')
      expect(await Bun.file(join(data.runDir, 'provider-comparison-report.json')).exists()).toBe(false)
    })
  })

  test('a different input artifact is rejected even when its text hash matches', async () => {
    await withLocalTestDir('ocr-publisher-path', async root => {
      const data = await fixture(root)
      const wrongPath = join(root, 'wrong-reference.txt')
      await writeFile(wrongPath, canonicalText)
      const result = dispatch(data.runDir, ['--input-text', wrongPath])
      expect(result.exitCode).not.toBe(0)
      expect(result.stderr.toString()).toContain('Explicit reference path does not match')
      expect(await Bun.file(join(data.runDir, 'provider-comparison-report.json')).exists()).toBe(false)
    })
  })

  test('malformed provenance, absolute paths and invalid hashes cannot be silently treated as consensus', async () => {
    await withLocalTestDir('ocr-publisher-invalid', async root => {
      const data = await fixture(root)
      for (const invalid of [
        { ...data.reference, sourceRevision: '' },
        { ...data.reference, kind: 'provider-output' },
        { ...data.reference, path: data.referencePath },
        { ...data.reference, path: '../outside-reference.txt' },
        { ...data.reference, sha256: 'not-a-sha256' },
        { ...data.reference, sourceUrl: 'file:///reference.txt' }
      ]) {
        data.manifest['reference'] = invalid
        await writeFile(data.manifestPath, JSON.stringify(data.manifest))
        const result = dispatch(data.runDir)
        expect(result.exitCode).not.toBe(0)
        expect(result.stderr.toString()).toMatch(/publisher-canonical reference|Publisher canonical reference/)
      }
    })
  })

  test('removing the publisher declaration restores the legacy default, labels and identical quality metrics', async () => {
    await withLocalTestDir('ocr-publisher-legacy', async root => {
      const data = await fixture(root)
      expect(dispatch(data.runDir).exitCode).toBe(0)
      const publisher = await Bun.file(join(data.runDir, 'provider-comparison-report.json')).json()
      delete data.manifest['reference']
      await writeFile(data.manifestPath, JSON.stringify(data.manifest))
      await writeFile(join(data.runDir, 'consensus-extraction.txt'), canonicalText)
      expect(dispatch(data.runDir).exitCode).toBe(0)
      const legacy = await Bun.file(join(data.runDir, 'provider-comparison-report.json')).json()
      expect(legacy).not.toHaveProperty('referenceProvenance')
      expect(legacy.providerGroups).toEqual(publisher.providerGroups)
      expect(legacy.metricRankings).toEqual(publisher.metricRankings)
      const markdown = await Bun.file(join(data.runDir, 'provider-comparison-report.md')).text()
      expect(markdown).not.toContain('Publisher canonical reference')
      expect(markdown).not.toContain('provider agreement did not determine')
      const variants = await Bun.file(join(data.runDir, 'variant-comparison-summary.json')).json()
      expect(variants.variants[0]?.variantId).toBe('status-quo-consensus')
      const summary = await Bun.file(join(data.runDir, 'ocr-benchmark-summary.md')).text()
      expect(summary).toContain('# OCR Consensus Benchmark Summary')
    })
  })
})
