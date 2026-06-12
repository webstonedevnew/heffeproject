import { describe, it, expect } from "vitest";
import { csvEscape, toCsv } from "@/lib/csv";

describe("csvEscape", () => {
  it("passes plain values through", () => {
    expect(csvEscape("Anna")).toBe("Anna");
  });
  it("quotes values containing commas", () => {
    expect(csvEscape("Doe, Anna")).toBe('"Doe, Anna"');
  });
  it("doubles embedded quotes", () => {
    expect(csvEscape('the "knower"')).toBe('"the ""knower"""');
  });
  it("quotes values containing newlines", () => {
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
  });
});

describe("toCsv", () => {
  it("produces CRLF rows with a UTF-8 BOM for Excel", () => {
    const csv = toCsv([
      ["Student", "Posted"],
      ["Anna, D.", "yes"],
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('Student,Posted\r\n"Anna, D.",yes\r\n');
  });
});
