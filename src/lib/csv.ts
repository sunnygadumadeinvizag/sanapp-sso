/**
 * Minimal RFC-4180-style CSV parsing/serializing used by the user import.
 * Handles quoted fields, embedded commas/quotes/newlines, and CRLF line endings.
 */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  // Strip a UTF-8 BOM if present.
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else if (ch === "\r") {
      // ignore — \n handles the line break
    } else {
      field += ch;
    }
  }

  // Last field/row (no trailing newline).
  row.push(field);
  rows.push(row);

  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

function escapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map((c) => escapeCell(c ?? "")).join(",")).join("\r\n");
}
