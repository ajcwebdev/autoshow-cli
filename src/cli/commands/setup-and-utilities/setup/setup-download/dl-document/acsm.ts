import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as l from '~/utils/app-logger/app-logger'
import { makeExecutable } from '~/utils/filesystem'
import {
  acsmAuthorizeManagedBinaryPath,
  acsmCalibrePluginAccountDir,
  acsmCalibrePluginPythonEnvDir,
  acsmCalibrePluginSourceDir,
  acsmCalibrePluginToolDir,
  acsmFulfillManagedBinaryPath,
  RUNTIME_BIN_DIR
} from '~/utils/runtime-paths'
import { InfraError } from '~/utils/error-handler'
import { ACSM_ACCOUNT_REQUIRED_FILES, ACSM_FULFILL_COMMAND } from '~/cli/commands/process-steps/step-1-download/document/acsm-fulfillment'
import { downloadFile } from '../download'
import { runCapture } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import { installManagedUv, resolveUvCommand } from '../managed-uv'
import { readDependencyUrlAndSha256, readDependencyVersion } from '../../dependency-metadata'
import type { AcsmWrapperPaths } from '~/types'

const ACSM_AUTHORIZE_COMMAND = 'calibre-acsm-authorize'
const ACSM_PYTHON_PACKAGES = ['lxml', 'pycryptodomex'] as const
export const ACSM_STANDALONE_IMPORT_MODULES = ['libadobe', 'libadobeAccount', 'libadobeFulfill', 'fulfill'] as const
const ACSM_RANDOM_SERIAL_BYTES_SNIPPET = 'sha_out = binascii.hexlify(Random.get_random_bytes(20)).lower()'
const ACSM_RANDOM_SERIAL_TEXT_SNIPPET = "sha_out = binascii.hexlify(Random.get_random_bytes(20)).decode('latin-1').lower()"
const ACSM_RANDOM_SERIAL_OVERPATCHED_SNIPPET = "sha_out = binascii.hexlify(Random.get_random_bytes(20)).decode('latin-1').decode('latin-1').lower()"
const ACSM_FINGERPRINT_SERIAL_GUARD = [
  '    if isinstance(serial, bytes):',
  "        serial = serial.decode('latin-1')"
].join('\n')
const ACSM_FINGERPRINT_HASH_LINE = "    str_to_hash = serial + devkey_bytes.decode('latin-1')"
const ACSM_FINGERPRINT_RETURN_TEXT_LINE = "    return b64str.decode('latin-1')"

const shellQuote = (value: string): string => `'${value.replace(/'/g, "'\\''")}'`

const ensureUvForAcsm = async (): Promise<string> => {
  const existing = await resolveUvCommand()
  if (existing) return existing
  await installManagedUv()
  const installed = await resolveUvCommand()
  if (!installed) {
    throw InfraError('uv setup completed but uv was not found', { stage: 'setup:acsm' })
  }
  return installed
}

const pythonPathForEnv = (envDir: string): string => join(envDir, 'bin/python')

export const buildAcsmPythonPath = (pluginDir: string, existingPythonPath?: string): string => {
  const entries = [
    `${pluginDir}/asn1crypto.zip/asn1crypto`,
    `${pluginDir}/oscrypto.zip/oscrypto`,
    pluginDir
  ]
  return existingPythonPath ? [...entries, existingPythonPath].join(':') : entries.join(':')
}

export const buildAcsmStandaloneImportCheckCode = (): string =>
  [
    'import importlib',
    `for module_name in ${JSON.stringify(ACSM_STANDALONE_IMPORT_MODULES)}:`,
    '    importlib.import_module(module_name)'
  ].join('\n')

