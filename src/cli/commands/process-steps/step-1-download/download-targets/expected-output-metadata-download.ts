import type { ExpectedOutputOptions } from '~/types'
import { isDocumentLikeTarget } from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-classifier'

export const buildMetadataExpectedFiles = (opts: ExpectedOutputOptions): string[] => {
  if (!opts.save) {
    return [opts.markdown ? 'metadata (logged to terminal as Markdown frontmatter YAML)' : 'metadata (logged to terminal)']
  }
  return opts.markdown ? ['manifest.json', 'metadata.md'] : ['manifest.json']
}

export const buildDownloadExpectedFiles = async (
  opts: ExpectedOutputOptions,
  resolvedTarget: string | undefined
): Promise<string[]> => {
  const documentDownload = typeof resolvedTarget === 'string' && await isDocumentLikeTarget(resolvedTarget, opts)
  return documentDownload ? ['manifest.json'] : [opts.bestQuality ? 'Media file' : 'Audio file', 'manifest.json']
}
