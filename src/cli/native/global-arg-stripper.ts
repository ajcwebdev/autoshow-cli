import type { CliFlagDefinition, CliFlagsDefinition, StripGlobalArgsOptions } from '~/types'

const isBoolean = (definition: CliFlagDefinition): boolean => definition.type === Boolean

export const stripDefinedGlobalArgs = (
  args: readonly string[],
  definitions: CliFlagsDefinition,
  options: StripGlobalArgsOptions = {}
): string[] => {
  const preserved = new Set(options.preserve ?? [])
  const shortNames = new Map<string, string>()
  for (const [name, definition] of Object.entries(definitions)) {
    if (definition.short) shortNames.set(definition.short, name)
  }

  const stripped: string[] = []
  for (let index = 0; index < args.length; index++) {
    const arg = args[index] as string
    if (arg === '--') {
      stripped.push(...args.slice(index))
      break
    }

    if (arg.startsWith('--')) {
      const raw = arg.slice(2)
      const equalsIndex = raw.indexOf('=')
      const rawName = equalsIndex === -1 ? raw : raw.slice(0, equalsIndex)
      const positiveName = rawName.startsWith('no-') ? rawName.slice(3) : rawName
      const definition = definitions[positiveName]
      const isNegated = rawName.startsWith('no-') && definition?.negatable === true && isBoolean(definition)
      if (definition && (rawName === positiveName || isNegated) && !preserved.has(positiveName)) {
        if (equalsIndex === -1 && !isBoolean(definition)) index++
        continue
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      const name = shortNames.get(arg.slice(1))
      const definition = name ? definitions[name] : undefined
      if (name && definition && !preserved.has(name)) {
        if (!isBoolean(definition)) index++
        continue
      }
    }

    stripped.push(arg)
  }
  return stripped
}