export const buildAcsmDeviceFilePreflightCode = (): string =>
  [
    'from libadobe import createDeviceKeyFile, makeFingerprint, makeSerial',
    'from libadobeAccount import createDeviceFile',
    'createDeviceKeyFile()',
    'serial = makeSerial(True)',
    'assert isinstance(serial, str), type(serial).__name__',
    'fingerprint = makeFingerprint(serial)',
    'assert isinstance(fingerprint, str), type(fingerprint).__name__',
    'assert createDeviceFile(True, 1) is True'
  ].join('\n')

const acsmPythonImportCheck = async (pythonPath: string): Promise<boolean> => {
  const result = await runCapture(
    pythonPath,
    ['-c', 'import lxml, Cryptodome'],
    { allowFailure: true }
  )
  return result.exitCode === 0
}

const ensureAcsmPythonEnv = async (): Promise<void> => {
  const pythonPath = pythonPathForEnv(acsmCalibrePluginPythonEnvDir)
  if (await Bun.file(pythonPath).exists() && await acsmPythonImportCheck(pythonPath)) {
    return
  }

  const uv = await ensureUvForAcsm()
  await runCapture(uv, ['venv', acsmCalibrePluginPythonEnvDir])
  await runCapture(uv, [
    'pip',
    'install',
    '--python',
    pythonPath,
    ...ACSM_PYTHON_PACKAGES
  ])
}

export const patchAcsmPluginPython3Compatibility = async (pluginDir: string = acsmCalibrePluginSourceDir): Promise<void> => {
  const libadobePath = join(pluginDir, 'libadobe.py')
  const source = await readFile(libadobePath, 'utf8')
  let patched = source

  patched = patched.replaceAll(ACSM_RANDOM_SERIAL_OVERPATCHED_SNIPPET, ACSM_RANDOM_SERIAL_TEXT_SNIPPET)
  if (patched.includes(ACSM_RANDOM_SERIAL_BYTES_SNIPPET)) {
    patched = patched.replace(ACSM_RANDOM_SERIAL_BYTES_SNIPPET, ACSM_RANDOM_SERIAL_TEXT_SNIPPET)
  } else if (!patched.includes(ACSM_RANDOM_SERIAL_TEXT_SNIPPET)) {
    throw InfraError('ACSM plugin compatibility patch failed: random serial snippet was not found', { stage: 'setup:acsm' })
  }

  patched = patched.replace(
    /(?:    if isinstance\(serial, bytes\):\n        serial = serial\.decode\('latin-1'\)\n)+/g,
    `${ACSM_FINGERPRINT_SERIAL_GUARD}\n`
  )
  if (!patched.includes(ACSM_FINGERPRINT_SERIAL_GUARD)) {
    if (!patched.includes(ACSM_FINGERPRINT_HASH_LINE)) {
      throw InfraError('ACSM plugin compatibility patch failed: fingerprint hash line was not found', { stage: 'setup:acsm' })
    }
    patched = patched.replace(ACSM_FINGERPRINT_HASH_LINE, `${ACSM_FINGERPRINT_SERIAL_GUARD}\n${ACSM_FINGERPRINT_HASH_LINE}`)
  }

  patched = patched.replace(/^    return b64str(?:\.decode\('latin-1'\))*$/m, ACSM_FINGERPRINT_RETURN_TEXT_LINE)
  if (!patched.includes(ACSM_FINGERPRINT_RETURN_TEXT_LINE)) {
    throw InfraError('ACSM plugin compatibility patch failed: fingerprint return line was not found', { stage: 'setup:acsm' })
  }

  if (patched !== source) {
    await writeFile(libadobePath, patched)
  }
}

export const runAcsmStandaloneImportPreflight = async ({
  pluginDir,
  pythonPath
}: Pick<AcsmWrapperPaths, 'pluginDir' | 'pythonPath'>): Promise<void> => {
  const result = await runCapture(
    pythonPath,
    ['-c', buildAcsmStandaloneImportCheckCode()],
    {
      allowFailure: true,
      env: { PYTHONPATH: buildAcsmPythonPath(pluginDir, process.env['PYTHONPATH']) }
    }
  )
  if (result.exitCode === 0) return

  const detail = (result.stderr.trim() || result.stdout.trim())
  throw InfraError(
    `ACSM plugin import preflight failed${detail ? `: ${detail}` : ''}`,
    { stage: 'setup:acsm' }
  )
}

