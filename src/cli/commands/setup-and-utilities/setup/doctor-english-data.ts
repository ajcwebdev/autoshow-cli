import { join } from 'node:path'
import type { DoctorToolProvenance } from '~/types'
import { RUNTIME_DIR, resolveTessdataPrefix, toProjectDisplayPath } from '~/utils/runtime-paths'
import { pathIsPhysicallyWithinRoot } from '~/utils/runtime-containment'
import { readDependencyUrlAndSha256 } from './dependency-metadata'
import { readManagedLinuxEnglishDataIdentity } from './setup-download/managed-linux-tools'

export type DoctorEnglishDataOptions = { runtimeRoot?: string, platform?: NodeJS.Platform }

const englishDataHash = async (path: string): Promise<string> => {
  const hash = new Bun.CryptoHasher('sha256')
  for await (const chunk of Bun.file(path).stream()) hash.update(chunk)
  return hash.digest('hex')
}

/** Verify selection, readability and trusted model bytes without starting OCR. */
export const validateReadOnlyEnglishData = async (prefix: string | undefined, options: DoctorEnglishDataOptions = {}): Promise<DoctorToolProvenance> => {
  const runtimeRoot = options.runtimeRoot ?? RUNTIME_DIR
  const platform = options.platform ?? process.platform
  const managedDirectory = prefix ?? join(runtimeRoot, 'tools/tessdata')
  const managedFile = join(managedDirectory, 'eng.traineddata')
  const source = `TESSDATA_PREFIX=${prefix ?? 'Tesseract packaged default'}`
  try {
    if (!pathIsPhysicallyWithinRoot(runtimeRoot, managedFile)) return { healthy: false, reason: `Managed Tesseract English data at ${toProjectDisplayPath(managedFile)} resolves outside runtime.` }
    const observedPrefix = resolveTessdataPrefix(managedDirectory)
    if (observedPrefix !== prefix) return { healthy: false, reason: 'Managed Tesseract English data selection changed during diagnostics; run doctor again.' }
    const native = await readDependencyUrlAndSha256('tessdataEng')
    let packaged: { path: string, sha256: string } | undefined
    if (platform === 'linux') packaged = await readManagedLinuxEnglishDataIdentity(runtimeRoot)
    if (prefix) {
      const actual = await englishDataHash(managedFile)
      if (actual !== native.sha256 && actual !== packaged?.sha256) return { healthy: false, reason: `Managed Tesseract English data at ${toProjectDisplayPath(managedFile)} does not match a trusted English model checksum.` }
    } else {
      if (!packaged) return { healthy: false, reason: 'Packaged Tesseract English data is unavailable; run bun autoshow setup --step ocr.' }
      if (!pathIsPhysicallyWithinRoot(runtimeRoot, packaged.path)) return { healthy: false, reason: 'Packaged Tesseract English data resolves outside runtime.' }
      const packagedDirectory = packaged.path.slice(0, -'/eng.traineddata'.length)
      if (resolveTessdataPrefix(packagedDirectory) !== packagedDirectory || await englishDataHash(packaged.path) !== packaged.sha256) return { healthy: false, reason: 'Packaged Tesseract English data does not match its managed package receipt.' }
    }
    return { healthy: true, detail: `English data checksum verified (${source}); engine initialization is checked during mutating setup.` }
  } catch (error) { return { healthy: false, reason: error instanceof Error ? error.message : String(error) } }
}
