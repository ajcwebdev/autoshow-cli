import { createHash } from 'node:crypto'
import { readFile, realpath, stat } from 'node:fs/promises'
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path'
import { PROJECT_ROOT } from '~/utils/project-root'
import { AppValidationError, UsageError } from '~/utils/error-handler'
import { writeCommandPayload } from '~/utils/app-logger/result-emitter'
import { findMachineSpecificPaths } from './repository-structure-check'

export const PROVIDER_REPORT_HEADINGS = [
  'Executive summary', 'Prioritized additions', 'Method, evidence, and implementation terminology',
  'Repository source map', 'Provider coverage', 'Current-model inventory and findings', 'Detailed findings',
  'Restricted and announced watchlist', 'Unresolved evidence, conflicting sources, and non-additions',
  'Implementation follow-up', 'Coverage reconciliation and actionable addition checklist', 'Validation and research limitations'
] as const
export type ReportProfile = 'auto' | 'generic' | 'provider-research'
export interface ReportValidationOptions {
  paths?: readonly string[]
  checksums?: readonly string[]
  projectRoot?: string
  profile?: ReportProfile
  maxErrors?: number
}
export interface ReportDiagnostic { path: string, line?: number, code: string, message: string }
interface MarkdownHeading { level: number, text: string, line: number }
interface MarkdownLink { target: string, line: number }
interface MarkdownTable { headers: string[], rows: string[][], line: number, section: string, scope: string }
interface MarkdownDocument {
  path: string, text: string, lines: string[], visible: string[], headings: MarkdownHeading[], anchors: Set<string>,
  links: MarkdownLink[], tables: MarkdownTable[]
}
const MAX_TEXT_BYTES = 5 * 1024 * 1024, MAX_ARCHIVE_ENTRY_BYTES = 128 * 1024 * 1024
const MAX_ARCHIVE_BYTES = 512 * 1024 * 1024, MAX_ARCHIVE_ENTRIES = 20_000, MAX_INPUTS = 100
const findingId = /\b(?:DKR|PRP|PM|LOW|MEDIUM|HIGH|TEXT|LLM|OCR|URL|STT|IMAGE|VIDEO|MUSIC|TTS)-(?:[A-Z]-?)?\d{2,4}\b/g
const ignored = (path: string): boolean => path.replaceAll('\\', '/').split('/').includes('.DS_Store')
const normalized = (path: string): boolean => path.length > 0 && path.length <= 1024 && path.trim() === path
  && !isAbsolute(path) && !/[:\\\x00-\x1f]/.test(path) && !path.split('/').some(part => !part || part === '.' || part === '..')
