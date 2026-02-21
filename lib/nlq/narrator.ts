// Narrator: builds Gemini prompt from computed results

import { ExecutionResult } from './types';
import { formatMetricValue } from './format';
import { getMeasureByKey } from './dictionary';

/**
 * Build Gemini prompt from execution results
 */
export function buildNarrationPrompt(result: ExecutionResult, question: string): string {
    let prompt = `You are a CFO dashboard assistant. Use ONLY the computed summary below. Do not invent values. Be concise. Echo time window and filters used.\n\n`;
    
    prompt += `COMPUTED RESULTS:\n`;
    prompt += `Time Window: ${result.meta.timeWindowUsed.type}${result.meta.timeWindowUsed.value ? ` (${result.meta.timeWindowUsed.value})` : ''}\n`;
    
    if (Object.keys(result.meta.filtersUsed).length > 0) {
        prompt += `Filters Applied: ${JSON.stringify(result.meta.filtersUsed)}\n`;
    }
    
    prompt += `Aggregation: ${result.meta.aggregationDefinition}\n`;
    prompt += `Metric: ${result.plan.metric}\n\n`;
    
    if (result.topRows.length > 0) {
        prompt += `Results:\n`;
        result.topRows.forEach((row, idx) => {
            prompt += `${idx + 1}. `;
            
            // Add dimension values
            const dimValues = Object.entries(row.dimensionValues)
                .map(([k, v]) => `${k}: ${v}`)
                .join(', ');
            if (dimValues) {
                prompt += `${dimValues} | `;
            }
            
            // Add measure values - formatting MUST be based on unit (exact lookup, NO guessing)
            const measureValues = Object.entries(row.measures)
                .map(([k, v]) => {
                    if (v === null || v === undefined) return null;
                    
                    // Determine unit: use exact key lookup, NO guessing from key name
                    let unit: "usd_mm" | "percent" | "count" = "count";
                    
                    // If this is the primary metric, use the measure definition from result
                    if (k === result.plan.metric && result.meta.measureDefinition && 'unit' in result.meta.measureDefinition) {
                        unit = result.meta.measureDefinition.unit;
                    } else {
                        // For supporting measures, use exact key lookup
                        const measureDef = getMeasureByKey(k);
                        if (measureDef && 'unit' in measureDef) {
                            unit = measureDef.unit;
                        }
                        // Default to 'count' if not found (no guessing)
                    }
                    
                    const formatted = formatMetricValue(v, unit);
                    return `${k}: ${formatted}`;
                })
                .filter(v => v !== null)
                .join(', ');
            
            prompt += `${measureValues}\n`;
        });
    } else {
        prompt += `No results found matching the query criteria.\n`;
    }
    
    prompt += `\nUser Question: ${question}\n\n`;
    prompt += `Instructions:
- Use ONLY the computed results above
- Do NOT calculate or invent any financial values
- Reference specific values from the results
- Echo the time window and filters used
- Format currency as $X.XXM for millions
- Format percentages as X.XX%
- Keep response to 2-3 sentences

Provide a concise narration:`;

    return prompt;
}

