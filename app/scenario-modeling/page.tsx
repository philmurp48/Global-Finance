'use client';

import { useState, useMemo, useEffect } from 'react';
import {
    ChevronRight,
    ChevronDown,
    DollarSign,
    RefreshCw,
    Save,
    Play,
    Sliders,
    TrendingUp,
    BarChart3
} from 'lucide-react';
import { ExcelDriverTreeData, FactMarginRecord } from '@/lib/excel-parser';

interface ScenarioLever {
    id: string;
    name: string;
    fieldName: string; // Field name in Fact_Margin
    currentValue: number; // Percentage change
    minValue: number;
    maxValue: number;
    unit: string;
    affectsField: string; // Which P&L field this affects
    affectsTotal: string; // Which total this affects (TotalRevenue or Total Expense)
}

interface PnLLineItem {
    label: string;
    fieldName: string;
    isTotal?: boolean;
    indent?: number;
}

interface PnLData {
    [period: string]: {
        [fieldName: string]: number;
    };
}

// Helper function to get field value from record with fuzzy matching
const getFieldValue = (record: FactMarginRecord, fieldName: string): number | null => {
    if (!record || !fieldName) return null;
    
    const normalizeFieldName = (name: string) => {
        return name
            .toLowerCase()
            .replace(/\$mm/g, '')
            .replace(/\$m(?![a-z])/g, '')
            .replace(/mm(?![a-z])/g, '')
            .replace(/_bps/g, '')
            .replace(/_pct/g, '')
            .replace(/_annual/g, '')
            .replace(/_fte/g, '')
            .replace(/[^a-z0-9]/g, '')
            .trim();
    };
    
    const extractCoreWords = (name: string): string[] => {
        const normalized = name.toLowerCase()
            .replace(/\$mm/g, ' ')
            .replace(/\$m(?![a-z])/g, ' ')
            .replace(/mm(?![a-z])/g, ' ')
            .replace(/_bps/g, ' ')
            .replace(/_pct/g, ' ')
            .replace(/_annual/g, ' ')
            .replace(/_fte/g, ' ')
            .replace(/[^a-z0-9\s_]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        
        return normalized.split(/[\s_]+/)
            .filter(w => w.length > 1)
            .map(w => w.replace(/[^a-z0-9]/g, ''));
    };
    
    const targetNormalized = normalizeFieldName(fieldName);
    const targetCoreWords = extractCoreWords(fieldName);
    
    // Strategy 1: Exact normalized match
    for (const [key, value] of Object.entries(record)) {
        const keyLower = key.toLowerCase();
        if (keyLower.includes('id') || keyLower.includes('period') || keyLower.includes('date') || keyLower.includes('quarter')) continue;
        
        const keyNormalized = normalizeFieldName(key);
        if (keyNormalized === targetNormalized && keyNormalized.length > 0) {
            const numValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
            if (!isNaN(numValue)) {
                return numValue;
            }
        }
    }
    
    // Strategy 2: Contains match
    for (const [key, value] of Object.entries(record)) {
        const keyLower = key.toLowerCase();
        if (keyLower.includes('id') || keyLower.includes('period') || keyLower.includes('date') || keyLower.includes('quarter')) continue;
        
        const keyNormalized = normalizeFieldName(key);
        if (keyNormalized.length > 3 && targetNormalized.length > 3) {
            if (keyNormalized.includes(targetNormalized) || targetNormalized.includes(keyNormalized)) {
                const numValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
                if (!isNaN(numValue)) {
                    return numValue;
                }
            }
        }
    }
    
    // Strategy 3: Word-by-word matching
    if (targetCoreWords.length > 0) {
        for (const [key, value] of Object.entries(record)) {
            const keyLower = key.toLowerCase();
            if (keyLower.includes('id') || keyLower.includes('period') || keyLower.includes('date') || keyLower.includes('quarter')) continue;
            
            const keyCoreWords = extractCoreWords(key);
            const allWordsMatch = targetCoreWords.length > 0 && 
                targetCoreWords.every(tWord => 
                    tWord.length > 2 && keyCoreWords.some(kWord => 
                        kWord.includes(tWord) || tWord.includes(kWord) || kWord === tWord
                    )
                );
            
            if (allWordsMatch) {
                const numValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
                if (!isNaN(numValue)) {
                    return numValue;
                }
            }
        }
    }
    
    // Strategy 4: Partial word matching
    for (const [key, value] of Object.entries(record)) {
        const keyLower = key.toLowerCase();
        if (keyLower.includes('id') || keyLower.includes('period') || keyLower.includes('date') || keyLower.includes('quarter')) continue;
        
        const allWordsFound = targetCoreWords.length > 0 && 
            targetCoreWords.every(tWord => tWord.length > 2 && keyLower.includes(tWord));
        
        if (allWordsFound) {
            const numValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
            if (!isNaN(numValue)) {
                return numValue;
            }
        }
    }
    
    return null;
};

export default function ScenarioModelingPage() {
    const [excelData, setExcelData] = useState<ExcelDriverTreeData | null>(null);
    const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);
    const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
    
    // Scenario levers based on Fact_Margin fields
    const [leverValues, setLeverValues] = useState<Record<string, number>>({
        AUM: 0,
        TxnFeeRate: 0,
        TradingVolume: 0,
        Headcount_FTE: 0
    });

    // Load Excel data on mount
    useEffect(() => {
        const loadData = async () => {
            try {
                const response = await fetch('/api/excel-data');
                if (response.ok) {
                    const result = await response.json();
                    if (result.data) {
                        const parsed = result.data;
                        const restoredData: ExcelDriverTreeData = {
                            tree: parsed.tree || [],
                            accountingFacts: new Map(parsed.accountingFacts || []),
                            factMarginRecords: parsed.factMarginRecords || [],
                            dimensionTables: new Map(Object.entries(parsed.dimensionTables || {}).map(([k, v]) => [k, new Map(Object.entries(v as any))]))
                        };
                        setExcelData(restoredData);
                    }
                }
            } catch (error) {
                console.error('Failed to load Excel data:', error);
            }
        };

        loadData();
    }, []);

    // Extract available periods from Fact_Margin Quarter field
    useEffect(() => {
        if (!excelData || !excelData.factMarginRecords) return;

        const quarters = new Set<string>();
        excelData.factMarginRecords.forEach(record => {
            if (!record) return;
            const quarterKey = Object.keys(record).find(key => 
                key.toLowerCase() === 'quarter'
            );
            if (quarterKey) {
                const quarterValue = record[quarterKey];
                if (quarterValue !== undefined && quarterValue !== null && quarterValue !== '') {
                    quarters.add(String(quarterValue));
                }
            }
        });
        
        const sortedQuarters = Array.from(quarters).sort();
        setAvailablePeriods(sortedQuarters);
        
        // Select all periods by default
        if (sortedQuarters.length > 0 && selectedPeriods.length === 0) {
            setSelectedPeriods(sortedQuarters);
        }
    }, [excelData]);

    // P&L Line Items Structure (matching operational reporting)
    const pnlLineItems: PnLLineItem[] = [
        // Revenue Section
        { label: 'Revenue', fieldName: '', isTotal: true, indent: 0 },
        { label: 'Total Revenue', fieldName: 'TotalRevenue', isTotal: true, indent: 1 },
        { label: 'Rev Transaction Fees', fieldName: 'Rev Transaction Fees', indent: 2 },
        { label: 'Rev CustodySafekeeping', fieldName: 'Rev CustodySafekeeping', indent: 2 },
        { label: 'AdminFundExpense', fieldName: 'AdminFundExpense', indent: 2 },
        { label: 'PerformanceFees', fieldName: 'PerformanceFees', indent: 2 },
        { label: 'Interest Rate Revenue', fieldName: 'Interest Rate Revenue', indent: 2 },
        
        // Expense Section
        { label: 'Expenses', fieldName: '', isTotal: true, indent: 0 },
        { label: 'Total Expense', fieldName: 'Total Expense', isTotal: true, indent: 1 },
        { label: 'Exp_CompBenefits', fieldName: 'Exp_CompBenefits', indent: 2 },
        { label: 'Exp_Tech and Data', fieldName: 'Exp_Tech and Data', indent: 2 },
        { label: 'Exp_SalesMktg', fieldName: 'Exp_SalesMktg', indent: 2 },
        { label: 'Exp_OpsProfSvcs', fieldName: 'Exp_OpsProfSvcs', indent: 2 },
    ];

    // Calculate base P&L data from Fact_Margin actuals
    const basePnLData = useMemo(() => {
        if (!excelData || !excelData.factMarginRecords || excelData.factMarginRecords.length === 0) {
            return {} as PnLData;
        }

        const data: PnLData = {};

        excelData.factMarginRecords.forEach(record => {
            if (!record) return;

            // Get quarter
            const quarterKey = Object.keys(record).find(key => 
                key.toLowerCase() === 'quarter'
            );
            if (!quarterKey) return;
            
            const quarter = record[quarterKey];
            if (!quarter || quarter === null || quarter === undefined || quarter === '') return;
            const period = String(quarter);

            if (!data[period]) {
                data[period] = {};
            }

            // Aggregate amounts for each line item
            pnlLineItems.forEach(item => {
                if (!item.fieldName || item.isTotal) return;

                const fieldValue = getFieldValue(record, item.fieldName);
                if (fieldValue !== null && !isNaN(fieldValue)) {
                    if (!data[period][item.fieldName]) {
                        data[period][item.fieldName] = 0;
                    }
                    data[period][item.fieldName] += fieldValue;
                }
            });
        });

        // Calculate totals
        Object.keys(data).forEach(period => {
            const periodData = data[period];
            
            // Calculate Total Revenue
            const totalRevenue = 
                (periodData['Rev Transaction Fees'] || 0) +
                (periodData['Rev CustodySafekeeping'] || 0) +
                (periodData['AdminFundExpense'] || 0) +
                (periodData['PerformanceFees'] || 0) +
                (periodData['Interest Rate Revenue'] || 0);
            periodData['TotalRevenue'] = totalRevenue;

            // Calculate Total Expense
            const totalExpense = 
                (periodData['Exp_CompBenefits'] || 0) +
                (periodData['Exp_Tech and Data'] || 0) +
                (periodData['Exp_SalesMktg'] || 0) +
                (periodData['Exp_OpsProfSvcs'] || 0);
            periodData['Total Expense'] = totalExpense;

            // Calculate Margin
            periodData['Margin'] = totalRevenue - totalExpense;
            periodData['MarginPct'] = totalRevenue !== 0 ? (periodData['Margin'] / totalRevenue) * 100 : 0;
        });

        return data;
    }, [excelData]);

    // Calculate impact percentages from actuals data
    const impactPercentages = useMemo(() => {
        if (!excelData || !excelData.factMarginRecords || excelData.factMarginRecords.length === 0) {
            return {
                AUM_to_AdminFundExpense: 0,
                TxnFeeRate_to_TransactionFees: 0,
                TradingVolume_to_TransactionFees: 0,
                Headcount_FTE_to_CompBenefits: 0
            };
        }

        // Calculate correlations from actuals
        let aumSum = 0;
        let adminFundExpenseSum = 0;
        let txnFeeRateSum = 0;
        let transactionFeesSum = 0;
        let tradingVolumeSum = 0;
        let headcountSum = 0;
        let compBenefitsSum = 0;
        let recordCount = 0;

        excelData.factMarginRecords.forEach(record => {
            if (!record) return;

            const aum = getFieldValue(record, 'AUM');
            const adminFundExpense = getFieldValue(record, 'AdminFundExpense');
            const txnFeeRate = getFieldValue(record, 'TxnFeeRate');
            const transactionFees = getFieldValue(record, 'Rev Transaction Fees');
            const tradingVolume = getFieldValue(record, 'TradingVolume');
            const headcount = getFieldValue(record, 'Headcount');
            const compBenefits = getFieldValue(record, 'Exp_CompBenefits');

            if (aum !== null && adminFundExpense !== null && adminFundExpense !== 0) {
                aumSum += aum;
                adminFundExpenseSum += adminFundExpense;
            }

            if (txnFeeRate !== null && transactionFees !== null && transactionFees !== 0) {
                txnFeeRateSum += txnFeeRate;
                transactionFeesSum += transactionFees;
            }

            if (tradingVolume !== null && transactionFees !== null && transactionFees !== 0) {
                tradingVolumeSum += tradingVolume;
            }

            if (headcount !== null && compBenefits !== null && compBenefits !== 0) {
                headcountSum += headcount;
                compBenefitsSum += compBenefits;
            }

            recordCount++;
        });

        // Calculate impact sensitivity from actuals
        // These represent the sensitivity: what % change in the metric results from 1% change in the driver
        // AUM to AdminFundExpense: Calculate the ratio to determine sensitivity
        // If AdminFundExpense is typically X% of AUM, then 1% AUM change = 1% AdminFundExpense change (direct)
        const aumToAdmin = 1.0; // Direct relationship: 1% AUM change = 1% AdminFundExpense change

        // TxnFeeRate to TransactionFees: direct relationship
        const txnFeeRateToFees = 1.0; // 1% rate change = 1% fees change

        // TradingVolume to TransactionFees: direct relationship (volume drives fees)
        const tradingVolumeToFees = 1.0; // 1% volume change = 1% fees change

        // Headcount to CompBenefits: direct relationship
        const headcountToComp = 1.0; // 1% headcount change = 1% comp benefits change

        return {
            AUM_to_AdminFundExpense: aumToAdmin,
            TxnFeeRate_to_TransactionFees: txnFeeRateToFees,
            TradingVolume_to_TransactionFees: tradingVolumeToFees,
            Headcount_FTE_to_CompBenefits: headcountToComp
        };
    }, [excelData]);

    // Calculate scenario P&L with lever impacts
    const scenarioPnLData = useMemo(() => {
        if (!basePnLData || Object.keys(basePnLData).length === 0) {
            return {} as PnLData;
        }

        const data: PnLData = {};

        // Filter to selected periods only
        const periodsToProcess = selectedPeriods.length > 0 
            ? selectedPeriods.filter(p => basePnLData[p])
            : Object.keys(basePnLData);

        periodsToProcess.forEach(period => {
            const baseData = basePnLData[period];
            if (!baseData) return;

            data[period] = { ...baseData };

            // Apply AUM impact to AdminFundExpense
            // If AUM changes by X%, AdminFundExpense changes by X% (direct relationship)
            const aumChange = leverValues.AUM || 0;
            if (aumChange !== 0) {
                const baseAdminFundExpense = baseData['AdminFundExpense'] || 0;
                const aumImpact = baseAdminFundExpense * (aumChange / 100);
                data[period]['AdminFundExpense'] = baseAdminFundExpense + aumImpact;
            }

            // Apply TxnFeeRate impact to Transaction Fees
            // If TxnFeeRate changes by X%, Transaction Fees change by X% (direct relationship)
            const txnFeeRateChange = leverValues.TxnFeeRate || 0;
            if (txnFeeRateChange !== 0) {
                const baseTransactionFees = baseData['Rev Transaction Fees'] || 0;
                const txnFeeRateImpact = baseTransactionFees * (txnFeeRateChange / 100);
                data[period]['Rev Transaction Fees'] = (data[period]['Rev Transaction Fees'] || baseTransactionFees) + txnFeeRateImpact;
            }

            // Apply TradingVolume impact to Transaction Fees
            // If TradingVolume changes by X%, Transaction Fees change by X% (direct relationship)
            const tradingVolumeChange = leverValues.TradingVolume || 0;
            if (tradingVolumeChange !== 0) {
                const baseTransactionFees = baseData['Rev Transaction Fees'] || 0;
                const tradingVolumeImpact = baseTransactionFees * (tradingVolumeChange / 100);
                data[period]['Rev Transaction Fees'] = (data[period]['Rev Transaction Fees'] || baseTransactionFees) + tradingVolumeImpact;
            }

            // Apply Headcount FTE impact to CompBenefits
            // If Headcount changes by X%, CompBenefits change by X% (direct relationship)
            const headcountChange = leverValues.Headcount_FTE || 0;
            if (headcountChange !== 0) {
                const baseCompBenefits = baseData['Exp_CompBenefits'] || 0;
                const headcountImpact = baseCompBenefits * (headcountChange / 100);
                data[period]['Exp_CompBenefits'] = baseCompBenefits + headcountImpact;
            }

            // Recalculate totals
            const totalRevenue = 
                (data[period]['Rev Transaction Fees'] || 0) +
                (data[period]['Rev CustodySafekeeping'] || 0) +
                (data[period]['AdminFundExpense'] || 0) +
                (data[period]['PerformanceFees'] || 0) +
                (data[period]['Interest Rate Revenue'] || 0);
            data[period]['TotalRevenue'] = totalRevenue;

            const totalExpense = 
                (data[period]['Exp_CompBenefits'] || 0) +
                (data[period]['Exp_Tech and Data'] || 0) +
                (data[period]['Exp_SalesMktg'] || 0) +
                (data[period]['Exp_OpsProfSvcs'] || 0);
            data[period]['Total Expense'] = totalExpense;

            data[period]['Margin'] = totalRevenue - totalExpense;
            data[period]['MarginPct'] = totalRevenue !== 0 ? (data[period]['Margin'] / totalRevenue) * 100 : 0;
        });

        return data;
    }, [basePnLData, leverValues, impactPercentages, selectedPeriods]);

    // Scenario levers configuration
    const scenarioLevers: ScenarioLever[] = [
        {
            id: 'AUM',
            name: 'AUM',
            fieldName: 'AUM',
            currentValue: leverValues.AUM || 0,
            minValue: -50,
            maxValue: 50,
            unit: '%',
            affectsField: 'AdminFundExpense',
            affectsTotal: 'TotalRevenue'
        },
        {
            id: 'TxnFeeRate',
            name: 'Txn Fee Rate',
            fieldName: 'TxnFeeRate',
            currentValue: leverValues.TxnFeeRate || 0,
            minValue: -50,
            maxValue: 50,
            unit: '%',
            affectsField: 'Rev Transaction Fees',
            affectsTotal: 'TotalRevenue'
        },
        {
            id: 'TradingVolume',
            name: 'Trading Volume',
            fieldName: 'TradingVolume',
            currentValue: leverValues.TradingVolume || 0,
            minValue: -50,
            maxValue: 50,
            unit: '%',
            affectsField: 'Rev Transaction Fees',
            affectsTotal: 'TotalRevenue'
        },
        {
            id: 'Headcount_FTE',
            name: 'Headcount FTE',
            fieldName: 'Headcount',
            currentValue: leverValues.Headcount_FTE || 0,
            minValue: -50,
            maxValue: 50,
            unit: '%',
            affectsField: 'Exp_CompBenefits',
            affectsTotal: 'Total Expense'
        }
    ];

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

        pnlLineItems.forEach((item, index) => {
            // Section headers (Revenue, Expenses) - always visible
            if (item.isTotal && !item.fieldName) {
                const nextItem = pnlLineItems[index + 1];
                if (nextItem && nextItem.isTotal && nextItem.fieldName && nextItem.indent === 1) {
                    visible.push({
                        ...nextItem,
                        combineWithHeader: true,
                        sectionHeader: item
                    } as any);
                } else {
                    visible.push(item);
                }

                if (item.label === 'Revenue') {
                    currentSection = 'Revenue';
                } else if (item.label === 'Expenses') {
                    currentSection = 'Expenses';
                }
            }
            // Total lines (indent 1) - skip if already combined with header
            else if (item.isTotal && item.fieldName && item.indent === 1) {
                const alreadyAdded = visible.some(v => (v as any).label === item.label && (v as any).combineWithHeader);
                if (!alreadyAdded) {
                    visible.push(item);
                }
            }
            // Detail lines (indent 2) - only show if section is expanded
            else if (item.indent === 2 && !item.isTotal) {
                if (currentSection && expandedSections.has(currentSection)) {
                    visible.push(item);
                }
            }
        });

        return visible;
    };

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

    const handleLeverChange = (leverId: string, value: number) => {
        setLeverValues(prev => ({ ...prev, [leverId]: value }));
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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Scenario Modeling</h1>
                        <p className="text-sm text-gray-600 mt-1">Model different scenarios by adjusting key levers</p>
                    </div>
                    <div className="flex items-center space-x-3">
                        <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 flex items-center space-x-2">
                            <RefreshCw className="w-4 h-4" />
                            <span>Reset</span>
                        </button>
                        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center space-x-2">
                            <Save className="w-4 h-4" />
                            <span>Save Scenario</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-12 gap-6">
                {/* Left Panel - Adjust Levers */}
                <div className="col-span-4">
                    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
                        <div className="flex items-center space-x-2 mb-4">
                            <Sliders className="w-5 h-5 text-gray-600" />
                            <h3 className="text-lg font-semibold text-gray-900">Adjust Levers</h3>
                        </div>
                        <div className="space-y-6">
                            {scenarioLevers.map(lever => (
                                <div key={lever.id}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div>
                                            <label className="text-sm font-medium text-gray-700">{lever.name}</label>
                                            <p className="text-xs text-gray-500">Affects: {lever.affectsField}</p>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <span className={`text-sm font-semibold ${
                                                (leverValues[lever.id] ?? 0) > 0 ? 'text-green-600' :
                                                (leverValues[lever.id] ?? 0) < 0 ? 'text-red-600' :
                                                'text-gray-600'
                                            }`}>
                                                {(leverValues[lever.id] ?? 0) > 0 ? '+' : ''}{leverValues[lever.id] ?? 0}{lever.unit}
                                            </span>
                                        </div>
                                    </div>
                                    <input
                                        type="range"
                                        min={lever.minValue}
                                        max={lever.maxValue}
                                        step="1"
                                        value={leverValues[lever.id] ?? 0}
                                        onChange={(e) => handleLeverChange(lever.id, parseFloat(e.target.value))}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                        style={{
                                            background: `linear-gradient(to right, #e5e7eb ${(((leverValues[lever.id] ?? 0) - lever.minValue) / (lever.maxValue - lever.minValue)) * 100}%, #3b82f6 ${(((leverValues[lever.id] ?? 0) - lever.minValue) / (lever.maxValue - lever.minValue)) * 100}%)`
                                        }}
                                    />
                                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                                        <span>{lever.minValue}%</span>
                                        <span>{lever.maxValue}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Panel - P&L and Driver Tree */}
                <div className="col-span-8 space-y-6">
                    {/* P&L Panel */}
                    <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                        <div className="p-6 border-b border-gray-200">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center space-x-2">
                                    <BarChart3 className="w-5 h-5 text-gray-600" />
                                    <h3 className="text-lg font-semibold text-gray-900">P&L Impact</h3>
                                </div>
                                {/* Period Multi-select */}
                                <div className="flex items-center space-x-2">
                                    <span className="text-sm text-gray-600">Periods:</span>
                                    <div className="flex flex-wrap gap-2">
                                        {availablePeriods.map(period => (
                                            <button
                                                key={period}
                                                onClick={() => togglePeriod(period)}
                                                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                                                    selectedPeriods.includes(period)
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                }`}
                                            >
                                                {period}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b-2 border-gray-200">
                                    <tr>
                                        <th className="text-left py-4 px-6 font-semibold text-gray-900 sticky left-0 bg-gray-50 z-10 min-w-[250px]">
                                            Line Item
                                        </th>
                                        {selectedPeriods.map(period => (
                                            <th key={period} className="text-right py-4 px-3 font-semibold text-gray-900 min-w-[160px]">
                                                {period}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {Object.keys(scenarioPnLData).length > 0 ? (
                                        getVisibleLineItems().map((item, idx) => {
                                            const isSectionHeader = item.isTotal && !item.fieldName;
                                            const isCombinedWithHeader = (item as any).combineWithHeader && (item as any).sectionHeader;
                                            
                                            const sectionName = (item as any).sectionHeader?.label === 'Revenue' ? 'Revenue' 
                                                                : (item as any).sectionHeader?.label === 'Expenses' ? 'Expenses'
                                                                : item.label === 'Revenue' ? 'Revenue' 
                                                                : item.label === 'Expenses' ? 'Expenses' 
                                                                : null;
                                            const isExpanded = sectionName ? expandedSections.has(sectionName) : false;
                                            
                                            const displayLabel = isCombinedWithHeader ? (item as any).sectionHeader!.label : item.label;
                                            
                                            return (
                                                <tr 
                                                    key={`${item.label}-${idx}`}
                                                    className={`hover:bg-gray-50 ${
                                                        item.isTotal ? 'bg-gray-50 font-semibold border-t border-gray-200' : ''
                                                    }`}
                                                >
                                                    <td className={`py-3 px-6 text-gray-900 sticky left-0 z-10 ${
                                                        item.isTotal ? 'bg-gray-50' : 'bg-white'
                                                    }`} style={{ paddingLeft: `${(item.indent || 0) * 24 + 24}px` }}>
                                                        <div className="flex items-center space-x-2">
                                                            {(isSectionHeader || isCombinedWithHeader) && sectionName ? (
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
                                                            <span>{displayLabel}</span>
                                                        </div>
                                                    </td>
                                                    {selectedPeriods.map((period, periodIdx) => {
                                                        const fieldNameToUse = (item as any).combineWithHeader ? item.fieldName : item.fieldName;
                                                        const value = scenarioPnLData[period]?.[fieldNameToUse] || 0;
                                                        const baseValue = basePnLData[period]?.[fieldNameToUse] || 0;
                                                        const change = value - baseValue;
                                                        const displayValue = formatCurrency(value);
                                                        
                                                        return (
                                                            <td 
                                                                key={period}
                                                                className={`py-3 px-3 text-right ${
                                                                    item.isTotal 
                                                                        ? 'font-semibold text-gray-900' 
                                                                        : 'text-gray-700'
                                                                }`}
                                                            >
                                                                {fieldNameToUse ? (
                                                                    <div className="flex flex-col items-end space-y-1">
                                                                        <span>{displayValue}</span>
                                                                        {change !== 0 && (
                                                                            <span className={`text-xs font-medium ${
                                                                                change >= 0 ? 'text-green-600' : 'text-red-600'
                                                                            }`}>
                                                                                {change >= 0 ? '+' : ''}{formatCurrency(change)}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    '-'
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={selectedPeriods.length + 1} className="py-8 text-center text-gray-500">
                                                No data available. Please upload Excel data with Fact_Margin records.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Performance Driver Tree */}
                    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Driver Tree</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Visualize how drivers impact performance. {excelData && excelData.tree.length > 0 ? 'Showing data from uploaded Excel file.' : 'Upload Excel data to see your actual driver tree.'}
                        </p>
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 min-h-[400px] max-h-[600px] overflow-y-auto">
                            {excelData && excelData.tree.length > 0 ? (
                                <div className="space-y-2">
                                    {excelData.tree.map((rootNode, index) => (
                                        <div key={rootNode.id} className="text-sm text-gray-700">
                                            {rootNode.name} (Level {rootNode.level})
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 text-center py-8">
                                    Performance Driver Tree will appear here when Excel data is uploaded.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
