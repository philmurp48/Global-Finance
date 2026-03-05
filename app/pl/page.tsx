'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    TrendingUp,
    TrendingDown, 
    Filter, 
    Download, 
    RefreshCw,
    DollarSign,
    BarChart3,
    Settings,
    ChevronDown,
    ChevronRight
} from 'lucide-react';

interface PnLLineItem {
    label: string;
    fieldName: string;
    isTotal?: boolean;
    isMargin?: boolean;
    indent?: number;
    isPercentage?: boolean;
}

interface PnLData {
    [rowKey: string]: {
        [period: string]: {
            [fieldName: string]: number;
        };
    };
}

// Sample data structure for Asset Management Company (like Invesco)
const generateSampleData = () => {
    const periods = ['Q1 2024', 'Q2 2024', 'Q3 2024', 'Q4 2024'];
    const entities = ['Equity Strategies', 'Fixed Income', 'Alternative Investments', 'Total'];
    
    const data: PnLData = {};
    
    entities.forEach(entity => {
        data[entity] = {};
        periods.forEach(period => {
            data[entity][period] = {};
            
            // Revenue items
            const managementFees = entity === 'Total' ? 1250 : (300 + Math.random() * 200);
            const performanceFees = entity === 'Total' ? 450 : (50 + Math.random() * 150);
            const advisoryFees = entity === 'Total' ? 320 : (60 + Math.random() * 100);
            const otherRevenue = entity === 'Total' ? 80 : (10 + Math.random() * 30);
            const totalRevenue = managementFees + performanceFees + advisoryFees + otherRevenue;
            
            // Cost of Revenue
            const costOfRevenue = entity === 'Total' ? 420 : (80 + Math.random() * 100);
            const grossProfit = totalRevenue - costOfRevenue;
            const grossProfitPct = totalRevenue !== 0 ? (grossProfit / totalRevenue) * 100 : 0;
            
            // Operating Expenses
            const compensation = entity === 'Total' ? 680 : (120 + Math.random() * 200);
            const technology = entity === 'Total' ? 180 : (30 + Math.random() * 60);
            const marketing = entity === 'Total' ? 95 : (15 + Math.random() * 40);
            const generalAdmin = entity === 'Total' ? 220 : (40 + Math.random() * 80);
            const otherExpenses = entity === 'Total' ? 45 : (5 + Math.random() * 20);
            const totalOperatingExpenses = compensation + technology + marketing + generalAdmin + otherExpenses;
            
            // EBITDA
            const ebitda = grossProfit - totalOperatingExpenses;
            
            // Depreciation & Amortization
            const depreciation = entity === 'Total' ? 85 : (15 + Math.random() * 30);
            
            // Operating Income
            const operatingIncome = ebitda - depreciation;
            
            // Other Financial Items
            const interestIncome = entity === 'Total' ? 25 : (3 + Math.random() * 10);
            const interestExpense = entity === 'Total' ? 15 : (2 + Math.random() * 8);
            const otherIncome = entity === 'Total' ? 12 : (1 + Math.random() * 5);
            
            // Net Income
            const netIncome = operatingIncome + interestIncome - interestExpense + otherIncome;
            const netIncomePct = totalRevenue !== 0 ? (netIncome / totalRevenue) * 100 : 0;
            
            // Key Metrics
            const aum = entity === 'Total' ? 125000 : (20000 + Math.random() * 30000);
            const netFlows = entity === 'Total' ? 2500 : (300 + Math.random() * 1000);
            const aumGrowth = entity === 'Total' ? 2.5 : (1.5 + Math.random() * 2);
            
            data[entity][period] = {
                // Revenue
                ManagementFees: managementFees,
                PerformanceFees: performanceFees,
                AdvisoryFees: advisoryFees,
                OtherRevenue: otherRevenue,
                TotalRevenue: totalRevenue,
                
                // Cost of Revenue
                CostOfRevenue: costOfRevenue,
                GrossProfit: grossProfit,
                GrossProfitPct: grossProfitPct,
                
                // Operating Expenses
                Compensation: compensation,
                Technology: technology,
                Marketing: marketing,
                GeneralAdmin: generalAdmin,
                OtherExpenses: otherExpenses,
                TotalOperatingExpenses: totalOperatingExpenses,
                
                // EBITDA
                EBITDA: ebitda,
                
                // Depreciation
                Depreciation: depreciation,
                
                // Operating Income
                OperatingIncome: operatingIncome,
                
                // Other Financial Items
                InterestIncome: interestIncome,
                InterestExpense: interestExpense,
                OtherIncome: otherIncome,
                
                // Net Income
                NetIncome: netIncome,
                NetIncomePct: netIncomePct,
                
                // Key Metrics
                AUM: aum,
                NetFlows: netFlows,
                AUMGrowth: aumGrowth
            };
        });
    });
    
    return { data, periods, entities };
};

