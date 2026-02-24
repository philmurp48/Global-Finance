// Text normalization and tokenization helpers

/**
 * Normalize text for matching (lowercase, remove special chars)
 */
export function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .replace(/\$mm/g, '')
        .replace(/_pct/g, '')
        .replace(/%/g, '')
        .replace(/_/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Tokenize query into words
 */
export function tokenize(query: string): string[] {
    return query
        .toLowerCase()
        .split(/\s+/)
        .filter(token => token.length > 0);
}

/**
 * Extract quarter from text (e.g., "2024Q1" or "2024 Q1")
 */
export function extractQuarter(text: string): string | null {
    const match = text.match(/(\d{4})\s*[Qq]\s*(\d)/i);
    if (match) {
        return `${match[1]}Q${match[2]}`.toUpperCase();
    }
    return null;
}

/**
 * Extract year from text (e.g., "2024")
 */
export function extractYear(text: string): string | null {
    const match = text.match(/\b(20\d{2})\b/);
    if (match) {
        return match[1];
    }
    return null;
}

/**
 * Extract number from text (e.g., "top 3" -> 3)
 */
export function extractNumber(text: string): number | null {
    const match = text.match(/\b(\d+)\b/);
    if (match) {
        return parseInt(match[1], 10);
    }
    return null;
}

/**
 * Check if text contains any of the keywords
 */
export function containsAny(text: string, keywords: string[]): boolean {
    const normalized = normalizeText(text);
    return keywords.some(keyword => normalized.includes(normalizeText(keyword)));
}

/**
 * Extract groupBy dimension from various patterns:
 * - "by X", "per X", "for each X", "split by X", "break down by X", "group by X"
 */
export function extractGroupBy(text: string): string | null {
    // Pattern 1: "by X" (e.g., "by Geography", "by Region")
    const byMatch = text.match(/\bby\s+([a-z\s]+?)(?:\s|$|,|\.)/i);
    if (byMatch) {
        return byMatch[1].trim();
    }
    
    // Pattern 2: "per X" (e.g., "per Geography", "per Region")
    const perMatch = text.match(/\bper\s+([a-z\s]+?)(?:\s|$|,|\.)/i);
    if (perMatch) {
        return perMatch[1].trim();
    }
    
    // Pattern 3: "for each X" (e.g., "for each Geography")
    const forEachMatch = text.match(/\bfor\s+each\s+([a-z\s]+?)(?:\s|$|,|\.)/i);
    if (forEachMatch) {
        return forEachMatch[1].trim();
    }
    
    // Pattern 4: "split by X" (e.g., "split by Geography")
    const splitMatch = text.match(/\bsplit\s+by\s+([a-z\s]+?)(?:\s|$|,|\.)/i);
    if (splitMatch) {
        return splitMatch[1].trim();
    }
    
    // Pattern 5: "break down by X" or "breakdown by X" (e.g., "break down by Geography")
    const breakdownMatch = text.match(/\bbreak\s*(?:down\s+)?by\s+([a-z\s]+?)(?:\s|$|,|\.)/i);
    if (breakdownMatch) {
        return breakdownMatch[1].trim();
    }
    
    // Pattern 6: "group by X" (e.g., "group by Geography")
    const groupMatch = text.match(/\bgroup\s+by\s+([a-z\s]+?)(?:\s|$|,|\.)/i);
    if (groupMatch) {
        return groupMatch[1].trim();
    }
    
    return null;
}

