import { REFERENCE_NOTICES } from './reference-notices';
import type { NoticeType, RecallClass, RegulatoryNoticeSource } from './types';

const EDA_BASE_URL = 'https://www.edaegypt.gov.eg';
const EDA_2026_URL = `${EDA_BASE_URL}/en/awareness/recalls-alerts-and-awareness-letters/recalls-and-alerts-notice-letters/2026/`;
const EDA_2025_URL = `${EDA_BASE_URL}/en/awareness/recalls-alerts-and-awareness-letters/recalls-and-alerts-notice-letters/2025/`;

export interface FetchEdaOptions {
  allowLive?: boolean;
  timeoutMs?: number;
}

export function parseRecallClass(text: string): RecallClass | null {
  const trimmed = text.trim().toUpperCase();
  if (trimmed === 'I' || trimmed === 'CLASS I' || trimmed === 'CLASS_I') return 'CLASS_I';
  if (trimmed === 'II' || trimmed === 'CLASS II' || trimmed === 'CLASS_II') return 'CLASS_II';
  if (trimmed === 'III' || trimmed === 'CLASS III' || trimmed === 'CLASS_III') return 'CLASS_III';
  return null;
}

export function parseNoticeType(typeText: string, recallClass: RecallClass | null): NoticeType {
  const lower = typeText.toLowerCase().trim();
  if (lower.includes('fraud') || lower.includes('counterfeit') || lower.includes('غش')) {
    return 'COMMERCIAL_FRAUD';
  }
  if (lower.includes('recall') || lower.includes('سحب') || recallClass !== null) {
    return 'RECALL';
  }
  if (lower.includes('alert') || lower.includes('تحذير')) {
    return 'ALERT';
  }
  if (lower.includes('awareness') || lower.includes('توعية')) {
    return 'AWARENESS';
  }
  return 'ALERT';
}

export function cleanHtmlText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function createChecksum(content: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < content.length; i++) {
    const code = content.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= (code + i);
    h2 = Math.imul(h2, 0x27d4eb2d);
  }
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const part3 = ((h1 ^ h2) >>> 0).toString(16).padStart(8, '0');
  const part4 = ((h1 + h2) >>> 0).toString(16).padStart(8, '0');
  return `${part1}${part2}${part3}${part4}${part1}${part2}${part3}${part4}`;
}

export function parseEdaTableHtml(
  html: string,
  year: number,
  retrievedAt: string = new Date().toISOString()
): RegulatoryNoticeSource[] {
  const notices: RegulatoryNoticeSource[] = [];

  // Match table rows: <tr>...</tr>
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowHtml = rowMatch[1];
    if (rowHtml.includes('<th')) continue; // Skip header row

    // Match <td> cells: <td>...</td>
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      cells.push(cellMatch[1].trim());
    }

    if (cells.length < 4) continue;

    // Typical EDA Table columns: [Class, Report Title/Link, Type, Product Name]
    const rawClass = cleanHtmlText(cells[0]);
    const rawReport = cells[1];
    const rawType = cleanHtmlText(cells[2]);
    const rawProduct = cleanHtmlText(cells[3]);

    // Extract PDF / link URL
    const linkMatch = /href=["']([^"']+)["']/i.exec(rawReport);
    let sourceUrl = `${EDA_BASE_URL}/en/awareness/recalls-alerts-and-awareness-letters/`;
    if (linkMatch) {
      const href = linkMatch[1];
      sourceUrl = href.startsWith('http') ? href : `${EDA_BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;
    }

    const reportTitle = cleanHtmlText(rawReport);
    const recallClass = parseRecallClass(rawClass);
    const noticeType = parseNoticeType(rawType, recallClass);

    if (reportTitle && rawProduct) {
      const sourceChecksum = createChecksum(`${reportTitle}|${rawProduct}|${year}`);

      // Extract batch numbers if mentioned in title or product name
      const batchMatches = (reportTitle + ' ' + rawProduct).match(/batch(?:es)?\s*(?:no\.?|#)?\s*([a-zA-Z0-9\-_,\s]+)/i);
      const batchNumbers = batchMatches
        ? batchMatches[1].split(/[,\s]+/).map((b) => b.trim()).filter(Boolean)
        : [];

      notices.push({
        noticeNumber: reportTitle,
        title: `${rawProduct} (${reportTitle})`,
        year,
        noticeType,
        recallClass,
        productName: rawProduct,
        manufacturer: null,
        batchNumbers,
        registrationNumber: null,
        reason: rawType || 'Regulatory Defect / Quality Alert',
        sourceUrl,
        sourceAuthority: 'Egyptian Drug Authority',
        sourceDocCode: null,
        sourceVersion: null,
        sourceChecksum,
        retrievedAt,
      });
    }
  }

  return notices;
}

export async function fetchEdaNotices(
  options: FetchEdaOptions = {}
): Promise<{ notices: RegulatoryNoticeSource[]; source: 'LIVE_SCRAPED' | 'REFERENCE_CACHE'; retrievedAt: string }> {
  const allowLive = options.allowLive ?? false;
  const timeoutMs = options.timeoutMs ?? 5000;
  const retrievedAt = new Date().toISOString();

  if (allowLive) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const [res2026, res2025] = await Promise.all([
        fetch(EDA_2026_URL, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        }).catch(() => null),
        fetch(EDA_2025_URL, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        }).catch(() => null),
      ]);

      clearTimeout(timer);

      const scrapedNotices: RegulatoryNoticeSource[] = [];

      if (res2026 && res2026.ok) {
        const html = await res2026.text();
        const parsed = parseEdaTableHtml(html, 2026, retrievedAt);
        scrapedNotices.push(...parsed);
      }

      if (res2025 && res2025.ok) {
        const html = await res2025.text();
        const parsed = parseEdaTableHtml(html, 2025, retrievedAt);
        scrapedNotices.push(...parsed);
      }

      if (scrapedNotices.length > 0) {
        return {
          notices: scrapedNotices,
          source: 'LIVE_SCRAPED',
          retrievedAt,
        };
      }
    } catch {
      // Fallback to reference notices cache on network error
    }
  }

  return {
    notices: REFERENCE_NOTICES,
    source: 'REFERENCE_CACHE',
    retrievedAt,
  };
}
