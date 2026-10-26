import { afterEach, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { PROVIDER_REPORT_HEADINGS, REPORT_VALIDATOR_HELP, parseReportValidatorArguments, validateReports } from '~/tools/report-validator'

const temporary: string[] = []
afterEach(async () => { await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true }))) })
const reportPath = 'docs/reports/check.md'
const hash = (text: string) => createHash('sha256').update(text).digest('hex')
const aligned = (headers: string[], rows: string[][]) => {
  const widths = headers.map((header, index) => Math.max(3, header.length, ...rows.map(row => row[index]!.length)))
  const line = (row: string[]) => '| ' + row.map((cell, index) => cell.padEnd(widths[index]!)).join(' | ') + ' |'
  return [line(headers), line(widths.map(width => '-'.repeat(width))), ...rows.map(line)].join('\n')
}
const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-report-validation-')); temporary.push(root)
  const write = async (path: string, value: string) => {
    await mkdir(dirname(join(root, path)), { recursive: true })
    await writeFile(join(root, path), value)
  }
  await write(reportPath, '# Action report\n\nCurrent work.\n')
  return { root, write, run: (options: Omit<Parameters<typeof validateReports>[0], 'projectRoot'> = {}) => validateReports({ projectRoot: root, paths: [reportPath], ...options }) }
}
const providerReport = () => {
  const body: Partial<Record<typeof PROVIDER_REPORT_HEADINGS[number], string>> = {
    'Prioritized additions': aligned(['Ref', 'Priority', 'Candidate'], [['[TEXT-001](#text-001-model)', 'P1', 'Model']]),
    'Provider coverage': aligned(['Provider', 'Workflows', 'Entries'], [['host', 'write', '1']]),
    'Current-model inventory and findings': `### write\n\n#### host\n\n${aligned(['Current ID', 'Finding', 'Ref'], [['model-a', 'Current', '[TEXT-001](#text-001-model)']])}`,
    'Detailed findings': '### TEXT-001 Model\n\nScoped finding.',
    'Coverage reconciliation and actionable addition checklist': aligned(['Category', 'Count'], [['Current', '1'], ['Total scoped tuples', '1']])
  }
  return '# Text Provider and Model Additions\n\n- **Research cutoff:** 2026-10-26 UTC\n- **Repository status date:** 2026-10-26 staging\n- **Workflow scope:** write\n- **Related reports:** None requested.\n\n'
    + PROVIDER_REPORT_HEADINGS.map(heading => `## ${heading}\n\n${body[heading] ?? 'Scoped context.'}`).join('\n\n') + '\n'
}
const codes = (result: Awaited<ReturnType<typeof validateReports>>) => result.diagnostics.map(item => item.code)

