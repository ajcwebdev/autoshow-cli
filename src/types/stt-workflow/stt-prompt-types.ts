export type SttPromptRefreshController = {
  queue: () => void
  flush: () => Promise<void>
}
