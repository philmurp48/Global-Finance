// Query planner: analyzes user questions to determine what data to compute and send to AI

export interface QueryPlan {
    metrics: string[]; // e.g., ['revenue', 'margin', 'expense']
    timeWindow?: {
        type: 'quarter' | 'year' | 'period' | 'latest' | 'all';
        value?: string; // e.g., '2024Q1', '2024'
    };
    dimensions?: string[]; // e.g., ['CostCenter', 'Geography']
    aggregations: {
        groupBy?: string[];
        topN?: number;
        bottomN?: number;
        comparison?: 'vs' | 'trend' | 'change';
    };
    filters?: Record<string, any>;
}

/**
 * Analyze query to create a query plan
 */
export function planQuery(query: string): QueryPlan {
    const queryLower = query.toLowerCase();
    const plan: QueryPlan = {
        metrics: [],
        aggregations: {}
    };

    // Detect metrics
    const metricKeywords: Record<string, string[]> = {
        revenue: ['revenue', 'sales', 'income'],
        expense: ['expense', 'cost', 'spend'],
        margin: ['margin', 'profit'],
        marginPct: ['margin %', 'margin percent', 'margin percentage', 'profit margin', 'margin%'],
        aum: ['aum', 'assets under management'],
        headcount: ['headcount', 'fte', 'employees'],
        operatingMargin: ['operating margin', 'op margin'],
        ebitda: ['ebitda'],
        volume: ['volume', 'trading volume']
    };

    for (const [metric, keywords] of Object.entries(metricKeywords)) {
        if (keywords.some(kw => queryLower.includes(kw))) {
            plan.metrics.push(metric);
        }
    }

    // If no specific metrics detected, use common ones
    if (plan.metrics.length === 0) {
        plan.metrics = ['revenue', 'margin', 'expense'];
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
    } else {
        plan.timeWindow = { type: 'latest' }; // Default to latest
    }

    // Detect dimensions
    const dimensionKeywords: Record<string, string[]> = {
        CostCenter: ['cost center', 'costcenter', 'cost centre', 'department'],
        Geography: ['geography', 'geographic', 'region', 'location', 'country'],
        LineOfBusiness: ['line of business', 'lineofbusiness', 'lob', 'business line'],
        LegalEntity: ['legal entity', 'legalentity', 'entity'],
        ProductType: ['product type', 'producttype', 'product']
    };

    for (const [dim, keywords] of Object.entries(dimensionKeywords)) {
        if (keywords.some(kw => queryLower.includes(kw))) {
            if (!plan.dimensions) plan.dimensions = [];
            plan.dimensions.push(dim);
        }
    }

    // Detect aggregations
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

    // Auto-enable groupBy if dimensions are detected AND best/worst/top/bottom is requested
    // OR if "by" keyword is present
    if (plan.dimensions && plan.dimensions.length > 0) {
        if (hasBestHighest || hasWorstLowest || queryLower.includes(' by ') || queryLower.includes('group by') || queryLower.includes('grouped by')) {
            plan.aggregations.groupBy = plan.dimensions;
        }
    }

    // Detect comparisons
    if (queryLower.includes(' vs ') || queryLower.includes(' versus ') || queryLower.includes(' compare ')) {
        plan.aggregations.comparison = 'vs';
    } else if (queryLower.includes('trend') || queryLower.includes('over time') || queryLower.includes('change')) {
        plan.aggregations.comparison = 'trend';
    }

    return plan;
}

/**
 * Compute summaries based on query plan
 */
