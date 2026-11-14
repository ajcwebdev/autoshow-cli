import { exec } from '~/utils/cli-utils'
import { getFfmpegBinary, resolveRuntimeToolInfo } from '~/utils/runtime-paths'
import { InfraError } from '~/utils/error-handler'

// Current ImageMagick omits the separate coder column printed by earlier releases.
export const supportsImageMagickTiffRead = (formats: string): boolean =>
  /^\s*TIFF\*?\s+(?:\S+\s+)?r[w-][+-](?:\s|$)/m.test(formats)

export const requireRenderingPrerequisites = async (): Promise<void> => {
  const imageMagick = resolveRuntimeToolInfo('magick') ?? resolveRuntimeToolInfo('convert')
  const fontconfig = resolveRuntimeToolInfo('fc-match')
  const hint = 'bun autoshow setup --step rendering'
  if (!imageMagick || !fontconfig) throw InfraError(`Managed rendering tools or fonts are missing. Run: ${hint}`, { stage: 'setup:rendering' })
  const formats = await exec(imageMagick.path, ['-list', 'format'])
  if (formats.exitCode !== 0 || !supportsImageMagickTiffRead(formats.stdout)) throw InfraError('ImageMagick must support reading TIFF images.', { stage: 'setup:rendering' })
  const font = await exec(fontconfig.path, ['-f', '%{family}', 'DejaVu Sans'])
  if (font.exitCode !== 0 || !font.stdout.includes('DejaVu Sans')) throw InfraError(`Rendering requires DejaVu Sans. Install: ${hint}`, { stage: 'setup:rendering' })
  const filters = await exec(getFfmpegBinary(), ['-hide_banner', '-filters'])
  if (!/^\s*\S+\s+ass\s/m.test(filters.stdout) && !resolveRuntimeToolInfo('pango-view')) throw InfraError(`Managed lyric rendering is unavailable. Run: ${hint}`, { stage: 'setup:rendering' })
}
