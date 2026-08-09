import { defineCliCommand } from '~/cli/native/native-types'
import { metadataFlags } from '~/cli/flags/metadata-flags'
import { handleProcessTarget } from '~/cli/commands/process-steps/step-1-download/download-targets/handle-process-target'

const inputParameter = [{ key: '[input]', description: 'URL, local file, directory, URL list (.md/.txt), or X Space/post' }] as const

export const metadataCommand = defineCliCommand({
  name: 'metadata',
  description: 'Collect and display metadata for media, documents, articles, or X Spaces without downloading',
  parameters: inputParameter,
  flags: metadataFlags,
  help: {
    examples: [
      ['bun autoshow metadata https://youtube.com/watch?v=abc', 'Get metadata for a YouTube video'],
      ['bun autoshow metadata https://x.com/i/spaces/1DXxyRYNejbKM', 'Get metadata for an X Space'],
      ['bun autoshow metadata input/examples/batch/2-urls.md --batch-all', 'Get metadata for all URLs in a file']
    ]
  }
}, async (ctx) => {
  await handleProcessTarget('metadata', ctx.parameters.input, ctx.flags, ctx.rawParsed)
})