const inside = (root: string, path: string): boolean => {
  const rel = relative(root, path)
  return !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`)
}
const label = (text: string): string => text.trim().replace(/\s+/g, ' ').toLowerCase()
const entities = (text: string): string => text.replace(/&(?:amp|quot|apos|lt|gt);/g, value => ({ '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' })[value]!)
  .replace(/&#(x[\da-f]+|\d+);/gi, (_, value: string) => {
    const code = value[0]!.toLowerCase() === 'x' ? Number.parseInt(value.slice(1), 16) : Number(value)
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ''
  })
const plain = (text: string): string => entities(text.replace(/!?\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/<[^>]*>/g, '').replace(/[`*_~]/g, '')).trim()
/** Backtick runs close a code span only when their lengths match exactly. */
const codeSpanEnd = (source: string, index: number): number => {
  const width = /^`+/.exec(source.slice(index))![0].length
  const runs = /`+/g
  runs.lastIndex = index + width
  for (let run = runs.exec(source); run; run = runs.exec(source)) {
    if (run[0].length === width) return run.index + width - 1
  }
  return index + width - 1
}
const maskCodeSpans = (text: string): string => {
  let value = '', index = 0
  while (index < text.length) {
    if (text[index] === '`') {
      const width = /^`+/.exec(text.slice(index))![0].length, end = codeSpanEnd(text, index)
      if (end >= index + width) value += ' '.repeat(end - index + 1)
      else value += text.slice(index, end + 1)
      index = end + 1; continue
    }
    value += text[index++]!
  }
  return value
}
const slug = (text: string): string => plain(text).toLowerCase().replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '').replace(/\s/g, '-')
const cells = (line: string): string[] => {
  const row = line.trim()
  const inner = row.startsWith('|') ? row.slice(1) : row
  return (inner.endsWith('|') ? inner.slice(0, -1) : inner).split(/(?<!\\)\|/)
}
const decodeText = (bytes: Uint8Array): string => new TextDecoder('utf-8', { fatal: true }).decode(bytes)
const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex')
const diagnosticMessage = (error: unknown, fallback: string): string =>
  error instanceof AppValidationError || error instanceof Error && !('code' in error) ? error.message : fallback

/** Parse one Markdown destination, respecting angle brackets, titles and balanced URL parentheses. */
const destination = (source: string): { target: string, consumed: number } | undefined => {
  if (source.startsWith('<')) {
    const end = source.indexOf('>')
    return end < 0 ? undefined : { target: source.slice(1, end), consumed: end + 1 }
  }
  let depth = 0, index = 0
  for (; index < source.length; index++) {
    const character = source[index]!
    if (character === '\\' && index + 1 < source.length) { index++; continue }
    if (character === '(') depth++
    if (character === ')') { if (depth === 0) break; depth-- }
    if (/\s/.test(character) && depth === 0) break
  }
  return depth === 0 ? { target: source.slice(0, index).replace(/\\([\\()[\]<> ])/g, '$1'), consumed: index } : undefined
}
const bracketPairs = (source: string): Map<number, number> => {
  const stack: number[] = [], pairs = new Map<number, number>()
  for (let index = 0; index < source.length; index++) {
    if (source[index] === '\\') { index++; continue }
    if (source[index] === '`') { index = codeSpanEnd(source, index); continue }
    if (source[index] === '[') stack.push(index)
    if (source[index] === ']' && stack.length) pairs.set(stack.pop()!, index)
  }
  return pairs
}
const titleThenClose = (source: string): number => {
  let index = 0
  while (/\s/.test(source[index] ?? '') && index < source.length) index++
  if (source[index] === ')') return index
  const delimiter = source[index], closing = delimiter === '(' ? ')' : delimiter
  if (!delimiter || !['"', "'", '('].includes(delimiter)) return -1
  index++
  while (index < source.length) {
    if (source[index] === '\\') { index += 2; continue }
    if (source[index] === closing) break
    index++
  }
  if (index >= source.length) return -1
  index++
  while (/\s/.test(source[index] ?? '') && index < source.length) index++
  return source[index] === ')' ? index : -1
}

type AddDiagnostic = (line: number, code: string, message: string) => void
interface LineScan { fence: string, comment: boolean }
/** True when the line opens, closes or sits inside a fenced code block. */
const fencedLine = (line: string, scan: LineScan): boolean => {
  const boundary = /^ {0,3}(`{3,}|~{3,})/.exec(line)
  if (boundary && (!scan.fence || boundary[1]![0] === scan.fence[0] && boundary[1]!.length >= scan.fence.length)) {
    scan.fence = scan.fence ? '' : boundary[1]!
    return true
  }
  return Boolean(scan.fence)
}
/** Drop HTML comment text from one line; an unclosed comment carries over to the following lines. */
const stripComments = (original: string, scan: LineScan): string => {
  let line = original, cleaned = ''
  while (line.length) {
    const at = line.indexOf(scan.comment ? '-->' : '<!--')
    if (at < 0) { if (!scan.comment) cleaned += line; break }
    if (!scan.comment) cleaned += line.slice(0, at)
    line = line.slice(at + (scan.comment ? 3 : 4)); scan.comment = !scan.comment
  }
  return cleaned
}
const collectHtmlAttributes = (cleaned: string, line: number, found: { anchors: Set<string>, htmlLinks: MarkdownLink[] }, add: AddDiagnostic): void => {
  for (const tag of maskCodeSpans(cleaned).matchAll(/<[a-z][^>]*>/gi)) {
    for (const match of tag[0].matchAll(/\b(id|name|href|src)\s*=\s*["']([^"']+)["']/gi)) {
      const name = match[1]!.toLowerCase(), value = entities(match[2]!)
      if (name === 'href' || name === 'src') { found.htmlLinks.push({ target: value, line }); continue }
      if (found.anchors.has(value)) add(line, 'DUPLICATE_ANCHOR', `HTML anchor ${value} is declared more than once.`)
      found.anchors.add(value)
    }
  }
}
const headingAt = (cleaned: string, index: number, visible: string[]): MarkdownHeading | undefined => {
  const heading = /^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(cleaned)
  if (heading) return { level: heading[1]!.length, text: plain(heading[2]!), line: index + 1 }
  if (index > 0 && /^ {0,3}(?:=+|-+)\s*$/.test(cleaned) && visible[index - 1]?.trim()) {
    return { level: cleaned.trim()[0] === '=' ? 1 : 2, text: plain(visible[index - 1]!), line: index }
  }
  return undefined
}
const scanLines = (lines: string[], add: AddDiagnostic) => {
  const visible: string[] = [], headings: MarkdownHeading[] = [], anchors = new Set<string>(), htmlLinks: MarkdownLink[] = []
  const scan: LineScan = { fence: '', comment: false }
  for (const [index, original] of lines.entries()) {
    if (fencedLine(original, scan)) { visible.push(''); continue }
    const cleaned = stripComments(original, scan)
    visible.push(cleaned)
    collectHtmlAttributes(cleaned, index + 1, { anchors, htmlLinks }, add)
    const heading = headingAt(cleaned, index, visible)
    if (heading) headings.push(heading)
  }
  if (scan.fence) add(lines.length, 'UNCLOSED_FENCE', 'Close the fenced code block.')
  if (scan.comment) add(lines.length, 'UNCLOSED_COMMENT', 'Close the HTML comment.')
  return { visible, headings, anchors, htmlLinks }
}
const registerHeadingAnchors = (headings: MarkdownHeading[], anchors: Set<string>, add: AddDiagnostic): void => {
  const usedSlugs = new Map<string, number>(), headingAnchors = new Set<string>()
  for (const heading of headings) {
    const base = slug(heading.text), prior = usedSlugs.get(base) ?? 0
    let id = prior ? `${base}-${prior}` : base
    let suffix = prior
    while (headingAnchors.has(id)) id = `${base}-${++suffix}`
    if (anchors.has(id)) add(heading.line, 'DUPLICATE_ANCHOR', `Heading anchor ${id} duplicates an explicit HTML anchor.`)
    usedSlugs.set(base, suffix + 1); headingAnchors.add(id); anchors.add(id)
  }
}
interface ReferenceDefinitions { definitions: Map<string, MarkdownLink>, footnotes: Set<string>, definitionLines: Set<number> }
const collectDefinitions = (visible: string[], add: AddDiagnostic): ReferenceDefinitions => {
  const definitions = new Map<string, MarkdownLink>(), footnotes = new Set<string>(), definitionLines = new Set<number>()
  for (const [index, line] of visible.entries()) {
    const definition = /^ {0,3}\[([^\]]+)\]:\s*(.*)$/.exec(line)
    if (!definition) continue
    definitionLines.add(index)
    const id = label(definition[1]!)
    if (id.startsWith('^')) { footnotes.add(id); continue }
    const value = definition[2]!.trim() || visible[index + 1]?.trim() || ''
    if (!definition[2]!.trim() && value) definitionLines.add(index + 1)
    const parsed = destination(value)
    if (!parsed || !parsed.target) add(index + 1, 'INVALID_REFERENCE', `Reference [${id}] needs a valid destination.`)
    else if (definitions.has(id)) add(index + 1, 'DUPLICATE_REFERENCE', `Reference [${id}] is declared more than once.`)
    else definitions.set(id, { target: parsed.target, line: index + 1 })
  }
  return { definitions, footnotes, definitionLines }
}
interface LinkScan extends ReferenceDefinitions { links: MarkdownLink[] }
interface BracketLine { text: string, pairs: Map<number, number>, number: number }
const scanInlineLink = (source: string, line: number, links: MarkdownLink[], add: AddDiagnostic): void => {
  const parsed = destination(source)
  if (!parsed || titleThenClose(source.slice(parsed.consumed)) < 0) add(line, 'INVALID_LINK', 'Close the inline link and use angle brackets around destinations containing spaces.')
  else links.push({ target: parsed.target, line })
}
const scanReferenceLink = (id: string, line: number, scan: LinkScan, add: AddDiagnostic): void => {
  const definition = scan.definitions.get(id)
  if (!definition) add(line, 'MISSING_REFERENCE', `Define reference [${id}].`)
  else scan.links.push({ target: definition.target, line })
}
/** Record what the bracket pair at index..close links to and return the index scanning resumes from. */
const scanBracket = (source: BracketLine, index: number, close: number, scan: LinkScan, add: AddDiagnostic): number => {
  const line = source.text, content = line.slice(index + 1, close), next = line[close + 1]
  if (next === '(') scanInlineLink(line.slice(close + 2), source.number, scan.links, add)
  else if (next === '[') {
    const referenceEnd = source.pairs.get(close + 1) ?? -1
    if (referenceEnd < 0) add(source.number, 'INVALID_REFERENCE', 'Close the reference-style link label.')
    else {
      scanReferenceLink(label(line.slice(close + 2, referenceEnd) || content), source.number, scan, add)
      index = referenceEnd
    }
  } else if (content.startsWith('^')) {
    if (!scan.footnotes.has(label(content))) add(source.number, 'MISSING_FOOTNOTE', `Define footnote [${content}].`)
  } else if (scan.definitions.has(label(content))) scan.links.push({ target: scan.definitions.get(label(content))!.target, line: source.number })
  return Math.max(index, close)
}
const scanLineLinks = (source: BracketLine, scan: LinkScan, add: AddDiagnostic): void => {
  const line = source.text
  for (let index = 0; index < line.length; index++) {
    if (line[index] === '\\') { index++; continue }
    if (line[index] === '`') { index = codeSpanEnd(line, index); continue }
    if (line[index] !== '[') continue
    const close = source.pairs.get(index) ?? -1
    if (close < 0) continue
    index = scanBracket(source, index, close, scan, add)
  }
}
const collectLinks = (visible: string[], references: ReferenceDefinitions, htmlLinks: MarkdownLink[], add: AddDiagnostic): MarkdownLink[] => {
  const links: MarkdownLink[] = [...references.definitions.values(), ...htmlLinks], scan: LinkScan = { ...references, links }
  for (const [lineIndex, line] of visible.entries()) {
    if (references.definitionLines.has(lineIndex)) continue
    scanLineLinks({ text: line, pairs: bracketPairs(line), number: lineIndex + 1 }, scan, add)
  }
  return links
}
const checkTableShape = (headers: string[], separator: string[], rows: string[][], first: number, add: AddDiagnostic): void => {
  const all = [headers, separator, ...rows]
  if (all.some(row => row.length !== headers.length)) { add(first + 1, 'TABLE_COLUMNS', 'Give every table row the same number of cells; escape literal pipes.'); return }
  const widths = headers.map((_, column) => Math.max(3, ...[headers, ...rows].map(row => row[column]!.trim().length)))
  for (const [rowIndex, row] of all.entries()) if (row.some((cell, column) => cell.length !== widths[column]! + 2)) {
    add(first + rowIndex + 1, 'TABLE_ALIGNMENT', 'Refit the table padding to the longest current value in each column.')
  }
}
const tableScope = (headings: MarkdownHeading[], first: number): { section: string, scope: string } => {
  const preceding = headings.filter(heading => heading.line <= first + 1)
  const section = preceding.findLast(heading => heading.level === 2)?.text ?? ''
  const start = preceding.findLastIndex(heading => heading.level === 2)
  let workflow = '', service = ''
  for (const heading of preceding.slice(start + 1)) {
    if (heading.level === 3) { workflow = heading.text; service = '' }
    if (heading.level === 4) service = heading.text
  }
  return { section, scope: [workflow, service].filter(Boolean).join('/') }
}
const collectTables = (lines: string[], visible: string[], headings: MarkdownHeading[], add: AddDiagnostic): MarkdownTable[] => {
  const tables: MarkdownTable[] = []
  for (let index = 0; index + 1 < visible.length; index++) {
    if (!visible[index]!.includes('|') || !/^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)+\|?\s*$/.test(visible[index + 1]!)) continue
    const first = index, headers = cells(lines[index]!), separator = cells(lines[index + 1]!), rows: string[][] = []
    index += 2
    while (index < visible.length && visible[index]!.trim() && visible[index]!.includes('|')) { rows.push(cells(lines[index]!)); index++ }
    index--
    checkTableShape(headers, separator, rows, first, add)
    const { section, scope } = tableScope(headings, first)
    tables.push({ headers: headers.map(plain), rows: rows.map(row => row.map(cell => cell.trim())), line: first + 1, section, scope })
  }
  return tables
}
const checkDeclaredIds = (headings: MarkdownHeading[], tables: MarkdownTable[], add: AddDiagnostic): void => {
  const declaredIds = new Map<string, number>()
  const declare = (id: string, line: number) => {
    if (declaredIds.has(id)) add(line, 'DUPLICATE_ID', `Identifier ${id} is already defined at line ${declaredIds.get(id)}.`)
    else declaredIds.set(id, line)
  }
  for (const heading of headings) {
    const id = heading.text.match(findingId)?.[0]
    if (id && heading.text.startsWith(id)) declare(id, heading.line)
  }
  for (const table of tables) {
    if (label(table.headers[0] ?? '') !== 'id') continue
    for (const [index, row] of table.rows.entries()) for (const id of plain(row[0] ?? '').match(findingId) ?? []) declare(id, table.line + index + 2)
  }
}

