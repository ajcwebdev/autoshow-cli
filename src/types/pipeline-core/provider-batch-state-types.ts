export type ProviderIdentityLike = { service: string, model: string }

export type ProviderStateLike = ProviderIdentityLike & { status: 'running' | 'succeeded' | 'missing' | 'failed' | 'skipped' }
