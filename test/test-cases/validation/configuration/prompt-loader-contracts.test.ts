import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { collectLeafPrompts, getAvailablePromptNames, resolvePromptNames } from '~/prompts/prompt-loader'
import { resolveStructuredSchema } from '~/cli/commands/process-steps/step-3-write/structured-output/schema-resolver'
import { parseAndValidateStructured } from '~/cli/commands/process-steps/step-3-write/structured-output/validator'
import { readPromptFile } from '~/cli/commands/process-steps/step-3-write/text-input-utils'

const MARKDOWN_PROMPT_SNAPSHOT = {
  blog: 'c1bb449943d0bfbf89f943c549ae507f254a2f362b53a65f05f6cd5be647042b',
  bulletPoints: '6f471ab912edd76e29dd4b4f665a2468de267dee23cd4659ac14a9debdeddcee',
  chapterTitles: 'e91ae6e183edd26e3305c19d82f26b34fd6cf68c714bced765118da2c90b7dec',
  chapterTitlesAndQuotes: 'c8caa808537d6b1b7effb1e21fe99fb0f363a51f15e483a62807b5dc4a4a2f02',
  contentStrategy: 'dc2d2d671bb21355189873f853b34392589cb2bc48a8b0d1079743a085b367f3',
  countrySong: 'e9abb2e058fedf7d379bb1e2e612ec33b1fb33c6fc45e5e0cc6ba852a5c321cb',
  emailNewsletter: 'cc08617ff2e8ea8b56f9e00c70ca6025dbe3ab89dc261e5a45fd32d259321e49',
  facebook: 'ccb0f3edcfa3d8dbb19ddb18f3bfef3134740ddadcdf19dae30b5a1b5a0ecf7c',
  faq: '928e611f34f3d8be222118d50aa6e4971c86d1aefdc9e2140df77dde17c2cf19',
  folkSong: '8cb27d9f135ebddde840cbc10f28e2c0728b591c81afb3e4c53e23e17ceb97b8',
  instagram: '9e0fc9faed4e4096fec96f4d76af8d3db141fa1c05a5f68c9d074a82d9db293d',
  jazzSong: '0a0e6cb962dfa80084bb7b119a81890ef4ef95d239e19643f8a9702e67741e3c',
  keyMoments: '12119912254b17068dfb1957e1b3d37d3f8969f5d85c4e9e402e65d925411496',
  linkedin: 'c593a110f35ea48b7bca806e72b02db84b848f4363ab7a3a0aec2be0052d48d2',
  longChapters: 'a3b9d8f8cfb78b861b23ae04e0c8addf45a16fef526e8599d011c5343c2326bc',
  longSummary: 'a77bb511929478b11f813091b833ef4144a759849bf634cbe32f00a79a7f2245',
  mediumChapters: 'f205d563cc255a11a6f3150efd4629562fbce1b67ab2a9c25baf0be946f55c2b',
  metadata: '296c2d14f8ba2c63846d10b05c4bf33d0e4cdd92e1cf2d3e362b35a72a9c85ff',
  pdfChapterBoundaries: '3ec0f79e37ad8f358d45b45246176348310c6244a1e9ae5a18d3673159f67422',
  poetryCollection: '1a3cde0d00aaad1234c651840e63c24d4ded9f2c317a26387b4828b3577bc833',
  popSong: '35485f45fe09458d7a8a62f71effce3365d5e9aba8e45a8f350edfb55ad55493',
  questions: 'bc6211e86975ad7b454a49b0bde581de3d85e93b2ecd657e2efb8667da033e25',
  quotes: '60b990695179204ff5dbc0278fda7b37fa58bc232d4286ff4c55c27647c6e1f2',
  rapSong: '46ff719f9fc7f7f1628a8307d572dd8e86e20744d467cc2c6aed125825d78333',
  rapSongLong: '3a11e747683016b4d5356f64f0fbf99e32b23233fd4fc05603f7a7f4b33eaf35',
  rockSong: '1f7a513e96fd567cb3536129499a5044f1d7c63e947442b7b4e1dd00eafddf46',
  screenplay: 'e34dbfcea0400550285bc959a016d67c1d9f0524c467eafe40f4aacca245169e',
  seoArticle: '36f388032f84ad978ef76e72f363b31bd6eef732c9e3cc6bc1ceb7eeb469dc88',
  shortChapters: '82f6cc6d2bd966c8d9395d69f0b3dbb1892d061d61a93b8768cc6b347c07a2a1',
  shortStory: 'e6800001394ced4131346efaa3638a87402859ec3105300b7017f0a704514952',
  shortSummary: '9a0ea7a28a9a22fe71050ce0e7723801ac481d91cb11bd5b9cc96068c331c5d4',
  takeaways: 'b46610b4d2fe5fe76a07f7211992576bf2ce47855b9457026e072a1a9b62a763',
  tiktok: '77e1d4d7326209452469431b90958b268bc278d32501791c1c54754ab5050265',
  titles: 'e1f5c6473dbea897867b67aceb7ef9f2b94e0057912497ff247d9157c2872276',
  x: '956b7594813d2438d8625fdcdf785b77c575bb840a6e2688a85fde357876e419',
  youtubeDescription: '5765d2ffa00b65c9e090ae1e543e6baa06ccc760994785859cd495488f3d0634'
} as const

