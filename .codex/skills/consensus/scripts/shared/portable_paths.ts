import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SCRIPT_REPO_ROOT = resolve(import.meta.dir, "../../../../..");

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function projectRoots(): string[] {
  return [...new Set([SCRIPT_REPO_ROOT, process.cwd()].map((root) => resolve(root)))]
    .filter((root) => root !== "/")
    .sort((left, right) => right.length - left.length);
}

// Rewrites absolute checkout paths (and file: URLs for them) to repo-relative paths so committed reports never embed a machine-specific location.
export function toPortableText(text: string): string {
  let next = text;
  for (const root of projectRoots()) {
    const pattern = new RegExp(`(?:file://)?${escapeRegExp(root)}(/|(?![\\w.-]))`, "g");
    next = next.replace(pattern, (_match, slash: string) => (slash === "/" ? "" : "."));
  }
  return next;
}

export function writePortableFileSync(path: string, content: string): void {
  writeFileSync(path, toPortableText(content));
}
