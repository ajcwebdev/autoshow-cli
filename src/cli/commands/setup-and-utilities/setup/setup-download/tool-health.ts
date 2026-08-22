import { runCapture } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import type { RuntimeToolId } from '~/types'
import { resolveRuntimeToolInfo } from '~/utils/runtime-paths'

export const isRuntimeToolHealthy = async (
  id: RuntimeToolId,
  args: string[],
  okExitCodes: readonly number[] = [0]
): Promise<boolean> => {
  const resolved = resolveRuntimeToolInfo(id)
  if (!resolved) return false

  try {
    const result = await runCapture(resolved.path, args, { allowFailure: true })
    return okExitCodes.includes(result.exitCode)
  } catch {
    return false
  }
}