// rockSong and rapSong are pinned by their own schema-shape tests below, so this
// list is the remainder that would otherwise have no preset coverage at all.
const STANDARD_SONG_LYRIC_PROMPTS = [
  'countrySong',
  'folkSong',
  'jazzSong',
  'popSong'
]

const CREATIVE_WRITING_PROMPTS = [
  {
    promptName: 'poetryCollection',
    presetName: 'poetryCollection',
    requiredKeys: ['title', 'theme', 'poems', 'collectionNotes']
  },
  {
    promptName: 'screenplay',
    presetName: 'screenplay',
    requiredKeys: ['title', 'logline', 'scenes', 'productionNotes']
  },
  {
    promptName: 'shortStory',
    presetName: 'shortStory',
    requiredKeys: ['title', 'genre', 'acts', 'themes']
  }
] as const

const TEST_EPISODE_DESCRIPTION = 'James Perkins explains how his professional network helped him land a new DevRel role within 12 hours of being laid off.'
const TEST_EPISODE_SUMMARY = 'James Perkins describes losing his role at Tina CMS during a sudden downsizing and immediately leaning on the professional network he had built through developer relations work. Instead of beginning a cold job search, he contacted a former collaborator named Clark, with whom he had already established trust through prior freelance projects. That relationship quickly turned into a concrete opportunity, and within 12 hours of the initial message, the new role was confirmed and paperwork was complete. Perkins frames the experience as both unfortunate and lucky, but the conversation makes clear that his luck was helped by a long history of visible work, reliable collaboration, and maintained industry connections.'

const getRequiredStringKeys = (jsonSchema: Record<string, unknown>, promptName: string): string[] => {
  const required = jsonSchema['required']
  if (!Array.isArray(required)) {
    throw new Error(`Expected ${promptName} schema required fields to be an array`)
  }

  if (!required.every((entry): entry is string => typeof entry === 'string')) {
    throw new Error(`Expected ${promptName} schema required fields to be strings`)
  }

  return [...required].sort()
}

const getObjectProperties = (jsonSchema: Record<string, unknown>, promptName: string): Record<string, unknown> => {
  const properties = jsonSchema['properties']
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    throw new Error(`Expected ${promptName} schema properties to be an object`)
  }

  return properties as Record<string, unknown>
}

