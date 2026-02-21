// Data model dictionaries for NLQ engine

import { Dimension, Measure, DerivedMetric } from './types';
import { normalizeText } from './normalize';

export const DIMENSIONS: Dimension[] = [
    { key: "Quarter", type: "time", synonyms: ["quarter", "q", "period"] },
    { key: "Scenario", type: "scenario", synonyms: ["scenario", "actual", "forecast", "plan"] },

    { key: "LegalEntityID", type: "id", displayKey: "LegalEntity" },
    { key: "LegalEntity", type: "name", synonyms: ["entity", "legal entity"] },

    { key: "CostCenterID", type: "id", displayKey: "CostCenter" },
    { key: "CostCenter", type: "name", synonyms: ["cost center", "cost centre", "cc"] },

    { key: "LOBID", type: "id", displayKey: "LineOfBusiness" },
    { key: "LineOfBusiness", type: "name", synonyms: ["lob", "line of business", "business line"] },

    { key: "GeographyID", type: "id", displayKey: "Geography" },
    { key: "Geography", type: "name", synonyms: ["geo", "region", "market"] },

    { key: "ProductTypeID", type: "id", displayKey: "ProductType" },
    { key: "ProductType", type: "name", synonyms: ["product", "product type", "offering"] }
];

export const MEASURES: Measure[] = [
    { key: "AvgAUM_$mm", unit: "usd_mm", aggregation: "sum", synonyms: ["aum"] },
    { key: "NetFlows_$mm", unit: "usd_mm", aggregation: "sum", synonyms: ["net flows"] },

    { key: "MarketReturn_pct", unit: "percent", aggregation: "weighted_avg", weightBy: "AvgAUM_$mm" },
    { key: "AdvisoryFeeRate_pct", unit: "percent", aggregation: "weighted_avg", weightBy: "AvgAUM_$mm" },
    { key: "AdvisoryRevenue_$mm", unit: "usd_mm", aggregation: "sum", synonyms: ["advisory revenue"] },

    { key: "TradingVolume_$mm", unit: "usd_mm", aggregation: "sum" },
    { key: "AvgFeePerTrade_pct", unit: "percent", aggregation: "weighted_avg", weightBy: "TradingVolume_$mm" },
    { key: "TransactionRevenue_$mm", unit: "usd_mm", aggregation: "sum", synonyms: ["trading revenue"] },

    { key: "InterestEarningAssets_$mm", unit: "usd_mm", aggregation: "sum" },
    { key: "NetInterestMargin_pct", unit: "percent", aggregation: "weighted_avg", weightBy: "InterestEarningAssets_$mm" },
    { key: "NetInterestRevenue_$mm", unit: "usd_mm", aggregation: "sum" },

    { key: "EligibleAUM_$mm", unit: "usd_mm", aggregation: "sum" },
    { key: "PerformanceFeeRate_pct", unit: "percent", aggregation: "weighted_avg", weightBy: "EligibleAUM_$mm" },
    { key: "PerformanceFees_$mm", unit: "usd_mm", aggregation: "sum" },

    { key: "Headcount_FTE", unit: "count", aggregation: "sum", synonyms: ["headcount", "fte"] },
    { key: "AvgBaseSalary_$mm", unit: "usd_mm", aggregation: "weighted_avg", weightBy: "Headcount_FTE" },
    { key: "BaseCompensation_$mm", unit: "usd_mm", aggregation: "sum" },
    { key: "PayoutPct_pct", unit: "percent", aggregation: "weighted_avg", weightBy: "BaseCompensation_$mm" },
    { key: "VariableCompensation_$mm", unit: "usd_mm", aggregation: "sum" },
    { key: "TotalCompensation_$mm", unit: "usd_mm", aggregation: "sum" },

    { key: "NumberOfApplications", unit: "count", aggregation: "sum" },
    { key: "AvgCostPerApplication_$mm", unit: "usd_mm", aggregation: "weighted_avg", weightBy: "NumberOfApplications" },
    { key: "ApplicationSpend_$mm", unit: "usd_mm", aggregation: "sum" },

    { key: "NewClients_Count", unit: "count", aggregation: "sum" },
    { key: "AcquisitionCostPerClient_$mm", unit: "usd_mm", aggregation: "weighted_avg", weightBy: "NewClients_Count" },
    { key: "ClientAcquisitionSpend_$mm", unit: "usd_mm", aggregation: "sum" },

    { key: "TotalRevenue_$mm", unit: "usd_mm", aggregation: "sum", synonyms: ["revenue"] },
    { key: "TotalExpense_$mm", unit: "usd_mm", aggregation: "sum", synonyms: ["expense"] },
    
    // DOLLAR AMOUNT (sum) - MUST NOT match plain "margin"
    {
        key: "Margin_$mm",
        unit: "usd_mm",
        aggregation: "sum",
        synonyms: [
            "margin dollars",
            "margin amount",
            "profit dollars",
            "profit amount",
            "margin $",
            "profit $"
        ]
    },

    // PERCENT (weighted ratio) - DEFAULT FOR "margin"
    {
        key: "MarginPct",
        unit: "percent",
        aggregation: "weighted_ratio",
        numerator: "Margin_$mm",
        denominator: "TotalRevenue_$mm",
        synonyms: [
            "margin",
            "margin %",
            "margin percent",
            "margin pct",
            "operating margin"
        ]
    }
];