describe('explicit Markdown report validation', () => {
  test('validates ignored paths, balanced destinations, reference styles, duplicate-heading fragments and literal code examples without writes', async () => {
    const f = await fixture()
    await f.write('.gitignore', 'docs/reports/\n')
    await f.write('docs/reports/target (draft).md', '# Café `code`\n\n## Repeated\n\n## Repeated\n\n<a id="explicit"></a>\n')
    await f.write('docs/reports/screen.html', '<h2 id="panel">Panel</h2>\n')
    await f.write('src/module.ts', 'export const one = 1\nexport const two = 2\n')
    const content = '# Action report\n\n[inline](<target (draft).md#café-code> "title") and [balanced](target%20(draft).md#repeated-1).\n\n'
      + '[reference][proof], [proof][], [proof], [HTML](screen.html#panel), [line](../../src/module.ts#L1-L2), and [explicit](target%20(draft).md#explicit).\n\n'
      + '[proof]: <target (draft).md#repeated>\n\n`[literal][undefined]`\n\n```markdown\n[also literal](absent.md)\n```\n'
    await f.write(reportPath, content)
    const result = await f.run()
    expect(result).toMatchObject({ status: 'valid', errorCount: 0, truncated: false })
    expect(result.reports).toEqual([{ path: reportPath, profile: 'generic', linksChecked: 9 }])
    expect(await readFile(join(f.root, reportPath), 'utf8')).toBe(content)
    expect(JSON.stringify(result)).not.toContain(f.root)
  })

  test('resolves Markdown links containing formatted heading labels, footnotes and explicit same-file anchors', async () => {
    const f = await fixture()
    await f.write(reportPath, '# Action report\n\n## [Useful](https://example.org) **section**\n\n[heading](#useful-section), [anchor](#manual), and footnote[^proof].\n\n<a id="manual"></a>\n\n[^proof]: A local footnote.\n')
    expect((await f.run()).status).toBe('valid')
  })

  test('checks real HTML links but ignores anchor declarations inside inline code examples', async () => {
    const f = await fixture()
    await f.write(reportPath, '# Notes\n\n`<a id="literal"></a>`\n\n[missing](#literal)\n\n<a href="absent.md">Broken</a>\n')
    expect(codes(await f.run()).filter(code => code === 'BROKEN_LINK')).toHaveLength(2)
  })

  for (const [name, text, code] of [
    ['missing local target', '# Notes\n\n[missing](absent.md)\n', 'BROKEN_LINK'],
    ['missing local fragment', '# Notes\n\n[missing](#absent)\n', 'BROKEN_LINK'],
    ['undefined reference', '# Notes\n\n[proof][missing]\n', 'MISSING_REFERENCE'],
    ['undefined footnote', '# Notes\n\nA claim[^missing].\n', 'MISSING_FOOTNOTE'],
    ['duplicate reference', '# Notes\n\n[proof]: https://example.org\n[proof]: https://example.org\n', 'DUPLICATE_REFERENCE'],
    ['malformed inline link', '# Notes\n\n[proof](missing.md\n', 'INVALID_LINK'],
    ['duplicate explicit anchors', '# Notes\n\n<a id="same"></a>\n<a id="same"></a>\n', 'DUPLICATE_ANCHOR'],
    ['heading and explicit anchor collision', '# Notes\n\n<a id="same"></a>\n\n## Same\n', 'DUPLICATE_ANCHOR'],
    ['unclosed fence', '# Notes\n\n```text\nexample\n', 'UNCLOSED_FENCE'],
    ['unclosed comment', '# Notes\n\n<!-- never closed\n', 'UNCLOSED_COMMENT'],
    ['missing final newline', '# Notes', 'FINAL_NEWLINE'],
    ['multiple final newlines', '# Notes\n\n', 'FINAL_NEWLINE'],
    ['trailing whitespace', '# Notes\n\nA claim. \n', 'WHITESPACE'],
    ['invalid UTF-8 percent encoding', '# Notes\n\n[bad](%FF.md)\n', 'INVALID_LINK_ENCODING']
  ]) test(`rejects ${name} with actionable local diagnostics`, async () => {
    const f = await fixture(); await f.write(reportPath, text!)
    const result = await f.run()
    expect(result.status).toBe('invalid')
    expect(codes(result)).toContain(code!)
    expect(result.diagnostics.every(item => item.path === reportPath && item.message.length > 0)).toBe(true)
  })

  test('rejects source links with nonexistent line ranges, project escapes and escaping symlinks', async () => {
    const f = await fixture(), outside = await mkdtemp(join(tmpdir(), 'autoshow-report-outside-')); temporary.push(outside)
    await writeFile(join(outside, 'outside.md'), '# Outside\n')
    await f.write('src/short.ts', 'one\n')
    await symlink(join(outside, 'outside.md'), join(f.root, 'docs/reports/escape.md'))
    await f.write(reportPath, '# Notes\n\n[line](../../src/short.ts#L400) [escape](escape.md) [parent](../../../outside.md)\n')
    const result = await f.run()
    expect(codes(result).filter(code => code === 'BROKEN_LINK')).toHaveLength(3)
    expect(JSON.stringify(result)).not.toContain(outside)
    const selected = await f.run({ paths: ['docs/reports/escape.md'] })
    expect(codes(selected)).toContain('REPORT_INPUT')
  })

  test('rejects unaligned tables, malformed columns and duplicate action ownership while permitting ordinary ID references', async () => {
    const f = await fixture()
    const table = aligned(['ID', 'Action'], [['PRP-01', 'First'], ['PRP-01', 'Duplicate']])
    await f.write(reportPath, '# Notes\n\nSee PRP-01.\n\n' + table + '\n')
    expect(codes(await f.run())).toEqual(['DUPLICATE_ID'])
    await f.write(reportPath, '# Notes\n\n| ID | Action |\n| --- | ------ |\n| PRP-01 | First |\n')
    expect(codes(await f.run())).toContain('TABLE_ALIGNMENT')
    await f.write(reportPath, '# Notes\n\n| ID | Action |\n| --- | ------ |\n| PRP-01 | First | Extra |\n')
    expect(codes(await f.run())).toContain('TABLE_COLUMNS')
  })

  test('keeps diagnostics bounded but reports the complete error count and next narrowing action', async () => {
    const f = await fixture()
    await f.write(reportPath, '# Notes\n\n' + Array.from({ length: 10 }, (_, index) => `[broken](missing-${index}.md)`).join('\n') + '\n')
    const result = await f.run({ maxErrors: 2 })
    expect(result.errorCount).toBe(10)
    expect(result.diagnostics).toHaveLength(2)
    expect(result.truncated).toBe(true)
    expect(result.next).toContain('--max-errors')
  })

  test('checks only explicitly selected reports and rejects nonportable stored checkout paths', async () => {
    const f = await fixture()
    await f.write('docs/reports/not-selected.md', 'Malformed unrelated report with [broken](absent)')
    expect((await f.run()).status).toBe('valid')
    await f.write(reportPath, `# Notes\n\nStored at ${f.root}/input/book.txt\n`)
    expect(codes(await f.run())).toContain('CHECKOUT_PATH')
    expect(JSON.stringify(await f.run())).not.toContain(f.root)
    await expect(validateReports({ projectRoot: f.root })).rejects.toThrow('explicit')
    expect(codes(await f.run({ paths: ['../outside.md'] }))).toContain('REPORT_INPUT')
  })
})

