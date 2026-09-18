import { join } from 'node:path'
import { COMMAND_DEFINITIONS } from '~/cli/create-cli'
import { getCommandHelpInventory, RETIRED_HELP_COMMANDS } from '~/cli/native/help-inventory'
import { renderCommandHelp, renderRootHelp } from '~/cli/native/help-renderer'
import { createNativeRootDefinition } from '~/cli/native/root-definition'
import { getHelpTopics } from '~/cli/native/help-topics'
import { stripAnsi } from '~/utils/terminal-colors'
import { PROJECT_ROOT } from '~/utils/runtime-paths'

export const generateHelpAuditInventory = async (): Promise<string> => {
  const reportPath = join(PROJECT_ROOT, 'docs/reports/help-output-inventory.md')
  const root = createNativeRootDefinition()
  const entries = getCommandHelpInventory(COMMAND_DEFINITIONS)
  const documents = [
    { name: 'root', visibility: 'public', topics: ['overview', 'globals'], document: renderRootHelp(root, COMMAND_DEFINITIONS) },
    ...entries.map(({ command, visibility }) => ({ name: command.name, visibility, topics: Object.keys(getHelpTopics(root, command)), document: renderCommandHelp(root, command) }))
  ]
  const records = documents.map(entry => {
    const document = stripAnsi(entry.document)
    return { command: entry.name === 'root' ? 'bun as --help' : `bun as ${entry.name} --help`, visibility: entry.visibility, topics: entry.topics, lines: document.split('\n').length - 1 }
  })
  const inventory = [
    '## Current CLI help inventory', '',
    'Generated from the command registry with `bun --no-env-file src/tools/help-output-audit.ts`. This command rewrites only this inventory file; it does not save raw captures or run command handlers, providers, or installation.', '',
    `Rendered ${records.length} help pages (${records.filter(row => row.visibility === 'public').length} public and ${records.filter(row => row.visibility === 'compatibility').length} compatibility). Retired commands: ${RETIRED_HELP_COMMANDS.join(', ')}.`, '',
    '| Command | Visibility | Render | Lines | Available topics |', '| --- | --- | --- | --- | --- |',
    ...records.map(row => `| \`${row.command}\` | ${row.visibility} | Passed | ${row.lines} | ${row.topics.map(topic => `\`${topic}\``).join(', ')} |`), ''
  ].join('\n')
  const document = [
    '# CLI help inventory',
    '',
    'Regenerable inventory of rendered help pages. Help-policy decisions live in [ADR-024](../adr/ADR-024-derive-cli-help-from-registries-and-generalize-provider-flags.md).',
    '',
    '<!-- help-inventory:start -->',
    inventory,
    '<!-- help-inventory:end -->',
    ''
  ].join('\n')
  await Bun.write(reportPath, document)
  return reportPath
}

if (import.meta.main) console.log(await generateHelpAuditInventory())
