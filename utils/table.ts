// Builds an aligned table that auto-sizes each column to its widest value
export function renderTable(
  headers: string[],
  rows: (string | number)[][],
): string {
  const cols = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => String(r[i]).length)),
  );

  const line = (cells: (string | number)[]): string =>
    "│ " +
    cells.map((c, i) => String(c).padEnd(cols[i])).join(" │ ") +
    " │";

  const divider = (l: string, m: string, r: string): string =>
    l + cols.map((w) => "─".repeat(w + 2)).join(m) + r;

  return [
    divider("┌", "┬", "┐"),
    line(headers),
    divider("├", "┼", "┤"),
    ...rows.map(line),
    divider("└", "┴", "┘"),
  ].join("\n");
}
