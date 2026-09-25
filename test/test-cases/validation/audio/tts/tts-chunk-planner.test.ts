import { describe, expect, test } from 'bun:test'
import { planTtsChunks, resolveTtsChunkMaxChars, splitTtsText } from '~/cli/commands/audio/tts/tts-utils/tts-chunk-planner'
import { splitTextIntoChunks } from '~/cli/commands/audio/tts/tts-utils/audio-utils'

const sentence = (index: number): string => `Sentence ${index} carries the story forward, one clause at a time.`
const paragraphs = (count: number, sentencesEach: number): string =>
  Array.from({ length: count }, (_, paragraphIndex) =>
    Array.from({ length: sentencesEach }, (_, index) => sentence(paragraphIndex * sentencesEach + index + 1)).join(' ')).join('\n\n')
const collapse = (value: string): string => value.replace(/\s+/gu, ' ').trim()

describe('TTS chunk planner', () => {
  test('saved legacy replay reproduces the original splitter; absent options use smart', () => {
    for (const text of [paragraphs(6, 9), 'x'.repeat(5000), `${'word '.repeat(900)}\nshort tail`, '  padded  ']) {
      for (const limit of [200, 2000, 5000]) {
        expect(splitTtsText(text, limit)).toEqual(splitTtsText(text, limit, { boundary: 'smart' }))
        expect(splitTtsText(text, limit, { boundary: 'smart', replay: 'legacy-v0' })).toEqual(splitTextIntoChunks(text, limit))
      }
    }
  })

  test('smart mode prefers paragraph breaks and preserves every word in order', () => {
    const text = paragraphs(8, 6)
    const chunks = planTtsChunks(text, 1000, { boundary: 'smart' })
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((chunk) => chunk.text.length <= 1000)).toBe(true)
    expect(chunks.slice(0, -1).every((chunk) => chunk.boundaryAfter === 'paragraph')).toBe(true)
    expect(chunks.at(-1)?.boundaryAfter).toBe('end')
    expect(collapse(chunks.map((chunk) => chunk.text).join(' '))).toBe(collapse(text))
  })

  test('smart mode falls back to sentence ends inside one long paragraph and never ends mid-sentence', () => {
    const text = Array.from({ length: 60 }, (_, index) => sentence(index + 1)).join(' ')
    const chunks = planTtsChunks(text, 900, { boundary: 'smart' })
    expect(chunks.slice(0, -1).every((chunk) => chunk.boundaryAfter === 'sentence' && /[.!?]$/u.test(chunk.text))).toBe(true)
    expect(collapse(chunks.map((chunk) => chunk.text).join(' '))).toBe(collapse(text))
  })

  test('smart mode balances chunk sizes instead of leaving a tiny trailing chunk', () => {
    const text = Array.from({ length: 31 }, (_, index) => sentence(index + 1)).join(' ')
    const limit = Math.ceil(text.length / 2) - 40
    const legacyTail = splitTextIntoChunks(text, limit).at(-1)?.length ?? 0
    const smart = planTtsChunks(text, limit, { boundary: 'smart' })
    const smallest = Math.min(...smart.map((chunk) => chunk.text.length))
    expect(legacyTail).toBeLessThan(limit * 0.2)
    expect(smallest).toBeGreaterThan(limit * 0.4)
  })

  test('smart mode is idempotent on its own chunks, which partial recovery depends on', () => {
    for (const chunk of planTtsChunks(paragraphs(10, 7), 1200, { boundary: 'smart' })) {
      expect(planTtsChunks(chunk.text, 1200, { boundary: 'smart' })).toEqual([{ text: chunk.text, boundaryAfter: 'end' }])
    }
  })

  test('smart mode never splits inside an inline delivery tag', () => {
    const tag = '[speaking slowly and with quiet resolve]'
    const text = `${'Filler words pad the line. '.repeat(18)}${tag} ${'Then the scene continues without pause. '.repeat(18)}`
    for (let limit = 480; limit <= 560; limit += 10) {
      for (const chunk of planTtsChunks(text, limit, { boundary: 'smart' })) {
        expect((chunk.text.match(/\[/gu) ?? []).length).toBe((chunk.text.match(/\]/gu) ?? []).length)
      }
    }
  })

  test('smart mode hard-cuts unbreakable text within the limit and marks the seam', () => {
    const chunks = planTtsChunks('x'.repeat(2500), 1000, { boundary: 'smart' })
    expect(chunks.map((chunk) => chunk.text.length)).toEqual([1000, 1000, 500])
    expect(chunks.map((chunk) => chunk.boundaryAfter)).toEqual(['hard', 'hard', 'end'])
  })

  test('a hard cut never separates a surrogate pair', () => {
    const chunks = planTtsChunks('😀'.repeat(600), 1001, { boundary: 'smart' })
    expect(chunks.every((chunk) => chunk.text.length % 2 === 0)).toBe(true)
    expect(chunks.map((chunk) => chunk.text).join('')).toBe('😀'.repeat(600))
  })

  test('chunk size override is clamped to the provider limit and defaults to it', () => {
    expect(resolveTtsChunkMaxChars(5000, undefined)).toBe(5000)
    expect(resolveTtsChunkMaxChars(5000, { boundary: 'smart', maxChars: 1200 })).toBe(1200)
    expect(resolveTtsChunkMaxChars(2000, { boundary: 'smart', maxChars: 9000 })).toBe(2000)
  })

  test('abbreviations, initials and times are not classified as sentence ends', () => {
    const text = 'x'.repeat(120) + ' Dr. Morgan returns at 4 p.m. with J. Smith. '.repeat(80)
    const chunks = planTtsChunks(text, 500)
    expect(chunks.some(chunk => chunk.boundaryAfter === 'sentence')).toBe(true)
    expect(chunks.filter(chunk => chunk.boundaryAfter === 'sentence').every(chunk => !/(?:Dr|p\.m|J)\.$/.test(chunk.text))).toBe(true)
    expect(collapse(chunks.map(chunk => chunk.text).join(' '))).toBe(collapse(text))
  })

  test('a notation larger than the budget and a budget smaller than one Unicode character fail explicitly', () => {
    expect(() => planTtsChunks('[a long delivery tag]', 5)).toThrow('notation')
    expect(() => planTtsChunks('🌍🌍', 1)).toThrow('Unicode')
    expect(() => planTtsChunks('text', Number.NaN)).toThrow('positive')
  })

  test('empty and whitespace-only text produce no chunks', () => {
    expect(planTtsChunks('   \n ', 1000, { boundary: 'smart' })).toEqual([])
    expect(planTtsChunks('', 1000, { boundary: 'smart', replay: 'legacy-v0' })).toEqual([])
  })
})
