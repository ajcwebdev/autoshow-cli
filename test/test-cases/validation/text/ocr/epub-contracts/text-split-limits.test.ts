import { describe, expect, test } from 'bun:test'
import { splitWithHardLimit } from '~/cli/commands/text/ocr/ebook/epub/text-split'
import { AppValidationError } from '~/utils/error-handler'

describe('EPUB chapter chunk limits', () => {
  test('rejects limits that cannot make bounded progress', () => {
    for (const limit of [0, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => splitWithHardLimit('abcdef', limit)).toThrow(AppValidationError)
    }
  })

  test('splits long words and paragraphs without empty or oversized chunks', () => {
    const chunks = splitWithHardLimit('abcdefghij next\n\nfinal', 4)
    expect(chunks).toEqual(['abcd', 'efgh', 'ij', 'next', 'fina', 'l'])
    expect(chunks.every(chunk => chunk.length > 0 && chunk.length <= 4)).toBe(true)
    expect(chunks.join('').replace(/\s/g, '')).toBe('abcdefghijnextfinal')
  })
})
