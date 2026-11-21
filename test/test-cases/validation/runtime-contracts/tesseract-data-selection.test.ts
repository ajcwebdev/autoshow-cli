import { expect, test } from 'bun:test'
import { chmod, mkdir, readFile, symlink, unlink, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { resolveTessdataPrefix } from '~/utils/runtime-paths'
import { inspectTesseractEnglishData } from '~/utils/tesseract-language-data'
import { withTempDir } from '../../../test-utils/temp-dirs'

test('Tesseract leaves packaged defaults selected when managed English data is absent or its directory is empty', async () => {
  await withTempDir('tesseract-absent-data-', async root => {
    const directory = join(root, 'tessdata')
    expect(resolveTessdataPrefix(directory)).toBeUndefined()
    await mkdir(directory)
    expect(resolveTessdataPrefix(directory)).toBeUndefined()
    await writeFile(join(directory, 'fra.traineddata'), 'another language')
    expect(resolveTessdataPrefix(directory)).toBeUndefined()
  })
})

test('Tesseract tracks managed data additions, symlinks, and removal without changing model bytes', async () => {
  await withTempDir('tesseract-readable-data-', async root => {
    const direct = join(root, 'direct'), linked = join(root, 'linked')
    await mkdir(direct); await mkdir(linked)
    const english = join(direct, 'eng.traineddata')
    expect(resolveTessdataPrefix(direct)).toBeUndefined()
    await writeFile(english, 'readable model fixture')
    await symlink(english, join(linked, 'eng.traineddata'))
    expect(resolveTessdataPrefix(direct)).toBe(direct)
    expect(resolveTessdataPrefix(linked)).toBe(linked)
    expect(await readFile(english, 'utf8')).toBe('readable model fixture')
    await unlink(english)
    expect(resolveTessdataPrefix(direct)).toBeUndefined()
    expect(() => resolveTessdataPrefix(linked)).toThrow('does not resolve')
    await unlink(join(linked, 'eng.traineddata'))
    expect(resolveTessdataPrefix(linked)).toBeUndefined()
  })
})

const invalidEntries = [
  { name: 'directory named eng.traineddata', make: async (path: string) => await mkdir(path), reason: 'not a regular file' },
  { name: 'empty English data', make: async (path: string) => await writeFile(path, ''), reason: 'is empty' },
  { name: 'unreadable English data', make: async (path: string) => { await writeFile(path, 'model'); await chmod(path, 0) }, reason: 'not readable' },
  { name: 'dangling English symlink', make: async (path: string) => await symlink(`${path}.missing`, path), reason: 'does not resolve' }
]
for (const invalid of invalidEntries) {
  test(`Tesseract rejects ${invalid.name} instead of silently falling back`, async () => {
    await withTempDir('tesseract-invalid-data-', async root => {
      await invalid.make(join(root, 'eng.traineddata'))
      expect(() => resolveTessdataPrefix(root)).toThrow(invalid.reason)
    })
  })
}

test('Tesseract diagnoses a non-directory managed data path', async () => {
  await withTempDir('tesseract-invalid-directory-', async root => {
    const directory = join(root, 'tessdata')
    await writeFile(directory, 'not a directory')
    expect(() => resolveTessdataPrefix(directory)).toThrow('cannot be inspected')
  })
})

test('English data inspection requires LSTM initialization after a successful language listing', async () => {
  const dispatched: string[][] = []
  const result = await inspectTesseractEnglishData(async args => {
    dispatched.push(args)
    return args.includes('--list-langs')
      ? { exitCode: 0, stdout: 'List of available languages:\neng\n', stderr: '' }
      : { exitCode: 1, stdout: '', stderr: 'Failed loading corrupt language eng' }
  })
  expect(result).toEqual({ status: 'invalid', detail: 'could not initialize English language data: Failed loading corrupt language eng' })
  expect(dispatched).toEqual([['--list-langs'], ['--print-parameters', '-l', 'eng', '--oem', '1']])
})

test('English data inspection stops before initialization when language listing fails or English is missing', async () => {
  for (const listing of [
    { exitCode: 1, stdout: '', stderr: 'cannot inspect languages' },
    { exitCode: 0, stdout: 'fra\n', stderr: '' }
  ]) {
    const dispatched: string[][] = []
    const result = await inspectTesseractEnglishData(async args => { dispatched.push(args); return listing })
    expect(result.status).toBe(listing.exitCode ? 'invalid' : 'missing')
    expect(dispatched).toEqual([['--list-langs']])
  }
})

const runtimeProbe = String.raw`
import { existsSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { resolveRuntimeToolInfo } from './src/utils/runtime-paths'
import { ocrImage } from './src/cli/commands/text/ocr/ocr-utils/tesseract-utils'
import { ensureTesseractEnglishData } from './src/cli/commands/text/ocr/ocr-local/tesseract-setup'
import { collectDoctorReport } from './src/cli/commands/setup-and-utilities/setup/run-doctor'
import { validateReadOnlyEnglishData } from './src/cli/commands/setup-and-utilities/setup/doctor-english-data'
import { SUPPORTED_BUN_VERSION } from './src/utils/bun-version'
const root = process.env.AUTOSHOW_PROJECT_ROOT
const binary = join(root, 'runtime/bin/tesseract')
const receipt = JSON.parse(await readFile(join(root, 'runtime/state/tesseract-fixture.json'), 'utf8'))
let doctorDispatches = 0
const report = await collectDoctorReport({
  bunVersion: SUPPORTED_BUN_VERSION, platform: 'linux', env: {},
  which: () => undefined, pathExists: async path => existsSync(path),
  listDirectory: async () => [], directoryHasFiles: async () => false,
  executeReadOnlyTools: false,
  validateRuntimeTool: async (tool, path) => {
    const sha256 = new Bun.CryptoHasher('sha256').update(await readFile(path)).digest('hex')
    return tool === 'tesseract' && path === binary && sha256 === receipt.sha256 && ((await stat(path)).mode & 0o777) === receipt.mode
      ? { healthy: true, detail: 'Synthetic engine identity and executable mode verified against the fixture receipt' }
      : { healthy: false, reason: 'Synthetic engine differs from its fixture receipt' }
  },
  validateTesseractData: async prefix => await validateReadOnlyEnglishData(prefix, { platform: 'linux' }),
  validateAlignmentRuntime: async () => ({ healthy: false, reason: 'No alignment runtime in this OCR fixture' }),
  validateProjectDependencies: async () => ({ healthy: false, reason: 'No project graph in this OCR fixture' }),
  run: async () => { doctorDispatches += 1; throw new Error('Read-only doctor must not launch the synthetic engine') },
  resolveYtDlpBinaryInfo: () => undefined,
  readDefuddleCliReadiness: async () => ({ status: 'MISSING', label: 'defuddle', detail: 'fixture', severity: 'warn' }),
  resolveConfigPath: async () => join(root, 'config/autoshow.json'), loadConfig: async () => ({}),
  inspectYtDlpAuthState: async () => ({ configuredMode: 'none', usableMode: 'none', cookieArgs: [] }),
  validateManagedArtifact: async () => ({ healthy: false, reason: 'fixture' })
})
const doctor = report.sections.flatMap(section => section.checks).find(check => check.label === 'Tesseract eng data')
const capture = async run => { try { return { result: await run() } } catch (error) { return { error: error.message } } }
const setup = await capture(ensureTesseractEnglishData)
const ocr = await capture(async () => await ocrImage('fixture.png', 'eng', 'text'))
process.stdout.write('TESSERACT_RESULT='+JSON.stringify({ doctor, doctorDispatches, toolPath: resolveRuntimeToolInfo('tesseract')?.path, setup, ocr })+'\n')
`

interface Dispatch { args: string[]; prefix: string | null }
interface ProbeResult { doctor: { status: string; detail: string }; doctorDispatches: number; toolPath: string; setup: { error?: string }; ocr: { result?: { text: string }; error?: string } }

const runRuntimeProbe = async (root: string): Promise<{ result: ProbeResult; dispatch: Dispatch[] }> => {
  await mkdir(join(root, 'runtime/bin'), { recursive: true })
  const log = join(root, 'dispatch.jsonl')
  const binary = join(root, 'runtime/bin/tesseract')
  await writeFile(binary, '#!'+process.execPath+'\n'+`
import { appendFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
const args = process.argv.slice(2), prefix = process.env.TESSDATA_PREFIX ?? null
appendFileSync(${JSON.stringify(log)}, JSON.stringify({ args, prefix })+'\\n')
if (args.includes('--version')) { console.log('tesseract fixture'); process.exit(0) }
if (args.includes('--list-langs')) { console.log('List of available languages:\\neng'); process.exit(0) }
if (prefix && readFileSync(join(prefix, 'eng.traineddata'), 'utf8').includes('corrupt')) {
  console.error('Failed loading language eng: corrupt model fixture'); process.exit(1)
}
console.log(args.includes('--print-parameters') ? 'tesseract parameter fixture' : 'synthetic dispatch output')
`)
  await chmod(binary, 0o755)
  await mkdir(join(root, 'runtime/state'), { recursive: true })
  await writeFile(join(root, 'runtime/state/tesseract-fixture.json'), JSON.stringify({
    sha256: new Bun.CryptoHasher('sha256').update(await readFile(binary)).digest('hex'), mode: 0o755
  }))
  // Only the engine is synthetic: the doctor uses the real read-only package-data selector.
  const packagedRoot = join(root, 'runtime/tools/linux-root')
  const relativeDataPath = 'usr/share/tesseract-ocr/5/tessdata/eng.traineddata'
  await mkdir(join(packagedRoot, relativeDataPath, '..'), { recursive: true })
  const packagedData = 'readable model fixture'
  await writeFile(join(packagedRoot, relativeDataPath), packagedData)
  await chmod(join(packagedRoot, relativeDataPath), 0o644)
  await writeFile(join(packagedRoot, '.autoshow-linux-toolchain.json'), JSON.stringify({
    schemaVersion: 2, recipeRevision: 'linux-runtime-v3', architecture: process.arch,
    distribution: 'debian-packages', requestedPackages: ['tesseract-ocr-eng'], packages: [],
    payload: [{ path: relativeDataPath, mode: 0o644, kind: 'file', sha256: new Bun.CryptoHasher('sha256').update(packagedData).digest('hex') }]
  }))
  const child = Bun.spawn([process.execPath, '--no-env-file', '-e', runtimeProbe], {
    cwd: resolve(import.meta.dir, '../../../..'),
    env: {
      PATH: process.env['PATH'] ?? '', HOME: root, NO_COLOR: '1',
      AUTOSHOW_PROJECT_ROOT: root, TESSDATA_PREFIX: '/deliberately/unrelated/tessdata', BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0'
    },
    stdout: 'pipe', stderr: 'pipe', stdin: 'ignore', signal: AbortSignal.timeout(30_000)
  })
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  expect(code, stderr).toBe(0)
  const resultLine = stdout.split('\n').find(line => line.startsWith('TESSERACT_RESULT='))
  expect(resultLine, stdout).toBeDefined()
  return {
    result: JSON.parse(resultLine!.slice('TESSERACT_RESULT='.length)) as ProbeResult,
    dispatch: await Bun.file(log).exists() ? (await readFile(log, 'utf8')).trim().split('\n').map(line => JSON.parse(line) as Dispatch) : []
  }
}

for (const managed of ['absent', 'empty-directory', 'readable', 'corrupt', 'directory', 'unreadable'] as const) {
  test(`read-only doctor agrees with setup/OCR child environments for ${managed} managed data`, async () => {
    await withTempDir('tesseract-environment-', async root => {
      const data = join(root, 'runtime/tools/tessdata')
      const english = join(data, 'eng.traineddata')
      if (managed !== 'absent') await mkdir(data, { recursive: true })
      if (managed === 'readable' || managed === 'corrupt' || managed === 'unreadable') {
        await writeFile(english, managed === 'corrupt' ? 'corrupt model fixture' : 'readable model fixture')
      }
      if (managed === 'directory') await mkdir(english)
      if (managed === 'unreadable') await chmod(english, 0)
      const { result, dispatch } = await runRuntimeProbe(root)
      expect(result.doctorDispatches).toBe(0)
      expect(result.toolPath).toBe(join(root, 'runtime/bin/tesseract'))
      const calls = dispatch.filter(call => !call.args.includes('--version'))
      if (managed === 'directory' || managed === 'unreadable') {
        expect(result.doctor.status).toBe('WARN')
        expect(result.setup.error).toContain('Managed Tesseract English data')
        expect(result.ocr.error).toContain('Managed Tesseract English data')
        expect(result.setup.error).toContain(managed === 'unreadable' ? 'is not readable' : 'is not a regular file')
        expect(result.ocr.error).toContain(managed === 'unreadable' ? 'is not readable' : 'is not a regular file')
        expect(calls).toEqual([])
        return
      }
      const expectedPrefix = managed === 'absent' || managed === 'empty-directory' ? null : data
      expect(calls).toHaveLength(3)
      expect(calls.map(call => call.args)).toEqual([
        ['--list-langs'], ['--print-parameters', '-l', 'eng', '--oem', '1'],
        ['fixture.png', 'stdout', '-l', 'eng', '--oem', '1', '--psm', '3']
      ])
      expect(calls.every(call => call.prefix === expectedPrefix)).toBe(true)
      expect(calls.filter(call => call.args.includes('--print-parameters'))).toHaveLength(1)
      if (managed === 'corrupt') {
        expect(result.doctor.status).toBe('WARN')
        expect(result.doctor.detail).toContain('does not match a trusted English model checksum')
        expect(result.setup.error).toContain('corrupt model fixture')
        expect(result.ocr.error).toContain('corrupt model fixture')
      } else {
        expect(result.doctor.status).toBe('OK')
        expect(result.doctor.detail).toContain(expectedPrefix ?? 'Tesseract packaged default')
        expect(result.setup.error).toBeUndefined()
        expect(result.ocr.result).toEqual({ text: 'synthetic dispatch output\n' })
      }
    })
  })
}
