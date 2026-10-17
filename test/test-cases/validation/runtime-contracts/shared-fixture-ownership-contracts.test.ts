import { describe, expect, test } from 'bun:test'
import { describeSourceVocabularyViolations, scanSourceVocabulary, SOURCE_VOCABULARY_TEST_ROOT } from './source-vocabulary-scanner'

// Concurrent workers share one checkout, so a generated fixture under `input/` can be overwritten or
// deleted by another worker's cleanup. Generated fixtures belong under a worker-private output root.
describe('shared fixture ownership contracts', () => {
  test('tests do not stage generated inputs under the shared input/test-fixtures tree', async () => {
    const violations = await scanSourceVocabulary(/['"`]input\/test-fixtures\b/, new Set(), SOURCE_VOCABULARY_TEST_ROOT)
    expect(describeSourceVocabularyViolations(violations)).toEqual([])
  })

  test('generated page images are never written over a shared input path', async () => {
    const violations = await scanSourceVocabulary(/ensurePageImageFixture\(\s*['"`]input\//, new Set(), SOURCE_VOCABULARY_TEST_ROOT)
    expect(describeSourceVocabularyViolations(violations)).toEqual([])
  })
})