export function computeSummaries(dataset: any, plan: QueryPlan): any {
    const summaries: any = {
        metrics: {},
        timeWindow: plan.timeWindow,
        dimensions: plan.dimensions || [],
        aggregations: []
    };

    if (!dataset?.factMarginRecords || !Array.isArray(dataset.factMarginRecords)) {
        return summaries;
    }

    const records = dataset.factMarginRecords;
    
    // Filter by time window
    let filteredRecords = records;
    if (plan.timeWindow) {
        if (plan.timeWindow.type === 'quarter' && plan.timeWindow.value) {
            filteredRecords = records.filter((r: any) => {
                const quarterKey = Object.keys(r).find(k => k.toLowerCase() === 'quarter');
                return quarterKey && String(r[quarterKey]).trim().toUpperCase() === plan.timeWindow!.value;
            });
        } else if (plan.timeWindow.type === 'latest') {
            // Get latest quarter
            const quarters = new Set<string>();
            records.forEach((r: any) => {
                const quarterKey = Object.keys(r).find(k => k.toLowerCase() === 'quarter');
                if (quarterKey && r[quarterKey]) {
                    quarters.add(String(r[quarterKey]).trim());
                }
            });
            const latestQuarter = Array.from(quarters).sort().pop();
            if (latestQuarter) {
                filteredRecords = records.filter((r: any) => {
                    const quarterKey = Object.keys(r).find(k => k.toLowerCase() === 'quarter');
                    return quarterKey && String(r[quarterKey]).trim() === latestQuarter;
                });
            }
        }
    }

    // Compute metric summaries
    plan.metrics.forEach(metric => {
        const metricFields = getMetricFields(metric);
        let total = 0;
        let count = 0;
        let nonZeroCount = 0;

        filteredRecords.forEach((record: any) => {
            let recordValue = 0;
            let found = false;
            
            metricFields.forEach(field => {
                const value = getFieldValue(record, field);
                if (value !== null && value !== undefined && !isNaN(value)) {
                    recordValue += Math.abs(value);
                    found = true;
                }
            });
            
            if (found) {
                total += recordValue;
                count++;
                if (recordValue !== 0) nonZeroCount++;
            }
        });

        summaries.metrics[metric] = {
            total: total,
            average: count > 0 ? total / count : 0,
            count: count,
            nonZeroCount: nonZeroCount,
            records: filteredRecords.length
        };
    });

    // Compute dimension aggregations if groupBy is specified OR if dimensions are detected
    // Always compute when dimensions are mentioned (e.g., "cost center", "geography")
    const dimensionsToGroup = plan.aggregations.groupBy || plan.dimensions || [];
    
    if (dimensionsToGroup.length > 0) {
        const dimensionAggs: Record<string, any> = {};
        
        dimensionsToGroup.forEach(dim => {
            const dimData: Record<string, any> = {};
            
            filteredRecords.forEach((record: any) => {
                const dimId = getDimensionId(record, dim);
                if (!dimId) return;

                if (!dimData[dimId]) {
                    dimData[dimId] = {
                        id: dimId,
                        name: getDimensionName(dataset, dim, dimId),
                        metrics: {}
                    };
                }

                plan.metrics.forEach(metric => {
                    const metricFields = getMetricFields(metric);
                    if (!dimData[dimId].metrics[metric]) {
                        dimData[dimId].metrics[metric] = 0;
                    }
                    metricFields.forEach(field => {
                        const value = getFieldValue(record, field);
                        if (value !== null && value !== undefined && !isNaN(value)) {
                            dimData[dimId].metrics[metric] += Math.abs(value);
                        }
                    });
                });
                
                // Always compute revenue when margin is requested (for margin% calculation)
                if (plan.metrics.includes('margin') || plan.metrics.includes('marginPct')) {
                    const revenueFields = getMetricFields('revenue');
                    revenueFields.forEach(field => {
                        const value = getFieldValue(record, field);
                        if (value !== null && value !== undefined && !isNaN(value)) {
                            if (!dimData[dimId].metrics.revenue) dimData[dimId].metrics.revenue = 0;
                            dimData[dimId].metrics.revenue += Math.abs(value);
                        }
                    });
                }
            });

            // Filter out dimensions with no data
            const validDimData = Object.values(dimData).filter((item: any) => {
                // Keep if at least one metric has a non-zero value
                return Object.values(item.metrics || {}).some((v: any) => v !== 0 && v !== null && v !== undefined);
            });

            if (validDimData.length > 0) {
                dimensionAggs[dim] = validDimData;
                
                // Apply topN/bottomN if specified
                if (plan.aggregations.topN) {
                    dimensionAggs[dim].sort((a: any, b: any) => {
                        // Sort by the first requested metric, or by margin if margin is requested
                        const sortMetric = plan.metrics.find(m => m === 'margin') || plan.metrics[0];
                        const aVal = a.metrics[sortMetric] || 0;
                        const bVal = b.metrics[sortMetric] || 0;
                        return bVal - aVal;
                    });
                    dimensionAggs[dim] = dimensionAggs[dim].slice(0, plan.aggregations.topN);
                } else if (plan.aggregations.bottomN) {
                    dimensionAggs[dim].sort((a: any, b: any) => {
                        const sortMetric = plan.metrics.find(m => m === 'margin') || plan.metrics[0];
                        const aVal = a.metrics[sortMetric] || 0;
                        const bVal = b.metrics[sortMetric] || 0;
                        return aVal - bVal;
                    });
                    dimensionAggs[dim] = dimensionAggs[dim].slice(0, plan.aggregations.bottomN);
                }
            }
        });

        if (Object.keys(dimensionAggs).length > 0) {
            summaries.aggregations = dimensionAggs;
        }
    }

    return summaries;
}

