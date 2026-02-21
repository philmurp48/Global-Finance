// Simple test script for NLQ engine
// Run with: npx tsx lib/nlq/test.ts

import { planQuery } from './planner';
import { executeQuery } from './executor';
import { buildNarrationPrompt } from './narrator';
import { DatasetMetadata } from './types';

// Mock data for testing
const mockRecords = [
    { Quarter: '2024Q1', CostCenter: 'ABC', TotalRevenue_$mm: 100, Margin_$mm: 10, MarginPct: 10 },
    { Quarter: '2024Q1', CostCenter: 'XYZ', TotalRevenue_$mm: 200, Margin_$mm: 30, MarginPct: 15 },
    { Quarter: '2024Q2', CostCenter: 'ABC', TotalRevenue_$mm: 120, Margin_$mm: 15, MarginPct: 12.5 },
    { Quarter: '2024Q2', CostCenter: 'XYZ', TotalRevenue_$mm: 250, Margin_$mm: 40, MarginPct: 16 },
];

const mockMetadata: DatasetMetadata = {
    dimensions: {
        CostCenter: ['ABC', 'XYZ'],
        Geography: ['US', 'EU']
    },
    quarters: ['2024Q1', '2024Q2'],
    latestQuarter: '2024Q2'
};

// Test cases - MUST PASS
const testCases = [
    {
        question: 'What cost center has best margin?',
        expectedMetric: 'MarginPct',
        expectedUnit: 'percent',
        description: 'Should return MarginPct (percentage)'
    },
    {
        question: 'What cost center has highest margin dollars?',
        expectedMetric: 'Margin_$mm',
        expectedUnit: 'usd_mm',
        description: 'Should return Margin_$mm (dollars)'
    },
    {
        question: 'Top 3 cost centers by margin % in 2025Q3',
        expectedMetric: 'MarginPct',
        expectedUnit: 'percent',
        description: 'Should return MarginPct with correct grouping and quarter filter'
    }
];

console.log('=== NLQ Engine Test Suite ===\n');

testCases.forEach((testCase, idx) => {
    const { question, expectedMetric, expectedUnit, description } = testCase;
    console.log(`\nTest ${idx + 1}: "${question}"`);
    console.log(`Expected: ${expectedMetric} (${expectedUnit})`);
    console.log('---');
    
    try {
        // Plan query
        const plan = planQuery(question, undefined, mockMetadata);
        console.log('Plan:', JSON.stringify(plan, null, 2));
        console.log('Selected metric:', plan.metric);
        
        // Verify metric selection
        if (plan.metric === expectedMetric) {
            console.log('✅ Metric selection: CORRECT');
        } else {
            console.log(`❌ Metric selection: WRONG (expected ${expectedMetric}, got ${plan.metric})`);
        }
        
        // Execute query
        const result = executeQuery(mockRecords, plan, mockMetadata);
        console.log('Result count:', result.topRows.length);
        console.log('Answer:', result.answerText);
        
        // Verify unit and formatting
        if (result.meta.measureDefinition && 'unit' in result.meta.measureDefinition) {
            const actualUnit = result.meta.measureDefinition.unit;
            console.log('Metric unit:', actualUnit);
            
            if (actualUnit === expectedUnit) {
                console.log('✅ Unit: CORRECT');
            } else {
                console.log(`❌ Unit: WRONG (expected ${expectedUnit}, got ${actualUnit})`);
            }
            
            const firstRow = result.topRows[0];
            if (firstRow) {
                const metricValue = firstRow.measures[plan.metric];
                if (metricValue !== null && metricValue !== undefined) {
                    console.log('Raw metric value:', metricValue);
                    
                    // Verify value range
                    if (actualUnit === 'percent') {
                        if (metricValue >= 0 && metricValue <= 1) {
                            console.log('✅ Percent value in [0,1] range: CORRECT');
                            console.log('Formatted value:', `${(metricValue * 100).toFixed(2)}%`);
                        } else {
                            console.log(`❌ Percent value NOT in [0,1] range: WRONG (got ${metricValue})`);
                        }
                    } else if (actualUnit === 'usd_mm') {
                        console.log('Formatted value:', `$${metricValue.toFixed(2)}M`);
                        if (metricValue > 0 && metricValue < 1000) {
                            console.log('✅ Dollar value reasonable: CORRECT');
                        }
                    }
                }
            }
        }
        
        console.log('Top rows:', result.topRows.slice(0, 3).map(r => ({
            dims: r.dimensionValues,
            measures: r.measures
        })));
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
});

console.log('\n=== Test Suite Complete ===');

