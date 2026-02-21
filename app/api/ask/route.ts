import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDataset } from '@/lib/storage';
import { planQuery } from '@/lib/nlq/planner';
import { executeQuery } from '@/lib/nlq/executor';
import { buildNarrationPrompt } from '@/lib/nlq/narrator';
import { DatasetMetadata } from '@/lib/nlq/types';
import { formatMetricValue, getMetricLabel } from '@/lib/nlq/format';
import { DatasetMetadata } from '@/lib/nlq/types';

// Rate limiting (in-memory for dev)
interface RateLimitEntry {
    count: number;
    resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute per IP

// Cache for responses (Map-based)
const responseCache = new Map<string, { response: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || entry.resetAt < now) {
        rateLimitMap.set(ip, {
            count: 1,
            resetAt: now + RATE_LIMIT_WINDOW
        });
        return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
    }

    if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
        return { allowed: false, remaining: 0 };
    }

    entry.count++;
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - entry.count };
}

function getCachedResponse(query: string, uploadId: string): any | null {
    const cacheKey = `${uploadId}:${query.toLowerCase().trim()}`;
    const cached = responseCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.response;
    }

    if (cached) {
        responseCache.delete(cacheKey);
    }

    return null;
}

function cacheResponse(query: string, uploadId: string, response: any): void {
    const cacheKey = `${uploadId}:${query.toLowerCase().trim()}`;
    responseCache.set(cacheKey, {
        response,
        timestamp: Date.now()
    });

    // Clean up old entries if cache gets too large
    if (responseCache.size > 100) {
        const entries = Array.from(responseCache.entries());
        entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
        const toKeep = entries.slice(0, 100);
        responseCache.clear();
        toKeep.forEach(([key, value]) => responseCache.set(key, value));
    }
}

/**
 * Build dataset metadata for filter inference
 */
function buildDatasetMetadata(dataset: any): DatasetMetadata {
    const metadata: DatasetMetadata = {
        dimensions: {},
        quarters: [],
        latestQuarter: undefined
    };

    if (!dataset?.factMarginRecords || !Array.isArray(dataset.factMarginRecords)) {
        return metadata;
    }

    const records = dataset.factMarginRecords;
    const dimensionKeys = ['CostCenter', 'Geography', 'LineOfBusiness', 'LegalEntity', 'ProductType'];
    
    // Collect dimension values
    dimensionKeys.forEach(dimKey => {
        const values = new Set<string>();
        records.forEach((r: any) => {
            const value = String(r[dimKey] || '').trim();
            if (value) values.add(value);
        });
        if (values.size > 0) {
            metadata.dimensions[dimKey] = Array.from(values);
        }
    });

    // Collect quarters
    records.forEach((r: any) => {
        const quarter = String(r.Quarter || r.quarter || '').trim().toUpperCase();
        if (quarter) metadata.quarters.push(quarter);
    });
    metadata.quarters = Array.from(new Set(metadata.quarters)).sort();
    metadata.latestQuarter = metadata.quarters[metadata.quarters.length - 1];

    return metadata;
}

