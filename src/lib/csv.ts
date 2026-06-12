/** Minimal RFC-4180 CSV writer (UTF-8 with BOM so Excel opens it cleanly). */

export function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(rows: string[][]): string {
  const body = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
  return "﻿" + body + "\r\n";
}
