# NLQ Engine Structure

## Files Created

### Core Types
1. **`lib/nlq/types.ts`** - TypeScript type definitions
   - `QueryPlan` - Query structure with metric, operation, groupBy, filters, timeWindow
   - `ExecutionResult` - Result structure with plan, meta, topRows, answerText
   - `AggregatedRow` - Individual aggregated result row
   - `DatasetMetadata` - Dataset metadata for filter inference

### Data Model
2. **`lib/nlq/dictionary.ts`** - Data model dictionaries
   - `DIMENSIONS` - Dimension definitions with synonyms
   - `MEASURES` - Measure definitions with aggregation rules
   - `DERIVED` - Derived metric definitions
   - Helper functions: `findDimension()`, `findMeasure()`, `getDimensionDisplayField()`

### Text Processing
3. **`lib/nlq/normalize.ts`** - Text normalization helpers
   - `normalizeText()` - Normalize text for matching
   - `tokenize()` - Tokenize query into words
   - `extractQuarter()` - Extract quarter from text
   - `extractYear()` - Extract year from text
   - `extractNumber()` - Extract number from text
   - `extractGroupBy()` - Extract "by X" or "per X" pattern
   - `containsAny()` - Check if text contains keywords

### Query Planning
4. **`lib/nlq/planner.ts`** - Query planning logic
   - `planQuery()` - Converts natural language to QueryPlan
   - Detects: metric, operation, groupBy, filters, timeWindow, topN, sortDirection

### Execution
5. **`lib/nlq/executor.ts`** - Deterministic aggregation execution
   - `executeQuery()` - Executes query plan and returns results
   - Implements: sum, weighted_avg, weighted_ratio
   - Applies minRevenue threshold for ratio rankings
   - Handles time window filtering
   - Handles dimension filtering

### Narration
6. **`lib/nlq/narrator.ts`** - Gemini prompt building
   - `buildNarrationPrompt()` - Builds prompt from execution results
   - Sends only computed results (no raw data)

### API Route
7. **`app/api/ask/route.ts`** - Wired together
   - Loads dataset by uploadId
   - Plans query
   - Executes aggregation
   - Builds narration prompt
   - Calls Gemini
   - Returns JSON response

### Testing
8. **`lib/nlq/test.ts`** - Simple test script
   - Tests 5 test cases
   - Can be run with: `npx tsx lib/nlq/test.ts`

## Response Structure

```typescript
{
  plan: QueryPlan,
  meta: {
    filtersUsed: Record<string, string[]>,
    timeWindowUsed: { type: string, value?: string },
    aggregationDefinition: string,
    measureDefinition: Measure | DerivedMetric | null
  },
  topRows: AggregatedRow[],
  answerText: string,
  summary: string, // Gemini narration
  // ... additional UI fields
}
```

## How to Run Locally

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

4. **Run test script (optional):**
   ```bash
   npx tsx lib/nlq/test.ts
   ```

## Key Features

- **Deterministic Aggregation**: All calculations done server-side
- **Weighted Ratios**: MarginPct = sum(margin)/sum(revenue) * 100
- **Min Revenue Threshold**: 1 $mm threshold for ratio rankings
- **Filter Inference**: Matches known dimension values from metadata
- **Gemini Narration Only**: No financial calculations in Gemini

