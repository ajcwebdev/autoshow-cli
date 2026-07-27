export type DownloadE2eStep1Metadata = {
  audioFileName?: string
  audioFileSize?: number
  format?: string
  pageCount?: number
  fileSize?: number
  title?: string
  channel?: string
  slug?: string
}

export type DownloadE2eMetadata = {
  step1?: DownloadE2eStep1Metadata
  step2?: unknown
  step3?: unknown
}

export type DownloadE2eCaseInput = string | (() => string | Promise<string>)

export type DownloadE2eSingleCase = {
  name: string
  input: DownloadE2eCaseInput
  suffix?: string
  checks: (metadata: DownloadE2eMetadata, outputDir: string) => Promise<void>
}

export type DownloadE2eBatchCase = {
  name: string
  input: DownloadE2eCaseInput
  extraArgs: string[]
  expectedSourceKind: string
  expectedSelectedCount?: number
}

export type DownloadE2eBatchSource = {
  sourceKind?: string
  selectedCount?: number
}
