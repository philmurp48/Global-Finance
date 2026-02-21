/**
 * Regression tests for NLQ engine stabilization
 * 
 * Tests critical scenarios:
 * 1. Margin % vs Margin $mm disambiguation
 * 2. Strict metric lookup (no fuzzy matching)
 * 3. Unit-driven formatting (percent as decimal, $mm not divided)
 * 4. Correct aggregation (weighted_ratio = sum/sum)
 */

import { planQuery } from '../planner';
import { executeQuery } from '../executor';
import { formatMetricValue } from '../format';
import { getMeasureByKey } from '../dictionary';
import { DatasetMetadata } from '../types';

// Mock dataset with sample records
const mockRecords = [
    {
        Quarter: '2025Q3',
        CostCenter: 'Sales',
        TotalRevenue_$mm: 100,
        Margin_$mm: 25,
        MarginPct: 0.25, // 25% stored as decimal
    },
    {
        Quarter: '2025Q3',
        CostCenter: 'Marketing',
        TotalRevenue_$mm: 80,
        Margin_$mm: 20,
        MarginPct: 0.25, // 25% stored as decimal
    },
    {
        Quarter: '2025Q3',
        CostCenter: 'Engineering',
        TotalRevenue_$mm: 120,
        Margin_$mm: 30,
        MarginPct: 0.25, // 25% stored as decimal
    },
    {
        Quarter: '2025Q2',
        CostCenter: 'Sales',
        TotalRevenue_$mm: 90,
        Margin_$mm: 18,
        MarginPct: 0.20, // 20% stored as decimal
    },
];

const mockMetadata: DatasetMetadata = {
    dimensions: {
        CostCenter: ['Sales', 'Marketing', 'Engineering'],
    },
    quarters: ['2025Q2', '2025Q3'],
    latestQuarter: '2025Q3',
};

