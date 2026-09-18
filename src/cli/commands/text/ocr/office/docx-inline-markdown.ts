import type { XmlElement } from './docx-body-reader'
import { descendants, directChildren, isElement, localName, nodeAttribute } from './docx-body-reader'

function nodeText(node: XmlElement): string {
  return node.children
    .map((child) => (typeof child === "string" ? child : isElement(child) ? nodeText(child) : ""))
    .join("");
}

function runMarkdown(run: XmlElement): string {
  const text = descendants(run, new Set(["t", "tab", "br"]))
    .map((node) => {
      switch (localName(node.name)) {
        case "tab":
          return " ";
        case "br":
          return nodeAttribute(node, "type") === "page" ? "" : "<br>";
        default:
          return nodeText(node);
      }
    })
    .join("");

  if (!text) return "";

  const properties = directChildren(run, "rPr")[0];
  const boldNode = properties && directChildren(properties, "b")[0];
  const italicNode = properties && directChildren(properties, "i")[0];
  const bold = Boolean(boldNode) && nodeAttribute(boldNode, "val") !== "0";
  const italic = Boolean(italicNode) && nodeAttribute(italicNode, "val") !== "0";
  const marker = bold && italic ? "***" : bold ? "**" : italic ? "_" : undefined;
  if (!marker) return text;

  const leading = text.match(/^\s*/)?.[0] ?? "";
  const trailing = text.match(/\s*$/)?.[0] ?? "";
  const core = text.trim();
  return core ? `${leading}${marker}${core}${marker}${trailing}` : text;
}

export function paragraphText(paragraph: XmlElement): string {
  return descendants(paragraph, new Set(["r"]))
    .map(runMarkdown)
    .join("")
    .trim();
}

export function plainParagraphText(paragraph: XmlElement): string {
  return descendants(paragraph, new Set(["t"]))
    .map(nodeText)
    .join("")
    .trim();
}

export function paragraphStyle(paragraph: XmlElement): string {
  const properties = directChildren(paragraph, "pPr")[0];
  const style = properties && directChildren(properties, "pStyle")[0];
  return nodeAttribute(style, "val") ?? "Normal";
}