function buildSmartContext(plan: any, summaries: any, dataset: any, metrics: any): string {
    const contextParts: string[] = [];

    contextParts.push('=== QUERY ANALYSIS ===');
    contextParts.push(`Metrics requested: ${plan.metrics.join(', ')}`);
    if (plan.timeWindow) {
        contextParts.push(`Time window: ${plan.timeWindow.type}${plan.timeWindow.value ? ` (${plan.timeWindow.value})` : ''}`);
    }
    if (plan.dimensions && plan.dimensions.length > 0) {
        contextParts.push(`Dimensions: ${plan.dimensions.join(', ')}`);
    }
    contextParts.push('');

    contextParts.push('=== COMPUTED METRICS ===');
    Object.entries(summaries.metrics || {}).forEach(([metric, data]: [string, any]) => {
        if (data.total !== 0 || data.count > 0) {
            if (metric.includes('Pct') || metric.includes('Percent')) {
                contextParts.push(`${metric}: ${data.average.toFixed(2)}% (from ${data.count} records)`);
            } else {
                contextParts.push(`${metric}: $${(data.total / 1000000).toFixed(2)}M (avg: $${(data.average / 1000000).toFixed(2)}M from ${data.count} records)`);
            }
        }
    });
    contextParts.push('');

    // Add dimension aggregations if available
    if (summaries.aggregations && Object.keys(summaries.aggregations).length > 0) {
        contextParts.push('=== DIMENSION BREAKDOWNS ===');
        Object.entries(summaries.aggregations).forEach(([dim, aggs]: [string, any]) => {
            contextParts.push(`\n${dim} Breakdown:`);
            if (Array.isArray(aggs) && aggs.length > 0) {
                aggs.forEach((agg: any, idx: number) => {
                    const metricValues: string[] = [];
                    Object.entries(agg.metrics || {}).forEach(([m, v]: [string, any]) => {
                        if (v !== 0 && v !== null && v !== undefined) {
                            if (m.includes('Pct') || m.includes('Percent') || m === 'marginPct') {
                                // Calculate margin % if we have revenue and margin
                                if (m === 'marginPct' && agg.metrics.revenue && agg.metrics.margin) {
                                    const marginPct = (agg.metrics.margin / agg.metrics.revenue) * 100;
                                    metricValues.push(`${m}: ${marginPct.toFixed(2)}%`);
                                } else {
                                    metricValues.push(`${m}: ${v.toFixed(2)}%`);
                                }
                            } else {
                                metricValues.push(`${m}: $${(v / 1000000).toFixed(2)}M`);
                            }
                        }
                    });
                    if (metricValues.length > 0) {
                        contextParts.push(`  ${idx + 1}. ${agg.name || agg.id}: ${metricValues.join(', ')}`);
                    }
                });
            } else {
                contextParts.push(`  No ${dim} data found`);
            }
        });
        contextParts.push('');
    }

    // Add schema preview (column names + sample rows)
    if (dataset?.factMarginRecords && dataset.factMarginRecords.length > 0) {
        contextParts.push('=== DATA SCHEMA ===');
        const sampleRecord = dataset.factMarginRecords[0];
        const columns = Object.keys(sampleRecord);
        contextParts.push(`Available columns: ${columns.join(', ')}`);
        contextParts.push(`Total records: ${dataset.factMarginRecords.length}`);
        
        // Show sample of 3 records
        contextParts.push('\nSample records (first 3):');
        dataset.factMarginRecords.slice(0, 3).forEach((record: any, idx: number) => {
            const recordStr = Object.entries(record)
                .filter(([k, v]) => v !== null && v !== undefined && v !== '')
                .map(([k, v]) => `${k}: ${v}`)
                .join(', ');
            contextParts.push(`  Record ${idx + 1}: ${recordStr}`);
        });
        contextParts.push('');
    }

    // Add available quarters
    if (dataset?.factMarginRecords) {
        const quarters = new Set<string>();
        dataset.factMarginRecords.forEach((record: any) => {
            const quarterKey = Object.keys(record).find(k => k.toLowerCase() === 'quarter');
            if (quarterKey && record[quarterKey]) {
                quarters.add(String(record[quarterKey]).trim());
            }
        });
        if (quarters.size > 0) {
            contextParts.push(`Available quarters: ${Array.from(quarters).sort().join(', ')}`);
        }
    }

    return contextParts.join('\n');
}

