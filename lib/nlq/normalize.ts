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
 * Extract "by X" or "per X" pattern
 */
export function extractGroupBy(text: string): string | null {
    const byMatch = text.match(/\bby\s+([a-z\s]+?)(?:\s|$|,)/i);
    if (byMatch) {
        return byMatch[1].trim();
    }
    
    const perMatch = text.match(/\bper\s+([a-z\s]+?)(?:\s|$|,)/i);
    if (perMatch) {
        return perMatch[1].trim();
    }
    
    return null;
}

