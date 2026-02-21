// Query planner: converts natural language to QueryPlan

import { QueryPlan, DatasetMetadata } from './types';
import { findDimension, findMeasure, getDimensionDisplayField, DIMENSIONS } from './dictionary';
import { normalizeText, extractQuarter, extractYear, extractNumber, extractGroupBy, containsAny } from './normalize';

/**
 * Disambiguate "margin" intent explicitly
 * Default meaning of "margin" in finance dashboards is margin % (MarginPct)
 * 
 * Rules:
 * - If question includes "%", "percent", "pct" -> MarginPct
 * - If question includes "$", "dollar", "amount", "mm" -> Margin_$mm
 * - Default: MarginPct
 */
function pickMarginMetric(question: string): "MarginPct" | "Margin_$mm" {
    const q = question.toLowerCase();

    const wantsPercent =
        q.includes("%") ||
        q.includes("percent") ||
        q.includes("pct");

    const wantsDollars =
        q.includes("$") ||
        q.includes("dollar") ||
        q.includes("amount") ||
        q.includes("mm");

    if (wantsPercent) return "MarginPct";
    if (wantsDollars) return "Margin_$mm";

    // Default meaning of "margin" in finance dashboards:
    return "MarginPct";
}

/**
 * Plan query from natural language
 */
export function planQuery(
    question: string,
    selectedQuarter?: string,
    metadata?: DatasetMetadata
): QueryPlan {
    const queryLower = question.toLowerCase();
    const plan: QueryPlan = {
        metric: '',
        operation: 'single',
        groupBy: [],
        filters: {},
        timeWindow: { type: 'latest' },
        sortDirection: 'desc'
    };

    // 1. Detect metric with explicit disambiguation for "margin"
    // IMPORTANT: Check for "margin" BEFORE generic synonym matching
    // to prevent substring matching on metric keys
    const questionLower = question.toLowerCase();
    let metricKey: string | null = null;
    
    if (questionLower.includes("margin")) {
        // Explicit disambiguation for "margin"
        metricKey = pickMarginMetric(question);
    } else {
        // Try generic synonym matching
        const measure = findMeasure(question);
        if (measure) {
            metricKey = measure.key;
        } else {
            // Default to common metrics
            if (containsAny(question, ['revenue', 'sales', 'income'])) {
                metricKey = 'TotalRevenue_$mm';
            } else if (containsAny(question, ['expense', 'cost', 'spend'])) {
                metricKey = 'TotalExpense_$mm';
            } else {
                metricKey = 'TotalRevenue_$mm'; // Default
            }
        }
    }
    
    plan.metric = metricKey;

    // 2. Detect operation
    if (containsAny(question, ['trend', 'over time', 'change', 'historical'])) {
        plan.operation = 'trend';
    } else if (containsAny(question, ['best', 'highest', 'top', 'maximum', 'max'])) {
        plan.operation = 'top';
        const topN = extractNumber(question);
        if (topN) {
            plan.topN = topN;
        } else {
            plan.topN = 10; // Default
        }
    } else if (containsAny(question, ['worst', 'lowest', 'bottom', 'minimum', 'min'])) {
        plan.operation = 'bottom';
        const bottomN = extractNumber(question);
        if (bottomN) {
            plan.topN = bottomN;
        } else {
            plan.topN = 10; // Default
        }
        plan.sortDirection = 'asc';
    } else {
        plan.operation = 'single';
    }

    // 3. Detect groupBy from "by X" or "per X"
    const groupByText = extractGroupBy(question);
    if (groupByText) {
        const dim = findDimension(groupByText);
        if (dim) {
            plan.groupBy = [getDimensionDisplayField(dim)];
        }
    }

    // Also detect dimensions by direct mention
    for (const dim of DIMENSIONS) {
        if (dim.type === 'name' || dim.type === 'time' || dim.type === 'scenario') {
            if (dim.synonyms) {
                for (const synonym of dim.synonyms) {
                    if (queryLower.includes(synonym.toLowerCase())) {
                        const displayField = getDimensionDisplayField(dim);
                        if (!plan.groupBy.includes(displayField)) {
                            plan.groupBy.push(displayField);
                        }
                    }
                }
            }
        }
    }

    // For trend operations, always group by Quarter
    if (plan.operation === 'trend' && !plan.groupBy.includes('Quarter')) {
        plan.groupBy.push('Quarter');
    }

    // Auto-enable groupBy if dimensions detected and ranking requested
    if (plan.groupBy.length === 0 && (plan.operation === 'top' || plan.operation === 'bottom')) {
        // Try to infer from question context
        for (const dim of DIMENSIONS) {
            if (dim.type === 'name' && dim.synonyms) {
                for (const synonym of dim.synonyms) {
                    if (queryLower.includes(synonym.toLowerCase())) {
                        const displayField = getDimensionDisplayField(dim);
                        if (!plan.groupBy.includes(displayField)) {
                            plan.groupBy.push(displayField);
                        }
                    }
                }
            }
        }
    }

    // 4. Detect time window
    const quarter = extractQuarter(question);
    if (quarter) {
        plan.timeWindow = { type: 'quarter', value: quarter };
    } else {
        const year = extractYear(question);
        if (year) {
            plan.timeWindow = { type: 'year', value: year };
        } else if (containsAny(question, ['latest', 'most recent', 'current'])) {
            plan.timeWindow = { type: 'latest' };
        } else if (containsAny(question, ['all', 'every'])) {
            plan.timeWindow = { type: 'all' };
        } else if (selectedQuarter) {
            plan.timeWindow = { type: 'quarter', value: selectedQuarter };
        } else {
            plan.timeWindow = { type: 'latest' };
        }
    }

    // 5. Detect filters from metadata (match known dimension values)
    if (metadata) {
        for (const [dimKey, values] of Object.entries(metadata.dimensions)) {
            for (const value of values) {
                const valueLower = normalizeText(value);
                if (queryLower.includes(valueLower) && valueLower.length > 2) {
                    if (!plan.filters[dimKey]) {
                        plan.filters[dimKey] = [];
                    }
                    if (!plan.filters[dimKey].includes(value)) {
                        plan.filters[dimKey].push(value);
                    }
                }
            }
        }
    }

    return plan;
}

