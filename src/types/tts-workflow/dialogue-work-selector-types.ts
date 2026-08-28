export type DialogueWorkItem<TResult> = {
  workspaceName: string
  run: (workspaceDir: string, signal: AbortSignal) => Promise<TResult>
}

export type DialogueWorkSelectorOptions<TResult> = {
  concurrency: number
  workspaceRoot: string
  work: readonly DialogueWorkItem<TResult>[]
}
