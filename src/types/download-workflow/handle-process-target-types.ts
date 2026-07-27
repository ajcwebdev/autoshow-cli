export type ResolvedProcessTargetDoubleDash =
  | { kind: 'target', resolvedTarget: string, ytDlpPassthroughArgs?: string[] | undefined }
  | { kind: 'raw-yt-dlp', ytDlpPassthroughArgs: string[] }
