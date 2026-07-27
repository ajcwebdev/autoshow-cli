export type MetadataTopLevelTargetKind = 'directory' | 'input_list' | 'single'

export type MetadataTopLevelTargetInfo = {
  kind: MetadataTopLevelTargetKind
  exists: boolean
  isDirectory: boolean
  isFile: boolean
}
