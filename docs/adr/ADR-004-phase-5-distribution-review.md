# ADR-004 Phase 5 macOS Toolchain Distribution Review

## Status

- **Review Status:** Approved for the exact `r1` distribution described below
- **Review Date:** 2026-08-13
- **Repository Reviewer:** `github:ajcwebdev/repository-owner`
- **Project Compliance Reviewer:** `github:ajcwebdev/project-compliance-owner`
- **Scope:** MuPDF 1.27.2, qpdf 12.3.2, and the statically linked libjpeg-turbo 3.2.0 input used by the accepted macOS arm64/x64 producer

The same repository owner holds both designated roles in this sole-maintainer project. This is the project's recorded open-source distribution approval, not a representation that outside counsel supplied a legal opinion. It approves only the exact versions, source digests, build recipes, notices, package inventories, release revision, source-access plan, and reviewer identities below. Any change requires a new review reference before signing or publication.

## Approval References

| Component | Approval Reference | Result |
|---|---|---|
| MuPDF 1.27.2 | `ADR-004-P5-MUPDF-1.27.2-r1` | Approved for separate-executable AGPL-3.0-or-later conveyance under the same-release source-access and notice conditions in this record |
| qpdf 12.3.2 | `ADR-004-P5-QPDF-12.3.2-r1` | Approved for Apache-2.0 binary redistribution with the exact upstream license and notice |
| libjpeg-turbo 3.2.0 | `ADR-004-P5-LIBJPEG-TURBO-3.2.0-r1` | Approved for static inclusion in qpdf under the IJG and Modified BSD terms with the exact upstream roll-up license |

## Approved Source and Build Boundary

| Input | Exact Source Asset | SHA-256 | Approved Role |
|---|---|---|---|
| MuPDF 1.27.2 | `mupdf-1.27.2-source.tar.gz` | `553867b135303dc4c25ab67c5f234d8e900a0e36e66e8484d99adc05fe1e8737` | Complete upstream MuPDF source, bundled third-party code, fonts, CMaps, hyphenation data, build files, and license material for the standalone `mutool` executable |
| qpdf 12.3.2 | `qpdf-12.3.2.tar.gz` | `6cba2f9f2cd887d905faeb99e0e51a307b217920d1bbf3e9cfbb2e8178a2deda` | Complete upstream qpdf source for the standalone `qpdf` executable |
| libjpeg-turbo 3.2.0 | `libjpeg-turbo-3.2.0.tar.gz` | `6f30092cef9fb839779646608f4ee14ae3cbac989c47fa05e841b0841f09878e` | Complete upstream source for the static JPEG library linked into qpdf |

The approved build boundary is exactly the shared recipe already recorded by ADR-004: MuPDF is built with the repository's pinned release flags and no host crypto dependency; qpdf uses native crypto and only the pinned static libjpeg-turbo input; both outputs are thin executables with system-only dynamic linkage. AutoShow invokes each executable as a separately installed subprocess and does not link either program into the MIT-licensed AutoShow process. The MuPDF executable and AutoShow therefore ship as separate works in an aggregate; this approval does not relicense AutoShow or permit combining MuPDF code into AutoShow.

## Approved License and Notice Inventory

The machine-readable source of truth is `managed-toolchain-distribution-policy.ts`. Each executable package contains its binary, the closed embedded manifest, and only the approved notice paths below. The manifest and clean verifier reject any missing, additional, reordered, or renamed path, and the archive/package hashes bind the exact notice bytes.

The MuPDF package contains:

- `licenses/mupdf-COPYING`, copied verbatim from the pinned source archive.
- `licenses/mupdf-README`, copied verbatim from the pinned source archive to preserve the copyright, AGPL-3.0-or-later election, and warranty notice.
- `licenses/mupdf-THIRD-PARTY-NOTICES.txt`, deterministically assembled from the pinned source archive with a source-path heading before every verbatim notice. Its approved inputs cover Brotli, Extract, FreeType and the FreeType/BDF/PCF terms, Gumbo, HarfBuzz, jbig2dec, Little CMS, IJG libjpeg, MuJS, OpenJPEG, zlib, Adobe CMaps, Droid/Source Han/Noto/Charis SIL/URW fonts, and all 48 embedded TeX hyphenation-pattern notices.
- `licenses/DISTRIBUTION-NOTICE.txt`, generated from the closed policy and naming the exact corresponding-source asset, AutoShow producer-source archive, approval identity, no-warranty statement, and AGPL section 6(d) network-source method.

