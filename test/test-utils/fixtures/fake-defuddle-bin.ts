import { chmod, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Shared body for the fake `defuddle` binaries the URL/links suites spawn.
 *
 * Both suites need the same handshake — shebang, argv slice, `--version` probe, and the
 * `AUTOSHOW_FAKE_DEFUDDLE_STDERR` echo used to assert that wrapper diagnostics are
 * swallowed — and differ only in how they render the document. Keeping the handshake in
 * one place means a change to the real CLI contract is made once.
 */
const FAKE_DEFUDDLE_VERSION = '0.17.0'

const FAKE_DEFUDDLE_PREAMBLE: readonly string[] = [
  '#!/usr/bin/env bun',
  'const args = process.argv.slice(2)',
  `if (args[0] === '--version') { console.log('${FAKE_DEFUDDLE_VERSION}'); process.exit(0) }`,
  'if (process.env.AUTOSHOW_FAKE_DEFUDDLE_STDERR) console.error(process.env.AUTOSHOW_FAKE_DEFUDDLE_STDERR)'
]

/** Write an executable fake `defuddle` into `dir`, appending suite-specific behavior. */
export const writeFakeDefuddleBinIn = async (
  dir: string,
  bodyLines: readonly string[],
  imports: readonly string[] = []
): Promise<string> => {
  const bin = join(dir, 'defuddle')
  await writeFile(bin, [
    FAKE_DEFUDDLE_PREAMBLE[0] as string,
    ...imports,
    ...FAKE_DEFUDDLE_PREAMBLE.slice(1),
    ...bodyLines
  ].join('\n'))
  await chmod(bin, 0o755)
  return bin
}
