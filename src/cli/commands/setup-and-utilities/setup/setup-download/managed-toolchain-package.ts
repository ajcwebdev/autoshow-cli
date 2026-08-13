import { cp, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  createManagedToolchainDistributionNotice,
  managedToolchainDistributionLicense,
  managedToolchainDistributionNoticePlan,
  managedToolchainSpdxLicense
} from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-toolchain-distribution-policy'
import type {
  ManagedArtifactPayloadFile,
  ManagedArtifactSource,
  ManagedArtifactToolId,
  ManagedPrebuiltProducer
} from '~/types'

export type ManagedToolchainSourceDirectories = Partial<Record<'mupdf' | 'qpdf' | 'libjpeg-turbo', string>>

export const writeManagedToolchainPackageNotices = async (options: {
  tool: ManagedArtifactToolId
  packageDir: string
  sourceDirectories: ManagedToolchainSourceDirectories
}): Promise<void> => {
  for (const notice of managedToolchainDistributionNoticePlan(options.tool)) {
    const sourceDirectory = options.sourceDirectories[notice.source]
    if (!sourceDirectory) throw new Error(`missing ${notice.source} source directory for package notices`)
    const destination = join(options.packageDir, notice.packagePath)
    await mkdir(dirname(destination), { recursive: true })
    if (notice.mode === 'copy') {
      const sourcePath = notice.sourcePaths[0]
      if (!sourcePath || notice.sourcePaths.length !== 1) throw new Error(`copy notice ${notice.packagePath} must have exactly one source`)
      await cp(join(sourceDirectory, sourcePath), destination)
      continue
    }
    const sections = await Promise.all(notice.sourcePaths.map(async sourcePath => {
      const content = (await Bun.file(join(sourceDirectory, sourcePath)).text()).trimEnd()
      return `===== ${sourcePath} =====\n${content}\n`
    }))
    await Bun.write(destination, `${sections.join('\n')}\n`)
  }
  const license = managedToolchainDistributionLicense(options.tool)
  await Bun.write(join(options.packageDir, license.userNoticePath), createManagedToolchainDistributionNotice(options.tool))
}

type SpdxChecksum = { algorithm: 'SHA256', checksumValue: string }
type SpdxPackage = {
  SPDXID: string
  name: string
  versionInfo: string
  downloadLocation: string
  filesAnalyzed: false
  checksums: SpdxChecksum[]
  licenseConcluded: 'NOASSERTION'
  licenseDeclared: string
  copyrightText: 'NOASSERTION'
}

export const createManagedToolchainSpdx = (options: {
  documentName: string
  tool: ManagedArtifactToolId
  architecture: 'arm64' | 'x64'
  producer: ManagedPrebuiltProducer
  sources: ManagedArtifactSource[]
  payload: ManagedArtifactPayloadFile[]
  created?: string
}): Record<string, unknown> => {
  const describedId = `SPDXRef-Package-${options.tool}`
  const packages: SpdxPackage[] = options.sources.map((source, index) => ({
    SPDXID: index === 0 ? describedId : `SPDXRef-Package-${source.name.replace(/[^A-Za-z0-9.-]/g, '-')}`,
    name: source.name,
    versionInfo: source.version,
    downloadLocation: source.url,
    filesAnalyzed: false,
    checksums: [{ algorithm: 'SHA256', checksumValue: source.sha256 }],
    licenseConcluded: 'NOASSERTION',
    licenseDeclared: managedToolchainSpdxLicense(source.name),
    copyrightText: 'NOASSERTION'
  }))
  return {
    spdxVersion: 'SPDX-2.3',
    dataLicense: 'CC0-1.0',
    SPDXID: 'SPDXRef-DOCUMENT',
    name: options.documentName,
    documentNamespace: `https://github.com/ajcwebdev/autoshow-cli/spdx/${options.producer.commit}/${options.tool}/${options.architecture}`,
    creationInfo: {
      created: options.created ?? new Date().toISOString(),
      creators: ['Organization: AutoShow', 'Tool: autoshow-macos-toolchain-producer']
    },
    documentDescribes: [describedId],
    packages,
    files: options.payload.map((file, index) => ({
      SPDXID: `SPDXRef-File-${index + 1}`,
      fileName: `./${file.path}`,
      checksums: [{ algorithm: 'SHA256', checksumValue: file.sha256 }],
      licenseConcluded: 'NOASSERTION',
      copyrightText: 'NOASSERTION'
    })),
    relationships: options.payload.map((_file, index) => ({
      spdxElementId: describedId,
      relationshipType: 'CONTAINS',
      relatedSpdxElement: `SPDXRef-File-${index + 1}`
    }))
  }
}
