// Deterministic answer builder - computes answers from summaries without AI

import { QueryPlan } from './query-planner';

export interface DeterministicAnswer {
    answer: string;
    keyFindings: Array<{
        title: string;
        detail: string;
        confidence: number;
    }>;
    computedValues?: Record<string, any>;
    topResults?: Array<{
        name: string;
        value: number;
        label: string;
        percentage?: number;
    }>;
}

/**
 * Build deterministic answer from query plan and summaries
 */
export function buildDeterministicAnswer(
    plan: QueryPlan,
    summaries: any,
    question: string
): DeterministicAnswer {
    const answer: DeterministicAnswer = {
        answer: '',
        keyFindings: [],
        computedValues: {}
    };

    // Handle "best margin cost center" type questions
    if (plan.dimensions && plan.dimensions.length > 0 && plan.metrics.includes('margin')) {
        const dimension = plan.dimensions[0]; // Use first dimension
        const aggregations = summaries.aggregations?.[dimension];
        
        if (aggregations && Array.isArray(aggregations) && aggregations.length > 0) {
            // Sort by margin (highest first)
            const sorted = [...aggregations].sort((a: any, b: any) => {
                const aMargin = a.metrics?.margin || 0;
                const bMargin = b.metrics?.margin || 0;
                return bMargin - aMargin;
            });

            const best = sorted[0];
            if (best && best.metrics) {
                const margin = best.metrics.margin || 0;
                const revenue = best.metrics.revenue || 0;
                // Use pre-calculated marginPct if available (weighted average from query planner)
                const marginPct = best.metrics.marginPct !== undefined 
                    ? best.metrics.marginPct 
                    : (revenue > 0 ? (margin / revenue) * 100 : 0);
                const marginFormatted = `$${(margin / 1000000).toFixed(2)}M`;
                const marginPctFormatted = `${marginPct.toFixed(2)}%`;

                answer.answer = `${best.name || best.id} has the best margin with ${marginFormatted} (${marginPctFormatted}).`;
                
                answer.keyFindings.push({
                    title: `Best ${dimension}: ${best.name || best.id}`,
                    detail: `Margin: ${marginFormatted}, Margin %: ${marginPctFormatted}${revenue > 0 ? `, Revenue: $${(revenue / 1000000).toFixed(2)}M` : ''}`,
                    confidence: 100
                });

                // Add top results
                answer.topResults = sorted.slice(0, plan.aggregations.topN || 10).map((item: any) => {
                    const itemMargin = item.metrics?.margin || 0;
                    const itemRevenue = item.metrics?.revenue || 0;
                    // Use pre-calculated marginPct if available
                    const itemMarginPct = item.metrics?.marginPct !== undefined
                        ? item.metrics.marginPct
                        : (itemRevenue > 0 ? (itemMargin / itemRevenue) * 100 : 0);
                    return {
                        name: item.name || item.id,
                        value: itemMargin,
                        label: 'Margin',
                        percentage: itemMarginPct
                    };
                });

                answer.computedValues = {
                    bestDimension: dimension,
                    bestValue: best.name || best.id,
                    margin: margin,
                    marginPct: marginPct,
                    revenue: revenue
                };
            }
        }
    }

    // Handle simple metric queries (revenue, expense, margin)
    else if (plan.metrics.length > 0 && (!plan.dimensions || plan.dimensions.length === 0)) {
        const metric = plan.metrics[0];
        const metricData = summaries.metrics?.[metric];
        
        if (metricData && metricData.total !== 0) {
            let formattedValue = '';
            if (metric.includes('Pct') || metric.includes('Percent')) {
                formattedValue = `${metricData.average.toFixed(2)}%`;
            } else {
                formattedValue = `$${(metricData.total / 1000000).toFixed(2)}M`;
            }

            answer.answer = `Total ${metric}: ${formattedValue}`;
            answer.keyFindings.push({
                title: `Total ${metric}`,
                detail: `${formattedValue} (from ${metricData.count} records)`,
                confidence: 95
            });

            answer.computedValues = {
                metric: metric,
                total: metricData.total,
                average: metricData.average,
                count: metricData.count
            };
        }
    }

    // Handle dimension breakdowns without "best"
    else if (plan.dimensions && plan.dimensions.length > 0) {
        const dimension = plan.dimensions[0];
        const aggregations = summaries.aggregations?.[dimension];
        
        if (aggregations && Array.isArray(aggregations) && aggregations.length > 0) {
            const count = aggregations.length;
            answer.answer = `Found ${count} ${dimension}${count > 1 ? 's' : ''} with data.`;
            
            aggregations.slice(0, 5).forEach((item: any) => {
                const metrics = Object.entries(item.metrics || {})
                    .filter(([_, v]: [string, any]) => v !== 0 && v !== null && v !== undefined)
                    .map(([m, v]: [string, any]) => {
                        if (m.includes('Pct') || m.includes('Percent')) {
                            return `${m}: ${(v as number).toFixed(2)}%`;
                        } else {
                            return `${m}: $${((v as number) / 1000000).toFixed(2)}M`;
                        }
                    })
                    .join(', ');
                
                answer.keyFindings.push({
                    title: `${item.name || item.id}`,
                    detail: metrics || 'No metrics available',
                    confidence: 90
                });
            });
        }
    }

    // Default answer if nothing matches
    if (!answer.answer) {
        answer.answer = 'Unable to compute deterministic answer from available data.';
        answer.keyFindings.push({
            title: 'Data Analysis',
            detail: 'Please check that your query matches the available data structure.',
            confidence: 0
        });
    }

    return answer;
}

