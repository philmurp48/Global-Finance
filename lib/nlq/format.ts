// Unit-driven metric formatting - NO GUESSING

export type Unit = "usd_mm" | "percent" | "count";

/**
 * Format metric value based on unit
 * - percent: value is in [0,1] range, format as X.XX%
 * - usd_mm: value is in millions, format as $X.XXM
 * - count: format as integer
 */
export function formatMetricValue(value: number | null | undefined, unit: Unit): string {
    if (value == null || Number.isNaN(value)) return "N/A";
    
    if (unit === "percent") {
        // Value is in [0,1] range (e.g., 0.269 = 26.9%)
        return `${(value * 100).toFixed(2)}%`;
    }
    
    if (unit === "usd_mm") {
        // Value is already in millions (e.g., 91.98 = $91.98M)
        // Do NOT divide by 1000000 - the data is already in $mm
        return `$${value.toFixed(2)}M`;
    }
    
    // count or other
    return `${Math.round(value)}`;
}

/**
 * Get display label for metric key
 */
export function getMetricLabel(metricKey: string): string {
    if (metricKey === 'Margin_$mm') return 'Margin ($mm)';
    if (metricKey === 'MarginPct') return 'Margin %';
    if (metricKey === 'TotalRevenue_$mm') return 'Revenue';
    if (metricKey === 'TotalExpense_$mm') return 'Expense';
    
    // Remove suffixes for display
    return metricKey
        .replace(/_?\$mm/g, '')
        .replace(/_?pct/gi, '')
        .replace(/_/g, ' ');
}

