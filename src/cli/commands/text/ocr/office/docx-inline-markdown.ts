import type { XmlElement } from './docx-body-reader'
import { descendants, directChildren, isElement, localName, nodeAttribute } from './docx-body-reader'

const numberPattern = /^([-+])?(0*)([0-9]*(\.[0-9]*)?)$/;

const exponentPattern = /^([-+])?(0*)(\d*(\.\d*)?[eE][-+]?\d+)$/;

const hexPattern = /^[-+]?0x[a-fA-F0-9]+$/;

function trimNumericZeros(value: string): string {
  if (!value.includes(".")) return value;
  const trimmed = value.replace(/0+$/, "");
  if (trimmed === ".") return "0";
  if (trimmed.startsWith(".")) return `0${trimmed}`;
  return trimmed.endsWith(".") ? trimmed.slice(0, -1) : trimmed;
}

function legacyTextValue(value: string): string {
  if (!value || value.trim() !== value || value === "true" || value === "false") return value;
  if (value === "0") return value;
  if (hexPattern.test(value)) return String(Number.parseInt(value, 16));

  if (/.+[eE].+/.test(value)) {
    const notation = value.match(exponentPattern);
    if (!notation) return value;
    const sign = notation[1] ?? "";
    const leadingZeros = notation[2] ?? "";
    const exponential = notation[3]!;
    const exponentCharacter = exponential.includes("e") ? "e" : "E";
    const exponentAdjacentToZeros = value[leadingZeros.length + (sign ? 1 : 0)] === exponentCharacter;
    if (leadingZeros.length > 1 && exponentAdjacentToZeros) return value;
    if (
      leadingZeros.length === 1 &&
      (exponential.startsWith(`.${exponentCharacter}`) || exponential.startsWith(exponentCharacter))
    ) {
      return String(Number(value));
    }
    return exponentAdjacentToZeros ? value : String(Number(`${sign}${exponential}`));
  }

  const match = value.match(numberPattern);
  if (!match) return value;
  const sign = match[1] ?? "";
  const leadingZeros = match[2] ?? "";
  const numericWithoutLeadingZeros = trimNumericZeros(match[3]!);
  const number = Number(value);
  const parsed = String(number);
  if (number === 0) return parsed;
  if (/[eE]/.test(parsed)) return parsed;
  if (value.includes(".")) {
    return parsed === numericWithoutLeadingZeros || parsed === `${sign}${numericWithoutLeadingZeros}` ? parsed : value;
  }
  const comparable = leadingZeros ? numericWithoutLeadingZeros : value;
  return comparable === parsed || comparable === `${sign}${parsed}` ? parsed : value;
}

function nodeText(node: XmlElement): string {
  return node.children
    .map((child) => (typeof child === "string" ? legacyTextValue(child) : isElement(child) ? nodeText(child) : ""))
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
