type CanonicalPrimitive = string | number | boolean | null
export type CanonicalValue = CanonicalPrimitive | CanonicalValue[] | { [key: string]: CanonicalValue }

export type ArtifactPathScope = 'render' | 'attempt' | 'batch-result' | 'audio-run'
