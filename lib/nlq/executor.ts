// Executor: deterministic aggregation execution

import { QueryPlan, AggregatedRow, ExecutionResult, DatasetMetadata } from './types';
import { MEASURES, DERIVED, getMeasureByKey } from './dictionary';
import { formatMetricValue, getMetricLabel } from './format';

// Revenue threshold for ratio rankings (values are already in $mm, so use 1)
const MIN_REVENUE_THRESHOLD = 1; // 1 $mm (data is already in millions)

/**
 * Execute query plan and return aggregated results
 */
export function executeQuery(
    records: any[],
    plan: QueryPlan,
    metadata?: DatasetMetadata
): ExecutionResult {
    if (!records || records.length === 0) {
        return {
            plan,
            meta: {
                filtersUsed: {},
                timeWindowUsed: { type: 'all' },
                aggregationDefinition: 'No data available',
                measureDefinition: null
            },
            topRows: [],
            answerText: 'No data available to answer this question.'
        };
    }

    let filteredRecords = [...records];

    // Apply time window filter
    let timeWindowUsed = { type: 'all' as string, value: undefined as string | undefined };
    if (plan.timeWindow.type === 'quarter' && plan.timeWindow.value) {
        filteredRecords = filteredRecords.filter(r => {
            const quarter = String(r.Quarter || r.quarter || '').trim().toUpperCase();
            return quarter === plan.timeWindow.value!.toUpperCase();
        });
        timeWindowUsed = { type: 'quarter', value: plan.timeWindow.value };
    } else if (plan.timeWindow.type === 'latest') {
        // Find latest quarter
        const quarters = new Set<string>();
        filteredRecords.forEach(r => {
            const q = String(r.Quarter || r.quarter || '').trim().toUpperCase();
            if (q) quarters.add(q);
        });
        const sortedQuarters = Array.from(quarters).sort().reverse();
        const latestQuarter = sortedQuarters[0];
        if (latestQuarter) {
            filteredRecords = filteredRecords.filter(r => {
                const quarter = String(r.Quarter || r.quarter || '').trim().toUpperCase();
                return quarter === latestQuarter;
            });
            timeWindowUsed = { type: 'quarter', value: latestQuarter };
        }
    } else if (plan.timeWindow.type === 'all') {
        timeWindowUsed = { type: 'all', value: undefined };
    }

    // Apply dimension filters
    const filtersUsed: Record<string, string[]> = {};
    for (const [dimKey, values] of Object.entries(plan.filters)) {
        filteredRecords = filteredRecords.filter(r => {
            const recordValue = String(r[dimKey] || '').trim();
            return values.some(v => recordValue.toLowerCase() === v.toLowerCase());
        });
        filtersUsed[dimKey] = values;
    }

    // Group and aggregate
    let aggregatedRows: AggregatedRow[] = [];

    if (plan.groupBy.length > 0) {
        // Group by dimensions
        const groups = new Map<string, any[]>();
        
        filteredRecords.forEach(record => {
            const groupKey = plan.groupBy.map(dim => String(record[dim] || '').trim()).join('|');
            if (!groups.has(groupKey)) {
                groups.set(groupKey, []);
            }
            groups.get(groupKey)!.push(record);
        });

        // Aggregate each group
        groups.forEach((groupRecords, groupKey) => {
            const dimensionValues: Record<string, string> = {};
            plan.groupBy.forEach((dim, idx) => {
                const value = groupKey.split('|')[idx] || '';
                dimensionValues[dim] = value;
            });

            const measures = aggregateMeasures(groupRecords, plan.metric);
            
            aggregatedRows.push({
                dimensionValues,
                measures,
                recordCount: groupRecords.length
            });
        });
    } else {
        // Aggregate all records
        const measures = aggregateMeasures(filteredRecords, plan.metric);
        aggregatedRows.push({
            dimensionValues: {},
            measures,
            recordCount: filteredRecords.length
        });
    }

    // Apply sorting and topN
    if (plan.operation === 'top' || plan.operation === 'bottom') {
        // Sort by metric value
        aggregatedRows.sort((a, b) => {
            const aVal = a.measures[plan.metric] || 0;
            const bVal = b.measures[plan.metric] || 0;
            
            // For ratios, apply minRevenue threshold
            // Use exact key lookup (NOT findMeasure which is for NL parsing)
            const measure = getMeasureByKey(plan.metric);
            if (measure && (measure.aggregation === 'weighted_ratio' || (measure as any).aggregation === 'ratio')) {
                const aRevenue = a.measures['TotalRevenue_$mm'] || 0;
                const bRevenue = b.measures['TotalRevenue_$mm'] || 0;
                
                if (aRevenue < MIN_REVENUE_THRESHOLD) return 1;
                if (bRevenue < MIN_REVENUE_THRESHOLD) return -1;
            }
            
            if (aVal === null || aVal === undefined) return 1;
            if (bVal === null || bVal === undefined) return -1;
            
            return plan.sortDirection === 'asc' ? (aVal - bVal) : (bVal - aVal);
        });

        // Apply topN
        if (plan.topN) {
            aggregatedRows = aggregatedRows.slice(0, plan.topN);
        }
    } else if (plan.operation === 'trend') {
        // Sort by Quarter for trends
        aggregatedRows.sort((a, b) => {
            const aQuarter = a.dimensionValues['Quarter'] || '';
            const bQuarter = b.dimensionValues['Quarter'] || '';
            return aQuarter.localeCompare(bQuarter);
        });
    }

    // Build aggregation definition
    const aggDef = buildAggregationDefinition(plan, aggregatedRows.length);

    // Get measure definition by exact key (NOT findMeasure which is for NL parsing)
    const measureDef = getMeasureByKey(plan.metric);

    // Build answer text
    const answerText = buildAnswerText(aggregatedRows, plan, measureDef);

    return {
        plan,
        meta: {
            filtersUsed,
            timeWindowUsed,
            aggregationDefinition: aggDef,
            measureDefinition: measureDef
        },
        topRows: aggregatedRows,
        answerText
    };
}

