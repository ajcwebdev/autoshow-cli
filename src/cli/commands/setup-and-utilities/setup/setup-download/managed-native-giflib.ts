/**
 * The upstream static target avoids the shared libraries, utilities, and manual
 * generators pulled into `make all` and `make install` by GIFLIB's Makefile.
 */
export const GIFLIB_SOURCE_RECIPE = {
  version: '6.1.3',
  url: 'https://downloads.sourceforge.net/project/giflib/giflib-6.x/giflib-6.1.3.tar.gz',
  sha256: 'b65b66b99f0424b93525f987386f22fc5efb9da2bfc92ad4a532249aaffbab0e',
  archiveFormat: 'tar-gz',
  dependencies: [],
  buildSystem: 'make',
  configureArgs: [],
  makeArgs: ['CC=/usr/bin/clang', 'AR=/usr/bin/ar', 'CFLAGS=-std=gnu99 -O2 -fPIC'],
  buildTargets: ['libgif.a'],
  installFiles: [
    { source: 'libgif.a', destination: 'lib/libgif.a' },
    { source: 'gif_lib.h', destination: 'include/gif_lib.h' }
  ],
  healthFiles: ['lib/libgif.a', 'include/gif_lib.h'],
  noticeFiles: ['COPYING']
} as const
