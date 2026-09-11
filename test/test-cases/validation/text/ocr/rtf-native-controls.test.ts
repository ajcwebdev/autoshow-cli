import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { extractRtfFile } from '~/cli/commands/text/ocr/office/native-text-extractors'
import { setupContractSuiteLifecycle } from '../../../../test-utils/rest-contract-helpers'

const tempDirs = setupContractSuiteLifecycle({ envKeys: [], tempPrefix: 'autoshow-rtf-controls-' })

describe('native RTF control and group decoding', () => {
  const fixtures = [
    ['destinations and nested groups', String.raw`{\rtf1 Before{\fonttbl hidden {nested}} after{\*\unknown ignored} visible}`, 'Before after visible'],
    ['escaped delimiters', String.raw`{\rtf1 \{literal\} \\ slash}`, '{literal} \\ slash'],
    ['signed Unicode and surrogate pairs', String.raw`{\rtf1 \u945? \u-10179?\u-8704?}`, 'α 😀'],
    ['scoped Unicode fallback width', String.raw`{\rtf1\uc2 \u945ab{\uc0\u946}\u947cd}`, 'αβγ'],
    ['hexadecimal fallbacks', String.raw`{\rtf1\uc1 \u233\'e9 and \'e9}`, 'é and é'],
    ['control delimiters and punctuation', String.raw`{\rtf1 one\tab two\par three\line four\emdash five\endash six\lquote seven\rquote\ldblquote eight\rdblquote\bullet}`, 'one\ttwo\nthree\nfour--five-six\'seven\'"eight"*'],
    ['control symbols', String.raw`{\rtf1 a\~b\-c\_d\!e}`, 'a bc-d!e'],
    ['whitespace normalization', '{\\rtf1  first  \r\nsecond\\par\\par\\par last  }', 'first\nsecond\n\nlast'],
    ['truncated escape and unknown controls', '{\\rtf1\\unknown23 kept\\', 'kept'],
    ['ignored Unicode does not consume visible sibling text', String.raw`{\rtf1{\info\uc2\u945ab}visible}`, 'visible'],
  ] as const
  for (const [label, source, expected] of fixtures) {
    test(label, async () => {
      const path = join(await tempDirs.make(), 'fixture.rtf')
      await Bun.write(path, source)
      expect(await extractRtfFile(path)).toEqual([{ pageNumber: 1, method: 'text', text: expected }])
    })
  }
})
