export type JsonProfileStore<TVersion extends number, TEntry> = {
  version: TVersion
  profiles: TEntry[]
}
