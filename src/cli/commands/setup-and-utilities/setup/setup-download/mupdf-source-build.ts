export const MUPDF_SOURCE_BUILD_FLAGS = [
  'build=release',
  'HAVE_X11=no',
  'HAVE_GLUT=no',
  'HAVE_OBJCOPY=no',
  'HAVE_LIBCRYPTO=no'
] as const

export const buildMupdfMakeArguments = (parallelJobs: number): string[] => [
  '-j', String(parallelJobs),
  ...MUPDF_SOURCE_BUILD_FLAGS
]
