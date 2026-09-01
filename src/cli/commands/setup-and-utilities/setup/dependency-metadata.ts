import { join } from 'node:path'
import * as v from 'valibot'
import { IMMUTABLE_ASSET_ROOT } from '~/utils/runtime-paths'
import { validateJson } from '~/utils/validate/validation'
import { InternalError } from '~/utils/error-handler'
import type { DependencyMetadata } from '~/types'

const DependencyEntrySchema = v.object({
  tag: v.optional(v.string(), undefined),
  version: v.optional(v.string(), undefined),
  ref: v.optional(v.string(), undefined),
  url: v.optional(v.string(), undefined),
  sha256: v.optional(v.string(), undefined),
  linuxUrl: v.optional(v.string(), undefined),
  linuxSha256: v.optional(v.string(), undefined)
})

export const DependencyMetadataSchema = v.record(v.string(), DependencyEntrySchema)

const depsJsonPath = join(IMMUTABLE_ASSET_ROOT, 'config/deps.json')

const DEFAULT_DEPENDENCY_METADATA: DependencyMetadata = {
  'whisper.cpp': { tag: 'v1.7.4' },
  'yt-dlp': {
    version: '2026.06.09',
    url: 'https://github.com/yt-dlp/yt-dlp/releases/download/2026.06.09/yt-dlp_macos',
    sha256: 'b82c3626952e6c14eaf654cc565866775ffd0b9ffb7021628ac59b42c2f4f244',
    linuxUrl: 'https://github.com/yt-dlp/yt-dlp/releases/download/2026.06.09/yt-dlp',
    linuxSha256: 'e5d57466682cfa9d61e9cf7c8a4f09b00f4a62af37d3bbdc4bcffdf63615feac'
  },
  ffmpeg: {
    version: '8.1.1',
    url: 'https://ffmpeg.org/releases/ffmpeg-8.1.1.tar.gz',
    sha256: '1b856f26a07082b6879f3e5300d81e8c7ce3b410ade5898b14382d90c2904634'
  },
  lame: {
    version: '3.100',
    url: 'https://downloads.sourceforge.net/project/lame/lame/3.100/lame-3.100.tar.gz',
    sha256: 'ddfe36cab873794038ae2c1210557ad34857a4b6bdc515785d1da9e175b1da1e'
  },
  mupdf: {
    version: '1.27.2',
    url: 'https://github.com/ArtifexSoftware/mupdf-downloads/releases/download/1.27.2/mupdf-1.27.2-source.tar.gz',
    sha256: '553867b135303dc4c25ab67c5f234d8e900a0e36e66e8484d99adc05fe1e8737'
  },
  calibre: {
    version: '9.9.0',
    url: 'https://download.calibre-ebook.com/9.9.0/calibre-9.9.0.dmg',
    sha256: '66cddba176f7a3d6f2932fe2e710f54898f01dff1d7532957124ce5c2fc22b36'
  },
  leptonica: {
    version: '1.87.0',
    url: 'https://github.com/DanBloomberg/leptonica/releases/download/1.87.0/leptonica-1.87.0.tar.gz',
    sha256: 'c73363397f96eb1295602bf44d708a994ad42046c791bf03ea0505d829bdb6a7'
  },
  tesseract: {
    version: '5.5.2',
    url: 'https://github.com/tesseract-ocr/tesseract/archive/refs/tags/5.5.2.tar.gz',
    sha256: '6235ea0dae45ea137f59c09320406f5888383741924d98855bd2ce0d16b54f21'
  },
  tessdataEng: {
    version: 'ced78752cc61322fb554c280d13360b35b8684e4',
    url: 'https://raw.githubusercontent.com/tesseract-ocr/tessdata/ced78752cc61322fb554c280d13360b35b8684e4/eng.traineddata',
    sha256: 'daa0c97d651c19fba3b25e81317cd697e9908c8208090c94c3905381c23fc047'
  },
  'libjpeg-turbo': {
    version: '3.2.0',
    url: 'https://github.com/libjpeg-turbo/libjpeg-turbo/releases/download/3.2.0/libjpeg-turbo-3.2.0.tar.gz',
    sha256: '6f30092cef9fb839779646608f4ee14ae3cbac989c47fa05e841b0841f09878e'
  },
  qpdf: {
    version: '12.3.2',
    url: 'https://github.com/qpdf/qpdf/releases/download/v12.3.2/qpdf-12.3.2.tar.gz',
    sha256: '6cba2f9f2cd887d905faeb99e0e51a307b217920d1bbf3e9cfbb2e8178a2deda'
  }
}

export const readDependencyMetadata = async (): Promise<DependencyMetadata> => {
  try {
    const raw = await Bun.file(depsJsonPath).text()
    return {
      ...DEFAULT_DEPENDENCY_METADATA,
      ...validateJson(DependencyMetadataSchema, raw, 'config/deps.json')
    }
  } catch {
    return DEFAULT_DEPENDENCY_METADATA
  }
}

export const readDependencyTag = async (name: string): Promise<string | undefined> => {
  const metadata = await readDependencyMetadata()
  return metadata[name]?.tag
}

export const readDependencyVersion = async (name: string): Promise<string | undefined> => {
  const metadata = await readDependencyMetadata()
  return metadata[name]?.version
}

export const readDependencyUrlAndSha256 = async (
  name: string,
  variant?: 'linux'
): Promise<{ url: string, sha256: string }> => {
  const metadata = await readDependencyMetadata()
  const entry = metadata[name]
  const url = variant === 'linux' ? entry?.linuxUrl : entry?.url
  const sha256 = variant === 'linux' ? entry?.linuxSha256 : entry?.sha256
  if (!url || !sha256) {
    const field = variant === 'linux' ? 'linuxUrl/linuxSha256' : 'url/sha256'
    throw InternalError(
      `Missing ${field} for dependency ${name} in the setup dependency metadata (defaults in dependency-metadata.ts, optionally overridden by ${depsJsonPath})`,
      { stage: 'setup:dependency-metadata' }
    )
  }
  return { url, sha256 }
}

export const listPinnedDependencies = async (): Promise<{ name: string, version: string }[]> => {
  const metadata = await readDependencyMetadata()
  return Object.entries(metadata).map(([name, entry]) => ({
    name,
    version: entry.tag ?? entry.version ?? entry.ref ?? 'unknown'
  }))
}
