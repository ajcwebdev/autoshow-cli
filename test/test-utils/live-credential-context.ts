import { AsyncLocalStorage } from 'node:async_hooks'

// A live test forwards only its declared credentials to CLI children.
export const liveCredentialContext = new AsyncLocalStorage<Record<string, string>>()
