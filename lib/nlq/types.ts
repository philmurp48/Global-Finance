// Type definitions for NLQ engine

export interface Dimension {
    key: string;
    type: 'time' | 'scenario' | 'id' | 'name';
    displayKey?: string; // For ID fields, points to name field
    synonyms?: string[];
}

export interface Measure {
    key: string;
    unit: 'usd_mm' | 'percent' | 'count';
    aggregation: 'sum' | 'weighted_avg' | 'weighted_ratio';
    weightBy?: string; // For weighted_avg
    numerator?: string; // For weighted_ratio
    denominator?: string; // For weighted_ratio
    synonyms?: string[];
}

export interface DerivedMetric {
    key: string;
    aggregation: 'ratio';
    numerator: string;
    denominator: string;
}

export interface QueryPlan {
    metric: string; // Single metric key
    operation: 'single' | 'trend' | 'top' | 'bottom';
    groupBy: string[]; // Dimension keys to group by
    filters: Record<string, string[]>; // Dimension filters: { CostCenter: ['ABC', 'XYZ'] }
    timeWindow: {
        type: 'quarter' | 'year' | 'period' | 'latest' | 'all';
        value?: string; // e.g., '2024Q1', '2024'
    };
    topN?: number; // For top/bottom operations
    sortDirection?: 'asc' | 'desc'; // Sort direction
}

export interface AggregatedRow {
    dimensionValues: Record<string, string>; // e.g., { CostCenter: "ABC", Geography: "US" }
    measures: Record<string, number>; // e.g., { TotalRevenue_$mm: 100, MarginPct: 10 }
    recordCount: number;
}

export interface ExecutionResult {
    plan: QueryPlan;
    meta: {
        filtersUsed: Record<string, string[]>;
        timeWindowUsed: { type: string; value?: string };
        aggregationDefinition: string;
        measureDefinition: Measure | DerivedMetric | null;
    };
    topRows: AggregatedRow[];
    answerText: string; // Deterministic answer text
}

export interface DatasetMetadata {
    dimensions: Record<string, string[]>; // Available values per dimension
    quarters: string[];
    latestQuarter?: string;
}

