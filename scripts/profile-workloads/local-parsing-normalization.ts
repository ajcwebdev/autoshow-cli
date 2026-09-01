import { cleanPageTextForExport } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/pdf/ocr-chapters/text'
import { firstTagText, scanTagBlocks } from '~/utils/xml-scan'

const ITEM_COUNT = 12000
const PAGE_COUNT = 16000

const xml = `<?xml version="1.0"?><feed>${Array.from({ length: ITEM_COUNT }, (_, index) =>
  `<item id="${index}"><title>Fixture ${index} — 東京 🧭</title><description><![CDATA[Local & bounded sample ${index}.]]></description></item>`
).join('')}</feed>`
const blocks = scanTagBlocks(xml, 'item')
const titles = blocks.map(block => firstTagText(block, 'title') ?? '')

const rawPages = Array.from({ length: PAGE_COUNT }, (_, index) =>
  `Page ${index + 1} of ${PAGE_COUNT}\r\nCHAPTER ${index + 1}\r\nSynthetic local parsing and normalization fixture ${index}.   \r\n\r\n`
).join('\n')
const normalized = cleanPageTextForExport(rawPages)
const checksum = new Bun.CryptoHasher('sha256')
  .update(titles.join('\0'))
  .update('\0')
  .update(normalized)
  .digest('hex')

const retainedWorkload = { xml, blocks, titles, rawPages, normalized }
process.stdout.write(`${JSON.stringify({
  fixture: 'synthetic-local-parsing-normalization-v1',
  itemCount: blocks.length,
  titleCount: titles.length,
  normalizedCharacters: normalized.length,
  checksum
})}\n`)
void retainedWorkload