describe('provider-research contracts apply only to selected research reports', () => {
  test('accepts complete research structure and reconciled inventories, and leaves action reports generic', async () => {
    const f = await fixture()
    expect((await f.run()).reports[0]?.profile).toBe('generic')
    await f.write(reportPath, providerReport())
    const result = await f.run()
    expect(result.status).toBe('valid')
    expect(result.reports[0]).toMatchObject({ profile: 'provider-research', inventoryTuples: 1 })
    await f.write(reportPath, '# Text Provider and Model Additions\n\nA deliberately generic summary.\n')
    expect((await f.run({ profile: 'generic' })).status).toBe('valid')
    expect(codes(await f.run())).toContain('PROVIDER_HEADINGS')
    await f.write('docs/reports/03-provider-model-additions-video-2026-10-26.md', '# Research\n')
    expect(codes(await f.run({ paths: ['docs/reports/03-provider-model-additions-video-2026-10-26.md'] }))).toContain('PROVIDER_HEADINGS')
  })

  for (const [name, transform, code] of [
    ['missing heading', (text: string) => text.replace('## Provider coverage', '## Missing coverage'), 'PROVIDER_HEADINGS'],
    ['missing metadata', (text: string) => text.replace('- **Research cutoff:** 2026-10-26 UTC\n', ''), 'PROVIDER_METADATA'],
    ['bad category total', (text: string) => text.replace('| Current             | 1     |', '| Current             | 2     |'), 'COVERAGE_COUNTS'],
    ['bad provider count', (text: string) => text.replace('| host     | write     | 1       |', '| host     | write     | 2       |'), 'PROVIDER_COUNTS'],
    ['unstable ID', (text: string) => text.replaceAll('TEXT-001', 'TEXT-01'), 'UNSTABLE_FINDING_ID'],
    ['missing inventory scope', (text: string) => text.replace('### write\n\n#### host\n\n', ''), 'INVENTORY_SCOPE']
  ] as const) test(`rejects research ${name}`, async () => {
    const f = await fixture(); const original = providerReport(), broken = transform(original)
    expect(broken).not.toBe(original)
    await f.write(reportPath, broken)
    expect(codes(await f.run())).toContain(code)
  })

  test('rejects duplicate current tuples and a repeated stable finding definition', async () => {
    const f = await fixture()
    const row = ['model-a', 'Current', '[TEXT-001](#text-001-model)']
    const duplicate = providerReport().replace(aligned(['Current ID', 'Finding', 'Ref'], [row]), aligned(['Current ID', 'Finding', 'Ref'], [row, row]))
      .replace('Scoped finding.', 'Scoped finding.\n\n### TEXT-001 Duplicate\n\nUnowned duplicate.')
    await f.write(reportPath, duplicate)
    const result = await f.run()
    expect(codes(result)).toContain('DUPLICATE_TUPLE')
    expect(codes(result)).toContain('DUPLICATE_ID')
    expect(codes(result)).toContain('COVERAGE_COUNTS')
  })

  test('matches the documented twelve-heading contract and detects repeated tuples after another service subsection', async () => {
    const documented = await Bun.file('.codex/skills/provider-model-additions/references/report-structure.md').text()
    expect([...documented.matchAll(/^## (.+)$/gm)].map(match => match[1])).toEqual([...PROVIDER_REPORT_HEADINGS])
    const f = await fixture(), row = ['model-a', 'Current', '[TEXT-001](#text-001-model)']
    const original = providerReport(), inventory = aligned(['Current ID', 'Finding', 'Ref'], [row])
    await f.write(reportPath, original.replace(inventory, `${inventory}\n\n#### other-host\n\nOther context.\n\n#### host\n\n${inventory}`))
    expect(codes(await f.run())).toContain('DUPLICATE_TUPLE')
  })
})

describe('supplied checksum manifests and ZIP evidence', () => {
  test('validates a raw manifest including binary bytes, then rejects corruption and escaping targets', async () => {
    const f = await fixture()
    await f.write('docs/evidence/data.txt', 'original bytes\n')
    await f.write('docs/evidence/SHA256SUMS', `${hash('original bytes\n')}  data.txt\n`)
    expect((await f.run({ checksums: ['docs/evidence/SHA256SUMS'] })).checksums).toEqual([{ path: 'docs/evidence/SHA256SUMS', entriesChecked: 1, completeCoverage: true }])
    await f.write('docs/evidence/data.txt', 'changed bytes\n')
    expect(codes(await f.run({ checksums: ['docs/evidence/SHA256SUMS'] }))).toContain('CHECKSUM_MISMATCH')
    await f.write('docs/evidence/SHA256SUMS', `${hash('outside')}  ../../../../outside.txt\n`)
    expect(codes(await f.run({ checksums: ['docs/evidence/SHA256SUMS'] }))).toContain('CHECKSUM_INPUT')
  })

  const zipFixture = async (f: Awaited<ReturnType<typeof fixture>>, manifest: string, extra = false) => {
    await f.write('evidence/a.txt', 'A\n')
    await f.write('evidence/source/nested.txt', 'Nested\n')
    await f.write('evidence/SHA256SUMS', manifest)
    if (extra) await f.write('evidence/unlisted.txt', 'Unlisted\n')
    const entries = ['a.txt', 'source/nested.txt', 'SHA256SUMS', ...(extra ? ['unlisted.txt'] : [])]
    const result = Bun.spawnSync(['zip', '-q', join(f.root, 'evidence.zip'), ...entries], { cwd: join(f.root, 'evidence'), stdout: 'pipe', stderr: 'pipe' })
    expect(result.exitCode, result.stderr.toString()).toBe(0)
  }

  test('verifies ZIP namespace hashes without extracting or modifying evidence', async () => {
    const f = await fixture()
    await zipFixture(f, `${hash('A\n')}  a.txt\n${hash('Nested\n')}  source/nested.txt\n`)
    const before = await readFile(join(f.root, 'evidence.zip'))
    const result = await f.run({ checksums: ['evidence.zip'] })
    expect(result.status).toBe('valid')
    expect(result.checksums).toEqual([{ path: 'evidence.zip', entriesChecked: 2, completeCoverage: true }])
    expect(await readFile(join(f.root, 'evidence.zip'))).toEqual(before)
    expect(await Bun.file(join(f.root, 'source/nested.txt')).exists()).toBe(false)
  })

  test('rejects corrupt ZIP checksums, omitted entries, duplicate manifests and unsafe checksum paths', async () => {
    const f = await fixture()
    await zipFixture(f, `${hash('bad')}  a.txt\n${hash('Nested\n')}  source/nested.txt\n`, true)
    let result = await f.run({ checksums: ['evidence.zip'] })
    expect(codes(result)).toContain('CHECKSUM_MISMATCH')
    expect(codes(result)).toContain('UNCHECKSUMMED_ENTRY')
    await f.write('docs/SHA256SUMS', `${hash('x')}  missing\n${hash('x')}  missing\n`)
    result = await f.run({ checksums: ['docs/SHA256SUMS'] })
    expect(codes(result)).toContain('DUPLICATE_CHECKSUM')
    await f.write('docs/SHA256SUMS', `${hash('x')}  /absolute/file\n`)
    expect(codes(await f.run({ checksums: ['docs/SHA256SUMS'] }))).toContain('CHECKSUM_INPUT')
  })

  test('rejects invalid UTF-8 and empty checksum inputs', async () => {
    const f = await fixture()
    await writeFile(join(f.root, reportPath), new Uint8Array([0xff, 0xfe]))
    expect(codes(await f.run())).toContain('REPORT_INPUT')
    await f.write('docs/SHA256SUMS', '')
    expect(codes(await f.run({ checksums: ['docs/SHA256SUMS'] }))).toContain('EMPTY_CHECKSUMS')
  })

  test('rejects real ZIP traversal entries before reading member payloads or extracting files', async () => {
    const f = await fixture()
    await f.write('outside.txt', 'Kept inside the test project.\n')
    await mkdir(join(f.root, 'zip-source'))
    const archive = join(f.root, 'unsafe.zip')
    expect(Bun.spawnSync(['zip', '-q', archive, '../outside.txt'], { cwd: join(f.root, 'zip-source') }).exitCode).toBe(0)
    const original = await readFile(join(f.root, 'outside.txt'))
    expect(codes(await f.run({ checksums: ['unsafe.zip'] }))).toContain('CHECKSUM_INPUT')
    expect(await readFile(join(f.root, 'outside.txt'))).toEqual(original)
  })
})

describe('report-validator CLI', () => {
  const command = (root: string, args: string[], input?: string) => Bun.spawnSync([process.execPath, '--no-env-file', resolve('src/tools/report-validator.ts'), ...args], {
    cwd: root, env: { PATH: process.env['PATH'] ?? '', HOME: root, AUTOSHOW_PROJECT_ROOT: root },
    stdin: input === undefined ? 'ignore' : new TextEncoder().encode(input), stdout: 'pipe', stderr: 'pipe'
  })
  test('provides help/version and rejects usage errors without implicit stdin or workspace reads', async () => {
    const f = await fixture()
    expect(REPORT_VALIDATOR_HELP).toContain('--checksums')
    for (const args of [[], ['--all'], ['--max-errors', '0'], ['--profile', 'unknown'], ['--checksums'], ['--files-from', 'list.txt']]) {
      const result = command(f.root, args)
      expect(result.exitCode).toBe(2)
      expect(result.stdout.toString()).toBe('')
      expect(JSON.parse(result.stderr.toString())).toMatchObject({ schemaVersion: 1, kind: 'report-validation-usage-error' })
    }
    const help = command(f.root, ['--help'])
    expect(help.exitCode).toBe(0); expect(help.stdout.toString()).toContain('Usage:'); expect(help.stderr.toString()).toBe('')
    expect(command(f.root, ['--version']).stdout.toString()).toBe('report-validator schema 1\n')
    expect(parseReportValidatorArguments(['--profile', 'generic', reportPath, '--max-errors', '3', '--json'])).toMatchObject({ paths: [reportPath], profile: 'generic', maxErrors: 3 })
  })

  test('returns one versioned JSON result on stdout and stable validation exit codes for argument and explicit piped paths', async () => {
    const f = await fixture()
    const valid = command(f.root, [reportPath, '--json'])
    expect(valid.exitCode, valid.stderr.toString()).toBe(0)
    expect(valid.stderr.toString()).toBe('')
    expect(JSON.parse(valid.stdout.toString())).toMatchObject({ status: 'valid', reports: [{ path: reportPath }] })
    const piped = command(f.root, ['--files-from', '-'], `${reportPath}\n`)
    expect(piped.exitCode).toBe(0)
    expect(JSON.parse(piped.stdout.toString()).reports).toHaveLength(1)
    await f.write(reportPath, '# Notes\n\n[bad](absent.md)\n')
    const invalid = command(f.root, [reportPath, '--max-errors', '1'])
    expect(invalid.exitCode).toBe(1)
    expect(invalid.stderr.toString()).toBe('')
    expect(JSON.parse(invalid.stdout.toString())).toMatchObject({ status: 'invalid', errorCount: 1 })
  })
})
