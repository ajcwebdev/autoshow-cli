import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { chmod, mkdir, rm, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { collectDoctorReport } from '../../src/cli/commands/setup-and-utilities/setup/run-doctor'
import { resolveTessdataPrefix } from '../../src/utils/runtime-paths'

type DataState = 'packaged' | 'valid' | 'corrupt' | 'unreadable' | 'directory' | 'empty'
const managed = '/app/runtime/tools/tessdata'
const english = `${managed}/eng.traineddata`

async function capture(command: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const child = Bun.spawn(command, { stdout: 'pipe', stderr: 'pipe', stdin: 'ignore', signal: AbortSignal.timeout(90_000) })
  const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  return { exitCode, stdout, stderr }
}

async function setManagedData(state: Exclude<DataState, 'packaged'>): Promise<void> {
  await mkdir(managed, { recursive: true })
  if (state === 'directory') await mkdir(english)
  else {
    await Bun.write(english, state === 'valid' || state === 'unreadable'
      ? Bun.file('/usr/share/tesseract-ocr/5/tessdata/eng.traineddata')
      : state === 'empty' ? '' : 'Authored corrupt Tesseract English data.\n')
    if (state === 'unreadable') await chmod(english, 0)
  }
}

async function verifyPhase(directory: string, phase: string, state: DataState) {
  let selected: string | undefined
  let selectionError: string | undefined
  try { selected = resolveTessdataPrefix() } catch (error) { selectionError = String(error) }
  const report = await collectDoctorReport()
  const doctor = report.sections.flatMap(section => section.checks).find(check => check.label === 'Tesseract eng data')
  assert(doctor, 'Doctor omitted its Tesseract English data check')
  const setup = await capture(['bun', '--no-env-file', '-e', `import { ensureTesseractEnglishData } from '/app/src/cli/commands/text/ocr/ocr-local/tesseract-setup.ts'; await ensureTesseractEnglishData();`])
  const setupOutput = `${setup.stdout}\n${setup.stderr}`
  const output = join(directory, phase)
  const ocr = await capture(['bun', '--no-env-file', '/app/src/cli/create-cli.ts',
    'extract', join(directory, 'fixture.png'), '--provider', 'tesseract', '--no-color',
    '--config-path', join(directory, 'empty-config.json'), '--output-root', output])
  const ocrOutput = `${ocr.stdout}\n${ocr.stderr}`
  const artifacts = existsSync(output) ? [...new Bun.Glob('**/extraction.txt').scanSync({ cwd: output, onlyFiles: true, throwErrorOnBrokenSymlink: true })] : []
  if (state === 'packaged' || state === 'valid') {
    assert.equal(selectionError, undefined)
    assert.equal(selected, state === 'valid' ? managed : undefined)
    assert.equal(doctor.status, 'OK', doctor.detail)
    assert(doctor.detail.includes(`TESSDATA_PREFIX=${selected ?? 'Tesseract packaged default'}`), doctor.detail)
    assert.equal(setup.exitCode, 0, setupOutput)
    assert(setupOutput.includes(`Tesseract language data (eng) ready (${state === 'valid' ? 'runtime/tools/tessdata' : 'Tesseract packaged default'})`), setupOutput)
    assert.equal(ocr.exitCode, 0, ocrOutput)
    assert.equal(artifacts.length, 1, 'Successful OCR must produce one extraction artifact')
    const text = await Bun.file(join(output, artifacts[0]!)).text()
    assert.match(text, /AutoShow\s+Phase\s+4/i, `Incorrect OCR text: ${text}`)
  } else {
    assert.equal(doctor.status, 'WARN', doctor.detail)
    assert.notEqual(setup.exitCode, 0, 'Invalid managed data passed setup')
    assert.notEqual(ocr.exitCode, 0, 'Invalid managed data passed OCR')
    assert.equal(artifacts.length, 0, 'Invalid managed data produced an extraction artifact')
    if (state === 'corrupt') {
      assert.equal(selectionError, undefined)
      assert.equal(selected, managed)
      assert(doctor.detail.includes('could not initialize English language data'), doctor.detail)
      assert(setupOutput.includes('Tesseract English data is unavailable (runtime/tools/tessdata)'), setupOutput)
      assert(setupOutput.includes('could not initialize English language data'), setupOutput)
      assert(ocrOutput.includes('Tesseract OCR failed (managed data: runtime/tools/tessdata)'), ocrOutput)
    } else {
      const diagnostic = state === 'unreadable' ? 'is not readable' : state === 'empty' ? 'is empty' : 'is not a regular file'
      for (const actual of [selectionError, doctor.detail, setupOutput, ocrOutput]) {
        assert(actual?.includes('Managed Tesseract English data') && actual.includes(diagnostic), actual)
      }
    }
  }
  return { phase, state, selectedData: selected ?? (selectionError ? 'rejected-managed-entry' : 'packaged-default'), doctor: doctor.status, setupExitCode: setup.exitCode, ocrExitCode: ocr.exitCode, textCorrect: state === 'packaged' || state === 'valid' }
}

if (import.meta.main) {
  const mode = Bun.argv[2]
  assert(mode && ['no-runtime-mount', 'empty-runtime', 'empty-tessdata', 'managed-valid', 'managed-corrupt', 'managed-unreadable', 'managed-directory', 'managed-empty', 'reset-managed'].includes(mode), 'Unknown Tesseract data case')
  // The host can remove these authored artifacts even when its UID differs from
  // the image user. No normal cache or workspace output is mounted here.
  process.umask(0)
  // A stale caller override must not replace the source selected by the app.
  process.env['TESSDATA_PREFIX'] = '/deliberately/unrelated/tessdata'
  process.env['NO_COLOR'] = '1'
  const directory = `/results/${mode}`
  await mkdir(directory, { recursive: true })
  await Bun.write(join(directory, 'empty-config.json'), '{}\n')
  const rendered = await capture(['mutool', 'draw', '-r', '200', '-o', join(directory, 'fixture.png'), '/fixture.pdf', '1'])
  assert.equal(rendered.exitCode, 0, rendered.stderr)
  const phases = []
  if (mode === 'reset-managed') {
    await setManagedData('valid')
    phases.push(await verifyPhase(directory, 'valid-before-removal', 'valid'))
    await unlink(english)
    phases.push(await verifyPhase(directory, 'packaged-after-removal', 'packaged'))
    await setManagedData('corrupt')
    phases.push(await verifyPhase(directory, 'corrupt-before-reset', 'corrupt'))
    await unlink(english)
    phases.push(await verifyPhase(directory, 'packaged-after-reset', 'packaged'))
  } else {
    const state: DataState = mode === 'managed-valid' ? 'valid'
      : mode === 'managed-corrupt' ? 'corrupt'
      : mode === 'managed-unreadable' ? 'unreadable'
      : mode === 'managed-directory' ? 'directory'
      : mode === 'managed-empty' ? 'empty' : 'packaged'
    if (mode === 'empty-tessdata') await mkdir(managed, { recursive: true })
    if (state !== 'packaged') await setManagedData(state)
    phases.push(await verifyPhase(directory, mode, state))
  }
  // Only this container's authored model is touched; its runtime mount is owned
  // by the host gate and never shares the normal acceptance or model caches.
  if (mode === 'managed-unreadable') await chmod(english, 0o644)
  if (mode === 'managed-directory') await rm(english, { recursive: true })
  console.log(`TESSERACT_DATA_ACCEPTANCE=${JSON.stringify({ status: 'passed', case: mode, architecture: process.arch, phases })}`)
}
