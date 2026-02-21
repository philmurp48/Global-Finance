# Margin Disambiguation Bug Fix

## Problem
For "What cost center has best margin?", the app was selecting `Margin_$mm` (dollar amount) and formatting it as a percent (e.g., "Margin_$mm: 91.98%"). This is wrong.

## Solution Implemented

### A) Updated Metric Dictionary
- **MarginPct** is now the default for "margin" queries
- **Margin_$mm** only matches when question includes: "$", "dollars", "amount", "margin dollars", "margin $", "profit dollars", "profit $"
- Added strict synonyms to prevent substring matching

### B) Planner Fix: Explicit Disambiguation
- Added `pickMarginMetric()` function that checks for percent/dollar keywords
- Default meaning of "margin" → `MarginPct` (weighted ratio)
- Checks for "margin" BEFORE generic synonym matching to prevent substring issues

### C) Executor Fix: Ratio Math in [0,1]
- `weighted_ratio` now returns decimal in [0,1] range (NOT 0-100)
- Formatter multiplies by 100 to display as percentage
- Example: 0.269 → displays as "26.90%"
- Min revenue threshold (1 $mm) applied for ratio rankings

### D) Formatter: Unit-Driven Display
- Created `lib/nlq/format.ts` with `formatMetricValue()` function
- **percent**: value in [0,1] → format as `X.XX%`
- **usd_mm**: value in millions → format as `$X.XXM`
- **count**: format as integer
- NO GUESSING - formatting is strictly unit-based

### E) Updated "Best" Logic
- "best margin" → `MarginPct` (percentage)
- "best margin dollars" → `Margin_$mm` (dollars)
- GroupBy inferred correctly from question
- Sort desc by metricValue

### F) Debug Dump
- Added debug info in response (gated behind `NODE_ENV !== 'production'`)
- Shows: `question`, `metricKey`, `metricUnit`, `firstMetricValueRaw`
- Expected for "best margin":
  - metricKey: "MarginPct"
  - metricUnit: "percent"
  - firstMetricValueRaw: around 0.25–0.30 (NOT 91.98)

## Files Modified

1. **`lib/nlq/dictionary.ts`**
   - Updated Margin_$mm synonyms (removed generic "margin")
   - Updated MarginPct synonyms (added "margin" as default)

2. **`lib/nlq/planner.ts`**
   - Added `pickMarginMetric()` function
   - Explicit margin disambiguation BEFORE generic matching

3. **`lib/nlq/executor.ts`**
   - Fixed weighted_ratio to return [0,1] range
   - Fixed derived metrics to return [0,1] range
   - Updated minRevenue threshold check to use unit
   - Updated `buildAnswerText()` to use formatter

4. **`lib/nlq/format.ts`** (NEW)
   - `formatMetricValue()` - unit-driven formatting
   - `getMetricLabel()` - user-friendly labels

5. **`lib/nlq/narrator.ts`**
   - Updated to use `formatMetricValue()` function

6. **`app/api/ask/route.ts`**
   - Updated to use `formatMetricValue()` and `getMetricLabel()`
   - Added debug dump (gated behind NODE_ENV)

7. **`lib/nlq/test.ts`**
   - Updated test cases with expected results
   - Added verification for metric selection and unit

## Test Cases (MUST PASS)

### 1. "What cost center has best margin?"
- **Expected**: metricKey = `MarginPct`, unit = `percent`
- **Formatted**: `XX.XX%` (value in [0,1] range, e.g., 0.269 → "26.90%")

### 2. "What cost center has highest margin dollars?"
- **Expected**: metricKey = `Margin_$mm`, unit = `usd_mm`
- **Formatted**: `$XX.XXM` (value in millions, e.g., 91.98 → "$91.98M")

### 3. "Top 3 cost centers by margin % in 2025Q3"
- **Expected**: metricKey = `MarginPct`, unit = `percent`
- **Formatted**: `XX.XX%`
- Correct grouping and quarter filter

## How to Test Locally

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Upload Excel data:**
   - Navigate to Data Upload page
   - Upload Fact_Margin sheet

3. **Test queries:**
   - "What cost center has best margin?" → Should show MarginPct as percentage
   - "What cost center has highest margin dollars?" → Should show Margin_$mm as dollars

4. **Check debug info** (in response, dev mode only):
   - `debug.metricKey` should be "MarginPct" for "best margin"
   - `debug.metricUnit` should be "percent"
   - `debug.firstMetricValueRaw` should be in [0,1] range (e.g., 0.269, NOT 26.9 or 91.98)

5. **Verify formatting:**
   - Margin_$mm values should show as `$X.XXM` (never as `%`)
   - MarginPct values should show as `X.XX%` (never as `$`)

## Confirmation

✅ **Margin % is weighted properly**: `sum(Margin_$mm) / sum(TotalRevenue_$mm)` returns [0,1] range
✅ **Formatting is unit-driven**: No guessing based on question text
✅ **UI shows correct labels**: Margin_$mm as dollars, MarginPct as percent
✅ **Debug dump available**: Shows metric selection and raw values (dev mode only)

