function stripHtml(text) {
  return String(text || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&#91;/g, "[")
    .replace(/&#93;/g, "]")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRow(cols) {
  if (cols.length < 3) return null;
  const name = cols[1];
  let dist;

  if (cols.length === 4) {
    const last = cols[3];
    const mid = cols[2];
    if (/^[0-9]/.test(last) || last.includes(".")) {
      dist = mid;
    } else if (/^City/i.test(mid)) {
      dist = last;
    } else {
      dist = last;
    }
  } else if (cols.length === 5) {
    dist = cols[3];
  } else if (cols.length === 6) {
    dist = cols[4];
  } else {
    dist = cols[cols.length - 2];
  }

  dist = String(dist || "").trim();
  if (/^City/i.test(dist) || /^[0-9]{4}$/.test(dist)) return null;
  if (!name || !dist || /^[0-9]/.test(dist)) return null;
  return { name: name.trim(), dist };
}

function parseMarkdownTable(text) {
  const byDistrictEn = {};
  let count = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith("|") || line.includes("---") || line.includes("Sl.")) continue;
    const cols = line
      .split("|")
      .map((s) => s.trim())
      .filter((_, i, a) => i > 0 && i < a.length - 1);
    if (!/^[0-9]+$/.test(cols[0])) continue;
    if ((cols[1] || "").includes("(Div.)")) continue;
    const parsed = parseRow(cols);
    if (!parsed) continue;
    count++;
    if (!byDistrictEn[parsed.dist]) byDistrictEn[parsed.dist] = [];
    if (byDistrictEn[parsed.dist].indexOf(parsed.name) === -1) {
      byDistrictEn[parsed.dist].push(parsed.name);
    }
  }
  return { byDistrictEn, count };
}

function parseHtmlTable(text) {
  const byDistrictEn = {};
  let count = 0;
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRe.exec(text))) {
    const cells = [];
    const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch;
    while ((cellMatch = cellRe.exec(rowMatch[1]))) {
      cells.push(stripHtml(cellMatch[1]));
    }
    if (cells.length < 3) continue;
    if (/^Sl\.?$/i.test(cells[0])) continue;
    if (!/^[0-9]+$/.test(cells[0])) continue;
    if ((cells[1] || "").includes("(Div.)")) continue;
    const parsed = parseRow(cells);
    if (!parsed) continue;
    count++;
    if (!byDistrictEn[parsed.dist]) byDistrictEn[parsed.dist] = [];
    if (byDistrictEn[parsed.dist].indexOf(parsed.name) === -1) {
      byDistrictEn[parsed.dist].push(parsed.name);
    }
  }
  return { byDistrictEn, count };
}

export function parseBddataThanas(text) {
  if (/<table/i.test(text)) return parseHtmlTable(text);
  return parseMarkdownTable(text);
}
