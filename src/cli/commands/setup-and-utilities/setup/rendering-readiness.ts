import { commandExists, exec } from '~/utils/cli-utils'
import { getFfmpegBinary } from '~/utils/runtime-paths'
import { InfraError } from '~/utils/error-handler'

export const requireRenderingPrerequisites = async (): Promise<void> => {
  const imageMagick = commandExists('magick') ? 'magick' : commandExists('convert') ? 'convert' : undefined
  const hint = process.platform === 'darwin'
    ? 'brew install imagemagick pango fontconfig font-dejavu'
    : 'apt-get install imagemagick pango1.0-tools fontconfig fonts-dejavu-core'
  if (!imageMagick || !commandExists('fc-match')) throw InfraError(`Rendering requires ImageMagick and Fontconfig with DejaVu fonts. Install: ${hint}`, { stage: 'setup:rendering' })
  const formats = await exec(imageMagick, ['-list', 'format'])
  if (formats.exitCode !== 0 || !/^\s*TIFF\*?\s+\S+\s+r/m.test(formats.stdout)) throw InfraError('ImageMagick must support reading TIFF images.', { stage: 'setup:rendering' })
  const font = await exec('fc-match', ['-f', '%{family}', 'DejaVu Sans'])
  if (font.exitCode !== 0 || !font.stdout.includes('DejaVu Sans')) throw InfraError(`Rendering requires DejaVu Sans. Install: ${hint}`, { stage: 'setup:rendering' })
  const filters = await exec(getFfmpegBinary(), ['-hide_banner', '-filters'])
  if (!/^\s*\S+\s+ass\s/m.test(filters.stdout) && !commandExists('pango-view')) throw InfraError(`Lyrics require the FFmpeg ass filter or Pango. Install: ${hint}`, { stage: 'setup:rendering' })
}
