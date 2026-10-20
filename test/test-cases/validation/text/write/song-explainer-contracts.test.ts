import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import type { WriteRuntimeOptions } from '~/types'
import { collectLeafPrompts, getAvailablePromptNames, getAvailablePromptNamesForHelp, resolvePromptNames, resolvePromptTokenEstimate } from '~/prompts/prompt-loader'
import { runTextWrite } from '~/cli/commands/text/write/run-text-write'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { readManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { buildLlmEstimates } from '~/cli/commands/pricing-orchestration/aggregate-pricing/llm-estimates'
import { resolveStructuredSchema } from '~/cli/commands/text/write/structured-output/schema-resolver'
import { parseAndValidateStructured } from '~/cli/commands/text/write/structured-output/validator'
import { renderToPlainText } from '~/cli/commands/text/write/structured-output/renderers'
import { installFetch, installOpenAIRestContractHooks, jsonResponse, withTempDir } from '../../providers/openai-rest-contracts/shared'

installOpenAIRestContractHooks()

type InputType = 'sourceOnly' | 'lyricsOnly' | 'lyricsAndSource'
const SOURCE_TEXT = '## Original source\n\nIn a fictional town, Mara keeps the red ledger of water levels beside the Three Bell Channel. The town council asks her to shut the outer gate before the evening rain. She follows the request and closes the gate. The account does not explain the channel name.'
const LINES = [
  ['Verse 1', 'Mara keeps the red ledger by the Three Bell Channel', 'Mara and her water-level record establish who makes the decision and where.', 'Opening paragraph: Mara keeps the water-level ledger beside the channel.'],
  ['Chorus 1', 'We borrow tomorrow\'s tide', 'Borrowing a tide is figurative: a possible reading is taking a risk whose consequences arrive later.', null],
  ['Verse 2', 'She shuts the outer gate before the evening rain', 'She refers to Mara; the gate closes ahead of the rain.', 'Opening paragraph: the council asks Mara to close the gate before evening rain.'],
  ['Chorus 2', 'We borrow tomorrow\'s tide', 'The repeated image now follows the gate closing, connecting the earlier risk to a concrete action.', null]
] as const
const LYRICS_TEXT = '# Borrowed Tide\n\n' + LINES.map(([section, lyric]) => `## ${section}\n\n${lyric}`).join('\n\n')
const INPUTS = { sourceOnly: SOURCE_TEXT, lyricsOnly: LYRICS_TEXT, lyricsAndSource: `## Lyrics\n\n${LYRICS_TEXT}\n\n${SOURCE_TEXT}` }
const explanation = (inputType: InputType) => ({
  inputType,
  title: inputType === 'sourceOnly' ? 'Listening guide to the gate-closing account' : 'Listening guide to Borrowed Tide',
  overview: inputType === 'sourceOnly' ? 'Lyrics were not supplied; this is context for the gate-closing account.' : 'The song links a gate-closing decision to a metaphor about future consequences.',
  background: [inputType === 'lyricsOnly' ? 'The original source is unavailable; only the song establishes Mara, the channel, and the gate.' : 'The supplied fictional account puts the council request before Mara closes the gate.'],
  glossary: [{
    term: 'Three Bell Channel', kind: 'place', explanation: 'The named waterway beside Mara and the ledger.',
    relevance: 'It locates the decision and explains the place named in the opening line.',
    evidenceBasis: inputType === 'lyricsOnly' ? 'lyrics' : 'sourceText',
    locations: inputType === 'sourceOnly' ? ['Original source, opening paragraph'] : ['Verse 1, lyric line 1']
  }],
  lyricAnnotations: inputType === 'sourceOnly' ? [] : LINES.map(([section, lyric, meaning, connection], index) => ({
    section, lineNumber: index + 1, lyric, explanation: meaning,
    sourceConnection: inputType === 'lyricsOnly' ? null : connection
  })),
  uncertainties: ['The reason for the channel name is not supplied.']
})
const PAIRED = explanation('lyricsAndSource')
const SHORT_SUMMARY = { episodeDescription: 'Mara closes a gate before rain while a recurring tide metaphor suggests future consequences.' }
const SEMANTIC_FAILURES = [
  {
    name: 'source-only output invents lyric annotations', inputType: 'sourceOnly',
    payload: { ...explanation('sourceOnly'), lyricAnnotations: [PAIRED.lyricAnnotations[0]!] },
    diagnostic: 'sourceOnly output must have an empty lyricAnnotations array'
  },
  {
    name: 'lyrics-only output claims an original-source connection', inputType: 'lyricsOnly',
    payload: { ...explanation('lyricsOnly'), lyricAnnotations: [{ ...PAIRED.lyricAnnotations[0]!, sourceConnection: 'Claimed passage from an unavailable source' }] },
    diagnostic: 'lyricsOnly output must use null for every sourceConnection'
  },
  ...[
    { name: 'line numbering starts after one', numbers: [2, 3, 4, 5] },
    { name: 'line numbering repeats', numbers: [1, 1, 3, 4] },
    { name: 'line numbering skips a line', numbers: [1, 2, 4, 5] },
    { name: 'line numbering changes order', numbers: [1, 3, 2, 4] },
  ].map(({ name, numbers }) => ({
    name, inputType: 'lyricsAndSource' as const,
    payload: { ...PAIRED, lyricAnnotations: PAIRED.lyricAnnotations.map((annotation, index) => ({ ...annotation, lineNumber: numbers[index]! })) },
    diagnostic: 'global lyric line numbers must start at 1 and be contiguous in annotation order'
  }))
] satisfies Array<{ name: string; inputType: InputType; payload: unknown; diagnostic: string }>
const options = (prompts: string[]) => {
  const flags = { openai: 'gpt-6.1-sol', prompt: prompts, 'rendered-text': true }
  return { ...buildOptsFromFlags(flags, {}, new Set(Object.keys(flags)), { scope: 'write' }), configPath: undefined } as WriteRuntimeOptions
}
const mockedWrite = async (dir: string, inputText: string, response: string, prompts = ['songExplainer']) => {
  process.env['OPENAI_API_KEY'] = 'test'
  const calls = installFetch(() => jsonResponse({ model: 'gpt-6.1-sol', output_text: response, usage: { input_tokens: 50, output_tokens: 30 } }))
  const inputPath = join(dir, 'unrelated-filename.txt')
  await Bun.write(inputPath, inputText)
  const { outputDir } = await runTextWrite(inputPath, dir, options(prompts))
  return { calls, outputDir }
}

describe('song explainer discovery, instructions, and no-call pricing', () => {
  test('discovers a dedicated preset for command selection and help', async () => {
    expect(await getAvailablePromptNames()).toContain('songExplainer')
    expect(getAvailablePromptNamesForHelp()).toContain('songExplainer')
    const schema = await resolveStructuredSchema(['songExplainer'])
    expect(schema.leafPromptNames).toEqual(['songExplainer'])
    expect(schema.presetNames).toEqual(['songExplainer'])
    expect(schema.jsonSchema['required']).toEqual(Object.keys(PAIRED))
    expect(schema.jsonSchema['additionalProperties']).toBe(false)
  })

  test('published JSON and composed examples validate against their actual schemas', async () => {
    const [leaf] = await collectLeafPrompts(['songExplainer'])
    expect(leaf).toBeDefined()
    const schema = await resolveStructuredSchema(['songExplainer'])
    expect(parseAndValidateStructured(schema.schema, leaf!.entry.examples.json).success).toBe(true)
    expect(await resolvePromptNames(['songExplainer'], { exampleFormat: 'markdown' })).toContain(leaf!.entry.examples.markdown.trimEnd())
    const names = ['songExplainer', 'shortSummary']
    const combined = await resolveStructuredSchema(names)
    const example = (await resolvePromptNames(names)).split('Example JSON output:\n\n')[1]
    expect(example).toBeDefined()
    expect(parseAndValidateStructured(combined.schema, example!).success).toBe(true)
  })

  test('instructions cover all modes, complete line coverage, repetition, and evidence limits', async () => {
    const [leaf] = await collectLeafPrompts(['songExplainer'])
    const instruction = leaf!.entry.instruction
    for (const mode of Object.keys(INPUTS)) expect(instruction).toContain(mode)
    expect(instruction).toMatch(/lyricAnnotations[^\n]*(?:empty array|\[\])/i)
    expect(instruction).toMatch(/sourceConnection[^\n]*null/i)
    expect(instruction).toMatch(/every nonblank lyric line/i)
    expect(instruction).toMatch(/repeated choruses/i)
    expect(instruction).toMatch(/do not invent/i)
    expect(instruction).toMatch(/no browsing/i)
    expect(instruction).toMatch(/(?:unsupported additions|contradictions)/i)
  })

  test('declared response length reaches source-aware price estimates without dispatch', async () => {
    const calls = installFetch(() => { throw new Error('Pricing must not dispatch a provider request') })
    const declaration = await resolvePromptTokenEstimate(['songExplainer'])
    expect(declaration.estimatedInputTokens).toBeGreaterThan(0)
    expect(declaration.estimatedOutputTokens).toBe(6000)
    const estimates = await buildLlmEstimates(options(['songExplainer']), INPUTS.lyricsAndSource)
    expect(estimates).toHaveLength(1)
    expect(estimates[0]).toMatchObject({ provider: 'openai', model: 'gpt-6.1-sol', estimatedOutputTokens: 6000 })
    expect(estimates[0]!.estimatedInputTokens).toBeGreaterThan(Math.ceil(INPUTS.lyricsAndSource.length / 4))
    expect(estimates[0]!.totalCost).toBeGreaterThan(0)
    expect(calls).toHaveLength(0)
  })
})

describe('song explainer decoded artifact contracts', () => {
  test('accepts all modes, evidence categories, absent connections, and original lyric whitespace', async () => {
    const { schema } = await resolveStructuredSchema(['songExplainer'])
    for (const mode of Object.keys(INPUTS) as InputType[]) {
      const payload = explanation(mode)
      expect(parseAndValidateStructured(schema, JSON.stringify(payload))).toMatchObject({ success: true, value: payload })
    }
    for (const evidenceBasis of ['sourceText', 'lyrics', 'generalKnowledge', 'interpretation', 'uncertain']) {
      const payload = { ...PAIRED, glossary: [{ ...PAIRED.glossary[0], evidenceBasis, locations: [] }] }
      expect(parseAndValidateStructured(schema, JSON.stringify(payload)).success).toBe(true)
    }
    const lyric = '  Mara keeps the red ledger  '
    const payload = { ...PAIRED, lyricAnnotations: [{ ...PAIRED.lyricAnnotations[0], lyric }] }
    expect(parseAndValidateStructured(schema, JSON.stringify(payload))).toMatchObject({ success: true, value: payload })
    expect(parseAndValidateStructured(schema, JSON.stringify({ ...PAIRED, background: [], glossary: [], lyricAnnotations: [], uncertainties: [] })).success).toBe(true)
  })

  test('rejects missing or blank fields, malformed collections, enums, line numbers, and extra properties', async () => {
    const { schema } = await resolveStructuredSchema(['songExplainer'])
    const term = PAIRED.glossary[0]!
    const annotation = PAIRED.lyricAnnotations[0]!
    const omit = (record: object, key: string) => Object.fromEntries(Object.entries(record).filter(([field]) => field !== key))
    const invalid: unknown[] = [
      ...Object.keys(PAIRED).map(key => omit(PAIRED, key)),
      ...['title', 'overview'].flatMap(key => ['', ' \n\t', null].map(value => ({ ...PAIRED, [key]: value }))),
      ...['background', 'uncertainties'].flatMap(key => [null, {}, 'text', [''], [' \t'], [null]].map(value => ({ ...PAIRED, [key]: value }))),
      ...['glossary', 'lyricAnnotations'].flatMap(key => [null, {}, 'text', ['text']].map(value => ({ ...PAIRED, [key]: value }))),
      ...[null, '', 'source', 1].map(inputType => ({ ...PAIRED, inputType })),
      ...Object.keys(term).map(key => ({ ...PAIRED, glossary: [omit(term, key)] })),
      ...['term', 'kind', 'explanation', 'relevance'].flatMap(key => ['', ' \n', null].map(value => ({ ...PAIRED, glossary: [{ ...term, [key]: value }] }))),
      ...[null, 'verified', ''].map(evidenceBasis => ({ ...PAIRED, glossary: [{ ...term, evidenceBasis }] })),
      ...[null, {}, 'line 1', [''], [' '], [1]].map(locations => ({ ...PAIRED, glossary: [{ ...term, locations }] })),
      ...Object.keys(annotation).map(key => ({ ...PAIRED, lyricAnnotations: [omit(annotation, key)] })),
      ...['section', 'lyric', 'explanation', 'sourceConnection'].flatMap(key => ['', ' \n'].map(value => ({ ...PAIRED, lyricAnnotations: [{ ...annotation, [key]: value }] }))),
      ...[0, -1, 1.5, '1', null].map(lineNumber => ({ ...PAIRED, lyricAnnotations: [{ ...annotation, lineNumber }] })),
      { ...PAIRED, extra: true }, { ...PAIRED, glossary: [{ ...term, extra: true }] },
      { ...PAIRED, lyricAnnotations: [{ ...annotation, extra: true }] }
    ]
    for (const payload of invalid) expect(parseAndValidateStructured(schema, JSON.stringify(payload)).success, JSON.stringify(payload)).toBe(false)
    expect(parseAndValidateStructured(schema, 'not JSON').success).toBe(false)
  })

  test('composition validates named leaves and does not inject the input filename as the guide title', async () => {
    for (const names of [['songExplainer'], ['songExplainer', 'shortSummary']]) {
      const schema = await resolveStructuredSchema(names)
      const payload = names.length === 1 ? PAIRED : { songExplainer: PAIRED, shortSummary: SHORT_SUMMARY }
      expect(parseAndValidateStructured(schema.schema, JSON.stringify(payload), {
        leafPromptNames: schema.leafPromptNames, presetNames: schema.presetNames, songLyricsTitle: 'unrelated-filename'
      })).toMatchObject({ success: true, value: payload })
      expect(renderToPlainText(payload, names)).toContain(PAIRED.title)
    }
  })

  for (const invalid of SEMANTIC_FAILURES) {
    test(`rejects semantic contradictions for single and composed presets: ${invalid.name}`, async () => {
      for (const names of [['songExplainer'], ['songExplainer', 'shortSummary'], ['shortSummary', 'songExplainer']]) {
        const resolved = await resolveStructuredSchema(names)
        const payload = names.length === 1 ? invalid.payload : { songExplainer: invalid.payload, shortSummary: SHORT_SUMMARY }
        const rejected = parseAndValidateStructured(resolved.schema, JSON.stringify(payload))
        expect(rejected.success).toBe(false)
        expect(rejected.issue).toContain(invalid.diagnostic)
        if (names.length > 1) expect(rejected.issue).toStartWith('songExplainer: ')
      }
    })
  }
})

describe('song explainer mocked transport and artifact integrity', () => {
  // These fixtures verify dispatch and decoded artifacts; they do not establish generated interpretive quality.
  for (const inputType of Object.keys(INPUTS) as InputType[]) {
    test(`${inputType} dispatches its native schema and preserves JSON, Markdown, source, and manifest`, async () => {
      await withTempDir(async dir => {
        const payload = explanation(inputType)
        const { calls, outputDir } = await mockedWrite(dir, INPUTS[inputType], JSON.stringify(payload))
        const schema = await resolveStructuredSchema(['songExplainer'])
        expect(calls).toHaveLength(1)
        expect(calls[0]?.url).toEndWith('/responses')
        expect(calls[0]?.bodyJson).toMatchObject({ model: 'gpt-6.1-sol', text: { format: { type: 'json_schema', name: 'prompt_songExplainer', strict: true, schema: schema.jsonSchema } } })
        expect(calls[0]?.bodyJson?.['input']).toContain(INPUTS[inputType])
        expect(await Bun.file(join(outputDir, 'prompt.md')).text()).toContain(INPUTS[inputType])
        expect(await Bun.file(join(outputDir, 'text.json')).json()).toEqual(payload)
        const rendered = await Bun.file(join(outputDir, 'text.md')).text()
        expect(rendered).toContain(payload.title)
        expect(rendered).toContain(payload.overview)
        expect(rendered).toContain('Three Bell Channel')
        expect(await Bun.file(join(outputDir, 'show-note.md')).text()).toContain(payload.overview)
        if (inputType === 'sourceOnly') expect(payload.lyricAnnotations).toEqual([])
        else {
          expect(payload.lyricAnnotations.map(entry => entry.lineNumber)).toEqual([1, 2, 3, 4])
          expect(payload.lyricAnnotations.map(entry => entry.lyric)).toEqual(LINES.map(([, line]) => line))
          expect(rendered.split(LINES[1][1]).length - 1).toBe(2)
          if (inputType === 'lyricsOnly') expect(payload.lyricAnnotations.every(entry => entry.sourceConnection === null)).toBe(true)
        }
        const manifest = await readManifest(outputDir)
        expect(manifest?.items[0]?.metadata['step3']).toMatchObject({ llmService: 'openai', llmModel: 'gpt-6.1-sol', structuredMode: 'native', structuredPresetNames: ['songExplainer'], validationFailed: false, outputFileName: 'text.json' })
        expect(manifest?.items[0]?.providers[0]?.settings?.local).toMatchObject({ prompts: ['songExplainer'], structuredPresetNames: ['songExplainer'] })
      })
    })
  }

  test('combined selection stores and renders separately named explanation and summary leaves', async () => {
    await withTempDir(async dir => {
      const prompts = ['songExplainer', 'shortSummary']
      const payload = { songExplainer: PAIRED, shortSummary: SHORT_SUMMARY }
      const { calls, outputDir } = await mockedWrite(dir, INPUTS.lyricsAndSource, JSON.stringify(payload), prompts)
      expect(calls).toHaveLength(1)
      expect(calls[0]?.bodyJson).toMatchObject({ text: { format: { schema: { required: prompts, additionalProperties: false } } } })
      expect(await Bun.file(join(outputDir, 'text.json')).json()).toEqual(payload)
      const rendered = await Bun.file(join(outputDir, 'text.md')).text()
      expect(rendered).toContain('## Song Explainer')
      expect(rendered).toContain('## Short Summary')
      expect(rendered).toContain(SHORT_SUMMARY.episodeDescription)
      const manifest = await readManifest(outputDir)
      expect(manifest?.items[0]?.metadata['step3']).toMatchObject({ structuredPresetNames: prompts, validationFailed: false })
    })
  })

  for (const invalid of [SEMANTIC_FAILURES[0]!, SEMANTIC_FAILURES[1]!, SEMANTIC_FAILURES[4]!]) {
    for (const prompts of [['songExplainer'], ['shortSummary', 'songExplainer']]) {
      test(`successful mocked transport preserves semantically invalid ${prompts.length === 1 ? 'single' : 'composed'} output as an error artifact: ${invalid.name}`, async () => {
        await withTempDir(async dir => {
          const payload = prompts.length === 1 ? invalid.payload : { shortSummary: SHORT_SUMMARY, songExplainer: invalid.payload }
          const raw = JSON.stringify(payload)
          const { calls, outputDir } = await mockedWrite(dir, INPUTS[invalid.inputType], raw, prompts)
          expect(calls).toHaveLength(1)
          expect(await Bun.file(join(outputDir, 'text.json')).json()).toMatchObject({ _raw: raw, _validationError: expect.stringContaining(invalid.diagnostic) })
          const rendered = await Bun.file(join(outputDir, 'text.md')).text()
          expect(rendered).toContain('## Structured Validation Error')
          expect(rendered).toContain(raw)
          const manifest = await readManifest(outputDir)
          expect(manifest?.items[0]?.metadata['step3']).toMatchObject({ validationFailed: true, structuredPresetNames: prompts })
        })
      })
    }
  }

  for (const raw of ['{"unsupported":"wrong shape"}', JSON.stringify({ ...PAIRED, lyricAnnotations: [{ ...PAIRED.lyricAnnotations[0], lineNumber: 0 }] }), '{"inputType":']) {
    test(`preserves invalid mocked output as marked error artifacts: ${raw.slice(0, 35)}`, async () => {
      await withTempDir(async dir => {
        const { calls, outputDir } = await mockedWrite(dir, INPUTS.lyricsAndSource, raw)
        expect(calls).toHaveLength(1)
        expect(await Bun.file(join(outputDir, 'text.json')).json()).toMatchObject({ _raw: raw, _validationError: expect.any(String) })
        const rendered = await Bun.file(join(outputDir, 'text.md')).text()
        expect(rendered).toContain('## Structured Validation Error')
        expect(rendered).toContain(raw)
        const manifest = await readManifest(outputDir)
        expect(manifest?.items[0]?.metadata['step3']).toMatchObject({ validationFailed: true, structuredPresetNames: ['songExplainer'] })
      })
    })
  }
})
