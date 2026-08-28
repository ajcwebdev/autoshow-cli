export type ManagedToolchainNoticePlanEntry = {
  source: 'mupdf' | 'qpdf' | 'libjpeg-turbo'
  sourcePaths: readonly string[]
  packagePath: string
  mode: 'copy' | 'concatenate'
}
