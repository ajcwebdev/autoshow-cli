/** Source pins are official upstream release archives, verified before extraction. */
export type NativeDependencyRecipe = {
  version: string
  url: string
  sha256: string
  archiveFormat: 'tar-gz' | 'tar-xz' | 'tar-bz2'
  dependencies: readonly string[]
  buildSystem: 'cmake' | 'configure' | 'meson' | 'fonts'
  configureArgs: readonly string[]
  healthFiles: readonly string[]
  noticeFiles?: readonly string[]
  linkLibraries?: readonly string[]
}

const staticConfigure = ['--disable-shared', '--enable-static'] as const

export const NATIVE_DEPENDENCY_RECIPES = {
  zlib: {
    noticeFiles: ['LICENSE'],
    version: '1.3.1',
    url: 'https://zlib.net/fossils/zlib-1.3.1.tar.gz',
    sha256: '9a93b2b7dfdac77ceba5a558a580e74667dd6fede4585b91eefb60f03b72df23',
    archiveFormat: 'tar-gz', dependencies: [], buildSystem: 'configure',
    configureArgs: ['--static'], healthFiles: ['lib/libz.a', 'include/zlib.h']
  },
  libpng: {
    noticeFiles: ['LICENSE'],
    version: '1.6.47',
    url: 'https://github.com/pnggroup/libpng/archive/refs/tags/v1.6.47.tar.gz',
    sha256: '631a4c58ea6c10c81f160c4b21fa8495b715d251698ebc2552077e8450f30454',
    archiveFormat: 'tar-gz', dependencies: ['zlib'], buildSystem: 'cmake',
    configureArgs: ['-DPNG_SHARED=OFF', '-DPNG_STATIC=ON', '-DPNG_TESTS=OFF', '-DPNG_TOOLS=OFF'],
    healthFiles: ['lib/libpng16.a', 'include/png.h']
  },
  'libjpeg-turbo': {
    noticeFiles: ['LICENSE.md', 'README.ijg'],
    version: '3.2.0',
    url: 'https://github.com/libjpeg-turbo/libjpeg-turbo/releases/download/3.2.0/libjpeg-turbo-3.2.0.tar.gz',
    sha256: '6f30092cef9fb839779646608f4ee14ae3cbac989c47fa05e841b0841f09878e',
    archiveFormat: 'tar-gz', dependencies: [], buildSystem: 'cmake',
    configureArgs: ['-DENABLE_SHARED=OFF', '-DENABLE_STATIC=ON', '-DWITH_TURBOJPEG=OFF', '-DWITH_TOOLS=OFF', '-DWITH_TESTS=OFF'],
    healthFiles: ['lib/libjpeg.a', 'include/jpeglib.h']
  },
  libtiff: {
    noticeFiles: ['LICENSE.md'],
    version: '4.7.0',
    url: 'https://download.osgeo.org/libtiff/tiff-4.7.0.tar.gz',
    sha256: '67160e3457365ab96c5b3286a0903aa6e78bdc44c4bc737d2e486bcecb6ba976',
    archiveFormat: 'tar-gz', dependencies: ['zlib', 'libjpeg-turbo'], buildSystem: 'cmake',
    configureArgs: ['-DBUILD_SHARED_LIBS=OFF', '-Dtiff-tools=OFF', '-Dtiff-tests=OFF', '-Dtiff-contrib=OFF', '-Dtiff-docs=OFF', '-Djpeg=ON', '-Dzlib=ON', '-Dwebp=OFF', '-Dzstd=OFF', '-Dlzma=OFF', '-Djbig=OFF', '-Dlerc=OFF'],
    healthFiles: ['lib/libtiff.a', 'include/tiffio.h']
  },
  libwebp: {
    noticeFiles: ['COPYING'],
    version: '1.5.0',
    url: 'https://storage.googleapis.com/downloads.webmproject.org/releases/webp/libwebp-1.5.0.tar.gz',
    sha256: '7d6fab70cf844bf6769077bd5d7a74893f8ffd4dfb42861745750c63c2a5c92c',
    archiveFormat: 'tar-gz', dependencies: [], buildSystem: 'cmake',
    configureArgs: ['-DBUILD_SHARED_LIBS=OFF', '-DWEBP_BUILD_ANIM_UTILS=OFF', '-DWEBP_BUILD_CWEBP=OFF', '-DWEBP_BUILD_DWEBP=OFF', '-DWEBP_BUILD_GIF2WEBP=OFF', '-DWEBP_BUILD_IMG2WEBP=OFF', '-DWEBP_BUILD_VWEBP=OFF', '-DWEBP_BUILD_WEBPINFO=OFF', '-DWEBP_BUILD_WEBPMUX=OFF', '-DWEBP_BUILD_EXTRAS=OFF'],
    healthFiles: ['lib/libwebp.a', 'include/webp/decode.h']
  },
  expat: {
    noticeFiles: ['COPYING'],
    version: '2.7.1',
    url: 'https://github.com/libexpat/libexpat/releases/download/R_2_7_1/expat-2.7.1.tar.gz',
    sha256: '0cce2e6e69b327fc607b8ff264f4b66bdf71ead55a87ffd5f3143f535f15cfa2',
    archiveFormat: 'tar-gz', dependencies: [], buildSystem: 'cmake',
    configureArgs: ['-DEXPAT_SHARED_LIBS=OFF', '-DEXPAT_BUILD_TOOLS=OFF', '-DEXPAT_BUILD_EXAMPLES=OFF', '-DEXPAT_BUILD_TESTS=OFF', '-DEXPAT_BUILD_DOCS=OFF'],
    healthFiles: ['lib/libexpat.a', 'include/expat.h']
  },
  freetype: {
    noticeFiles: ['LICENSE.TXT', 'docs/FTL.TXT', 'docs/GPLv2.TXT'],
    version: '2.13.3',
    url: 'https://download.savannah.gnu.org/releases/freetype/freetype-2.13.3.tar.xz',
    sha256: '0550350666d427c74daeb85d5ac7bb353acba5f76956395995311a9c6f063289',
    archiveFormat: 'tar-xz', dependencies: ['zlib', 'libpng'], buildSystem: 'cmake',
    configureArgs: ['-DBUILD_SHARED_LIBS=OFF', '-DFT_REQUIRE_ZLIB=ON', '-DFT_REQUIRE_PNG=ON', '-DFT_DISABLE_HARFBUZZ=ON', '-DFT_DISABLE_BZIP2=ON', '-DFT_DISABLE_BROTLI=ON'],
    healthFiles: ['lib/libfreetype.a', 'include/freetype2/ft2build.h']
  },
  fribidi: {
    noticeFiles: ['COPYING'],
    version: '1.0.16',
    url: 'https://github.com/fribidi/fribidi/releases/download/v1.0.16/fribidi-1.0.16.tar.xz',
    sha256: '1b1cde5b235d40479e91be2f0e88a309e3214c8ab470ec8a2744d82a5a9ea05c',
    archiveFormat: 'tar-xz', dependencies: [], buildSystem: 'configure',
    configureArgs: [...staticConfigure, '--disable-docs'],
    healthFiles: ['lib/libfribidi.a', 'include/fribidi/fribidi.h']
  },
  harfbuzz: {
    noticeFiles: ['COPYING'],
    version: '10.4.0',
    url: 'https://github.com/harfbuzz/harfbuzz/releases/download/10.4.0/harfbuzz-10.4.0.tar.xz',
    sha256: '480b6d25014169300669aa1fc39fb356c142d5028324ea52b3a27648b9beaad8',
    archiveFormat: 'tar-xz', dependencies: ['freetype'], buildSystem: 'cmake',
    configureArgs: ['-DBUILD_SHARED_LIBS=OFF', '-DHB_HAVE_FREETYPE=ON', '-DHB_HAVE_CORETEXT=OFF', '-DHB_BUILD_UTILS=OFF', '-DHB_HAVE_GLIB=OFF', '-DHB_HAVE_GOBJECT=OFF', '-DHB_HAVE_ICU=OFF', '-DHB_HAVE_CAIRO=OFF', '-DHB_HAVE_INTROSPECTION=OFF', '-DHB_BUILD_SUBSET=OFF'],
    healthFiles: ['lib/libharfbuzz.a', 'include/harfbuzz/hb.h']
  },
  gperf: {
    noticeFiles: ['COPYING'],
    version: '3.1',
    url: 'https://ftp.gnu.org/gnu/gperf/gperf-3.1.tar.gz',
    sha256: '588546b945bba4b70b6a3a616e80b4ab466e3f33024a352fc2198112cdbb3ae2',
    archiveFormat: 'tar-gz', dependencies: [], buildSystem: 'configure',
    configureArgs: [], healthFiles: ['bin/gperf']
  },
  fontconfig: {
    noticeFiles: ['COPYING'],
    version: '2.16.0',
    url: 'https://www.freedesktop.org/software/fontconfig/release/fontconfig-2.16.0.tar.xz',
    sha256: '6a33dc555cc9ba8b10caf7695878ef134eeb36d0af366041f639b1da9b6ed220',
    archiveFormat: 'tar-xz', dependencies: ['freetype', 'expat', 'gperf'], buildSystem: 'configure',
    configureArgs: [...staticConfigure, '--disable-docs', '--disable-nls', '--disable-cache-build', '--disable-libxml2', '--disable-iconv', '--with-default-fonts=none', '--with-add-fonts=none'],
    healthFiles: ['lib/libfontconfig.a', 'bin/fc-match', 'bin/fc-cache']
  },
  libass: {
    noticeFiles: ['COPYING'],
    version: '0.17.5',
    url: 'https://github.com/libass/libass/releases/download/0.17.5/libass-0.17.5.tar.gz',
    sha256: 'caab4b993dd7be6187c55623b789ed75dddefea6e65938af134637c732fe094a',
    archiveFormat: 'tar-gz', dependencies: ['freetype', 'fribidi', 'harfbuzz', 'fontconfig', 'libiconv'], buildSystem: 'configure',
    configureArgs: [...staticConfigure, '--enable-fontconfig', '--disable-coretext', '--disable-libunibreak', '--disable-asm'],
    healthFiles: ['lib/libass.a', 'include/ass/ass.h']
  },
  x264: {
    noticeFiles: ['COPYING'],
    version: 'b35605ace3ddf7c1a5d67a2eb553f034aef41d55',
    url: 'https://code.videolan.org/videolan/x264/-/archive/b35605ace3ddf7c1a5d67a2eb553f034aef41d55/x264-b35605ace3ddf7c1a5d67a2eb553f034aef41d55.tar.gz',
    sha256: 'cd71a7515b0e9a012e1ac9b1f8415bebcaf6fc97d4db32286642ac4c0fbe24f9',
    archiveFormat: 'tar-gz', dependencies: [], buildSystem: 'configure',
    configureArgs: ['--enable-static', '--disable-cli', '--disable-opencl', '--enable-pic'],
    healthFiles: ['lib/libx264.a', 'include/x264.h']
  },
  libffi: {
    noticeFiles: ['LICENSE', 'LICENSE-BUILDTOOLS'],
    version: '3.4.8',
    url: 'https://github.com/libffi/libffi/releases/download/v3.4.8/libffi-3.4.8.tar.gz',
    sha256: 'bc9842a18898bfacb0ed1252c4febcc7e78fa139fd27fdc7a3e30d9d9356119b',
    archiveFormat: 'tar-gz', dependencies: [], buildSystem: 'configure',
    configureArgs: [...staticConfigure, '--disable-docs'], healthFiles: ['lib/libffi.a', 'include/ffi.h']
  },
  libiconv: {
    noticeFiles: ['COPYING.LIB', 'COPYING'],
    version: '1.18',
    url: 'https://ftp.gnu.org/gnu/libiconv/libiconv-1.18.tar.gz',
    sha256: '3b08f5f4f9b4eb82f151a7040bfd6fe6c6fb922efe4b1659c66ea933276965e8',
    archiveFormat: 'tar-gz', dependencies: [], buildSystem: 'configure',
    configureArgs: [...staticConfigure, '--disable-nls'],
    healthFiles: ['lib/libiconv.a', 'include/iconv.h']
  },
  pcre2: {
    noticeFiles: ['LICENCE.md', 'COPYING'],
    version: '10.45',
    url: 'https://github.com/PCRE2Project/pcre2/releases/download/pcre2-10.45/pcre2-10.45.tar.gz',
    sha256: '0e138387df7835d7403b8351e2226c1377da804e0737db0e071b48f07c9d12ee',
    archiveFormat: 'tar-gz', dependencies: [], buildSystem: 'cmake',
    configureArgs: ['-DBUILD_SHARED_LIBS=OFF', '-DPCRE2_BUILD_TESTS=OFF', '-DPCRE2_BUILD_PCRE2GREP=OFF', '-DPCRE2_SUPPORT_JIT=OFF', '-DPCRE2_BUILD_PCRE2_16=OFF', '-DPCRE2_BUILD_PCRE2_32=OFF'],
    healthFiles: ['lib/libpcre2-8.a', 'include/pcre2.h']
  },
  'proxy-libintl': {
    noticeFiles: ['COPYING'],
    // This is the exact fallback commit pinned by the GLib release below.
    version: '33934de09af6a6627eb44e310a8079df009abdbb',
    url: 'https://github.com/frida/proxy-libintl/archive/33934de09af6a6627eb44e310a8079df009abdbb.tar.gz',
    sha256: '4ab5af85ec6124cb526a15c58bbc0877d241807e30855779808dbf9292d861aa',
    archiveFormat: 'tar-gz', dependencies: [], buildSystem: 'meson', configureArgs: [],
    healthFiles: ['lib/libintl.a', 'include/libintl.h']
  },
  glib: {
    // Meson's builtin text-library detectors do not inspect extra static-library
    // search directories. Supply the managed archives for their link probes.
    linkLibraries: ['intl', 'iconv'],
    noticeFiles: ['COPYING'],
    version: '2.84.4',
    url: 'https://download.gnome.org/sources/glib/2.84/glib-2.84.4.tar.xz',
    sha256: '8a9ea10943c36fc117e253f80c91e477b673525ae45762942858aef57631bb90',
    archiveFormat: 'tar-xz', dependencies: ['libffi', 'libiconv', 'pcre2', 'zlib', 'proxy-libintl'], buildSystem: 'meson',
    configureArgs: ['-Dprefer_static=false', '-Dtests=false', '-Dinstalled_tests=false', '-Ddocumentation=false', '-Dman-pages=disabled', '-Dnls=disabled', '-Dintrospection=disabled', '-Dlibmount=disabled', '-Dselinux=disabled', '-Dlibelf=disabled', '-Ddtrace=disabled', '-Dsystemtap=disabled', '-Dsysprof=disabled'],
    healthFiles: ['lib/libglib-2.0.a', 'lib/libgobject-2.0.a', 'lib/libgio-2.0.a']
  },
  pixman: {
    noticeFiles: ['COPYING'],
    version: '0.44.2',
    url: 'https://cairographics.org/releases/pixman-0.44.2.tar.gz',
    sha256: '6349061ce1a338ab6952b92194d1b0377472244208d47ff25bef86fc71973466',
    archiveFormat: 'tar-gz', dependencies: [], buildSystem: 'meson',
    configureArgs: ['-Dtests=disabled', '-Ddemos=disabled', '-Dgtk=disabled', '-Dlibpng=disabled', '-Dopenmp=disabled'],
    healthFiles: ['lib/libpixman-1.a', 'include/pixman-1/pixman.h']
  },
  cairo: {
    noticeFiles: ['COPYING', 'COPYING-LGPL-2.1', 'COPYING-MPL-1.1'],
    version: '1.18.4',
    url: 'https://cairographics.org/releases/cairo-1.18.4.tar.xz',
    sha256: '445ed8208a6e4823de1226a74ca319d3600e83f6369f99b14265006599c32ccb',
    archiveFormat: 'tar-xz', dependencies: ['zlib', 'libpng', 'freetype', 'fontconfig', 'pixman'], buildSystem: 'meson',
    configureArgs: ['-Dtests=disabled', '-Dgtk_doc=false', '-Dglib=disabled', '-Dfontconfig=enabled', '-Dfreetype=enabled', '-Dpng=enabled', '-Dzlib=enabled', '-Dquartz=disabled', '-Dxcb=disabled', '-Dxlib=disabled', '-Dlzo=disabled', '-Dspectre=disabled', '-Dsymbol-lookup=disabled'],
    healthFiles: ['lib/libcairo.a', 'include/cairo/cairo.h']
  },
  pango: {
    noticeFiles: ['COPYING'],
    version: '1.56.4',
    url: 'https://download.gnome.org/sources/pango/1.56/pango-1.56.4.tar.xz',
    sha256: '17065e2fcc5f5a5bdbffc884c956bfc7c451a96e8c4fb2f8ad837c6413cb5a01',
    archiveFormat: 'tar-xz', dependencies: ['glib', 'harfbuzz', 'fribidi', 'fontconfig', 'cairo'], buildSystem: 'meson',
    configureArgs: ['-Ddocumentation=false', '-Dman-pages=false', '-Dintrospection=disabled', '-Dbuild-testsuite=false', '-Dbuild-examples=false', '-Dfontconfig=enabled', '-Dfreetype=enabled', '-Dcairo=enabled', '-Dlibthai=disabled', '-Dxft=disabled'],
    healthFiles: ['lib/libpango-1.0.a', 'lib/libpangocairo-1.0.a', 'bin/pango-view']
  },
  imagemagick: {
    noticeFiles: ['LICENSE', 'NOTICE'],
    version: '7.1.2-35',
    url: 'https://github.com/ImageMagick/ImageMagick/archive/refs/tags/7.1.2-35.tar.gz',
    sha256: '40b6fefa88fe16ca5a4b3d3db5133eaebfb0157f21f98530bde8aec5dd5b0776',
    archiveFormat: 'tar-gz', dependencies: ['zlib', 'libpng', 'libjpeg-turbo', 'libtiff', 'libwebp', 'freetype', 'fontconfig'], buildSystem: 'configure',
    configureArgs: [...staticConfigure, '--disable-openmp', '--disable-opencl', '--disable-docs', '--disable-hdri', '--enable-legacy-support', '--without-modules', '--without-perl', '--without-magick-plus-plus', '--without-x', '--without-bzlib', '--without-zstd', '--without-djvu', '--without-raqm', '--without-heic', '--without-jbig', '--without-jxl', '--without-lcms', '--without-openjp2', '--without-lqr', '--without-lzma', '--without-openexr', '--without-pango', '--without-raw', '--without-xml', '--with-png=yes', '--with-jpeg=yes', '--with-tiff=yes', '--with-webp=yes', '--with-freetype=yes', '--with-fontconfig=yes'],
    healthFiles: ['bin/magick', 'bin/convert', 'lib/libMagickCore-7.Q16.a']
  },
  'dejavu-fonts': {
    noticeFiles: ['LICENSE'],
    version: '2.37',
    url: 'https://github.com/dejavu-fonts/dejavu-fonts/releases/download/version_2_37/dejavu-fonts-ttf-2.37.tar.bz2',
    sha256: 'fa9ca4d13871dd122f61258a80d01751d603b4d3ee14095d65453b4e846e17d7',
    archiveFormat: 'tar-bz2', dependencies: [], buildSystem: 'fonts', configureArgs: [],
    healthFiles: ['share/fonts/truetype/dejavu/DejaVuSans.ttf', 'share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']
  }
} as const satisfies Record<string, NativeDependencyRecipe>

export type NativeDependencyName = keyof typeof NATIVE_DEPENDENCY_RECIPES

export const NATIVE_RENDERING_DEPENDENCIES = ['libass', 'imagemagick', 'pango', 'dejavu-fonts'] as const satisfies readonly NativeDependencyName[]
