import { expect, test } from 'bun:test'
import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { hostname, tmpdir } from 'node:os'
import { basename, dirname, join, relative } from 'node:path'
import { snapshotProjectDependencyGraph } from '~/tools/project-runtime-dependencies'
import { SOURCE_ROOT } from '~/utils/project-root'

const families = [
  { name: 'Bun', root: 'tools/bun', tool: 'bun', label: 'Managed Bun worker' },
  { name: 'Deno', root: 'tools/deno', tool: 'deno', label: 'Downloader JavaScript runtime' },
  { name: 'alignment', root: 'tools/stt-alignment', label: 'Local alignment runtime' },
  { name: 'Defuddle', root: 'defuddle', label: 'defuddle' },
  { name: 'native rendering', root: 'tools/native/imagemagick', tool: 'magick', label: 'ImageMagick sheets and TIFF' },
  { name: 'transitive native dependency', root: 'tools/native/freetype', tool: 'ffmpeg', label: 'ffmpeg' },
  { name: 'FFmpeg', root: 'tools/ffmpeg', tool: 'ffmpeg', label: 'ffmpeg' },
  { name: 'Tesseract', root: 'tools/tesseract', tool: 'tesseract', label: 'tesseract' },
  { name: 'Calibre', root: 'tools/calibre', tool: 'ebook-convert', label: 'ebook-convert' },
  { name: 'MuPDF', root: 'tools/mupdf', tool: 'mutool', label: 'mutool' },
  { name: 'qpdf', root: 'tools/qpdf', tool: 'qpdf', label: 'qpdf' },
  { name: 'Linux toolchain', root: 'tools/linux-root', tool: 'ffmpeg', label: 'ffmpeg', platform: 'linux' },
  { name: 'bootstrap toolchain', root: 'tools/build-tools/cmake', tool: 'cmake', label: 'Managed CMake' },
  { name: 'copied rendering fonts', root: 'fonts/dejavu', label: 'Managed rendering fonts' }
] as const

for (const family of families) {
  test(`doctor rejects the pending ${family.name} transaction without recovering or launching its candidate`, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'autoshow-doctor-pending-'))
    const project = join(directory, 'project')
    const runtime = join(project, 'runtime')
    const destination = join(runtime, family.root)
    const id = crypto.randomUUID()
    const backup = `${destination}.backup-${id}`
    const journal = join(dirname(destination), `.${basename(destination)}.transaction.json`)
    try {
      for (const root of [destination, backup]) {
        await mkdir(root, { recursive: true })
        await writeFile(join(root, 'payload'), root === destination ? 'candidate bytes\n' : 'previous verified bytes\n')
        await chmod(join(root, 'payload'), 0o640)
        await symlink('payload', join(root, 'resource-link'))
      }
      const transaction = {
        schemaVersion: 1, id, phase: 'candidate-promoted', ownerPid: process.pid, ownerHost: hostname(), hadPreviousInstall: true,
        destination: relative(runtime, destination), staging: relative(runtime, `${destination}.staging-${id}`),
        backup: relative(runtime, backup), evidence: relative(runtime, join(dirname(destination), `.${basename(destination)}.interrupted-${id}`))
      }
      await writeFile(journal, `${JSON.stringify(transaction)}\n`, { mode: 0o600 })
      if ('tool' in family) {
        await mkdir(join(runtime, 'bin'), { recursive: true })
        await writeFile(join(runtime, 'bin', family.tool), '#!/bin/sh\nexit 97\n', { mode: 0o755 })
      }
      const before = await snapshotProjectDependencyGraph(runtime)
      const source = `
        import {createDoctorToolProvenance} from ${JSON.stringify(join(SOURCE_ROOT, 'src/cli/commands/setup-and-utilities/setup/doctor-tool-provenance.ts'))};
        import {collectDoctorReport,runDoctor} from ${JSON.stringify(join(SOURCE_ROOT, 'src/cli/commands/setup-and-utilities/setup/run-doctor.ts'))};
        import {reconfigureLogger} from ${JSON.stringify(join(SOURCE_ROOT, 'src/utils/app-logger/app-logger.ts'))};
        reconfigureLogger({quiet:true});
        const family=${JSON.stringify(family)};
        const provenance=createDoctorToolProvenance({platform:family.platform??'darwin'});
        const healthy=async()=>({healthy:true,detail:'synthetic independent installed payload verified'});
        let launches=0;
        const probes={
          bunVersion:Bun.version,platform:family.platform??'darwin',env:{},which:()=>undefined,
          pathExists:async()=>true,listDirectory:async()=>[],directoryHasFiles:async()=>true,executeReadOnlyTools:false,
          validateRuntimeTool:async(tool,path)=>tool===family.tool?await provenance.validateRuntimeTool(tool,path):await healthy(),
          validateRenderingConfiguration:family.name==='copied rendering fonts'?provenance.validateRenderingConfiguration:healthy,
          validateAlignmentRuntime:family.name==='alignment'?provenance.validateAlignmentRuntime:healthy,
          validateProjectDependencies:healthy,validateWhisperfile:healthy,validateTesseractData:healthy,
          resolveTessdataPrefix:()=>undefined,
          readDefuddleCliReadiness:async()=>{
            const result=family.name==='Defuddle'?await provenance.validateDefuddleRuntime():await healthy();
            return {label:'defuddle',status:result.healthy?'OK':'WARN',detail:result.healthy?result.detail:result.reason,severity:result.healthy?'info':'warn'};
          },
          run:async()=>{launches++;return {exitCode:0,stdout:'synthetic',stderr:''}},
          resolveYtDlpBinaryInfo:()=>undefined,resolveConfigPath:async()=>'/fixture/config.json',loadConfig:async()=>({}),
          inspectYtDlpAuthState:async()=>({configuredMode:'none',usableMode:'none',cookieArgs:[]}),
          validateManagedArtifact:async()=>({healthy:true,distribution:'source',version:'1',platform:'darwin',architecture:'arm64'})
        };
        const report=await collectDoctorReport(probes);
        let strictExit;
        try{await runDoctor({strict:true,probeOverrides:probes})}catch(error){strictExit=error.exitCode}
        console.log(JSON.stringify({check:report.sections.flatMap(section=>section.checks).find(check=>check.label===family.label),strictExit,launches}));
      `
      const child = Bun.spawn([process.execPath, '--no-env-file', '-e', source], {
        cwd: SOURCE_ROOT,
        env: { PATH: '/usr/bin:/bin', AUTOSHOW_PROJECT_ROOT: project, BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0', NO_COLOR: '1' },
        stdin: 'ignore', stdout: 'pipe', stderr: 'pipe'
      })
      const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
      expect(code, stderr).toBe(0)
      const result = JSON.parse(stdout.trim())
      expect(result.check).toMatchObject({ status: 'WARN' })
      expect(result.check.detail).toContain('unfinished candidate-promoted transaction')
      expect(result.strictExit).toBe(2)
      expect(result.launches).toBe(0)
      expect(await snapshotProjectDependencyGraph(runtime)).toEqual(before)
    } finally { await rm(directory, { recursive: true, force: true }) }
  }, 15000)
}