const parseMarkdown = (path: string, text: string, add: AddDiagnostic): MarkdownDocument => {
  const lines = text.split('\n'), { visible, headings, anchors, htmlLinks } = scanLines(lines, add)
  registerHeadingAnchors(headings, anchors, add)
  const links = collectLinks(visible, collectDefinitions(visible, add), htmlLinks, add)
  const tables = collectTables(lines, visible, headings, add)
  checkDeclaredIds(headings, tables, add)
  return { path, text, lines, visible, headings, anchors, links, tables }
}

const countInventoryTuples = (inventory: MarkdownTable[], add: AddDiagnostic): number => {
  const tuples = new Set<string>()
  let count = 0
  for (const table of inventory) {
    if (!table.scope.includes('/')) add(table.line, 'INVENTORY_SCOPE', 'Group inventory rows under workflow and service headings.')
    for (const [index, row] of table.rows.entries()) {
      const at = table.line + index + 2, tuple = `${table.scope}/${plain(row[0] ?? '')}`
      if (row.length !== 3 || row.some(cell => !cell.trim())) add(at, 'INVENTORY_ROW', 'Give each current tuple an ID, primary finding category and stable finding reference.')
      if (tuples.has(tuple)) add(at, 'DUPLICATE_TUPLE', `Current tuple ${tuple} appears more than once.`)
      tuples.add(tuple); count++
      if (!/\b[A-Z][A-Z0-9]*(?:-[A-Z]+)*-\d{3}\b/.test(plain(row[2] ?? ''))) add(at, 'INVENTORY_REFERENCE', 'Use a stable three-digit finding ID for every current tuple.')
    }
  }
  return count
}
const numericCell = (value: string | undefined): number | undefined => /^\d+$/.test(plain(value ?? '')) ? Number(plain(value!)) : undefined
const coverageReconciles = (coverage: MarkdownTable, count: number): boolean => {
  const totalRows = coverage.rows.filter(row => label(plain(row[0] ?? '')) === 'total scoped tuples')
  const counts = coverage.rows.filter(row => label(plain(row[0] ?? '')) !== 'total scoped tuples').map(row => numericCell(row[1]))
  const total = numericCell(totalRows[0]?.[1])
  return !(totalRows.length !== 1 || total === undefined || counts.some(value => value === undefined) || total !== count || counts.reduce<number>((sum, value) => sum + (value ?? 0), 0) !== total)
}
const validateProviderStructure = (document: MarkdownDocument, add: AddDiagnostic): number => {
  const headings = document.headings.filter(heading => heading.level === 2)
  if (JSON.stringify(headings.map(heading => heading.text)) !== JSON.stringify(PROVIDER_REPORT_HEADINGS)) add(1, 'PROVIDER_HEADINGS', 'Use each of the twelve provider-research second-level headings exactly once, in the documented order.')
  for (const name of ['Research cutoff', 'Repository status date', 'Workflow scope', 'Related reports']) {
    if (!document.visible.some(line => new RegExp(`^- \\*\\*${name}:\\*\\*\\s+\\S`).test(line))) add(1, 'PROVIDER_METADATA', `Add a nonempty ${name} metadata field.`)
  }
  const inventory = document.tables.filter(table => table.section === 'Current-model inventory and findings' && table.headers.map(label).join('/') === 'current id/finding/ref')
  if (!inventory.length) add(1, 'PROVIDER_INVENTORY', 'Add the Current ID / Finding / Ref inventory table, including when there are zero scoped tuples.')
  const count = countInventoryTuples(inventory, add)
  for (const heading of document.headings) {
    const id = /^([A-Z][A-Z0-9-]*-\d+)\b/.exec(heading.text)?.[1]
    if (id && !/^[A-Z][A-Z0-9]*(?:-[A-Z]+)*-\d{3}$/.test(id)) add(heading.line, 'UNSTABLE_FINDING_ID', `Use a stable three-digit provider finding ID instead of ${id}.`)
  }
  const coverage = document.tables.find(table => table.section === 'Coverage reconciliation and actionable addition checklist' && table.headers.map(label).join('/') === 'category/count')
  const provider = document.tables.find(table => table.section === 'Provider coverage' && table.headers.map(label).join('/') === 'provider/workflows/entries')
  if (!coverage) add(1, 'COVERAGE_COUNTS', 'Add the Category / Count reconciliation table.')
  else if (!coverageReconciles(coverage, count)) add(coverage.line, 'COVERAGE_COUNTS', 'Category counts, Total scoped tuples and current inventory rows must reconcile exactly.')
  if (!provider) add(1, 'PROVIDER_COUNTS', 'Add the Provider / Workflows / Entries coverage table.')
  else {
    const counts = provider.rows.map(row => numericCell(row[2]))
    if (counts.some(value => value === undefined) || counts.reduce<number>((sum, value) => sum + (value ?? 0), 0) !== count) add(provider.line, 'PROVIDER_COUNTS', 'Provider entry counts must be nonnegative integers and sum to the current inventory count.')
  }
  return count
}

