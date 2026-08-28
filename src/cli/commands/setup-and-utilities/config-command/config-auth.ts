import { configureYtDlpAuth } from '~/cli/commands/process-steps/shared/shared-yt-dlp-options'
import { loadConfig, resolveConfigPath } from './config-loader'

export const applyConfiguredYtDlpAuth = async (configPathOverride?: string): Promise<void> => {
  try {
    const config = await loadConfig(await resolveConfigPath(configPathOverride))
    const cookies = config.auth?.cookies
    const cookiesFromBrowser = config.auth?.cookiesFromBrowser
    if (!cookies && !cookiesFromBrowser) return
    configureYtDlpAuth({
      ...(cookies ? { cookies } : {}),
      ...(cookiesFromBrowser ? { cookiesFromBrowser } : {})
    })
  } catch {
    return
  }
}
