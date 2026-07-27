export type ComicSubcommandDefinition = {
  name: string
  description: string
  run: (rawArgs: string[]) => Promise<void>
}