const explicitInputs = (options: ReportValidationOptions): { paths: string[], checksums: string[] } => {
  const paths = [...new Set((options.paths ?? []).filter(path => !ignored(path)))], checksums = [...new Set((options.checksums ?? []).filter(path => !ignored(path)))]
  if (!paths.length && !checksums.length) throw new AppValidationError('Provide at least one explicit Markdown report or checksum path; no workspace scan is performed')
  if (paths.length + checksums.length > MAX_INPUTS) throw new AppValidationError(`Provide at most ${MAX_INPUTS} explicit inputs per invocation`)
  return { paths, checksums }
}
const reportProfile = (options: ReportValidationOptions, path: string, document: MarkdownDocument): Exclude<ReportProfile, 'auto'> =>
  options.profile === 'provider-research' || options.profile !== 'generic' && (/\/0[0-5]-provider-model-additions-[^/]+\.md$/.test(`/${path}`)
    || document.headings.some(heading => heading.level === 1 && /Provider and Model Additions$/i.test(heading.text))) ? 'provider-research' : 'generic'
const checkReportLines = (document: MarkdownDocument, path: string, rootSpellings: string[], add: AddDiagnostic): void => {
  for (const [index, line] of document.lines.entries()) {
    if (/[ \t]+$/.test(line) || line.includes('\r')) add(index + 1, 'WHITESPACE', 'Remove trailing whitespace and use LF line endings.')
    if (rootSpellings.some(spelling => line.includes(spelling)) || findMachineSpecificPaths(path, line).length) add(index + 1, 'CHECKOUT_PATH', 'Store checkout paths relative to the project root.')
  }
}
/** Split a project-local link into its decoded file and fragment; external, nonportable and ignored links yield undefined. */
const localLinkParts = (link: MarkdownLink, add: AddDiagnostic): { file: string, fragment: string } | undefined => {
  if (!link.target || /^(?:https?:|mailto:|tel:|data:)/i.test(link.target)) return undefined
  if (/^[a-z][a-z\d+.-]*:/i.test(link.target) || isAbsolute(link.target) || link.target.startsWith('//')) {
    add(link.line, 'NONPORTABLE_LINK', 'Use a project-relative local link or an explicit HTTP(S) URL.'); return undefined
  }
  const hashAt = link.target.indexOf('#'), queryAt = link.target.indexOf('?')
  const pathEnd = Math.min(hashAt < 0 ? Infinity : hashAt, queryAt < 0 ? Infinity : queryAt)
  let file: string, fragment: string
  try { file = decodeURIComponent(link.target.slice(0, Number.isFinite(pathEnd) ? pathEnd : undefined)); fragment = hashAt < 0 ? '' : decodeURIComponent(link.target.slice(hashAt + 1)) }
  catch { add(link.line, 'INVALID_LINK_ENCODING', 'Use valid percent encoding in the link destination.'); return undefined }
  if (ignored(file)) return undefined
  return { file, fragment }
}
const checksumEntryPath = (name: string): string => {
  const stripped = name.startsWith('./') ? name.slice(2) : name
  if (!normalized(stripped) || /[*?\[\]]/.test(stripped)) throw new AppValidationError('Checksum paths must be normalized relative paths without traversal or ZIP wildcard characters')
  return stripped
}
interface ChecksumScope { zip: boolean, files: Set<string>, declared: Set<string>, add: AddDiagnostic }
/** Register one manifest row and return the target still to be hashed; rejected and ignored rows yield undefined. */
const declaredChecksum = (scope: ChecksumScope, line: string, index: number): { name: string, expected: string } | undefined => {
  const match = /^([a-f\d]{64})[ \t]+\*?(.+)$/i.exec(line)
  if (!match) { scope.add(index + 1, 'CHECKSUM_ROW', 'Use SHA-256 followed by two spaces and a relative file path.'); return undefined }
  if (ignored(match[2]!)) return undefined
  const name = checksumEntryPath(match[2]!)
  if (scope.declared.has(name)) { scope.add(index + 1, 'DUPLICATE_CHECKSUM', `Checksum path ${name} appears more than once.`); return undefined }
  scope.declared.add(name)
  if (scope.zip && (name === 'SHA256SUMS' || !scope.files.has(name))) { scope.add(index + 1, 'CHECKSUM_TARGET', `Checksum target ${name} is missing or refers to the manifest itself.`); return undefined }
  return { name, expected: match[1]! }
}