// Helper functions
function getMetricFields(metric: string): string[] {
    const fieldMap: Record<string, string[]> = {
        revenue: ['TotalRevenue_$mm', 'TotalRevenue', 'Revenue', 'Rev_', 'Rev_TransactionalFees_$mm', 'Rev_CustodySafekeeping_$mm'],
        expense: ['TotalExpense_$mm', 'TotalExpense', 'Expense', 'Exp_', 'Exp_CompBenefits_$mm', 'Exp_TechData_$mm', 'Exp_SalesMktg_$mm', 'Exp_OpsProfSvcs_$mm'],
        margin: ['Margin_$mm', 'Margin', 'Profit'],
        marginPct: ['MarginPct', 'Margin_%', 'MarginPercent'],
        aum: ['AUM_$mm', 'AUM'],
        headcount: ['Headcount_FTE', 'Headcount', 'FTE'],
        operatingMargin: ['OperatingMargin', 'OpMargin'],
        volume: ['TradingVolume_$mm', 'TradingVolume', 'Volume']
    };
    return fieldMap[metric] || [metric];
}

function getFieldValue(record: any, fieldPattern: string): number | null {
    // Try exact match first
    if (record[fieldPattern] !== undefined && record[fieldPattern] !== null) {
        const val = record[fieldPattern];
        if (typeof val === 'number' && !isNaN(val)) return val;
    }

    // Try pattern matching (for fields like Rev_TransactionalFees_$mm)
    const patternLower = fieldPattern.toLowerCase().replace(/\$mm/g, '').replace(/_/g, '');
    for (const [key, value] of Object.entries(record)) {
        const keyLower = key.toLowerCase().replace(/\$mm/g, '').replace(/_/g, '');
        if (keyLower.includes(patternLower) || patternLower.includes(keyLower)) {
            if (typeof value === 'number' && !isNaN(value)) return value;
        }
    }

    return null;
}

function getDimensionId(record: any, dimension: string): string | null {
    const idFields: Record<string, string[]> = {
        CostCenter: ['CostCenterID', 'Cost_Center_ID', 'CostCenter', 'SegmentID'],
        Geography: ['GeographyID', 'Geography', 'RegionID', 'Region'],
        LineOfBusiness: ['LOBID', 'LineOfBusiness', 'LOB'],
        LegalEntity: ['LegalEntityID', 'LegalEntity', 'EntityID'],
        ProductType: ['ProductTypeID', 'ProductType', 'ProductID']
    };

    const fields = idFields[dimension] || [];
    for (const field of fields) {
        if (record[field]) {
            return String(record[field]);
        }
    }

    return null;
}

function getDimensionName(dataset: any, dimension: string, dimId: string): string {
    if (!dataset.dimensionTables) return dimId;

    const tableName = `Dim_${dimension}`;
    const dimTable = dataset.dimensionTables[tableName] || dataset.dimensionTables[dimension];
    
    if (dimTable && dimTable[dimId]) {
        return dimTable[dimId].name || dimTable[dimId].Name || dimId;
    }

    return dimId;
}

