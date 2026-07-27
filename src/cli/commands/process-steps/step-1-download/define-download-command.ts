import { defineCliCommand } from '~/cli/native/native-types'
import { downloadFlags } from '~/cli/flags/download-flags'
import { handleProcessTarget } from './download-targets/handle-process-target'

const inputParameter = [{ key: '[input]', description: 'URL, local file, directory, URL list (.md/.txt), or X Space/post' }] as const

export const downloadCommand = defineCliCommand({
  name: 'download',
  description: 'Download media, documents, articles, or X Space audio and collect metadata only',
  parameters: inputParameter,
  flags: downloadFlags,
  help: {
    examples: [
      ['bun autoshow download https://youtube.com/watch?v=abc', 'Download audio from a URL'],
      ['bun autoshow download https://x.com/i/spaces/1DXxyRYNejbKM', 'Download audio from an X Space'],
      ['bun autoshow download input/examples/batch/2-urls.md --batch-limit 3', 'Download first 3 items from a URL list'],
      ['bun autoshow download https://example.com/feed --batch-all --keep-original-media --flat-batch', 'Download all podcast episode files into one batch directory'],
      ['bun autoshow download https://youtube.com/watch?v=abc -- --write-thumbnail', 'Download with extra yt-dlp flags'],
      ['bun autoshow download input/examples/batch/2-urls.md --batch-limit 3 -- --format bestaudio', 'Batch download with extra yt-dlp flags'],
      ['bun autoshow download -- --format bestaudio -o "%(title)s.%(ext)s" https://youtube.com/watch?v=abc', 'Run yt-dlp directly (raw mode)']
    ]
  }
}, async (ctx) => {
  await handleProcessTarget('download', ctx.parameters.input, ctx.flags, ctx.rawParsed.doubleDash)
})