/** Only explicit report/manifest paths are opened; ignored files are never discovered by a workspace scan. */
export const validateReports = async (options: ReportValidationOptions = {}) => {
  const selectedRoot = resolve(options.projectRoot ?? PROJECT_ROOT), root = await realpath(selectedRoot), limit = options.maxErrors ?? 50
  const rootSpellings = [root, selectedRoot, Bun.pathToFileURL(root).href, Bun.pathToFileURL(selectedRoot).href]
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new AppValidationError('maxErrors must be an integer from 1 through 1000')
  const { paths, checksums } = explicitInputs(options)
  const diagnostics: ReportDiagnostic[] = []
  let errorCount = 0
  const add = (path: string, line: number | undefined, code: string, message: string) => {
    errorCount++
    if (diagnostics.length < limit) diagnostics.push({ path, ...(line === undefined ? {} : { line }), code, message: message.slice(0, 400) })
  }
  const existing = async (path: string): Promise<string> => {
    if (!normalized(path)) throw new AppValidationError('Use a normalized project-relative path without traversal, an absolute prefix or control characters')
    const actual = await realpath(resolve(root, path))
    if (!inside(root, actual)) throw new AppValidationError('The selected path resolves outside the project; replace the escaping symlink or path')
    return actual
  }
  const textFile = async (actual: string): Promise<string> => {
    const info = await stat(actual)
    if (!info.isFile() || info.size > MAX_TEXT_BYTES) throw new AppValidationError('Expected a UTF-8 text file of at most 5 MiB')
    return decodeText(await readFile(actual))
  }
  const cache = new Map<string, MarkdownDocument>()
  const documents: Array<{ path: string, profile: Exclude<ReportProfile, 'auto'>, linksChecked: number, inventoryTuples?: number }> = []
  for (const path of paths) {
    const display = normalized(path) ? path : '<invalid report path>'
    try {
      const actual = await existing(path)
      if (extname(path).toLowerCase() !== '.md') throw new AppValidationError('Select a Markdown (.md) report; use --checksums for manifests and ZIP archives')
      const text = await textFile(actual), document = parseMarkdown(path, text, (line, code, message) => add(display, line, code, message))
      cache.set(actual, document)
      if (!text.endsWith('\n') || text.endsWith('\n\n')) add(display, undefined, 'FINAL_NEWLINE', 'End the report with exactly one newline.')
      checkReportLines(document, path, rootSpellings, (line, code, message) => add(display, line, code, message))
      const profile = reportProfile(options, path, document)
      const inventoryTuples = profile === 'provider-research' ? validateProviderStructure(document, (line, code, message) => add(display, line, code, message)) : undefined
      let linksChecked = 0
      for (const link of document.links) {
        const parts = localLinkParts(link, (line, code, message) => add(display, line, code, message))
        if (!parts) continue
        const { file, fragment } = parts
        const target = file ? resolve(dirname(actual), file) : actual
        linksChecked++
        try {
          if (!inside(root, target)) throw new AppValidationError('The local link escapes the project; use an official URL or a portable project reference')
          const resolved = await realpath(target)
          if (!inside(root, resolved)) throw new AppValidationError('The local link resolves through an escaping symlink')
          const info = await stat(resolved)
          if (!fragment) continue
          if (info.isDirectory()) throw new AppValidationError('Link directly to the Markdown or HTML file when checking a fragment')
          if (/\.md$/i.test(resolved)) {
            let destinationDocument = cache.get(resolved)
            if (!destinationDocument) { destinationDocument = parseMarkdown(relative(root, resolved), await textFile(resolved), () => {}); cache.set(resolved, destinationDocument) }
            if (!destinationDocument.anchors.has(fragment)) throw new AppValidationError(`Fragment #${fragment} is not a heading or explicit anchor in the linked document`)
          } else if (/^L\d+(?:-L\d+)?$/.test(fragment)) {
            const numbers = fragment.match(/\d+/g)!.map(Number), source = await textFile(resolved)
            const lineCount = source ? source.split('\n').length - Number(source.endsWith('\n')) : 0
            if (numbers[0]! < 1 || numbers.at(-1)! > lineCount || numbers[0]! > numbers.at(-1)!) throw new AppValidationError('The linked line range does not exist')
          } else if (/\.html?$/i.test(resolved)) {
            const html = await textFile(resolved), ids = [...html.matchAll(/\b(?:id|name)\s*=\s*["']([^"']+)["']/g)].map(match => match[1])
            if (!ids.includes(fragment)) throw new AppValidationError(`Fragment #${fragment} is not an HTML anchor`)
          } else throw new AppValidationError('Fragment validation supports Markdown/HTML anchors and source-file #Lnumber ranges')
        } catch (error) { add(display, link.line, 'BROKEN_LINK', diagnosticMessage(error, `Local target ${file || path} does not exist or cannot be read.`)) }
      }
      documents.push({ path, profile, linksChecked, ...(inventoryTuples === undefined ? {} : { inventoryTuples }) })
    } catch (error) { add(display, undefined, 'REPORT_INPUT', diagnosticMessage(error, 'Cannot read the selected report; check its path and permissions.')) }
  }
  const checksumResults: Array<{ path: string, entriesChecked: number, completeCoverage: boolean }> = []
  for (const path of checksums) {
    const display = normalized(path) ? path : '<invalid checksum path>'
    let entriesChecked = 0
    try {
      const actual = await existing(path), zip = extname(path).toLowerCase() === '.zip'
      let archiveBytes = 0
      const zipRead = async (args: string[], maximum: number, consume: (bytes: Uint8Array) => void): Promise<void> => {
        const child = Bun.spawn(['unzip', ...args, actual], { cwd: root, stdin: 'ignore', stdout: 'pipe', stderr: 'ignore' })
        const timer = setTimeout(() => child.kill(), 30_000)
        let bytes = 0
        try {
          for await (const chunk of child.stdout) {
            bytes += chunk.length; archiveBytes += chunk.length
            if (bytes > maximum || archiveBytes > MAX_ARCHIVE_BYTES) throw new AppValidationError('Archive validation exceeds its documented byte limit')
            consume(chunk)
          }
          if (await child.exited !== 0) throw new AppValidationError('unzip could not read the archive; verify it is intact and unzip is installed')
        } finally { clearTimeout(timer); if (child.exitCode === null) { child.kill(); await child.exited } }
      }
      const zipText = async (entry?: string): Promise<string> => {
        const chunks: Uint8Array[] = []
        // unzip expects the archive before the selected entry, so use a dedicated invocation below.
        if (entry !== undefined) {
          const child = Bun.spawn(['unzip', '-p', actual, entry], { cwd: root, stdin: 'ignore', stdout: 'pipe', stderr: 'ignore' })
          const timer = setTimeout(() => child.kill(), 30_000)
          let bytes = 0
          try {
            for await (const chunk of child.stdout) { bytes += chunk.length; archiveBytes += chunk.length; if (bytes > MAX_TEXT_BYTES || archiveBytes > MAX_ARCHIVE_BYTES) throw new AppValidationError('Checksum manifest exceeds its documented byte limit'); chunks.push(chunk) }
            if (await child.exited !== 0) throw new AppValidationError('ZIP archives supplied to --checksums need a root SHA256SUMS file')
          } finally { clearTimeout(timer); if (child.exitCode === null) { child.kill(); await child.exited } }
        } else await zipRead(['-Z1'], MAX_TEXT_BYTES, chunk => chunks.push(chunk))
        return decodeText(Buffer.concat(chunks))
      }
      const archiveNames = zip ? (await zipText()).trimEnd().split('\n').filter(name => name && !ignored(name)) : []
      if (zip && (archiveNames.length > MAX_ARCHIVE_ENTRIES || new Set(archiveNames).size !== archiveNames.length)) throw new AppValidationError('Archive contains too many entries or duplicate entry names')
      const files = new Set(archiveNames.filter(name => !name.endsWith('/')).map(name => checksumEntryPath(name)))
      for (const name of archiveNames) checksumEntryPath(name.endsWith('/') ? name.slice(0, -1) : name)
      const manifest = zip ? await zipText('SHA256SUMS') : await textFile(actual)
      const declared = new Set<string>(), manifestLines = manifest.trimEnd().split('\n')
      if (manifestLines.length > MAX_ARCHIVE_ENTRIES) throw new AppValidationError('Checksum manifest contains too many entries')
      const scope: ChecksumScope = { zip, files, declared, add: (line, code, message) => add(display, line, code, message) }
      for (const [index, line] of manifestLines.entries()) {
        const row = declaredChecksum(scope, line, index)
        if (!row) continue
        const { name } = row
        let digest: string
        try {
          if (zip) {
            const hasher = createHash('sha256'), child = Bun.spawn(['unzip', '-p', actual, name], { cwd: root, stdin: 'ignore', stdout: 'pipe', stderr: 'ignore' })
            const timer = setTimeout(() => child.kill(), 30_000)
            let bytes = 0
            try {
              for await (const chunk of child.stdout) { bytes += chunk.length; archiveBytes += chunk.length; if (bytes > MAX_ARCHIVE_ENTRY_BYTES || archiveBytes > MAX_ARCHIVE_BYTES) throw new AppValidationError('Archive member exceeds the documented byte limit'); hasher.update(chunk) }
              if (await child.exited !== 0) throw new AppValidationError('Cannot decode the checksummed archive member')
            } finally { clearTimeout(timer); if (child.exitCode === null) { child.kill(); await child.exited } }
            digest = hasher.digest('hex')
          } else {
            const target = await realpath(resolve(dirname(actual), name))
            if (!inside(root, target)) throw new AppValidationError('Checksum target resolves outside the project')
            const info = await stat(target)
            if (!info.isFile() || info.size > MAX_ARCHIVE_ENTRY_BYTES) throw new AppValidationError('Checksum target is not a bounded regular file')
            archiveBytes += info.size
            if (archiveBytes > MAX_ARCHIVE_BYTES) throw new AppValidationError('Checksum validation exceeds its documented byte limit')
            digest = sha256(await readFile(target))
          }
          entriesChecked++
          if (digest.toLowerCase() !== row.expected.toLowerCase()) add(display, index + 1, 'CHECKSUM_MISMATCH', `SHA-256 does not match ${name}.`)
        } catch (error) { add(display, index + 1, 'CHECKSUM_TARGET', diagnosticMessage(error, `Cannot read checksum target ${name}.`)) }
      }
      const completeCoverage = !zip || [...files].every(name => name === 'SHA256SUMS' || declared.has(name))
      if (!declared.size) add(display, undefined, 'EMPTY_CHECKSUMS', 'Supply at least one checksummed artifact.')
      if (!completeCoverage) add(display, undefined, 'UNCHECKSUMMED_ENTRY', 'The root SHA256SUMS must cover every archive file except itself.')
      checksumResults.push({ path, entriesChecked, completeCoverage })
    } catch (error) { add(display, undefined, 'CHECKSUM_INPUT', diagnosticMessage(error, 'Cannot read the checksum input; check its path, permissions and unzip availability.')) }
  }
  return { schemaVersion: 1, kind: 'report-validation', status: errorCount ? 'invalid' : 'valid',
    scope: 'Local document contracts and supplied artifact checksums; external URLs, provider availability and research conclusions are not verified.',
    reports: documents, checksums: checksumResults, errorCount, diagnostics, truncated: errorCount > diagnostics.length,
    ...(errorCount > diagnostics.length ? { next: limit === 1000 ? 'Narrow the explicit input paths to inspect the remaining diagnostics.'
      : `Rerun with --max-errors ${Math.min(1000, Math.max(limit + 1, limit * 2))} or narrow the explicit input paths.` } : {}) }
}

