import { expect, test } from 'bun:test'
import { chmod, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DoctorProbes } from '~/types'
import { collectDoctorReport } from '~/cli/commands/setup-and-utilities/setup/run-doctor'
import { validateReadOnlyEnglishData } from '~/cli/commands/setup-and-utilities/setup/doctor-english-data'
import { resolveTessdataPrefix } from '~/utils/runtime-paths'
import { SUPPORTED_BUN_VERSION } from '~/utils/bun-version'

const trustedBytes = 'synthetic receipt-covered English model bytes\n'
const trustedSha256 = new Bun.CryptoHasher('sha256').update(trustedBytes).digest('hex')

const createPackagedEnglishFixture = async (runtimeRoot: string): Promise<string> => {
  const relative = 'usr/share/tesseract-ocr/5/tessdata/eng.traineddata'
  const root = join(runtimeRoot, 'tools/linux-root')
  const model = join(root, relative)
  await mkdir(join(model, '..'), { recursive: true })
  await Bun.write(model, trustedBytes)
  await chmod(model, 0o644)
  await Bun.write(join(root, '.autoshow-linux-toolchain.json'), JSON.stringify({
    schemaVersion: 2, recipeRevision: 'linux-runtime-v3', architecture: process.arch,
    distribution: 'debian-packages', requestedPackages: ['tesseract-ocr-eng'], packages: [],
    payload: [{ path: relative, mode: 0o644, kind: 'file', sha256: trustedSha256 }]
  }))
  return model
}

for (const state of ['packaged', 'empty-directory', 'valid', 'corrupt', 'unreadable', 'directory', 'empty'] as const) {
  test(`read-only doctor verifies ${state} English model selection against trusted package bytes without dispatch`, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'autoshow-doctor-english-'))
    const runtimeRoot = join(directory, 'runtime')
    const data = join(runtimeRoot, 'tools/tessdata')
    const model = join(data, 'eng.traineddata')
    let dispatches = 0
    try {
      const packaged = await createPackagedEnglishFixture(runtimeRoot)
      if (state !== 'packaged') await mkdir(data, { recursive: true })
      if (state === 'valid' || state === 'unreadable') await Bun.write(model, trustedBytes)
      if (state === 'corrupt') await Bun.write(model, 'corrupt model bytes\n')
      if (state === 'empty') await Bun.write(model, '')
      if (state === 'directory') await mkdir(model)
      if (state === 'unreadable') await chmod(model, 0)
      const probes: Partial<DoctorProbes> = {
        platform: 'linux', bunVersion: SUPPORTED_BUN_VERSION, env: {}, executeReadOnlyTools: false,
        pathExists: async path => path.endsWith('/tesseract'), which: () => undefined,
        listDirectory: async () => [], directoryHasFiles: async () => false,
        resolveConfigPath: async () => join(directory, 'absent-config.json'), loadConfig: async () => ({}),
        inspectYtDlpAuthState: async () => ({ configuredMode: 'none', usableMode: 'none', cookieArgs: [] }),
        readDefuddleCliReadiness: async () => ({ label: 'defuddle', status: 'MISSING', detail: 'synthetic uninstalled package', severity: 'warn' }),
        validateAlignmentRuntime: async () => ({ healthy: false, reason: 'synthetic uninstalled alignment package' }),
        validateRuntimeTool: async () => ({ healthy: true, detail: 'synthetic package receipt verified' }),
        resolveTessdataPrefix: () => resolveTessdataPrefix(data),
        validateTesseractData: async prefix => await validateReadOnlyEnglishData(prefix, { runtimeRoot, platform: 'linux' }),
        run: async () => { dispatches += 1; throw new Error('Read-only data inspection must not launch OCR') }
      }
      const report = await collectDoctorReport(probes)
      const check = report.sections.flatMap(section => section.checks).find(entry => entry.label === 'Tesseract eng data')!
      if (state === 'packaged' || state === 'empty-directory' || state === 'valid') {
        expect(check.status).toBe('OK')
        expect(check.detail).toContain(`TESSDATA_PREFIX=${state === 'valid' ? data : 'Tesseract packaged default'}`)
        expect(check.detail).toContain('checksum verified')
      } else {
        expect(check.status).toBe('WARN')
        const diagnostic = state === 'corrupt' ? 'does not match a trusted English model checksum'
          : state === 'unreadable' ? 'is not readable' : state === 'directory' ? 'is not a regular file' : 'is empty'
        expect(check.detail).toContain(diagnostic)
      }
      expect(dispatches).toBe(0)
      expect(await Bun.file(packaged).text()).toBe(trustedBytes)
      if (state === 'corrupt') {
        expect(await Bun.file(model).text()).toBe('corrupt model bytes\n')
        await rm(model)
        const reset = await validateReadOnlyEnglishData(undefined, { runtimeRoot, platform: 'linux' })
        expect(reset.healthy).toBe(true)
        if (reset.healthy) expect(reset.detail).toContain('TESSDATA_PREFIX=Tesseract packaged default')
      }
    } finally {
      if (state === 'unreadable') await chmod(model, 0o644)
      await rm(directory, { recursive: true, force: true })
    }
  })
}
