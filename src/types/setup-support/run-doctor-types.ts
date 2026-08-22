import type { AutoshowConfig, CheckResult, ManagedArtifactToolId, ManagedArtifactValidation, ResolvedYtDlpBinary, RunResult } from '~/types'
export type DoctorStatus = 'OK' | 'MISSING' | 'WARN' | 'INFO'

export type DoctorSeverity = 'warn' | 'info'

export type DoctorCheck = {
  label: string
  status: DoctorStatus
  detail: string
  severity: DoctorSeverity
  nextStep?: string | undefined
}

export type DoctorSection = {
  title: string
  checks: DoctorCheck[]
}

export type DoctorProbes = {
  env: Record<string, string | undefined>
  which: (command: string) => string | undefined
  pathExists: (path: string) => Promise<boolean>
  listDirectory: (path: string) => Promise<string[]>
  directoryHasFiles: (path: string) => Promise<boolean>
  run: (command: string, args: string[]) => Promise<RunResult>
  resolveYtDlpBinaryInfo: () => ResolvedYtDlpBinary | undefined
  readDefuddleCliReadiness: () => Promise<CheckResult>
  resolveConfigPath: () => Promise<string>
  loadConfig: (path: string) => Promise<AutoshowConfig>
  inspectYtDlpAuthState: () => Promise<Awaited<ReturnType<typeof import('~/cli/commands/process-steps/shared/shared-yt-dlp-options').inspectYtDlpAuthState>>>
  validateManagedArtifact: (tool: ManagedArtifactToolId) => Promise<ManagedArtifactValidation>
}

export type DoctorReport = {
  sections: DoctorSection[]
  hasWarnings: boolean
  missingConfiguredCredentialEnvVars: string[]
  nextSteps: string[]
}