export const REPORT_VALIDATOR_HELP = `Usage: bun src/tools/report-validator.ts [options] <report.md> [...]

Validate only explicit local reports; ignored reports are supported. Nothing is written or fetched.
Passing local checks does not establish external availability, research accuracy or runtime inventory truth.

Options:
  --profile auto|generic|provider-research  auto recognizes dated provider reports and their title
  --checksums <SHA256SUMS|archive.zip>     repeatable; raw manifest paths are relative to its directory
  --max-errors <1..1000>                  maximum returned diagnostics (default: 50)
  --files-from -                         read newline-separated report paths from stdin
  --json                                 emit the default versioned JSON result
  --help, -h                             show this help
  --version                              print validator schema version

Exit codes: 0 valid, 1 validation/input failure, 2 usage error. No implicit directory scan or stdin read.
Limits: 100 inputs; 5 MiB per text file; 20,000 ZIP entries; 128 MiB per member; 512 MiB decoded per archive.
ZIP checks use local unzip with a 30-second deadline per operation and never extract files.

Examples:
  bun src/tools/report-validator.ts docs/reports/repository-improvement-actions.md
  bun src/tools/report-validator.ts docs/reports/repository-improvement-actions.md --checksums docs/reports/repository-improvement-actions.evidence.zip
  printf '%s\\n' docs/reports/notes.md | bun src/tools/report-validator.ts --files-from -
`
interface ReportValidatorArguments { action: string, paths: string[], checksums: string[], profile: ReportProfile, maxErrors: number, stdin: boolean }
const VALUE_OPTIONS = ['--profile', '--checksums', '--max-errors', '--files-from']
const applyValueOption = (parsed: ReportValidatorArguments, arg: string, value: string | undefined): void => {
  if (!value || value.startsWith('--')) throw UsageError(`Provide a value for ${arg}; use --help for examples.`)
  if (arg === '--profile') { if (!['auto', 'generic', 'provider-research'].includes(value)) throw UsageError('Choose --profile auto, generic or provider-research.'); parsed.profile = value as ReportProfile }
  if (arg === '--checksums') parsed.checksums.push(value)
  if (arg === '--max-errors') { if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 1000) throw UsageError('Choose --max-errors from 1 through 1000.'); parsed.maxErrors = Number(value) }
  if (arg === '--files-from') { if (value !== '-' || parsed.stdin) throw UsageError('--files-from accepts one explicit - stdin source.'); parsed.stdin = true }
}
const hasExplicitInput = (parsed: ReportValidatorArguments): boolean => parsed.paths.some(path => !ignored(path)) || parsed.checksums.some(path => !ignored(path)) || parsed.stdin
export const parseReportValidatorArguments = (args: readonly string[]) => {
  const parsed: ReportValidatorArguments = { action: 'validate', paths: [], checksums: [], profile: 'auto', maxErrors: 50, stdin: false }
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!
    if (arg === '--') { parsed.paths.push(...args.slice(index + 1)); break }
    if (arg === '--help' || arg === '-h' || arg === '--version') { parsed.action = arg === '--version' ? 'version' : 'help'; continue }
    if (arg === '--json') continue
    if (VALUE_OPTIONS.includes(arg)) { applyValueOption(parsed, arg, args[++index]); continue }
    if (arg.startsWith('-')) throw UsageError(`Unknown option ${arg.slice(0, 120)}; use --help for valid options.`)
    parsed.paths.push(arg)
  }
  if (parsed.action === 'validate' && !hasExplicitInput(parsed)) throw UsageError('Provide an explicit report/checksum path or --files-from -; use --help for examples.')
  return parsed
}