The qpdf package contains:

- `licenses/qpdf-LICENSE.txt`, copied verbatim from qpdf 12.3.2.
- `licenses/qpdf-NOTICE.md`, copied verbatim from qpdf 12.3.2 and retaining its embedded-code attributions.
- `licenses/libjpeg-turbo-LICENSE.md`, copied verbatim from libjpeg-turbo 3.2.0 and retaining the IJG attribution requirement, IJG notice, and Modified BSD terms.
- `licenses/DISTRIBUTION-NOTICE.txt`, generated from the closed policy and naming the exact source assets, AutoShow producer-source archive, approval identities, and no-warranty statement.

No separate written offer is used. MuPDF object code will be offered by network download alongside equivalent no-charge access to `mupdf-1.27.2-source.tar.gz` and the exact AutoShow tag archive on the same immutable release page, following the network-conveyance method in AGPL section 6(d). The distribution notice is mandatory in both tool packages. qpdf and libjpeg-turbo do not require corresponding-source conveyance under their approved permissive terms, but their exact source archives remain mandatory release assets for provenance and rebuildability.

## Approved Source References and Release Assets

The exact AutoShow producer source references are:

- MuPDF: `https://github.com/ajcwebdev/autoshow-cli/archive/refs/tags/toolchain-mupdf-1.27.2-r1.tar.gz`
- qpdf/libjpeg-turbo: `https://github.com/ajcwebdev/autoshow-cli/archive/refs/tags/toolchain-qpdf-12.3.2-r1.tar.gz`

The MuPDF release must include both architecture ZIPs, both release manifests, both SPDX SBOMs, `SHA256SUMS`, attestations, the exact MuPDF source asset, and the tag source archive. The qpdf release must include the equivalent binary/manifest/SBOM/checksum/attestation set, the exact qpdf and libjpeg-turbo source assets, and the tag source archive. Source directions must appear next to the downloadable binary assets and releases/tags must remain immutable while a supported AutoShow revision references them.

## Approved SBOM and Package Inventories

The SPDX 2.3 package inventory records exact independently downloaded producer inputs rather than inventing separate download identities for components already contained in the checksum-pinned MuPDF source archive:

| Tool Package | SPDX Source Packages | Declared Licenses |
|---|---|---|
| MuPDF | `mupdf` 1.27.2 at its exact URL and SHA-256 | `AGPL-3.0-or-later` |
| qpdf | `qpdf` 12.3.2 and `libjpeg-turbo` 3.2.0 at their exact URLs and SHA-256 values | `Apache-2.0`; `IJG AND BSD-3-Clause` |

The SBOM also records the exact executable path and SHA-256. The clean verifier reconstructs the complete expected SPDX document from the closed payload manifest and rejects any field or inventory drift. MuPDF's bundled component and resource obligations are captured by the exact complete source asset and the consolidated notice inputs above; they may not be removed merely because the top-level SPDX input inventory has one package.

Each unsigned or final executable ZIP has one top-level tool directory and exactly six regular files: the executable, its embedded payload manifest, and the four tool-specific approved notice files. No headers, static libraries, build trees, alternate executables, or unreviewed documentation may enter the archive. The outer verification/release manifest must repeat the exact component approval references, and both the outer and embedded references must match the closed repository policy.

## Sign-off and Change Control

`github:ajcwebdev/repository-owner` approves the repository, packaging, retention, source-availability, and release-boundary obligations recorded here. `github:ajcwebdev/project-compliance-owner` approves the exact MuPDF, qpdf, and libjpeg-turbo redistribution and notice plans recorded here. MuPDF publication remains conditioned on satisfying this record byte-for-byte; the approval is void for any other version, source digest, recipe, linked dependency, package path, SPDX inventory, source reference, release revision, or reviewer identity.

Phase 5 does not authorize signing, notarization, release creation, publication, or production metadata activation. Phase 6 remains the first phase allowed to introduce protected signing and draft-publication controls.
