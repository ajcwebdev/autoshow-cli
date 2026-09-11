import { XML } from "bun"
import { ValidationError } from '~/utils/error-handler'

export type XmlElement = Bun.XML.Node;

type XmlChild = XmlElement["children"][number];

export function localName(name: string): string {
  const separator = name.lastIndexOf(":");
  return separator === -1 ? name : name.slice(separator + 1);
}

export function isElement(child: XmlChild): child is XmlElement {
  return typeof child === "object" && child !== null && "name" in child;
}

export function directChildren(node: XmlElement, name: string): XmlElement[] {
  return node.children.filter((child): child is XmlElement => isElement(child) && localName(child.name) === name);
}

// Content controls wrap blocks, rows, or cells without changing their order.
// Only unwrap sdtContent; sdtPr contains control metadata, not document text.
export function contentChildren(node: XmlElement): XmlElement[] {
  return node.children.flatMap((child): XmlElement[] => {
    if (!isElement(child)) return [];
    if (localName(child.name) === "sdt") {
      return directChildren(child, "sdtContent").flatMap(contentChildren);
    }
    return [child];
  });
}

export function descendants(node: XmlElement, names: ReadonlySet<string>): XmlElement[] {
  const matches: XmlElement[] = [];
  for (const child of node.children) {
    if (!isElement(child)) continue;
    if (names.has(localName(child.name))) matches.push(child);
    matches.push(...descendants(child, names));
  }
  return matches;
}

export function nodeAttribute(node: XmlElement | undefined, name: string): string | undefined {
  return Object.entries(node?.attributes ?? {}).find(([attributeName]) => localName(attributeName) === name)?.[1];
}

export function parseDocxBody(xml: string, inputPath: string): XmlElement {
  let parsed: XmlElement;
  try {
    parsed = XML.parse(xml, { compact: false });
  } catch (error) {
    if (error instanceof SyntaxError) throw ValidationError(`Invalid word/document.xml: ${error.message}`, { stage: 'extract:docx-markdown', cause: error });
    throw error;
  }

  const documentNode = localName(parsed.name) === "document" ? parsed : undefined;
  const body = documentNode && descendants(documentNode, new Set(["body"]))[0];
  if (!body) throw ValidationError(`DOCX has no Word document body: ${inputPath}`, { stage: 'extract:docx-markdown' });

  return body;
}
