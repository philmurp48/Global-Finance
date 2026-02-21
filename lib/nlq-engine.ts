// Generic NLQ Engine - Deterministic aggregation with Gemini narration

import { DIMENSIONS, MEASURES, DERIVED, findDimension, findMeasure, getDimensionDisplayField } from './data-model';

export interface NLQQueryPlan {
    measures: string[]; // Measure keys from data model
    dimensions?: string[]; // Dimension keys (use displayKey for ID fields)
    timeWindow?: {
        type: 'quarter' | 'year' | 'period' | 'latest' | 'all';
        value?: string; // e.g., '2024Q1', '2024'
    };
    filters?: Record<string, string[]>; // Dimension filters
    aggregations: {
        groupBy?: string[]; // Dimension keys to group by
        topN?: number;
        bottomN?: number;
        comparison?: 'vs' | 'trend' | 'change';
    };
    minRevenueThreshold?: number; // For ratio ranking (default 1 $mm)
}

export interface AggregatedResult {
    dimensionValues: Record<string, string>; // e.g., { CostCenter: "ABC", Geography: "US" }
    measures: Record<string, number>; // e.g., { TotalRevenue_$mm: 100, Margin_$mm: 10, MarginPct: 10 }
    recordCount: number;
}

export interface NLQResult {
    results: AggregatedResult[];
    filtersUsed: Record<string, string[]>;
    timeWindowUsed: { type: string; value?: string };
    aggregationDefinition: string;
    measureDefinitions: Record<string, any>;
}

/**
 * Plan NLQ query from natural language
 */
export function planNLQQuery(query: string, selectedQuarter?: string): NLQQueryPlan {
    const queryLower = query.toLowerCase();
    const plan: NLQQueryPlan = {
        measures: [],
        aggregations: {},
        minRevenueThreshold: 1 // 1 $mm default
    };

    // Detect measures via synonyms
    for (const measure of MEASURES) {
        if (measure.synonyms) {
            for (const synonym of measure.synonyms) {
                if (queryLower.includes(synonym.toLowerCase())) {
                    plan.measures.push(measure.key);
                    break;
                }
            }
        }
        // Also check key name
        const keyLower = measure.key.toLowerCase().replace(/\$mm/g, '').replace(/_pct/g, '').replace(/_/g, '');
        if (queryLower.includes(keyLower) || keyLower.includes(queryLower.replace(/\s/g, ''))) {
            if (!plan.measures.includes(measure.key)) {
                plan.measures.push(measure.key);
            }
        }
    }

    // Check derived metrics
    for (const derived of DERIVED) {
        const keyLower = derived.key.toLowerCase();
        if (queryLower.includes(keyLower)) {
            // Add numerator and denominator as measures
            if (!plan.measures.includes(derived.numerator)) {
                plan.measures.push(derived.numerator);
            }
            if (!plan.measures.includes(derived.denominator)) {
                plan.measures.push(derived.denominator);
            }
        }
    }

    // If no measures detected, default to common ones
    if (plan.measures.length === 0) {
        plan.measures = ['TotalRevenue_$mm', 'Margin_$mm', 'MarginPct'];
    }

    // Detect dimensions via "by X" or direct mention
    const byMatch = query.match(/by\s+([a-z\s]+)/i);
    if (byMatch) {
        const byText = byMatch[1].trim();
        const dim = findDimension(byText);
        if (dim) {
            plan.dimensions = [getDimensionDisplayField(dim)];
            plan.aggregations.groupBy = [getDimensionDisplayField(dim)];
        }
    }

    // Also detect dimensions by direct mention
    for (const dim of DIMENSIONS) {
        if (dim.type === 'name' || dim.type === 'time' || dim.type === 'scenario') {
            if (dim.synonyms) {
                for (const synonym of dim.synonyms) {
                    if (queryLower.includes(synonym.toLowerCase())) {
                        if (!plan.dimensions) plan.dimensions = [];
                        const displayField = getDimensionDisplayField(dim);
                        if (!plan.dimensions.includes(displayField)) {
                            plan.dimensions.push(displayField);
                        }
                    }
                }
            }
        }
    }

    // Detect time window
    const quarterMatch = query.match(/(\d{4}[Qq]\d)/i);
    if (quarterMatch) {
        plan.timeWindow = {
            type: 'quarter',
            value: quarterMatch[1].toUpperCase()
        };
    } else if (queryLower.match(/\d{4}/)) {
        const yearMatch = query.match(/(\d{4})/);
        if (yearMatch) {
            plan.timeWindow = {
                type: 'year',
                value: yearMatch[1]
            };
        }
    } else if (queryLower.includes('latest') || queryLower.includes('most recent') || queryLower.includes('current')) {
        plan.timeWindow = { type: 'latest' };
    } else if (queryLower.includes('all') || queryLower.includes('every')) {
        plan.timeWindow = { type: 'all' };
    } else if (selectedQuarter) {
        // Use selected quarter from UI
        plan.timeWindow = {
            type: 'quarter',
            value: selectedQuarter
        };
    } else {
        plan.timeWindow = { type: 'latest' };
    }

    // Detect ranking
    const hasBestHighest = queryLower.includes('best') || queryLower.includes('highest') || queryLower.includes('top') || queryLower.includes('maximum') || queryLower.includes('max');
    const hasWorstLowest = queryLower.includes('worst') || queryLower.includes('lowest') || queryLower.includes('bottom') || queryLower.includes('minimum') || queryLower.includes('min');
    
    if (hasBestHighest) {
        const topMatch = query.match(/top\s*(\d+)/i);
        plan.aggregations.topN = topMatch ? parseInt(topMatch[1]) : 10;
    }
    
    if (hasWorstLowest) {
        const bottomMatch = query.match(/bottom\s*(\d+)/i);
        plan.aggregations.bottomN = bottomMatch ? parseInt(bottomMatch[1]) : 10;
    }

    // Auto-enable groupBy if dimensions detected and ranking requested
    if (plan.dimensions && plan.dimensions.length > 0) {
        if (hasBestHighest || hasWorstLowest || queryLower.includes(' by ')) {
            plan.aggregations.groupBy = plan.dimensions;
        }
    }

    // Detect trend
    if (queryLower.includes('trend') || queryLower.includes('over time') || queryLower.includes('change')) {
        plan.aggregations.comparison = 'trend';
        // For trends, group by Quarter
        if (!plan.aggregations.groupBy) {
            plan.aggregations.groupBy = ['Quarter'];
        }
    }

    return plan;
}

