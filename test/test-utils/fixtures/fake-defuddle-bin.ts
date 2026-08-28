import { chmod, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const FAKE_DEFUDDLE_VERSION = '0.17.0'

const FAKE_DEFUDDLE_PREAMBLE: readonly string[] = [
  '#!/usr/bin/env bun',
  'const args = process.argv.slice(2)',
  `if (args[0] === '--version') { console.log('${FAKE_DEFUDDLE_VERSION}'); process.exit(0) }`,
  'if (process.env.AUTOSHOW_FAKE_DEFUDDLE_STDERR) console.error(process.env.AUTOSHOW_FAKE_DEFUDDLE_STDERR)'
]

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