function PnLContent() {
    const searchParams = useSearchParams();
    const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['Revenue', 'OperatingExpenses']));
    const [selectedEntities, setSelectedEntities] = useState<string[]>([]);
    
    const { data: sampleData, periods: availablePeriods, entities: availableEntities } = useMemo(() => generateSampleData(), []);
    
    useEffect(() => {
        if (availablePeriods.length > 0 && selectedPeriods.length === 0) {
            setSelectedPeriods(availablePeriods);
        }
        if (availableEntities.length > 0 && selectedEntities.length === 0) {
            setSelectedEntities(availableEntities.filter(e => e !== 'Total'));
        }
    }, [availablePeriods, availableEntities]);
    
    // Build P&L Line Items Structure for Asset Management Company
    const pnlLineItems: PnLLineItem[] = useMemo(() => {
        const items: PnLLineItem[] = [];
        
        // Revenue Section
        items.push({ label: 'Revenue', fieldName: 'TotalRevenue', isTotal: true, indent: 0 });
        items.push({ label: 'Management Fees', fieldName: 'ManagementFees', indent: 1 });
        items.push({ label: 'Performance Fees', fieldName: 'PerformanceFees', indent: 1 });
        items.push({ label: 'Advisory Fees', fieldName: 'AdvisoryFees', indent: 1 });
        items.push({ label: 'Other Revenue', fieldName: 'OtherRevenue', indent: 1 });
        
        // Cost of Revenue
        items.push({ label: 'Cost of Revenue', fieldName: 'CostOfRevenue', indent: 0 });
        
        // Gross Profit
        items.push({ label: 'Gross Profit', fieldName: 'GrossProfit', isTotal: true, indent: 0 });
        items.push({ label: 'Gross Profit %', fieldName: 'GrossProfitPct', isPercentage: true, indent: 1 });
        
        // Operating Expenses
        items.push({ label: 'Operating Expenses', fieldName: 'TotalOperatingExpenses', isTotal: true, indent: 0 });
        items.push({ label: 'Compensation', fieldName: 'Compensation', indent: 1 });
        items.push({ label: 'Technology', fieldName: 'Technology', indent: 1 });
        items.push({ label: 'Marketing', fieldName: 'Marketing', indent: 1 });
        items.push({ label: 'General & Administrative', fieldName: 'GeneralAdmin', indent: 1 });
        items.push({ label: 'Other Expenses', fieldName: 'OtherExpenses', indent: 1 });
        
        // EBITDA
        items.push({ label: 'EBITDA', fieldName: 'EBITDA', isTotal: true, indent: 0 });
        
        // Depreciation & Amortization
        items.push({ label: 'Depreciation & Amortization', fieldName: 'Depreciation', indent: 0 });
        
        // Operating Income
        items.push({ label: 'Operating Income', fieldName: 'OperatingIncome', isTotal: true, indent: 0 });
        
        // Other Financial Items
        items.push({ label: 'Interest Income', fieldName: 'InterestIncome', indent: 0 });
        items.push({ label: 'Interest Expense', fieldName: 'InterestExpense', indent: 0 });
        items.push({ label: 'Other Income', fieldName: 'OtherIncome', indent: 0 });
        
        // Net Income
        items.push({ label: 'Net Income', fieldName: 'NetIncome', isTotal: true, indent: 0 });
        items.push({ label: 'Net Income %', fieldName: 'NetIncomePct', isPercentage: true, indent: 1 });
        
        return items;
    }, []);
    
    // Key Metrics Line Items
    const keyMetricsItems: PnLLineItem[] = useMemo(() => {
        return [
            { label: 'AUM ($M)', fieldName: 'AUM', indent: 0 },
            { label: 'Net Flows ($M)', fieldName: 'NetFlows', indent: 0 },
            { label: 'AUM Growth %', fieldName: 'AUMGrowth', isPercentage: true, indent: 0 }
        ];
    }, []);
    
    const formatCurrency = (value: number): string => {
        if (Math.abs(value) >= 1000000) {
            return `$${(value / 1000000).toFixed(2)}M`;
        } else if (Math.abs(value) >= 1000) {
            return `$${(value / 1000).toFixed(2)}K`;
        }
        return `$${value.toFixed(2)}`;
    };
    
    const formatPercentage = (value: number): string => {
        return `${value.toFixed(2)}%`;
    };
    
    const togglePeriod = (period: string) => {
        setSelectedPeriods(prev => {
            if (prev.includes(period)) {
                return prev.filter(p => p !== period);
            } else {
                return [...prev, period];
            }
        });
    };
    
    const toggleEntity = (entity: string) => {
        setSelectedEntities(prev => {
            if (prev.includes(entity)) {
                return prev.filter(e => e !== entity);
            } else {
                return [...prev, entity];
            }
        });
    };
    
    const toggleSection = (sectionName: string) => {
        setExpandedSections(prev => {
            const newSet = new Set(prev);
            if (newSet.has(sectionName)) {
                newSet.delete(sectionName);
            } else {
                newSet.add(sectionName);
            }
            return newSet;
        });
    };
    
    const getVisibleLineItems = (): PnLLineItem[] => {
        const visible: PnLLineItem[] = [];
        let currentSection: string | null = null;
        
        pnlLineItems.forEach(item => {
            const isSectionHeader = item.isTotal && item.indent === 0;
            
            if (isSectionHeader) {
                // Determine section name
                if (item.label === 'Revenue') {
                    currentSection = 'Revenue';
                } else if (item.label === 'Operating Expenses') {
                    currentSection = 'OperatingExpenses';
                } else {
                    currentSection = null;
                }
                
                // Section headers are always visible
                visible.push(item);
            } else {
                // Detail items - show if section is expanded
                if (currentSection === 'Revenue' && expandedSections.has('Revenue')) {
                    visible.push(item);
                } else if (currentSection === 'OperatingExpenses' && expandedSections.has('OperatingExpenses')) {
                    visible.push(item);
                } else if (!currentSection) {
                    // Items not in collapsible sections are always visible
                    visible.push(item);
                }
            }
        });
        
        return visible;
    };
    
    const displayEntities = selectedEntities.length > 0 ? [...selectedEntities, 'Total'] : ['Total'];
    
    // Generate table header columns
    const tableColumns = useMemo(() => {
        const columns: Array<{ entity: string; period: string }> = [];
        displayEntities.forEach(entity => {
            selectedPeriods.forEach(period => {
                columns.push({ entity, period });
            });
        });
        return columns;
    }, [displayEntities, selectedPeriods]);
    
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Profit & Loss Statement</h1>
                        <p className="text-sm text-gray-600 mt-1">Asset Management Company - Financial Performance</p>
                    </div>
                    <div className="flex items-center space-x-3">
                        <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 flex items-center space-x-2">
                            <Download className="w-4 h-4" />
                            <span>Export</span>
                        </button>
                        <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 flex items-center space-x-2">
                            <Settings className="w-4 h-4" />
                            <span>Settings</span>
                        </button>
                    </div>
                </div>

                {/* Slicers */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    {/* Entity Selection */}
                    <div className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-3">
                            <Filter className="w-4 h-4 text-gray-600" />
                            <h3 className="text-sm font-semibold text-gray-900">Business Units</h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {availableEntities.filter(e => e !== 'Total').map(entity => (
                                <button
                                    key={entity}
                                    onClick={() => toggleEntity(entity)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                        selectedEntities.includes(entity)
                                            ? 'bg-blue-600 text-white shadow-md'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    {entity}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Periods Selection */}
                    <div className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-3">
                            <BarChart3 className="w-4 h-4 text-gray-600" />
                            <h3 className="text-sm font-semibold text-gray-900">Periods</h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {availablePeriods.map(period => {
                                const isSelected = selectedPeriods.includes(period);
                                return (
                                    <button
                                        key={period}
                                        onClick={() => togglePeriod(period)}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                            isSelected
                                                ? 'bg-green-500 text-white shadow-md hover:bg-green-600'
                                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                                        }`}
                                    >
                                        {period}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* P&L Table */}
            {selectedPeriods.length > 0 && (
                <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b-2 border-gray-200">
                                <tr>
                                    <th className="text-left py-4 px-6 font-semibold text-gray-900 sticky left-0 bg-gray-50 z-10 min-w-[250px]">
                                        Line Item
                                    </th>
                                    {tableColumns.map((col, idx) => (
                                        <th key={`${col.entity}-${col.period}-${idx}`} className="text-right py-4 px-3 font-semibold text-gray-900 min-w-[140px]">
                                            <div className="flex flex-col">
                                                <span className="text-xs text-gray-500">{col.entity}</span>
                                                <span>{col.period}</span>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {/* P&L Line Items */}
                                {getVisibleLineItems().map((item, idx) => {
                                    const isSectionHeader = item.isTotal && item.indent === 0;
                                    const sectionName = item.label === 'Revenue' ? 'Revenue' 
                                                        : item.label === 'Operating Expenses' ? 'OperatingExpenses'
                                                        : null;
                                    const isExpanded = sectionName ? expandedSections.has(sectionName) : false;
                                    
                                    const rowId = `field-${item.fieldName}-${idx}`;
                                    
                                    return (
                                        <tr 
                                            id={rowId}
                                            key={`${item.label}-${idx}`}
                                            className={`hover:bg-gray-50 transition-colors ${
                                                item.isTotal ? 'bg-yellow-50 font-semibold border-t border-gray-200' : ''
                                            }`}
                                        >
                                            <td 
                                                className={`py-3 px-6 text-gray-900 sticky left-0 z-10 ${
                                                    item.isTotal ? 'bg-yellow-50' : 'bg-white'
                                                }`} 
                                                style={{ paddingLeft: `${(item.indent || 0) * 24 + 24}px` }}
                                            >
                                                <div className="flex items-center space-x-2">
                                                    {isSectionHeader && sectionName ? (
                                                        <button
                                                            onClick={() => toggleSection(sectionName)}
                                                            className="flex items-center justify-center w-5 h-5 hover:bg-gray-200 rounded transition-colors"
                                                            aria-label={isExpanded ? 'Collapse' : 'Expand'}
                                                        >
                                                            {isExpanded ? (
                                                                <ChevronDown className="w-4 h-4 text-gray-600" />
                                                            ) : (
                                                                <ChevronRight className="w-4 h-4 text-gray-600" />
                                                            )}
                                                        </button>
                                                    ) : (
                                                        <span className="w-5"></span>
                                                    )}
                                                    <span>{item.label}</span>
                                                </div>
                                            </td>
                                            {tableColumns.map((col, colIdx) => {
                                                const value = sampleData[col.entity]?.[col.period]?.[item.fieldName] || 0;
                                                const displayValue = item.isPercentage 
                                                    ? formatPercentage(value)
                                                    : formatCurrency(value);
                                                
                                                // Calculate trend vs previous period for same entity
                                                let trendValue: number | null = null;
                                                if (colIdx > 0 && item.fieldName) {
                                                    const prevCol = tableColumns[colIdx - 1];
                                                    if (prevCol.entity === col.entity) {
                                                        const prevValue = sampleData[col.entity]?.[prevCol.period]?.[item.fieldName] || 0;
                                                        if (prevValue !== 0) {
                                                            trendValue = ((value - prevValue) / Math.abs(prevValue)) * 100;
                                                        } else if (value !== 0) {
                                                            trendValue = value > 0 ? 100 : -100;
                                                        }
                                                    }
                                                }
                                                
                                                const trendIsPositive = trendValue !== null && trendValue >= 0;
                                                
                                                return (
                                                    <td 
                                                        key={`${col.entity}-${col.period}-${colIdx}`}
                                                        className={`py-3 px-3 text-right ${
                                                            item.isTotal 
                                                                ? 'font-semibold text-gray-900' 
                                                                : 'text-gray-700'
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-end space-x-2">
                                                            <span>{displayValue}</span>
                                                            {trendValue !== null && !item.isPercentage && (
                                                                <span className={`flex items-center space-x-0.5 text-xs font-medium ${
                                                                    trendIsPositive ? 'text-green-600' : 'text-red-600'
                                                                }`}>
                                                                    <TrendingUp className={`w-3 h-3 ${
                                                                        trendIsPositive ? '' : 'rotate-180'
                                                                    }`} />
                                                                    <span>{trendIsPositive ? '+' : ''}{trendValue.toFixed(1)}%</span>
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                                
                                {/* Key Metrics Section */}
                                <tr>
                                    <td colSpan={tableColumns.length + 1} className="py-2 bg-yellow-100">
                                        <div className="px-6 font-semibold text-gray-900">Key Metrics</div>
                                    </td>
                                </tr>
                                {keyMetricsItems.map((item, idx) => (
                                    <tr key={`metrics-${item.label}-${idx}`} className="hover:bg-gray-50">
                                        <td className="py-3 px-6 text-gray-700 sticky left-0 bg-white z-10" style={{ paddingLeft: '48px' }}>
                                            {item.label}
                                        </td>
                                        {tableColumns.map((col, colIdx) => {
                                            const value = sampleData[col.entity]?.[col.period]?.[item.fieldName] || 0;
                                            const displayValue = item.isPercentage 
                                                ? formatPercentage(value)
                                                : item.fieldName === 'AUM' || item.fieldName === 'NetFlows'
                                                ? formatCurrency(value)
                                                : formatCurrency(value);
                                            
                                            return (
                                                <td key={`${col.entity}-${col.period}-${colIdx}`} className="py-3 px-3 text-right text-gray-700">
                                                    {displayValue}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                                
                                {/* Spacer row */}
                                <tr>
                                    <td colSpan={tableColumns.length + 1} className="py-2"></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {selectedPeriods.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
                    <p className="text-amber-800 font-medium">Please select at least one period to view the P&L statement.</p>
                </div>
            )}
        </div>
    );
}

export default function PnL() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        }>
            <PnLContent />
        </Suspense>
    );
}

