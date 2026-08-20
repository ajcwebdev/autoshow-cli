import type { ManagedArtifactToolId, ManagedPrebuiltLicense, ManagedToolchainNoticePlanEntry } from '~/types'
import { InternalError } from '~/utils/error-handler'

const REVIEWED_AT = '2026-08-13'
const REPOSITORY_REVIEWER = 'github:ajcwebdev/repository-owner'
const COMPLIANCE_REVIEWER = 'github:ajcwebdev/project-compliance-owner'
const USER_NOTICE_PATH = 'licenses/DISTRIBUTION-NOTICE.txt'

const HYPHEN_NOTICE_NAMES = [
  'hyph-af.info',
  'hyph-as.info',
  'hyph-be.info',
  'hyph-bg.info',
  'hyph-bn.info',
  'hyph-ca.info',
  'hyph-cop.info',
  'hyph-da.info',
  'hyph-de-1996.info',
  'hyph-el-polyton.info',
  'hyph-en-us.info',
  'hyph-es.info',
  'hyph-et.info',
  'hyph-fi.info',
  'hyph-fr.info',
  'hyph-gu.info',
  'hyph-hi.info',
  'hyph-hr.info',
  'hyph-hu.info',
  'hyph-hy.info',
  'hyph-is.info',
  'hyph-it.info',
  'hyph-ka.info',
  'hyph-kn.info',
  'hyph-la.info',
  'hyph-lt.info',
  'hyph-lv.info',
  'hyph-ml.info',
  'hyph-mn-cyrl.info',
  'hyph-mr.info',
  'hyph-nb.info',
  'hyph-nl.info',
  'hyph-or.info',
  'hyph-pa.info',
  'hyph-pi.info',
  'hyph-pl.info',
  'hyph-pt.info',
  'hyph-ro.info',
  'hyph-ru.info',
  'hyph-sa.info',
  'hyph-sl.info',
  'hyph-sq.info',
  'hyph-sv.info',
  'hyph-ta.info',
  'hyph-te.info',
  'hyph-th.info',
  'hyph-tk.info',
  'hyph-tr.info'
] as const

const MUPDF_THIRD_PARTY_NOTICE_SOURCES = [
  'thirdparty/brotli/LICENSE',
  'thirdparty/extract/COPYING',
  'thirdparty/freetype/LICENSE.TXT',
  'thirdparty/freetype/docs/FTL.TXT',
  'thirdparty/freetype/src/bdf/README',
  'thirdparty/freetype/src/pcf/README',
  'thirdparty/gumbo-parser/COPYING',
  'thirdparty/harfbuzz/COPYING',
  'thirdparty/jbig2dec/COPYING',
  'thirdparty/jbig2dec/LICENSE',
  'thirdparty/lcms2/LICENSE',
  'thirdparty/libjpeg/README',
  'thirdparty/mujs/COPYING',
  'thirdparty/openjpeg/LICENSE',
  'thirdparty/zlib/LICENSE',
  'resources/README',
  'resources/cmaps/CNS-EUC-H',
  'resources/fonts/droid/NOTICE',
  'resources/fonts/han/LICENSE.txt',
  'resources/fonts/han/README.txt',
  'resources/fonts/noto/COPYING',
  'resources/fonts/sil/OFL.txt',
  'resources/fonts/sil/README.txt',
  'resources/fonts/urw/OFL.txt',
  'resources/hyphen/README',
  ...HYPHEN_NOTICE_NAMES.map(name => `resources/hyphen/license/${name}`)
] as const

const NOTICE_PLAN: Record<ManagedArtifactToolId, readonly ManagedToolchainNoticePlanEntry[]> = {
  mupdf: [
    { source: 'mupdf', sourcePaths: ['COPYING'], packagePath: 'licenses/mupdf-COPYING', mode: 'copy' },
    { source: 'mupdf', sourcePaths: ['README'], packagePath: 'licenses/mupdf-README', mode: 'copy' },
    {
      source: 'mupdf',
      sourcePaths: MUPDF_THIRD_PARTY_NOTICE_SOURCES,
      packagePath: 'licenses/mupdf-THIRD-PARTY-NOTICES.txt',
      mode: 'concatenate'
    }
  ],
  qpdf: [
    { source: 'qpdf', sourcePaths: ['LICENSE.txt'], packagePath: 'licenses/qpdf-LICENSE.txt', mode: 'copy' },
    { source: 'qpdf', sourcePaths: ['NOTICE.md'], packagePath: 'licenses/qpdf-NOTICE.md', mode: 'copy' },
    { source: 'libjpeg-turbo', sourcePaths: ['LICENSE.md'], packagePath: 'licenses/libjpeg-turbo-LICENSE.md', mode: 'copy' }
  ]
}