/**
 * Execute deterministic aggregation
 */
export function executeAggregation(
    dataset: any,
    plan: NLQQueryPlan
): NLQResult {
    if (!dataset?.factMarginRecords || !Array.isArray(dataset.factMarginRecords)) {
        return {
            results: [],
            filtersUsed: {},
            timeWindowUsed: { type: 'all' },
            aggregationDefinition: 'No data available',
            measureDefinitions: {}
        };
    }

    let records = dataset.factMarginRecords;

    // Apply time window filter
    let timeWindowUsed = { type: 'all' as string, value: undefined as string | undefined };
    if (plan.timeWindow) {
        timeWindowUsed = { type: plan.timeWindow.type, value: plan.timeWindow.value };
        
        if (plan.timeWindow.type === 'quarter' && plan.timeWindow.value) {
            records = records.filter((r: any) => {
                const quarter = String(r.Quarter || r.quarter || '').trim().toUpperCase();
                return quarter === plan.timeWindow!.value!.toUpperCase();
            });
        } else if (plan.timeWindow.type === 'latest') {
            // Find latest quarter
            const quarters = new Set<string>();
            records.forEach((r: any) => {
                const q = String(r.Quarter || r.quarter || '').trim().toUpperCase();
                if (q) quarters.add(q);
            });
            const sortedQuarters = Array.from(quarters).sort().reverse();
            const latestQuarter = sortedQuarters[0];
            if (latestQuarter) {
                records = records.filter((r: any) => {
                    const quarter = String(r.Quarter || r.quarter || '').trim().toUpperCase();
                    return quarter === latestQuarter;
                });
                timeWindowUsed = { type: 'quarter', value: latestQuarter };
            }
        }
    }

    // Apply dimension filters
    const filtersUsed: Record<string, string[]> = {};
    if (plan.filters) {
        for (const [dimKey, values] of Object.entries(plan.filters)) {
            records = records.filter((r: any) => {
                const recordValue = String(r[dimKey] || '').trim();
                return values.some(v => recordValue.toLowerCase() === v.toLowerCase());
            });
            filtersUsed[dimKey] = values;
        }
    }

    // Group by dimensions if specified
    const groupBy = plan.aggregations.groupBy || [];
    const results: AggregatedResult[] = [];

    if (groupBy.length > 0) {
        // Group records by dimension values
        const groups = new Map<string, any[]>();
        
        records.forEach((record: any) => {
            const groupKey = groupBy.map(dim => String(record[dim] || '').trim()).join('|');
            if (!groups.has(groupKey)) {
                groups.set(groupKey, []);
            }
            groups.get(groupKey)!.push(record);
        });

        // Aggregate each group
        groups.forEach((groupRecords, groupKey) => {
            const dimensionValues: Record<string, string> = {};
            groupBy.forEach((dim, idx) => {
                const value = groupKey.split('|')[idx] || '';
                dimensionValues[dim] = value;
            });

            const aggregated = aggregateMeasures(groupRecords, plan.measures);
            
            results.push({
                dimensionValues,
                measures: aggregated,
                recordCount: groupRecords.length
            });
        });
    } else {
        // Aggregate all records
        const aggregated = aggregateMeasures(records, plan.measures);
        results.push({
            dimensionValues: {},
            measures: aggregated,
            recordCount: records.length
        });
    }

    // Apply ranking if specified
    if (plan.aggregations.topN || plan.aggregations.bottomN) {
        // Determine sort metric (use first measure, or MarginPct if available)
        const sortMeasure = plan.measures.find(m => m === 'MarginPct') || plan.measures[0];
        
        // For ratios, apply minRevenue threshold
        if (sortMeasure === 'MarginPct' || sortMeasure.includes('Ratio') || sortMeasure.includes('Per')) {
            results.forEach(result => {
                const revenue = result.measures['TotalRevenue_$mm'] || 0;
                if (revenue < (plan.minRevenueThreshold || 1) * 1000000) {
                    // Mark for exclusion or set to null
                    result.measures[sortMeasure] = null as any;
                }
            });
        }

        results.sort((a, b) => {
            const aVal = a.measures[sortMeasure] || 0;
            const bVal = b.measures[sortMeasure] || 0;
            if (aVal === null) return 1;
            if (bVal === null) return -1;
            return plan.aggregations.topN ? (bVal - aVal) : (aVal - bVal);
        });

        const n = plan.aggregations.topN || plan.aggregations.bottomN || 10;
        results.splice(n);
    }

    // Build aggregation definition
    const aggDef = buildAggregationDefinition(plan, results.length);

    // Build measure definitions
    const measureDefinitions: Record<string, any> = {};
    plan.measures.forEach(measureKey => {
        const measure = MEASURES.find(m => m.key === measureKey);
        if (measure) {
            measureDefinitions[measureKey] = {
                key: measure.key,
                unit: measure.unit,
                aggregation: measure.aggregation,
                weightBy: measure.weightBy,
                numerator: measure.numerator,
                denominator: measure.denominator
            };
        }
    });

    return {
        results,
        filtersUsed,
        timeWindowUsed,
        aggregationDefinition: aggDef,
        measureDefinitions
    };
}

