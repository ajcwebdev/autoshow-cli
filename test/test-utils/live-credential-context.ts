import { AsyncLocalStorage } from 'node:async_hooks'

export const liveCredentialContext = new AsyncLocalStorage<Record<string, string>>()
