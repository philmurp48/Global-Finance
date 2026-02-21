# Generic NLQ Engine Implementation

## Overview
Implemented a generic Natural Language Query (NLQ) engine for finance dashboard with deterministic aggregation and Gemini narration. All financial calculations are done server-side; Gemini is used only for formatting/narration.

## Files Changed

### New Files
1. **`lib/data-model.ts`** - Data model definitions
   - DIMENSIONS dictionary with synonyms
   - MEASURES dictionary with aggregation rules
   - DERIVED metrics definitions
   - Helper functions: `findDimension()`, `findMeasure()`, `getDimensionDisplayField()`

2. **`lib/nlq-engine.ts`** - Core NLQ engine
   - `planNLQQuery()` - Plans query from natural language
   - `executeAggregation()` - Deterministic aggregation execution
   - Handles weighted averages, weighted ratios, sums
   - Applies minRevenue threshold for ratio ranking

### Modified Files
1. **`app/api/ask/route.ts`**
   - Uses new NLQ engine instead of old query planner
   - Accepts `selectedQuarter` parameter
   - Sends only computed results to Gemini (no raw data)
   - Returns structured NLQ results

## Key Features

### 1. Deterministic Aggregation
- **Sum**: For USD and count measures
- **Weighted Average**: For percentage measures (weighted by specified field)
- **Weighted Ratio**: For MarginPct = sum(margin)/sum(revenue) * 100
- **Min Revenue Threshold**: Applies 1 $mm threshold when ranking ratios

### 2. Query Planning
Detects:
- **Measures**: Via synonyms (e.g., "revenue", "margin", "margin %")
- **Dimensions**: Via "by X" or direct mention (e.g., "cost center", "geography")
- **Time Window**: Quarter/year from query or selectedQuarter parameter
- **Ranking**: Top/bottom/best/highest/lowest
- **Trends**: Groups by Quarter automatically

### 3. Data Model Compliance
- Uses NAME fields for grouping (not ID fields)
- Handles all measures from MEASURES dictionary
- Supports derived metrics (ExpenseRatio, RevenuePerFTE, etc.)

### 4. Gemini Integration
- Receives ONLY computed results (no raw dataset)
- Prompt: "Use ONLY computed summary. Do not invent values. Be concise. Echo time window and filters used."
- Provides 2-3 sentence narration

## Test Cases

### 1. "What cost center has best margin?"
**Expected:**
- Detects: `measure = MarginPct`, `dimension = CostCenter`, `ranking = topN`
- Groups by CostCenter
- Calculates MarginPct = sum(Margin_$mm) / sum(TotalRevenue_$mm) * 100 for each
- Sorts by MarginPct (highest first)
- Returns top CostCenter with margin $ and margin %

### 2. "Top 3 geographies by revenue in 2025Q3"
**Expected:**
- Detects: `measure = TotalRevenue_$mm`, `dimension = Geography`, `topN = 3`, `timeWindow = 2025Q3`
- Filters to 2025Q3
- Groups by Geography
- Sums TotalRevenue_$mm per geography
- Returns top 3

### 3. "Margin trend by quarter"
**Expected:**
- Detects: `measure = Margin_$mm`, `trend = true`
- Groups by Quarter automatically
- Sums Margin_$mm per quarter
- Returns time series

### 4. "Revenue per FTE by line of business"
**Expected:**
- Detects: `measure = RevenuePerFTE` (derived), `dimension = LineOfBusiness`
- Groups by LineOfBusiness
- Calculates RevenuePerFTE = sum(TotalRevenue_$mm) / sum(Headcount_FTE) for each
- Returns results

### 5. "Lowest margin product type"
**Expected:**
- Detects: `measure = MarginPct`, `dimension = ProductType`, `ranking = bottomN`
- Groups by ProductType
- Calculates MarginPct (weighted ratio)
- Applies minRevenue threshold (>= 1 $mm)
- Sorts by MarginPct (lowest first)
- Returns bottom ProductType

## Margin Percentage Calculation

**Formula:** `MarginPct = (Sum of Margin_$mm / Sum of TotalRevenue_$mm) * 100`

This is a **weighted ratio**, NOT an average of percentages. This ensures accuracy when aggregating across multiple records.

**Example:**
- Record 1: Revenue $100M, Margin $10M → 10%
- Record 2: Revenue $200M, Margin $30M → 15%
- **Weighted Ratio:** (10+30)/(100+200) * 100 = 13.33%
- **NOT:** (10% + 15%) / 2 = 12.5%

## Local Testing Steps

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Upload Excel data:**
   - Navigate to Data Upload page
   - Upload Fact_Margin sheet
   - Verify uploadId is stored in localStorage

3. **Test queries:**
   - "What cost center has best margin?"
   - "Top 3 geographies by revenue in 2025Q3"
   - "Margin trend by quarter"
   - "Revenue per FTE by line of business"
   - "Lowest margin product type"

4. **Verify:**
   - Check server logs for query plan and results
   - Verify deterministic answer is computed correctly
   - Verify Gemini narration references computed values only
   - Check that margin % is calculated as weighted ratio

5. **Check server logs:**
   - Query plan should show detected measures, dimensions, time window
   - Results should show aggregated values
   - MarginPct should be calculated as sum(margin)/sum(revenue) * 100

## Response Structure

```typescript
{
  summary: string,              // Gemini narration
  deterministicAnswer: string,  // Computed answer
  keyFindings: [...],           // Structured findings from results
  topResults: [...],            // Top N results
  filtersUsed: {...},           // Applied filters
  timeWindow: {...},            // Time window used
  computedSummary: NLQResult,   // Full NLQ result
  aggregationDefinition: string // Aggregation description
}
```

## Confirmation: Margin % is Weighted Properly

✅ **Confirmed**: MarginPct is calculated using weighted ratio:
- Formula: `sum(Margin_$mm) / sum(TotalRevenue_$mm) * 100`
- Implemented in `aggregateMeasures()` function in `nlq-engine.ts`
- Applied per dimension group (e.g., per CostCenter)
- NOT averaged across records

## Next Steps

1. Test all test cases
2. Verify UI displays deterministic answers correctly
3. Add support for more complex queries (e.g., "revenue by geography and quarter")
4. Add visualization support for trend queries