const LICENSE_POLICY: Record<ManagedArtifactToolId, ManagedPrebuiltLicense> = {
  mupdf: {
    primaryLicense: 'AGPL-3.0-or-later',
    noticePaths: [...NOTICE_PLAN.mupdf.map(entry => entry.packagePath), USER_NOTICE_PATH],
    correspondingSourceAssets: ['mupdf-1.27.2-source.tar.gz'],
    autoshowSourceArchive: 'https://github.com/ajcwebdev/autoshow-cli/archive/refs/tags/toolchain-mupdf-1.27.2-r1.tar.gz',
    reviewStatus: 'approved',
    reviewReferences: ['ADR-004-P5-MUPDF-1.27.2-r1'],
    reviewedAt: REVIEWED_AT,
    repositoryReviewer: REPOSITORY_REVIEWER,
    complianceReviewer: COMPLIANCE_REVIEWER,
    writtenOfferRequired: false,
    userNoticePath: USER_NOTICE_PATH
  },
  qpdf: {
    primaryLicense: 'Apache-2.0',
    noticePaths: [...NOTICE_PLAN.qpdf.map(entry => entry.packagePath), USER_NOTICE_PATH],
    correspondingSourceAssets: ['qpdf-12.3.2.tar.gz', 'libjpeg-turbo-3.2.0.tar.gz'],
    autoshowSourceArchive: 'https://github.com/ajcwebdev/autoshow-cli/archive/refs/tags/toolchain-qpdf-12.3.2-r1.tar.gz',
    reviewStatus: 'approved',
    reviewReferences: ['ADR-004-P5-QPDF-12.3.2-r1', 'ADR-004-P5-LIBJPEG-TURBO-3.2.0-r1'],
    reviewedAt: REVIEWED_AT,
    repositoryReviewer: REPOSITORY_REVIEWER,
    complianceReviewer: COMPLIANCE_REVIEWER,
    writtenOfferRequired: false,
    userNoticePath: USER_NOTICE_PATH
  }
}

const SPDX_LICENSE_BY_SOURCE: Record<string, string> = {
  mupdf: 'AGPL-3.0-or-later',
  qpdf: 'Apache-2.0',
  'libjpeg-turbo': 'IJG AND BSD-3-Clause'
}

const sameJson = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right)

export const managedToolchainDistributionLicense = (tool: ManagedArtifactToolId): ManagedPrebuiltLicense =>
  structuredClone(LICENSE_POLICY[tool])

export const managedToolchainDistributionNoticePlan = (tool: ManagedArtifactToolId): readonly ManagedToolchainNoticePlanEntry[] =>
  NOTICE_PLAN[tool]

export const managedToolchainSpdxLicense = (sourceName: string): string => {
  const license = SPDX_LICENSE_BY_SOURCE[sourceName]
  if (!license) {
    throw InternalError(`no approved SPDX license for managed toolchain source ${sourceName}`, {
      stage: 'setup:managed-artifact',
      retryable: false
    })
  }
  return license
}

export const validateManagedToolchainDistributionLicense = (
  tool: ManagedArtifactToolId,
  license: ManagedPrebuiltLicense
): string | undefined => sameJson(license, LICENSE_POLICY[tool])
  ? undefined
  : `distribution license inventory does not match the approved ${tool} Phase 5 review`

export const createManagedToolchainDistributionNotice = (tool: ManagedArtifactToolId): string => {
  const policy = LICENSE_POLICY[tool]
  const title = tool === 'mupdf' ? 'MuPDF 1.27.2' : 'qpdf 12.3.2 with statically linked libjpeg-turbo 3.2.0'
  const licenseSummary = tool === 'mupdf'
    ? 'This executable is conveyed under AGPL-3.0-or-later. It is a separate subprocess in the AutoShow aggregate; this distribution does not relicense AutoShow.'
    : 'This executable is conveyed under Apache-2.0, with libjpeg-turbo conveyed under its IJG and Modified BSD terms.'
  return [
    `AutoShow macOS toolchain distribution notice for ${title}`,
    '',
    licenseSummary,
    'The executable and its bundled components are provided without warranty. Read every file in this licenses directory before redistribution.',
    '',
    'Exact upstream source assets offered on the same immutable GitHub release page:',
    ...policy.correspondingSourceAssets.map(asset => `- ${asset}`),
    '',
    'Exact AutoShow producer source archive:',
    `- ${policy.autoshowSourceArchive}`,
    '',
    tool === 'mupdf'
      ? 'The binary and machine-readable Corresponding Source are offered by equivalent network access from the same release page under AGPL section 6(d); no written offer is used.'
      : 'The source assets are included for provenance and rebuildability; no written offer is required by the approved permissive-license distribution.',
    '',
    `Distribution review: ${policy.reviewReferences.join(', ')}`,
    `Reviewed: ${policy.reviewedAt}`,
    `Repository reviewer: ${policy.repositoryReviewer}`,
    `Project compliance reviewer: ${policy.complianceReviewer}`,
    ''
  ].join('\n')
}