describe('Regression Tests - Stabilization Pass', () => {
    describe('Test 1: Margin % disambiguation', () => {
        it('should select MarginPct for "What cost center has best margin?"', () => {
            const plan = planQuery('What cost center has best margin?', undefined, mockMetadata);
            
            expect(plan.metric).toBe('MarginPct');
            expect(plan.operation).toBe('top');
            expect(plan.groupBy).toContain('CostCenter');
        });

        it('should format MarginPct as percentage (0-100%)', () => {
            const plan = planQuery('What cost center has best margin?', undefined, mockMetadata);
            const result = executeQuery(mockRecords, plan, mockMetadata);
            
            expect(result.topRows.length).toBeGreaterThan(0);
            const topRow = result.topRows[0];
            const marginPctValue = topRow.measures['MarginPct'];
            
            // Value should be in [0,1] range (decimal)
            expect(marginPctValue).toBeGreaterThanOrEqual(0);
            expect(marginPctValue).toBeLessThanOrEqual(1);
            
            // Format should show as percentage
            const measureDef = getMeasureByKey('MarginPct');
            expect(measureDef?.unit).toBe('percent');
            const formatted = formatMetricValue(marginPctValue, 'percent');
            expect(formatted).toMatch(/%$/); // Ends with %
            expect(parseFloat(formatted.replace('%', ''))).toBeGreaterThan(0);
        });
    });

    describe('Test 2: Margin $mm disambiguation', () => {
        it('should select Margin_$mm for "What cost center has highest margin dollars?"', () => {
            const plan = planQuery('What cost center has highest margin dollars?', undefined, mockMetadata);
            
            expect(plan.metric).toBe('Margin_$mm');
            expect(plan.operation).toBe('top');
        });

        it('should format Margin_$mm as $X.XXM (not divided by 1e6)', () => {
            const plan = planQuery('What cost center has highest margin dollars?', undefined, mockMetadata);
            const result = executeQuery(mockRecords, plan, mockMetadata);
            
            expect(result.topRows.length).toBeGreaterThan(0);
            const topRow = result.topRows[0];
            const marginDollarValue = topRow.measures['Margin_$mm'];
            
            // Value should be in millions (not divided)
            expect(marginDollarValue).toBeGreaterThanOrEqual(0);
            // Should be around 25-30 for our test data
            expect(marginDollarValue).toBeLessThan(100);
            
            // Format should show as $X.XXM
            const measureDef = getMeasureByKey('Margin_$mm');
            expect(measureDef?.unit).toBe('usd_mm');
            const formatted = formatMetricValue(marginDollarValue, 'usd_mm');
            expect(formatted).toMatch(/^\$/); // Starts with $
            expect(formatted).toMatch(/M$/); // Ends with M
            // Should NOT be divided (e.g., 25 should format as $25.00M, not $0.00M)
            expect(parseFloat(formatted.replace(/[$,M]/g, ''))).toBeGreaterThan(1);
        });
    });

    describe('Test 3: Top 3 cost centers by margin % in specific quarter', () => {
        it('should group by CostCenter, filter by Quarter, return top 3', () => {
            const plan = planQuery('Top 3 cost centers by margin % in 2025Q3', undefined, mockMetadata);
            
            expect(plan.metric).toBe('MarginPct');
            expect(plan.operation).toBe('top');
            expect(plan.topN).toBe(3);
            expect(plan.groupBy).toContain('CostCenter');
            expect(plan.timeWindow.type).toBe('quarter');
            expect(plan.timeWindow.value).toBe('2025Q3');
        });

        it('should return exactly 3 results for 2025Q3', () => {
            const plan = planQuery('Top 3 cost centers by margin % in 2025Q3', undefined, mockMetadata);
            const result = executeQuery(mockRecords, plan, mockMetadata);
            
            // Should have 3 cost centers in 2025Q3
            expect(result.topRows.length).toBe(3);
            
            // All should have CostCenter dimension
            result.topRows.forEach(row => {
                expect(row.dimensionValues).toHaveProperty('CostCenter');
                expect(row.dimensionValues.CostCenter).toBeTruthy();
            });
            
            // All should have MarginPct in [0,1] range
            result.topRows.forEach(row => {
                const marginPct = row.measures['MarginPct'];
                expect(marginPct).toBeGreaterThanOrEqual(0);
                expect(marginPct).toBeLessThanOrEqual(1);
            });
        });
    });

    describe('Test 4: Strict metric lookup (no fuzzy matching)', () => {
        it('should use getMeasureByKey for exact key lookup', () => {
            const marginPct = getMeasureByKey('MarginPct');
            expect(marginPct).not.toBeNull();
            expect(marginPct?.key).toBe('MarginPct');
            expect(marginPct?.unit).toBe('percent');
            
            const marginDollars = getMeasureByKey('Margin_$mm');
            expect(marginDollars).not.toBeNull();
            expect(marginDollars?.key).toBe('Margin_$mm');
            expect(marginDollars?.unit).toBe('usd_mm');
            
            // Non-existent key should return null
            const invalid = getMeasureByKey('InvalidMetric');
            expect(invalid).toBeNull();
        });
    });

    describe('Test 5: Weighted ratio aggregation', () => {
        it('should calculate weighted_ratio as sum(numerator) / sum(denominator)', () => {
            const plan = planQuery('What is the margin % for all cost centers?', undefined, mockMetadata);
            plan.metric = 'MarginPct';
            plan.operation = 'single';
            plan.groupBy = [];
            plan.timeWindow = { type: 'quarter', value: '2025Q3' };
            
            const result = executeQuery(mockRecords, plan, mockMetadata);
            
            expect(result.topRows.length).toBe(1);
            const aggregated = result.topRows[0];
            const marginPct = aggregated.measures['MarginPct'];
            
            // Should be calculated as: sum(Margin_$mm) / sum(TotalRevenue_$mm)
            // (25 + 20 + 30) / (100 + 80 + 120) = 75 / 300 = 0.25
            expect(marginPct).toBeCloseTo(0.25, 2);
            
            // Should be in [0,1] range (decimal)
            expect(marginPct).toBeGreaterThanOrEqual(0);
            expect(marginPct).toBeLessThanOrEqual(1);
        });
    });

    describe('Test 6: Unit-driven formatting (no guessing)', () => {
        it('should format percent values correctly (multiply by 100)', () => {
            const value = 0.25; // 25% as decimal
            const formatted = formatMetricValue(value, 'percent');
            expect(formatted).toBe('25.00%');
        });

        it('should format usd_mm values correctly (no division)', () => {
            const value = 25.5; // $25.5M
            const formatted = formatMetricValue(value, 'usd_mm');
            expect(formatted).toBe('$25.50M');
            // Should NOT be $0.00M (which would indicate division by 1e6)
            expect(formatted).not.toBe('$0.00M');
        });

        it('should format count values correctly', () => {
            const value = 123.7;
            const formatted = formatMetricValue(value, 'count');
            expect(formatted).toBe('124'); // Rounded
        });
    });
});