/**
 * Aggregate measures for a set of records
 * NEVER performs ratio math for usd_mm metrics
 */
function aggregateMeasures(records: any[], metricKey: string): Record<string, number> {
    const aggregated: Record<string, number> = {};
    // Use exact key lookup (NOT findMeasure which is for NL parsing)
    const measure = getMeasureByKey(metricKey);

    if (!measure) {
        return aggregated;
    }

    // Handle regular measures - check unit first to prevent ratio math on usd_mm
    if ('aggregation' in measure && 'unit' in measure) {
        // usd_mm and count metrics: always use sum aggregation
        if (measure.unit === 'usd_mm' || measure.unit === 'count') {
            if (measure.aggregation === 'sum') {
                let sum = 0;
                records.forEach(record => {
                    const value = parseFloat(record[metricKey]) || 0;
                    sum += Math.abs(value);
                });
                aggregated[metricKey] = sum;
            } else {
                // Fallback: still sum even if aggregation type is different
                let sum = 0;
                records.forEach(record => {
                    const value = parseFloat(record[metricKey]) || 0;
                    sum += Math.abs(value);
                });
                aggregated[metricKey] = sum;
            }
        }
        // percent metrics: use weighted_avg or weighted_ratio
        else if (measure.unit === 'percent') {
            if (measure.aggregation === 'weighted_avg') {
                let weightedSum = 0;
                let totalWeight = 0;
                
                if (measure.weightBy) {
                    records.forEach(record => {
                        const value = parseFloat(record[metricKey]) || 0;
                        const weight = parseFloat(record[measure.weightBy!]) || 0;
                        weightedSum += value * weight;
                        totalWeight += weight;
                    });
                }
                
                aggregated[metricKey] = totalWeight > 0 ? (weightedSum / totalWeight) : 0;
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
                
                // Calculate ratio as decimal in [0,1] range (NOT 0-100)
                // Formatter will multiply by 100 to show as percentage
                aggregated[metricKey] = denominatorSum > 0 ? (numeratorSum / denominatorSum) : 0;
            }
        }
    }

    // Handle derived metrics (always ratios, return as decimal in [0,1])
    const derived = DERIVED.find(d => d.key === metricKey);
    if (derived) {
        let numeratorSum = 0;
        let denominatorSum = 0;
        
        records.forEach(record => {
            const num = parseFloat(record[derived.numerator]) || 0;
            const den = parseFloat(record[derived.denominator]) || 0;
            numeratorSum += Math.abs(num);
            denominatorSum += Math.abs(den);
        });
        
        // Return as decimal in [0,1] range (formatter will multiply by 100)
        aggregated[metricKey] = denominatorSum > 0 ? (numeratorSum / denominatorSum) : 0;
    }

    // Also compute supporting measures if needed (e.g., revenue for margin%)
    if (metricKey === 'MarginPct') {
        let revenueSum = 0;
        let marginSum = 0;
        records.forEach(record => {
            revenueSum += Math.abs(parseFloat(record['TotalRevenue_$mm']) || 0);
            marginSum += Math.abs(parseFloat(record['Margin_$mm']) || 0);
        });
        aggregated['TotalRevenue_$mm'] = revenueSum;
        aggregated['Margin_$mm'] = marginSum;
    }

    return aggregated;
}

/**
 * Build aggregation definition string
 */
function buildAggregationDefinition(plan: QueryPlan, resultCount: number): string {
    const parts: string[] = [];
    
    if (plan.groupBy.length > 0) {
        parts.push(`Grouped by: ${plan.groupBy.join(', ')}`);
    }
    
    if (plan.operation === 'top' && plan.topN) {
        parts.push(`Top ${plan.topN} results`);
    } else if (plan.operation === 'bottom' && plan.topN) {
        parts.push(`Bottom ${plan.topN} results`);
    } else if (plan.operation === 'trend') {
        parts.push(`Trend over time`);
    }
    
    if (plan.timeWindow.type !== 'all') {
        parts.push(`Time window: ${plan.timeWindow.type}${plan.timeWindow.value ? ` (${plan.timeWindow.value})` : ''}`);
    }
    
    parts.push(`Total results: ${resultCount}`);
    
    return parts.join(' | ');
}

/**
 * Build deterministic answer text
 */
function buildAnswerText(
    rows: AggregatedRow[],
    plan: QueryPlan,
    measureDef: any
): string {
    if (rows.length === 0) {
        return 'No results found matching the query criteria.';
    }

    const topRow = rows[0];
    const dimValues = Object.entries(topRow.dimensionValues)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
    
    const metricValue = topRow.measures[plan.metric];
    if (metricValue === null || metricValue === undefined) {
        return 'Unable to compute metric value.';
    }

    // Formatting MUST be based on unit, never based on question text
    const unit = measureDef && 'unit' in measureDef ? measureDef.unit : 'count';
    const formattedValue = formatMetricValue(metricValue, unit);
    
    // Use display label instead of raw metric key
    const displayLabel = getMetricLabel(plan.metric);
    
    if (plan.operation === 'top' || plan.operation === 'bottom') {
        return `${dimValues || 'Top result'} - ${displayLabel}: ${formattedValue}`;
    }

    return `${dimValues || 'Result'} - ${displayLabel}: ${formattedValue}`;
}

