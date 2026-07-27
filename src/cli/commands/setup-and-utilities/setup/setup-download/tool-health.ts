import { runCapture } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import type { RuntimeToolId } from '~/types'
import { resolveRuntimeToolInfo } from '~/utils/runtime-paths'

// Existence is not readiness: a truncated binary, a wrapper pointing at a
// deleted install tree, or a partially extracted app bundle all pass an
// existsSync check and then fail at first real use, with no way for a re-run of
// setup to notice and repair them. qpdf already resolves through a dedicated
// health probe; this is the same idea for the remaining managed tools.
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
