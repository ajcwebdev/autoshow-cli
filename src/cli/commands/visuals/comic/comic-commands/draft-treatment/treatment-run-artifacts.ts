import { mkdir } from 'node:fs/promises'
import { extname, join } from 'node:path'
import type { TreatmentCatalogMergeReport } from '~/types'
import { getOutputRoot } from '~/cli/commands/command-shared/output-root'
import { resolveRunDirectory } from '~/cli/commands/command-shared/run-dir'
import { copyFileExact, writeFileExact } from '~/utils/bun-file-io'
import { atomicWriteJson } from '~/utils/filesystem'

export const TREATMENT_RUN_STAGE = 'comic-treatment'

export const createTreatmentRunDirectory = (slug: string): string =>
  resolveRunDirectory(getOutputRoot(), `${slug}-treatment`, TREATMENT_RUN_STAGE)

export const getTreatmentMetadataDirectory = (runDirectory: string): string => join(runDirectory, 'metadata', 'treatment')

export const writeTreatmentTextArtifact = async (runDirectory: string, name: string, content: string): Promise<string> => {
  const directory = getTreatmentMetadataDirectory(runDirectory)
  await mkdir(directory, { recursive: true })
  const path = join(directory, name)
  await writeFileExact(path, content)
  return path
}

export const writeTreatmentJsonArtifact = async (runDirectory: string, name: string, value: unknown): Promise<string> => {
  const path = join(getTreatmentMetadataDirectory(runDirectory), name)
  await atomicWriteJson(path, value)
  return path
}

export const copyTreatmentSourceArtifact = async (runDirectory: string, sourcePath: string): Promise<string> => {
  const directory = getTreatmentMetadataDirectory(runDirectory)
  await mkdir(directory, { recursive: true })
  const path = join(directory, `source${extname(sourcePath).toLowerCase() || '.txt'}`)
  await copyFileExact(sourcePath, path)
  return path
}

export const buildTreatmentMergeReportMarkdown = (report: TreatmentCatalogMergeReport, context: {
  scriptPath: string
  shorthand: string
  panelCount: number
  styleSeedPath: string
  speakers: readonly string[]
}): string => {
  const list = (values: readonly string[]): string => values.length > 0 ? values.map(value => `- \`${value}\``).join('\n') : '- none'
  const referenceCommands = [
    ...report.charactersAdded.map(key => `bun autoshow comic reference-sketch --character ${key}`),
    ...report.locationsAdded.map(key => `bun autoshow comic reference-sketch --location ${key}`),
  ]
  const voiceSubjects = ['role:narrator', ...context.speakers]
  return [
    '# Treatment catalog merge report',
    '',
    `Script: \`${context.scriptPath}\` (shorthand \`${context.shorthand}\`, ${context.panelCount} panels)`,
    '',
    `Style seed: \`${context.styleSeedPath}\``,
    '',
    `Location style image: ${report.styleImage.action} \`${report.styleImage.value}\``,
    '',
    '## Characters added',
    '',
    list(report.charactersAdded),
    '',
    '## Characters skipped (existing keys kept as authored)',
    '',
    list(report.charactersSkipped),
    '',
    '## Aliases dropped',
    '',
    report.droppedAliases.length > 0 ? report.droppedAliases.map(item => `- \`${item.key}\`: "${item.alias}" (${item.reason})`).join('\n') : '- none',
    '',
    '## Locations added',
    '',
    list(report.locationsAdded),
    '',
    '## Locations skipped (existing keys kept as authored)',
    '',
    list(report.locationsSkipped),
    '',
    '## Next steps',
    '',
    '```bash',
    `bun autoshow comic draft-scenes ${context.shorthand} --only structure`,
    ...referenceCommands,
    `bun autoshow comic draft-scenes ${context.shorthand} --only prompt`,
    `bun autoshow comic draft-scenes ${context.shorthand} --only scene --panel-count ${context.panelCount} --no-blocking`,
    `bun autoshow comic draft-scenes ${context.shorthand} --only panel-prompts --no-blocking`,
    `bun autoshow comic generate-images ${context.shorthand} --target images --panels 1-${context.panelCount}`,
    ...voiceSubjects.map(subject => `bun autoshow voice import ${subject} --provider <provider> --model <model> --voice-id <id>`),
    `bun autoshow comic generate-audio ${context.shorthand} --provider <provider>=<model>`,
    `bun autoshow comic generate-slideshow ${context.shorthand}`,
    '```',
    '',
  ].join('\n')
}
