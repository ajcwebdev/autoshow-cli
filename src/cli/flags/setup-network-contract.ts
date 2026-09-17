// Network-diagnostic defaults and value lists shared by the setup flag definitions and the
// runtime check, so `--help` renders the same numbers the diagnostic actually uses.
export const NETWORK_PROBE_CLIENTS = ['rest', 'fetch', 'fetch-no-keepalive'] as const
export type NetworkProbeClient = typeof NETWORK_PROBE_CLIENTS[number]

export const DEFAULT_NETWORK_PROBE_CLIENT: NetworkProbeClient = 'rest'
export const DEFAULT_NETWORK_FIXTURE_DELAY_SECONDS = 150
export const DEFAULT_NETWORK_FIXTURE_PORT = 8787
