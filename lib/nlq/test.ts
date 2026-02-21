// Regression tests for NLQ engine
// Run with: npx tsx lib/nlq/test.ts

import { planQuery } from './planner';
import { executeQuery } from './executor';
import { formatMetricValue } from './format';
import { getMeasureByKey } from './dictionary';
import { DatasetMetadata } from './types';

// Mock data for testing
const mockRecords = [
    { Quarter: '2024Q1', CostCenter: 'ABC', TotalRevenue_$mm: 100, Margin_$mm: 10, MarginPct: 0.10 },
    { Quarter: '2024Q1', CostCenter: 'XYZ', TotalRevenue_$mm: 200, Margin_$mm: 30, MarginPct: 0.15 },
    { Quarter: '2024Q2', CostCenter: 'ABC', TotalRevenue_$mm: 120, Margin_$mm: 15, MarginPct: 0.125 },
    { Quarter: '2024Q2', CostCenter: 'XYZ', TotalRevenue_$mm: 250, Margin_$mm: 40, MarginPct: 0.16 },
    { Quarter: '2025Q3', CostCenter: 'ABC', TotalRevenue_$mm: 150, Margin_$mm: 20, MarginPct: 0.133 },
    { Quarter: '2025Q3', CostCenter: 'XYZ', TotalRevenue_$mm: 300, Margin_$mm: 50, MarginPct: 0.167 },
];

const mockMetadata: DatasetMetadata = {
    dimensions: {
        CostCenter: ['ABC', 'XYZ'],
        Geography: ['US', 'EU']
    },
    quarters: ['2024Q1', '2024Q2', '2025Q3'],
    latestQuarter: '2025Q3'
};

// Test cases - MUST PASS
const testCases = [
    {
        question: 'What cost center has best margin?',
        expectedMetric: 'MarginPct',
        expectedUnit: 'percent',
        description: 'Should return MarginPct (percentage) - default for "margin"',
        validate: (result: any) => {
            const metricValue = result.topRows[0]?.measures['MarginPct'];
            if (metricValue === undefined || metricValue === null) {
                return { pass: false, error: 'MarginPct value is missing' };
            }
            if (metricValue < 0 || metricValue > 1) {
                return { pass: false, error: `MarginPct value ${metricValue} not in [0,1] range` };
            }
            const formatted = formatMetricValue(metricValue, 'percent');
            if (!formatted.includes('%') || formatted.includes('$')) {
                return { pass: false, error: `Formatting incorrect: ${formatted} (should have %, no $)` };
            }
            return { pass: true };
        }
    },
    {
        question: 'What cost center has highest margin dollars?',
        expectedMetric: 'Margin_$mm',
        expectedUnit: 'usd_mm',
        description: 'Should return Margin_$mm (dollars) - explicit dollar request',
        validate: (result: any) => {
            const metricValue = result.topRows[0]?.measures['Margin_$mm'];
            if (metricValue === undefined || metricValue === null) {
                return { pass: false, error: 'Margin_$mm value is missing' };
            }
            const formatted = formatMetricValue(metricValue, 'usd_mm');
            if (!formatted.includes('$') || formatted.includes('%')) {
                return { pass: false, error: `Formatting incorrect: ${formatted} (should have $, no %)` };
            }
            return { pass: true };
        }
    },
    {
        question: 'Top 3 cost centers by margin % in 2025Q3',
        expectedMetric: 'MarginPct',
        expectedUnit: 'percent',
        description: 'Should return MarginPct with correct grouping and quarter filter',
        validate: (result: any) => {
            if (result.topRows.length !== 2) { // Only 2 cost centers in mock data
                return { pass: false, error: `Expected 2 results, got ${result.topRows.length}` };
            }
            const hasQuarterFilter = result.meta.filtersUsed['Quarter']?.includes('2025Q3') || 
                                   result.meta.timeWindowUsed.value === '2025Q3';
            if (!hasQuarterFilter) {
                return { pass: false, error: 'Quarter filter not applied correctly' };
            }
            const hasGroupBy = result.plan.groupBy.includes('CostCenter');
            if (!hasGroupBy) {
                return { pass: false, error: 'GroupBy CostCenter not applied' };
            }
            return { pass: true };
        }
    }
];

console.log('=== NLQ Engine Regression Test Suite ===\n');

let passed = 0;
let failed = 0;

testCases.forEach((testCase, idx) => {
    const { question, expectedMetric, expectedUnit, description, validate } = testCase;
    console.log(`\nTest ${idx + 1}: "${question}"`);
    console.log(`Expected: ${expectedMetric} (${expectedUnit})`);
    console.log(`Description: ${description}`);
    console.log('---');
    
    try {
        // Plan query
        const plan = planQuery(question, undefined, mockMetadata);
        console.log('Plan metric:', plan.metric);
        console.log('Plan groupBy:', plan.groupBy);
        console.log('Plan timeWindow:', plan.timeWindow);
        
        // Verify metric selection
        if (plan.metric === expectedMetric) {
            console.log('✅ Metric selection: CORRECT');
        } else {
            console.log(`❌ Metric selection: WRONG (expected ${expectedMetric}, got ${plan.metric})`);
            failed++;
            return;
        }
        
        // Execute query
        const result = executeQuery(mockRecords, plan, mockMetadata);
        console.log('Result count:', result.topRows.length);
        console.log('Answer:', result.answerText);
        
        // Verify unit
        const measureDef = getMeasureByKey(plan.metric);
        if (measureDef && 'unit' in measureDef) {
            const actualUnit = measureDef.unit;
            if (actualUnit === expectedUnit) {
                console.log('✅ Unit: CORRECT');
            } else {
                console.log(`❌ Unit: WRONG (expected ${expectedUnit}, got ${actualUnit})`);
                failed++;
                return;
            }
        } else {
            console.log('❌ Unit: WRONG (measure definition not found)');
            failed++;
            return;
        }
        
        // Run custom validation
        const validation = validate(result);
        if (validation.pass) {
            console.log('✅ Validation: PASSED');
            passed++;
        } else {
            console.log(`❌ Validation: FAILED - ${validation.error}`);
            failed++;
        }
        
        // Show first result details
        if (result.topRows.length > 0) {
            const firstRow = result.topRows[0];
            const metricValue = firstRow.measures[plan.metric];
            const unit = measureDef && 'unit' in measureDef ? measureDef.unit : 'count';
            const formatted = formatMetricValue(metricValue, unit);
            console.log(`First result: ${JSON.stringify(firstRow.dimensionValues)} - ${formatted}`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
        failed++;
    }
});

console.log('\n=== Test Summary ===');
console.log(`Passed: ${passed}/${testCases.length}`);
console.log(`Failed: ${failed}/${testCases.length}`);

if (failed === 0) {
    console.log('\n✅ All tests passed!');
    process.exit(0);
} else {
    console.log('\n❌ Some tests failed. Please review the output above.');
    process.exit(1);
}
