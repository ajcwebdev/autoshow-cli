export const SETUP_FOCUSED_MODE_FLAGS = ['models', 'doctor', 'strict', 'step', 'force-redownload'] as const
export const SETUP_NETWORK_DEPENDENT_FLAGS = ['probe-url', 'probe-client', 'delay-seconds', 'port'] as const

export const SETUP_MODE_NOTES = [
  `--models cannot be combined with ${SETUP_FOCUSED_MODE_FLAGS.filter(name => name !== 'models').map(name => `--${name}`).join(', ')}.`,
  `--network-check cannot be combined with ${[...SETUP_FOCUSED_MODE_FLAGS, 'price'].map(name => `--${name}`).join(', ')}.`,
  `${SETUP_NETWORK_DEPENDENT_FLAGS.map(name => `--${name}`).join(', ')} require --network-check.`,
  '--strict requires --doctor. Installation runs with no mode flag; --models only downloads models, and --doctor only inspects readiness.'
] as const