export const runAcsmDeviceFilePreflight = async ({
  pluginDir,
  pythonPath
}: Pick<AcsmWrapperPaths, 'pluginDir' | 'pythonPath'>): Promise<void> => {
  const workDir = await mkdtemp(join(tmpdir(), 'autoshow-acsm-device-preflight-'))
  try {
    const result = await runCapture(
      pythonPath,
      ['-c', buildAcsmDeviceFilePreflightCode()],
      {
        allowFailure: true,
        cwd: workDir,
        env: { PYTHONPATH: buildAcsmPythonPath(pluginDir, process.env['PYTHONPATH']) }
      }
    )
    if (result.exitCode === 0) return

    const detail = result.stderr.trim() || result.stdout.trim()
    throw InfraError(
      `ACSM device-file preflight failed${detail ? `: ${detail}` : ''}`,
      { stage: 'setup:acsm' }
    )
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}

export const buildAcsmFulfillWrapperScript = ({
  pluginDir,
  accountDir,
  pythonPath
}: AcsmWrapperPaths): string => `#!/usr/bin/env bash
set -euo pipefail

if [ "\${1:-}" = "--version" ]; then
  echo "${ACSM_FULFILL_COMMAND} AutoShow wrapper"
  exit 0
fi

if [ "$#" -ne 2 ]; then
  echo "usage: ${ACSM_FULFILL_COMMAND} <input.acsm> <output-dir>" >&2
  exit 2
fi

default_plugin_dir=${shellQuote(pluginDir)}
default_account_dir=${shellQuote(accountDir)}
default_python=${shellQuote(pythonPath)}

plugin_dir="\${AUTOSHOW_ACSM_PLUGIN_DIR:-$default_plugin_dir}"
account_dir="\${AUTOSHOW_ACSM_ACCOUNT_DIR:-$default_account_dir}"
python_bin="\${AUTOSHOW_ACSM_PYTHON:-$default_python}"
input_path="$1"
output_dir="$2"
fulfill_script="$plugin_dir/fulfill.py"

case "$input_path" in
  /*) input_abs="$input_path" ;;
  *) input_abs="$(pwd)/$input_path" ;;
esac

if [ ! -f "$input_abs" ]; then
  echo "ACSM input file was not found: $input_path" >&2
  exit 1
fi

if [ ! -f "$fulfill_script" ]; then
  echo "ACSM fulfillment setup is incomplete: fulfill.py was not found. Run: bun autoshow setup --step acsm" >&2
  exit 1
fi

if [ ! -x "$python_bin" ]; then
  echo "ACSM fulfillment setup is incomplete: managed Python was not found. Run: bun autoshow setup --step acsm" >&2
  exit 1
fi

for required in ${ACSM_ACCOUNT_REQUIRED_FILES.join(' ')}; do
  if [ ! -f "$account_dir/$required" ]; then
    echo "ACSM fulfillment is not authorized. Run runtime/bin/${ACSM_AUTHORIZE_COMMAND}, or copy activation.xml, device.xml, and devicesalt into $account_dir." >&2
    exit 1
  fi
done

mkdir -p "$output_dir"
work_dir="$(mktemp -d "\${TMPDIR:-/tmp}/autoshow-acsm-work.XXXXXX")"
cleanup() {
  rm -rf "$work_dir"
}
trap cleanup EXIT

cp "$account_dir/activation.xml" "$work_dir/activation.xml"
cp "$account_dir/device.xml" "$work_dir/device.xml"
cp "$account_dir/devicesalt" "$work_dir/devicesalt"

export PYTHONPATH="$plugin_dir/asn1crypto.zip/asn1crypto:$plugin_dir/oscrypto.zip/oscrypto:$plugin_dir\${PYTHONPATH:+:$PYTHONPATH}"

if ! (cd "$work_dir" && "$python_bin" "$fulfill_script" "$input_abs" > "$work_dir/fulfill.log" 2>&1); then
  echo "ACSM fulfillment failed. Inspect ${ACSM_FULFILL_COMMAND} setup and authorization locally." >&2
  exit 1
fi

outputs=()
while IFS= read -r output; do
  outputs+=("$output")
done < <(find "$work_dir" -maxdepth 1 -type f \\( -iname '*.epub' -o -iname '*.pdf' \\) | sort)

if [ "\${#outputs[@]}" -ne 1 ]; then
  echo "ACSM fulfillment failed or produced an invalid number of EPUB/PDF outputs." >&2
  exit 1
fi

mv "\${outputs[0]}" "$output_dir/"
`

export const buildAcsmAuthorizeWrapperScript = ({
  pluginDir,
  accountDir,
  pythonPath
}: AcsmWrapperPaths): string => `#!/usr/bin/env bash
set -euo pipefail

if [ "\${1:-}" = "--version" ]; then
  echo "${ACSM_AUTHORIZE_COMMAND} AutoShow wrapper"
  exit 0
fi

default_plugin_dir=${shellQuote(pluginDir)}
default_account_dir=${shellQuote(accountDir)}
default_python=${shellQuote(pythonPath)}

plugin_dir="\${AUTOSHOW_ACSM_PLUGIN_DIR:-$default_plugin_dir}"
account_dir="\${AUTOSHOW_ACSM_ACCOUNT_DIR:-$default_account_dir}"
python_bin="\${AUTOSHOW_ACSM_PYTHON:-$default_python}"
register_script="$plugin_dir/register_ADE_account.py"

if [ ! -f "$register_script" ]; then
  echo "ACSM authorization setup is incomplete: register_ADE_account.py was not found. Run: bun autoshow setup --step acsm" >&2
  exit 1
fi

if [ ! -x "$python_bin" ]; then
  echo "ACSM authorization setup is incomplete: managed Python was not found. Run: bun autoshow setup --step acsm" >&2
  exit 1
fi

mkdir -p "$account_dir"
export PYTHONPATH="$plugin_dir/asn1crypto.zip/asn1crypto:$plugin_dir/oscrypto.zip/oscrypto:$plugin_dir\${PYTHONPATH:+:$PYTHONPATH}"
cd "$account_dir"
exec "$python_bin" "$register_script"
`

const writeAcsmWrapperScripts = async (): Promise<void> => {
  await mkdir(RUNTIME_BIN_DIR, { recursive: true })
  const paths: AcsmWrapperPaths = {
    pluginDir: acsmCalibrePluginSourceDir,
    accountDir: acsmCalibrePluginAccountDir,
    pythonPath: pythonPathForEnv(acsmCalibrePluginPythonEnvDir)
  }
  await writeFile(acsmFulfillManagedBinaryPath, buildAcsmFulfillWrapperScript(paths))
  await writeFile(acsmAuthorizeManagedBinaryPath, buildAcsmAuthorizeWrapperScript(paths))
  await makeExecutable(acsmFulfillManagedBinaryPath)
  await makeExecutable(acsmAuthorizeManagedBinaryPath)
}

const ensureAcsmPluginFiles = async (): Promise<void> => {
  if (await Bun.file(join(acsmCalibrePluginSourceDir, 'fulfill.py')).exists()) {
    return
  }

  const { url, sha256 } = await readDependencyUrlAndSha256('acsm-calibre-plugin')
  await rm(acsmCalibrePluginSourceDir, { recursive: true, force: true })
  await mkdir(acsmCalibrePluginSourceDir, { recursive: true })
  await downloadFile({
    url,
    sha256,
    destination: acsmCalibrePluginSourceDir,
    mode: 'zip',
    expectedMinBytes: 100_000,
    flowId: 'acsm-calibre-plugin'
  })
}

const writeAccountReadme = async (): Promise<void> => {
  await mkdir(acsmCalibrePluginAccountDir, { recursive: true })
  const version = await readDependencyVersion('acsm-calibre-plugin') ?? 'unknown'
  await writeFile(
    join(acsmCalibrePluginAccountDir, 'README.txt'),
    [
      'AutoShow ACSM account directory',
      '',
      `Plugin version: ${version}`,
      '',
      `Run ${ACSM_AUTHORIZE_COMMAND} to create activation.xml, device.xml, and devicesalt here.`,
      'You can press Enter for anonymous authorization when prompted for an Adobe ID.',
      'These files are sensitive account activation material. Keep backups and do not commit them.'
    ].join('\n')
  )
}

// Authorization is separate from installation: the wrapper refuses to fulfill
// anything until these three files exist, and only an interactive Adobe login
// can create them.
export const isAcsmAuthorized = async (): Promise<boolean> => {
  for (const name of ACSM_ACCOUNT_REQUIRED_FILES) {
    if (!await Bun.file(join(acsmCalibrePluginAccountDir, name)).exists()) return false
  }
  return true
}

const hasAcsmFulfillmentInstall = async (): Promise<boolean> =>
  await Bun.file(join(acsmCalibrePluginSourceDir, 'fulfill.py')).exists()
  && await Bun.file(pythonPathForEnv(acsmCalibrePluginPythonEnvDir)).exists()
  && await Bun.file(acsmFulfillManagedBinaryPath).exists()
  && await Bun.file(acsmAuthorizeManagedBinaryPath).exists()

export const setupAcsmFulfillment = async (options: { printAuthorizeHint?: boolean } = {}): Promise<void> => {
  // Re-patching the plugin, re-running both Python preflights and rewriting the
  // wrappers on every setup made the authorize hint print on every run, which
  // trained the eye to read a real to-do as routine noise.
  if (!await hasAcsmFulfillmentInstall()) {
    l.write('info', 'Installing ACSM fulfillment support')
    await mkdir(acsmCalibrePluginToolDir, { recursive: true })
    await ensureAcsmPluginFiles()
    await patchAcsmPluginPython3Compatibility()
    await ensureAcsmPythonEnv()
    await runAcsmStandaloneImportPreflight({
      pluginDir: acsmCalibrePluginSourceDir,
      pythonPath: pythonPathForEnv(acsmCalibrePluginPythonEnvDir)
    })
    await runAcsmDeviceFilePreflight({
      pluginDir: acsmCalibrePluginSourceDir,
      pythonPath: pythonPathForEnv(acsmCalibrePluginPythonEnvDir)
    })
    await writeAccountReadme()
    await writeAcsmWrapperScripts()
    l.write('success', `ACSM fulfillment setup complete (${ACSM_FULFILL_COMMAND})`)
  }

  if (options.printAuthorizeHint !== false && !await isAcsmAuthorized()) {
    l.warn(`ACSM fulfillment is installed but not authorized. Run: ${acsmAuthorizeManagedBinaryPath}`)
  }
}

export const runAcsmAuthorization = async (): Promise<void> => {
  await setupAcsmFulfillment({ printAuthorizeHint: false })
  l.write('info', 'Starting ACSM authorization. Follow the prompts; press Enter at the Adobe ID prompt for anonymous authorization.')

  const proc = Bun.spawn([acsmAuthorizeManagedBinaryPath], {
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit'
  })
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    throw InfraError(`${ACSM_AUTHORIZE_COMMAND} failed with exit code ${exitCode}`, { stage: 'setup:acsm-authorize' })
  }

  l.write('success', 'ACSM authorization complete')
}