if (import.meta.main) {
  try {
    const args = parseReportValidatorArguments(Bun.argv.slice(2))
    if (args.action === 'help') writeCommandPayload(REPORT_VALIDATOR_HELP)
    else if (args.action === 'version') writeCommandPayload('report-validator schema 1\n')
    else {
      if (args.stdin) {
        if (process.stdin.isTTY) throw UsageError('Pipe newline-separated report paths into --files-from -; no interactive input is requested.')
        const chunks: Uint8Array[] = []
        let size = 0
        for await (const bytes of Bun.stdin.stream()) {
          size += bytes.length
          if (size > MAX_TEXT_BYTES) throw UsageError('The explicit stdin path list must be at most 5 MiB.')
          chunks.push(bytes)
        }
        args.paths.push(...decodeText(Buffer.concat(chunks)).split(/\r?\n/).map(line => line.trim()).filter(line => line && !ignored(line)))
      }
      const result = await validateReports(args)
      writeCommandPayload(JSON.stringify(result) + '\n')
      if (result.status !== 'valid') process.exitCode = 1
    }
  } catch (error) {
    writeCommandPayload(JSON.stringify({ schemaVersion: 1, kind: 'report-validation-usage-error',
      message: error instanceof Error ? error.message.slice(0, 400) : 'Unable to parse report validation inputs.', next: 'Run with --help; use explicit project-relative paths.' }) + '\n', 'stderr')
    process.exitCode = 2
  }
}