export async function POST(request: NextRequest) {
    try {
        // Get client IP for rate limiting
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                    request.headers.get('x-real-ip') || 
                    'unknown';

        // Check rate limit
        const rateLimit = checkRateLimit(ip);
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { 
                    error: 'Rate limit exceeded. Please try again later.',
                    retryAfter: 60
                },
                { status: 429 }
            );
        }

        // Parse request body
        const body = await request.json();
        const { question, uploadId, pageContext, selectedQuarter } = body;

        if (!question || typeof question !== 'string' || !question.trim()) {
            return NextResponse.json(
                { error: 'Question is required' },
                { status: 400 }
            );
        }

        // Check for uploadId
        if (!uploadId) {
            return NextResponse.json(
                {
                    summary: 'No dataset uploaded. Please upload your Excel file first using the Data Upload page.',
                    keyFindings: [
                        {
                            title: 'Dataset Required',
                            detail: 'You need to upload a dataset before asking questions. Go to the Data Upload page and upload your Excel file.',
                            confidence: 100
                        }
                    ],
                    recommendations: [
                        'Navigate to the Data Upload page',
                        'Upload your Excel file with financial data',
                        'Wait for the upload to complete',
                        'Then try your search query again'
                    ],
                    relatedDrivers: [],
                    visualizations: {},
                    dataSource: 'System',
                    lastUpdated: new Date().toISOString(),
                    query: question
                },
                { status: 200 }
            );
        }

        // Check cache
        const cachedResponse = getCachedResponse(question, uploadId);
        if (cachedResponse) {
            return NextResponse.json(cachedResponse);
        }

        // Check for Gemini API key
        const geminiApiKey = process.env.GEMINI_API_KEY;
        if (!geminiApiKey) {
            return NextResponse.json(
                { 
                    error: 'AI service is not configured. Please set GEMINI_API_KEY environment variable.',
                    fallback: true
                },
                { status: 503 }
            );
        }

        // Load dataset by uploadId
        const dataset = await getDataset(uploadId);
        if (!dataset || !dataset.data) {
            return NextResponse.json(
                {
                    summary: `Dataset with ID ${uploadId} not found. Please upload your Excel file again.`,
                    keyFindings: [
                        {
                            title: 'Dataset Not Found',
                            detail: 'The uploaded dataset could not be found. This may happen if the server was restarted (in dev mode) or the dataset expired.',
                            confidence: 100
                        }
                    ],
                    recommendations: [
                        'Go to the Data Upload page',
                        'Re-upload your Excel file',
                        'Try your search query again'
                    ],
                    relatedDrivers: [],
                    visualizations: {},
                    dataSource: 'System',
                    lastUpdated: new Date().toISOString(),
                    query: question
                },
                { status: 200 }
            );
        }

        // Build dataset metadata for filter inference
        const metadata = buildDatasetMetadata(dataset.data);
        
        // Plan query
        const plan = planQuery(question, selectedQuarter, metadata);
        
        // Log query plan for debugging
        console.log('Query plan:', JSON.stringify(plan, null, 2));
        
        // Execute deterministic aggregation
        const result = executeQuery(dataset.data.factMarginRecords || [], plan, metadata);
        
        // Log results for debugging
        console.log('Execution result:', {
            resultCount: result.topRows.length,
            filtersUsed: Object.keys(result.meta.filtersUsed).length,
            timeWindow: result.meta.timeWindowUsed,
            answerText: result.answerText
        });

        // Initialize Gemini
        const genAI = new GoogleGenerativeAI(geminiApiKey);
        
        // Build prompt for Gemini narration
        const prompt = buildNarrationPrompt(result, question);

        // Call Gemini API - try multiple model names
        let responseText: string | undefined;
        const modelNames = [
            'gemini-2.5-pro',
            'gemini-2.5-flash',
            'gemini-2.5-flash-lite',
            'gemini-2.0-flash',
            'gemini-2.0-flash-lite',
            'gemini-1.5-flash',
            'gemini-pro'
        ];
        let lastError: any = null;
        
        try {
            for (const modelName of modelNames) {
                try {
                    const model = genAI.getGenerativeModel({ model: modelName });
                    const result = await model.generateContent(prompt);
                    responseText = result.response.text();
                    console.log(`Successfully used model: ${modelName}`);
                    break;
                } catch (error: any) {
                    console.log(`Model ${modelName} failed:`, error.message);
                    lastError = error;
                    continue;
                }
            }
            
            if (!responseText) {
                throw lastError || new Error('All Gemini models failed');
            }
        } catch (error: any) {
            console.error('Gemini API Error:', error);
            
            // Handle quota/rate limit errors
            if (error.message?.includes('quota') || 
                error.message?.includes('rate limit') || 
                error.message?.includes('429') ||
                error.status === 429 ||
                error.statusCode === 429) {
                return NextResponse.json(
                    { 
                        error: 'AI temporarily unavailable, try later.',
                        retryAfter: 60
                    },
                    { status: 503 }
                );
            }

            // Handle API key errors
            if (error.message?.includes('API_KEY') || 
                error.message?.includes('api key') ||
                error.message?.includes('invalid') ||
                error.status === 401 ||
                error.statusCode === 401) {
                return NextResponse.json(
                    { 
                        error: 'Invalid API key. Please check your GEMINI_API_KEY.',
                        fallback: true
                    },
                    { status: 503 }
                );
            }

            throw error;
        }

        // Build key findings from results
        const keyFindings = result.topRows.slice(0, 10).map((row, idx) => {
            const dimValues = Object.entries(row.dimensionValues)
                .map(([k, v]) => `${k}: ${v}`)
                .join(', ');
            
            const measureValues = Object.entries(row.measures)
                .map(([k, v]) => {
                    if (v === null || v === undefined) return null;
                    
                    // Find unit for this measure key
                    let unit: "usd_mm" | "percent" | "count" = "count";
                    if (k === result.plan.metric && result.meta.measureDefinition && 'unit' in result.meta.measureDefinition) {
                        unit = result.meta.measureDefinition.unit;
                    } else {
                        // Infer from key name as fallback
                        if (k.includes('_$mm') || k.includes('$mm')) {
                            unit = 'usd_mm';
                        } else if (k.includes('_pct') || k.includes('Pct') || k === 'MarginPct') {
                            unit = 'percent';
                        }
                    }
                    
                    const formatted = formatMetricValue(v, unit);
                    return `${k}: ${formatted}`;
                })
                .filter(v => v !== null)
                .join(', ');
            
            return {
                title: dimValues || `Result ${idx + 1}`,
                detail: measureValues || 'No measures available',
                confidence: 100
            };
        });

        // Get unit for formatting
        const metricUnit = result.meta.measureDefinition && 'unit' in result.meta.measureDefinition
            ? result.meta.measureDefinition.unit
            : 'count';
        
        // Format response with debug info (gated behind NODE_ENV)
        const response: any = {
            plan: result.plan,
            meta: result.meta,
            topRows: result.topRows,
            answerText: result.answerText,
            summary: responseText, // Gemini narration
            deterministicAnswer: result.answerText,
            keyFindings: keyFindings,
            topResults: result.topRows.map(r => {
                const metricValue = r.measures[result.plan.metric] || 0;
                return {
                    name: Object.values(r.dimensionValues).join(' - ') || 'All',
                    value: metricValue,
                    formattedValue: formatMetricValue(metricValue, metricUnit),
                    label: getMetricLabel(result.plan.metric),
                    unit: metricUnit,
                    // Only include percentage if it's actually a percent metric
                    percentage: metricUnit === 'percent' ? metricValue * 100 : (r.measures['MarginPct'] ? r.measures['MarginPct'] * 100 : undefined)
                };
            }),
            recommendations: [],
            relatedDrivers: [],
            visualizations: {},
            filtersUsed: result.meta.filtersUsed,
            timeWindow: result.meta.timeWindowUsed,
            computedSummary: result,
            aggregationDefinition: result.meta.aggregationDefinition,
            dataSource: 'Deterministic Computation + Google Gemini AI Narration',
            lastUpdated: new Date().toISOString(),
            query: question,
            uploadId: uploadId
        };
        
        // Add debug dump (temporarily, gated behind NODE_ENV)
        if (process.env.NODE_ENV !== 'production') {
            response.debug = {
                question,
                metricKey: result.plan.metric,
                metricUnit: metricUnit,
                firstMetricValueRaw: result.topRows?.[0]?.measures[result.plan.metric] || null,
                measureDefinition: result.meta.measureDefinition
            };
        }

        // Cache the response
        cacheResponse(question, uploadId, response);

        return NextResponse.json(response);

    } catch (error: any) {
        console.error('Error in /api/ask:', error);
        
        const errorMessage = process.env.NODE_ENV === 'development' 
            ? `Error: ${error.message || 'Unknown error'}. Check server logs for details.`
            : 'An error occurred while processing your request.';
        
        return NextResponse.json(
            { 
                error: errorMessage,
                details: process.env.NODE_ENV === 'development' ? {
                    message: error.message,
                    name: error.name,
                    stack: error.stack?.split('\n').slice(0, 5).join('\n')
                } : undefined
            },
            { status: 500 }
        );
    }
}