export const DERIVED: DerivedMetric[] = [
    { key: "ExpenseRatio", aggregation: "ratio", numerator: "TotalExpense_$mm", denominator: "TotalRevenue_$mm" },
    { key: "RevenuePerFTE", aggregation: "ratio", numerator: "TotalRevenue_$mm", denominator: "Headcount_FTE" },
    { key: "CostPerFTE", aggregation: "ratio", numerator: "TotalExpense_$mm", denominator: "Headcount_FTE" },
    { key: "CAC", aggregation: "ratio", numerator: "ClientAcquisitionSpend_$mm", denominator: "NewClients_Count" }
];

/**
 * Single source of truth: Map of measure key -> Measure (exact match only)
 * Use this when you already have a metric key and need the measure definition
 * STRICT: No fuzzy matching, no substring matching
 */
export const MEASURE_BY_KEY = new Map<string, Measure | DerivedMetric>(
    MEASURES.map(m => [m.key, m])
);

// Add derived metrics to the map
DERIVED.forEach(derived => {
    // Convert DerivedMetric to Measure-like object for lookup
    MEASURE_BY_KEY.set(derived.key, {
        key: derived.key,
        unit: 'percent', // Derived metrics are ratios, displayed as percentages
        aggregation: 'weighted_ratio',
        numerator: derived.numerator,
        denominator: derived.denominator
    } as Measure);
});

/**
 * Get measure by exact key match (for code paths that already have a metric key)
 * Returns null if key not found - NO fuzzy matching, NO substring matching
 */
export function getMeasureByKey(key: string): Measure | DerivedMetric | null {
    return MEASURE_BY_KEY.get(key) ?? null;
}

/**
 * Find dimension by key or synonym
 */
export function findDimension(query: string): Dimension | null {
    const queryLower = normalizeText(query);
    
    for (const dim of DIMENSIONS) {
        // Match by key (case insensitive)
        if (normalizeText(dim.key) === queryLower) {
            return dim;
        }
        
        // Match by synonym
        if (dim.synonyms) {
            for (const synonym of dim.synonyms) {
                if (queryLower.includes(normalizeText(synonym)) || normalizeText(synonym).includes(queryLower)) {
                    return dim;
                }
            }
        }
    }
    
    return null;
}

/**
 * Find measure by query text (for NL parsing only)
 * STRICT matching: exact key match OR synonym match (query includes synonym)
 * NO substring matching on keys, NO reverse matching (synonym.includes(query))
 * This prevents "margin" from matching "MarginPct" or "Margin_$mm" by substring
 */
export function findMeasure(query: string): Measure | DerivedMetric | null {
    const queryLower = normalizeText(query);
    
    // First: exact key match (normalized)
    for (const measure of MEASURES) {
        const keyLower = normalizeText(measure.key);
        if (keyLower === queryLower) {
            return measure;
        }
    }
    
    // Second: synonym match (query includes synonym, NOT reverse)
    for (const measure of MEASURES) {
        if (measure.synonyms) {
            for (const synonym of measure.synonyms) {
                const synonymLower = normalizeText(synonym);
                // Only match if query includes the synonym (not reverse)
                if (queryLower.includes(synonymLower)) {
                    return measure;
                }
            }
        }
    }
    
    // Third: derived metrics exact match
    for (const derived of DERIVED) {
        const keyLower = normalizeText(derived.key);
        if (keyLower === queryLower) {
            // Convert to Measure-like object
            return {
                key: derived.key,
                unit: 'percent',
                aggregation: 'weighted_ratio',
                numerator: derived.numerator,
                denominator: derived.denominator
            } as Measure;
        }
    }
    
    return null;
}

/**
 * Get display field for a dimension (returns name field for ID fields)
 */
export function getDimensionDisplayField(dim: Dimension): string {
    if (dim.type === 'id' && dim.displayKey) {
        return dim.displayKey;
    }
    return dim.key;
}