describe('prompt loader contracts', () => {
  test('discovers categorized prompt entries by basename', async () => {
    const names = await getAvailablePromptNames()
    const expectedNames = [
      'shortSummary',
      'shortChapters',
      'rockSong',
      'facebook',
      'youtubeDescription',
      'blog',
      'screenplay'
    ]

    for (const name of expectedNames) {
      expect(names).toContain(name)
    }
  })

  test('preserves every leaf prompt markdown output byte-for-byte after the presentation-prefix migration', async () => {
    const leaves = await collectLeafPrompts(await getAvailablePromptNames())
    const leafNames = leaves.map(({ name }) => name).sort((left, right) => left.localeCompare(right))

    expect(leafNames).toEqual(Object.keys(MARKDOWN_PROMPT_SNAPSHOT))

    for (const name of leafNames) {
      const prompt = await resolvePromptNames([name], { exampleFormat: 'markdown' })
      const digest = createHash('sha256').update(prompt).digest('hex')
      expect(digest).toBe(MARKDOWN_PROMPT_SNAPSHOT[name as keyof typeof MARKDOWN_PROMPT_SNAPSHOT])
    }
  })

  test('rejects the retired markdown presentation prefix in JSON prompt files', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-prompt-prefix-'))
    const promptPath = join(tempDir, 'legacy-prompt.json')

    try {
      await Bun.write(promptPath, JSON.stringify({
        description: 'Legacy prompt file',
        expectedInputTokens: 1,
        expectedOutputTokens: 1,
        instruction: 'Write a summary.',
        examples: {
          json: '{ "summary": "Example" }',
          markdown: '  \nFormat the output like so:\n\n## Summary\n\nExample'
        }
      }))

      await expect(readPromptFile(promptPath)).rejects.toThrow(
        'Markdown prompt examples must not begin'
      )
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('does not expose category-qualified prompt names', async () => {
    const names = await getAvailablePromptNames()

    expect(names).not.toContain('summary-and-overview/shortSummary')
    expect(names).not.toContain('chapters/chapters')
    expect(names).not.toContain('social-media/youtubeDescription')
  })

  test('does not expose removed combined summary prompt', async () => {
    const names = await getAvailablePromptNames()

    expect(names).not.toContain('summary')
    await expect(resolvePromptNames(['summary'])).rejects.toThrow('Unknown prompt "summary"')
  })

  test('resolves default composite prompt with existing include names', async () => {
    const prompt = await resolvePromptNames(['default'])

    expect(prompt).toContain('Write a one-sentence description of the transcript')
    expect(prompt).toContain('Write a one-paragraph summary')
    expect(prompt).toContain('Create chapter titles and descriptions based on the topics discussed throughout')
  })

  // Asserted through resolveStructuredSchema rather than a preset-name lookup, so a
  // prompt whose structuredPreset is dropped and a preset deleted from preset-registry.ts
  // both surface here as an empty presetNames array.
  test('resolves song lyric prompts to the standardSongLyrics preset', async () => {
    for (const promptName of STANDARD_SONG_LYRIC_PROMPTS) {
      const schema = await resolveStructuredSchema([promptName])

      expect(schema.presetNames).toEqual(['standardSongLyrics'])
    }
  })

  test('summary schemas match split prompt examples', async () => {
    const shortSchema = await resolveStructuredSchema(['shortSummary'])
    const shortRequired = getRequiredStringKeys(shortSchema.jsonSchema, 'shortSummary')
    expect(shortRequired).toEqual(['episodeDescription'])

    const shortValidation = parseAndValidateStructured(
      shortSchema.schema,
      JSON.stringify({ episodeDescription: TEST_EPISODE_DESCRIPTION })
    )
    expect(shortValidation.success).toBe(true)
    expect(shortValidation.value).toEqual({ episodeDescription: TEST_EPISODE_DESCRIPTION })

    const longSchema = await resolveStructuredSchema(['longSummary'])
    const longRequired = getRequiredStringKeys(longSchema.jsonSchema, 'longSummary')
    expect(longRequired).toEqual(['episodeSummary'])

    const longValidation = parseAndValidateStructured(
      longSchema.schema,
      JSON.stringify({ episodeSummary: TEST_EPISODE_SUMMARY })
    )
    expect(longValidation.success).toBe(true)
    expect(longValidation.value).toEqual({ episodeSummary: TEST_EPISODE_SUMMARY })
  })

  test('combined short and long summary prompts validate as separate leaves', async () => {
    const schema = await resolveStructuredSchema(['shortSummary', 'longSummary'])
    const validation = parseAndValidateStructured(
      schema.schema,
      JSON.stringify({
        shortSummary: { episodeDescription: TEST_EPISODE_DESCRIPTION },
        longSummary: { episodeSummary: TEST_EPISODE_SUMMARY }
      })
    )

    expect(validation.success).toBe(true)
    expect(validation.value).toEqual({
      shortSummary: { episodeDescription: TEST_EPISODE_DESCRIPTION },
      longSummary: { episodeSummary: TEST_EPISODE_SUMMARY }
    })
  })

  test('creative writing schemas require distinct top-level fields without content envelope', async () => {
    const requiredShapes: string[] = []

    for (const { promptName, presetName, requiredKeys } of CREATIVE_WRITING_PROMPTS) {
      const schema = await resolveStructuredSchema([promptName])
      const required = getRequiredStringKeys(schema.jsonSchema, promptName)
      const properties = getObjectProperties(schema.jsonSchema, promptName)

      expect(schema.presetNames).toEqual([presetName])
      expect(required).toEqual([...requiredKeys].sort())
      expect(required).not.toContain('content')
      expect(Object.keys(properties)).not.toContain('content')

      for (const key of requiredKeys) {
        expect(Object.keys(properties)).toContain(key)
      }

      const oldEnvelopeValidation = parseAndValidateStructured(
        schema.schema,
        '{ "content": "Removed envelope text." }'
      )
      expect(oldEnvelopeValidation.success).toBe(false)

      requiredShapes.push(required.join('|'))
    }

    expect(new Set(requiredShapes).size).toBe(CREATIVE_WRITING_PROMPTS.length)
  })

  test('standard song lyric schema requires title and section fields', async () => {
    const schema = await resolveStructuredSchema(['rockSong'])
    const required = getRequiredStringKeys(schema.jsonSchema, 'rockSong')
    const properties = getObjectProperties(schema.jsonSchema, 'rockSong')

    expect(schema.presetNames).toEqual(['standardSongLyrics'])
    expect(required).toContain('title')
    expect(required).toContain('verse1')
    expect(required).toContain('chorus')
    expect(required).toContain('verse2')
    expect(required).toContain('bridge')
    expect(required).toContain('finalChorus')
    expect(required).not.toContain('lyrics')

    const propKeys = Object.keys(properties)
    expect(propKeys).toContain('title')
    expect(propKeys).toContain('verse1')
    expect(propKeys).toContain('chorus')
    expect(propKeys).toContain('verse2')
    expect(propKeys).toContain('bridge')
    expect(propKeys).toContain('finalChorus')
  })

  test('rap song lyric schema requires title and three verse/chorus pairs', async () => {
    const schema = await resolveStructuredSchema(['rapSong'])
    const required = getRequiredStringKeys(schema.jsonSchema, 'rapSong')

    expect(schema.presetNames).toEqual(['rapSongLyrics'])
    expect(required).toContain('title')
    expect(required).toContain('verse1')
    expect(required).toContain('chorus1')
    expect(required).toContain('verse2')
    expect(required).toContain('chorus2')
    expect(required).toContain('verse3')
    expect(required).toContain('chorus3')
    expect(required).not.toContain('lyrics')
  })

  test('song lyric validation overrides the title before storage', async () => {
    const schema = await resolveStructuredSchema(['rockSong'])
    const validation = parseAndValidateStructured(
      schema.schema,
      '{ "title": "Model Title", "verse1": "Line one", "chorus": "Hook line", "verse2": "Line two", "bridge": "Bridge line", "finalChorus": "Final hook" }',
      {
        leafPromptNames: schema.leafPromptNames,
        presetNames: schema.presetNames,
        songLyricsTitle: 'Track One'
      }
    )

    expect(validation.success).toBe(true)
    expect(validation.value).toEqual({
      title: 'Track One',
      verse1: 'Line one',
      chorus: 'Hook line',
      verse2: 'Line two',
      bridge: 'Bridge line',
      finalChorus: 'Final hook'
    })
  })

  test('multi-prompt song lyric validation only injects title into song lyric leaves', async () => {
    const schema = await resolveStructuredSchema(['rockSong', 'shortSummary'])
    const validation = parseAndValidateStructured(
      schema.schema,
      JSON.stringify({
        rockSong: {
          verse1: 'Line one',
          chorus: 'Hook',
          verse2: 'Line two',
          bridge: 'Bridge',
          finalChorus: 'Final'
        },
        shortSummary: {
          episodeDescription: TEST_EPISODE_DESCRIPTION
        }
      }),
      {
        leafPromptNames: schema.leafPromptNames,
        presetNames: schema.presetNames,
        songLyricsTitle: 'Track One'
      }
    )

    expect(validation.success).toBe(true)
    expect(validation.value).toEqual({
      rockSong: {
        title: 'Track One',
        verse1: 'Line one',
        chorus: 'Hook',
        verse2: 'Line two',
        bridge: 'Bridge',
        finalChorus: 'Final'
      },
      shortSummary: {
        episodeDescription: TEST_EPISODE_DESCRIPTION
      }
    })
  })
})