/**
 * Aggregate measures for a set of records
 */
function aggregateMeasures(records: any[], measureKeys: string[]): Record<string, number> {
    const aggregated: Record<string, number> = {};

    for (const measureKey of measureKeys) {
        const measure = MEASURES.find(m => m.key === measureKey);
        if (!measure) continue;

        if (measure.aggregation === 'sum') {
            let sum = 0;
            records.forEach(record => {
                const value = parseFloat(record[measureKey]) || 0;
                sum += Math.abs(value);
            });
            aggregated[measureKey] = sum;

        } else if (measure.aggregation === 'weighted_avg') {
            let weightedSum = 0;
            let totalWeight = 0;
            
            if (measure.weightBy) {
                records.forEach(record => {
                    const value = parseFloat(record[measureKey]) || 0;
                    const weight = parseFloat(record[measure.weightBy!]) || 0;
                    weightedSum += value * weight;
                    totalWeight += weight;
                });
            }
            
            aggregated[measureKey] = totalWeight > 0 ? (weightedSum / totalWeight) : 0;

        } else if (measure.aggregation === 'weighted_ratio') {
            let numeratorSum = 0;
            let denominatorSum = 0;
            
            if (measure.numerator && measure.denominator) {
                records.forEach(record => {
                    const num = parseFloat(record[measure.numerator!]) || 0;
                    const den = parseFloat(record[measure.denominator!]) || 0;
                    numeratorSum += Math.abs(num);
                    denominatorSum += Math.abs(den);
                });
            }
            
            // Calculate ratio as percentage
            aggregated[measureKey] = denominatorSum > 0 ? (numeratorSum / denominatorSum) * 100 : 0;
        }
    }

    // Also compute derived metrics if requested
    for (const derived of DERIVED) {
        if (measureKeys.includes(derived.key) || 
            measureKeys.includes(derived.numerator) || 
            measureKeys.includes(derived.denominator)) {
            
            const numSum = aggregated[derived.numerator] || 
                records.reduce((sum, r) => sum + (parseFloat(r[derived.numerator]) || 0), 0);
            const denSum = aggregated[derived.denominator] || 
                records.reduce((sum, r) => sum + (parseFloat(r[derived.denominator]) || 0), 0);
            
            if (denSum > 0) {
                aggregated[derived.key] = (numSum / denSum) * 100;
            }
        }
    }

    return aggregated;
}

/**
 * Build aggregation definition string
 */
function buildAggregationDefinition(plan: NLQQueryPlan, resultCount: number): string {
    const parts: string[] = [];
    
    if (plan.aggregations.groupBy && plan.aggregations.groupBy.length > 0) {
        parts.push(`Grouped by: ${plan.aggregations.groupBy.join(', ')}`);
    }
    
    if (plan.aggregations.topN) {
        parts.push(`Top ${plan.aggregations.topN} results`);
    } else if (plan.aggregations.bottomN) {
        parts.push(`Bottom ${plan.aggregations.bottomN} results`);
    }
    
    if (plan.timeWindow) {
        parts.push(`Time window: ${plan.timeWindow.type}${plan.timeWindow.value ? ` (${plan.timeWindow.value})` : ''}`);
    }
    
    parts.push(`Total results: ${resultCount}`);
    
    return parts.join(' | ');
}

