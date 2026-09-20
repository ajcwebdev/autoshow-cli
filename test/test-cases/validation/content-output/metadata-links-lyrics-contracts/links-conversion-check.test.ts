import { afterEach, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import type { FetchFn, LinksRefreshLinkMetadata, LinksRefreshMetadata } from '~/types'
import {
  getLinksRefreshMetadataPath,
  runLinksWithArgv
} from '~/cli/commands/setup-and-utilities/links/define-links-command'
import {
  checkHtmlConversion,
  collectIdentifiers,
  extractHtmlPlainText
} from '~/cli/commands/setup-and-utilities/links/links-conversion-check'
import { collectLinksRefreshFindings } from '~/cli/commands/setup-and-utilities/links/links-refresh-findings'
import { configureBinDir, getConfiguredBinDir } from '~/utils/runtime-paths'
import { writeFakeDefuddleBinIn } from '../../../../test-utils/fixtures/fake-defuddle-bin'
import { makeTempDir } from '../../../../test-utils/temp-dirs'
import { linksTestOutputPath } from './shared'

const originalBinDir = getConfiguredBinDir()
const tempDirs: string[] = []

afterEach(async () => {
  configureBinDir(originalBinDir ?? '')
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

const entry = (
  sourceUrl: string,
  lostIdentifiers: string[],
  identifierCount = 10,
  missingIdentifiers: string[] = lostIdentifiers
): LinksRefreshLinkMetadata => ({
  sourceUrl,
  fetchUrl: sourceUrl,
  finalUrl: sourceUrl,
  status: 'success',
  changeStatus: 'changed',
  tokenCount: 100,
  contentHash: `hash:${sourceUrl}`,
  byteCount: 400,
  characterCount: 400,
  lastRefreshAt: '2026-09-20T00:00:00.000Z',
  conversion: {
    backend: 'defuddle',
    identifierCount,
    identifierRecall: 1 - missingIdentifiers.length / identifierCount,
    missingIdentifiers,
    ...(lostIdentifiers.length > 0 ? { lostIdentifiers } : {})
  }
})

test('identifiers are field names, camelCase names, hyphenated IDs that carry a digit, and dollar prices', () => {
  const text = 'Send voice_id and responseFormat to voxtral-mini-2602 or gpt-5.6-luna for $0.30, or $1,250.50 yearly. ' +
    'A low-latency, real-time, end-of-line answer on 2026-07-16 takes 3-5 minutes.'

  expect([...collectIdentifiers(text)]).toEqual(['voice_id', 'responseFormat', 'voxtral-mini-2602', 'gpt-5.6-luna', '$0.30', '$1,250.50'])
})

test('page text ignores chrome and scripts but keeps elements a stylesheet would hide', () => {
  const html = '<nav>nav_item</nav><script>var script_only = 1</script><main><div class="hidden">hidden_field</div>' +
    '<p>shown_field &amp; $5</p></main><footer>footer_item</footer>'

  expect([...collectIdentifiers(extractHtmlPlainText(html))]).toEqual(['hidden_field', 'shown_field', '$5'])
})

test('conversion check lists identifiers the page has and the markdown lost, reading escaped underscores as plain', () => {
  const html = '<main><h5>voice_id</h5><h5>response_format</h5><h5>ref_audio</h5><p>$0.30</p></main>'

  expect(checkHtmlConversion(html, '##### voice\\_id\n\n$0.30', 'defuddle')).toEqual({
    backend: 'defuddle',
    identifierCount: 4,
    missingIdentifiers: ['ref_audio', 'response_format']
  })
})

test('refresh findings report conversion loss only when the previous capture held enough of what is now missing', () => {
  const url = (name: string): string => `https://docs.acme.test/${name}`
  const findings = collectLinksRefreshFindings([
    entry(url('lost'), ['prompt_cache_key', 'ref_audio', 'response_format', 'voice_id'], 9),
    // Never captured, so not a regression: a related-models carousel the converter is right to drop.
    entry(url('carousel'), [], 10, ['$1', '$2', '$3', '$4', '$5', '$6', '$7', '$8']),
    entry(url('one-field'), ['only_one'], 10),
    entry(url('small-share'), ['a_b', 'c_d'], 21),
    entry(url('tiny-page'), ['a_b', 'c_d', 'e_f'], 4),
    entry(url('at-threshold'), ['a_b', 'c_d'], 20)
  ], {})

  expect(findings).toEqual([
    {
      sourceUrl: url('lost'),
      status: 'conversion-loss',
      detail: 'the page still has 4 of 9 identifiers that the previous capture held and this one lost: prompt_cache_key, ref_audio, response_format, voice_id'
    },
    {
      sourceUrl: url('at-threshold'),
      status: 'conversion-loss',
      detail: 'the page still has 2 of 20 identifiers that the previous capture held and this one lost: a_b, c_d'
    }
  ])
})

test('conversion loss detail caps the identifiers it names', () => {
  const lost = Array.from({ length: 11 }, (_, index) => `field_${String(index).padStart(2, '0')}`)
  const [finding] = collectLinksRefreshFindings([entry('https://docs.acme.test/many', lost, 20)], {})

  expect(finding?.detail).toEndWith('field_00, field_01, field_02, field_03, field_04, field_05, field_06, field_07, and 3 more')
})

test('links --refresh records the conversion check for an HTML page and reports a converter that starts dropping fields', async () => {
  const binDir = await makeTempDir('autoshow-links-conversion-')
  tempDirs.push(binDir)
  await writeFakeDefuddleBinIn(binDir, [
    "const html = readFileSync(args[1] ?? '', 'utf8')",
    "const filler = ' This reference page describes the speech endpoint in enough words to count as meaningful content.'.repeat(3)",
    "const fields = html.includes('data-converter=\"lossy\"') ? 'voice_id' : 'voice_id response_format ref_audio prompt_cache_key sample_rate'",
    "console.log(JSON.stringify({ contentMarkdown: '# Speech\\n\\n' + fields + filler }))"
  ], ["import { readFileSync } from 'node:fs'"])
  configureBinDir(binDir)

  const outputPath = linksTestOutputPath('refresh-conversion')
  const sidecarPath = getLinksRefreshMetadataPath(outputPath)
  let converter = 'faithful'
  let carousel = ''
  const fetchImpl: FetchFn = async () => new Response(
    `<!doctype html><html><body data-converter="${converter}"><main><h5>voice_id</h5><h5>response_format</h5><h5>ref_audio</h5>` +
    `<h5>prompt_cache_key</h5><h5>sample_rate</h5>${carousel}</main></body></html>`,
    { headers: { 'content-type': 'text/html' } }
  )
  const argv = ['bun', 'src/cli/create-cli.ts', 'links', '--refresh', 'https://docs.acme.test/speech']
  const refresh = async (): Promise<LinksRefreshMetadata> => {
    await runLinksWithArgv(argv, { outputPath, fetchImpl })
    return JSON.parse(await Bun.file(sidecarPath).text()) as LinksRefreshMetadata
  }

  const first = await refresh()
  expect(first.links[0]?.conversion).toEqual({ backend: 'defuddle', identifierCount: 5, identifierRecall: 1, missingIdentifiers: [] })
  expect(first.findings).toEqual([])

  // The page gains related-model cards that the converter drops. They were never captured, so nothing was lost.
  carousel = '<div><h6>fibo-1.5</h6><h6>klein-4b</h6><h6>gemma-4</h6></div>'
  const withCarousel = await refresh()
  expect(withCarousel.links[0]?.conversion).toEqual({
    backend: 'defuddle',
    identifierCount: 8,
    identifierRecall: 0.625,
    missingIdentifiers: ['fibo-1.5', 'gemma-4', 'klein-4b']
  })
  expect(withCarousel.findings).toEqual([])
  carousel = ''

  converter = 'lossy'
  const second = await refresh()
  expect(second.links[0]?.conversion).toEqual({
    backend: 'defuddle',
    identifierCount: 5,
    identifierRecall: 0.2,
    missingIdentifiers: ['prompt_cache_key', 'ref_audio', 'response_format', 'sample_rate'],
    lostIdentifiers: ['prompt_cache_key', 'ref_audio', 'response_format', 'sample_rate']
  })
  expect(second.findings.map(finding => [finding.status, finding.detail])).toEqual([[
    'conversion-loss',
    'the page still has 4 of 5 identifiers that the previous capture held and this one lost: prompt_cache_key, ref_audio, response_format, sample_rate'
  ]])

  // The loss is reported when it happens, not on every later run.
  expect((await refresh()).findings).toEqual([])
})

test('a markdown response carries no conversion check', async () => {
  const outputPath = linksTestOutputPath('refresh-no-conversion')
  await runLinksWithArgv(
    ['bun', 'src/cli/create-cli.ts', 'links', '--refresh', 'https://docs.acme.test/page.md'],
    { outputPath, fetchImpl: async () => new Response('# voice_id', { headers: { 'content-type': 'text/markdown' } }) }
  )
  const metadata = JSON.parse(await Bun.file(getLinksRefreshMetadataPath(outputPath)).text()) as LinksRefreshMetadata

  expect(metadata.links[0]?.conversion).toBeUndefined()
})
