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
import { ExcelDriverTreeData, FactMarginRecord, DriverTreeNode, PeriodData, NamingConventionRecord } from '@/lib/excel-parser';

interface ScenarioLever {
    id: string;
    name: string;
    factMarginFieldName: string; // Field name in Fact_Margin (e.g., "AUM_$mm")
    reportFieldName: string; // Report Field Name for display (e.g., "AUM")
    currentValue: number; // Percentage change
    minValue: number;
    maxValue: number;
    unit: string;
    affectsField: string; // Which P&L field this affects
    affectsTotal: string; // Which total this affects (TotalRevenue or Total Expense)
}

// Mapping table: Fact_Margin Field Name -> Report Field Name
const fieldNameMapping: Record<string, string> = {
    'TradingVolume_$mm': 'Trading Volume',
    'TxnFeeRate_bps': 'Rev Transaction Fees',
    'AUM_$mm': 'AUM',
    'CashBalances_$mm': 'Cash Balance',
    'NIM_bps_annual': 'NIM',
    'MarketReturn_pct': 'Market Return Percent',
    'Rev_TransactionalFees_$mm': 'Rev Transaction Fees',
    'Rev_CustodySafekeeping_$mm': 'Rev CustodySafekeeping',
    'Rev_AdminFundExpense_$mm': 'AdminFundExpense',
    'Rev_PerformanceFees_$mm': 'PerformanceFees',
    'Rev_InterestRateRevenue_$mm': 'Interest Rate Revenue',
    'TotalRevenue_$mm': 'TotalRevenue',
    'Headcount_FTE': 'Headcount',
    'Exp_CompBenefits_$mm': 'Exp_CompBenefits',
    'Exp_TechData_$mm': 'Exp_Tech and Data',
    'Exp_SalesMktg_$mm': 'Exp_SalesMktg',
    'Exp_OpsProfSvcs_$mm': 'Exp_OpsProfSvcs',
    'TotalExpense_$mm': 'Total Expense',
    'Margin_$mm': 'Margin',
    'MarginPct': 'MarginPct'
};

// Helper to get Report Field Name from Fact_Margin Field Name
const getReportFieldName = (factMarginFieldName: string): string => {
    // Try exact match first
    if (fieldNameMapping[factMarginFieldName]) {
        return fieldNameMapping[factMarginFieldName];
    }
    
    // Try fuzzy matching
    const factMarginLower = factMarginFieldName.toLowerCase();
    for (const [factField, reportField] of Object.entries(fieldNameMapping)) {
        const factFieldLower = factField.toLowerCase();
        if (factMarginLower.includes(factFieldLower) || factFieldLower.includes(factMarginLower)) {
            return reportField;
        }
    }
    
    // If no match, return original
    return factMarginFieldName;
};

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
    const [expandedDrivers, setExpandedDrivers] = useState<Set<string>>(new Set());
    
    // Expand to Level 2 by default
    useEffect(() => {
        if (excelData && excelData.tree && excelData.tree.length > 0) {
            const expanded = new Set<string>();
            const expandToLevel2 = (nodes: DriverTreeNode[], parentIndex: string = '', rootIndex: number = 0) => {
                nodes.forEach((node, index) => {
                    const nodeIndex = parentIndex 
                        ? `${parentIndex}-${node.id}` 
                        : `root-${rootIndex}-${node.id}`;
                    
                    // Expand if level is 1 or 2
                    if (node.level && node.level <= 2) {
                        expanded.add(nodeIndex);
                    }
                    
                    if (node.children && node.children.length > 0) {
                        expandToLevel2(node.children, nodeIndex, rootIndex);
                    }
                });
            };
            excelData.tree.forEach((rootNode, rootIndex) => expandToLevel2([rootNode], '', rootIndex));
            setExpandedDrivers(expanded);
        }
    }, [excelData]);
    
    // Scenario levers based on new structure
    const [leverValues, setLeverValues] = useState<Record<string, number>>({
        AvgAUM: 0,
        TradingVolume: 0,
        HeadcountFTE: 0,
        AcquisitionCostPerClient: 0
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
                            dimensionTables: new Map(Object.entries(parsed.dimensionTables || {}).map(([k, v]) => [k, new Map(Object.entries(v as any))])),
                            namingConventionRecords: parsed.namingConventionRecords || []
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

    // Expand to Level 2 by default
    useEffect(() => {
        if (excelData && excelData.tree && excelData.tree.length > 0) {
            const expanded = new Set<string>();
            const expandToLevel2 = (nodes: DriverTreeNode[], parentIndex: string = '', rootIndex: number = 0) => {
                nodes.forEach((node, index) => {
                    const nodeIndex = parentIndex 
                        ? `${parentIndex}-${node.id}` 
                        : `root-${rootIndex}-${node.id}`;
                    
                    // Expand if level is 1 or 2
                    if (node.level && node.level <= 2) {
                        expanded.add(nodeIndex);
                    }
                    
                    if (node.children && node.children.length > 0) {
                        expandToLevel2(node.children, nodeIndex, rootIndex);
                    }
                });
            };
            excelData.tree.forEach((rootNode, rootIndex) => expandToLevel2([rootNode], '', rootIndex));
            setExpandedDrivers(expanded);
        }
    }, [excelData]);

    // Extract available periods from Fact_Margin Quarter field
    useEffect(() => {
        if (!excelData || !excelData.factMarginRecords || excelData.factMarginRecords.length === 0) {
            console.warn('No Fact_Margin records available for period extraction');
            setAvailablePeriods([]);
            return;
        }

        const quarters = new Set<string>();
        excelData.factMarginRecords.forEach(record => {
            if (!record) return;
            
            // Try to find Quarter field (case-insensitive)
            const quarterKey = Object.keys(record).find(key => 
                key.toLowerCase() === 'quarter'
            );
            
            if (quarterKey) {
                const quarterValue = record[quarterKey];
                if (quarterValue !== undefined && quarterValue !== null && quarterValue !== '') {
                    const quarterStr = String(quarterValue).trim();
                    if (quarterStr) {
                        quarters.add(quarterStr);
                    }
                }
            } else {
                // Debug: log available keys if Quarter not found
                console.warn('Quarter field not found in record. Available keys:', Object.keys(record).slice(0, 10));
            }
        });
        
        const sortedQuarters = Array.from(quarters).sort();
        console.log('Extracted periods from Fact_Margin Quarter field:', sortedQuarters);
        setAvailablePeriods(sortedQuarters);
        
        // Auto-select all periods if none selected
        if (sortedQuarters.length > 0) {
            setSelectedPeriods(prev => {
                if (prev.length === 0) {
                    console.log('Auto-selecting all periods:', sortedQuarters);
                    return sortedQuarters;
                }
                return prev;
            });
        }
    }, [excelData]);

    // Build P&L Line Items Structure dynamically from NamingConvention (same as Operational Performance page)
    const pnlLineItems: PnLLineItem[] = useMemo(() => {
        const items: PnLLineItem[] = [];
        
        if (!excelData?.namingConventionRecords || excelData.namingConventionRecords.length === 0) {
            // Fallback to empty structure if no NamingConvention data
            return [];
        }

        // Find column names in NamingConvention (case-insensitive)
        const findColumnName = (records: NamingConventionRecord[], possibleNames: string[]): string | null => {
            if (records.length === 0) return null;
            const firstRecord = records[0];
            const keys = Object.keys(firstRecord);
            
            for (const possibleName of possibleNames) {
                const found = keys.find(k => k.toLowerCase() === possibleName.toLowerCase());
                if (found) return found;
            }
            return null;
        };

        const factMarginNamingCol = findColumnName(excelData.namingConventionRecords, [
            'Fact_Margin Naming', 'Fact_Margin naming', 'Fact Margin Naming', 
            'Fact Margin naming', 'Naming', 'Field Name', 'Fact_Margin Field Name'
        ]);
        const categoryCol = findColumnName(excelData.namingConventionRecords, [
            'Category', 'category'
        ]);
        const plImpactCol = findColumnName(excelData.namingConventionRecords, [
            'P&L Impact', 'P&L impact', 'P and L Impact', 'PL Impact', 'PL impact'
        ]);
        const leverImpactCol = findColumnName(excelData.namingConventionRecords, [
            'Lever Impact', 'Lever impact', 'Lever', 'Driver Impact', 'Driver impact'
        ]);

        if (!factMarginNamingCol) {
            console.warn('NamingConvention: Fact_Margin naming column not found');
            return [];
        }

        // Filter records where Category = 'Financial Result'
        const financialResultRecords = excelData.namingConventionRecords.filter(record => {
            if (!categoryCol) return true; // Include all if no category column
            const category = String(record[categoryCol] || '').trim();
            return category.toLowerCase() === 'financial result';
        });

        if (financialResultRecords.length === 0) {
            console.warn('NamingConvention: No records with Category = "Financial Result" found');
            return [];
        }

        // Group by P&L Impact
        const revenueItems: PnLLineItem[] = [];
        const expenseItems: PnLLineItem[] = [];
        const marginItems: PnLLineItem[] = [];

        // Track compensation fields for hierarchy
        const compensationFields = new Map<string, PnLLineItem>();
        let totalCompensationItem: PnLLineItem | null = null;

        financialResultRecords.forEach(record => {
            const fieldName = String(record[factMarginNamingCol] || '').trim();
            if (!fieldName) return;

            // Skip TotalRevenue_$mm and TotalExpense_$mm from detail items (they're totals, not details)
            const fieldNameLower = fieldName.toLowerCase();
            if (fieldNameLower === 'totalrevenue_$mm' || fieldNameLower === 'totalexpense_$mm') {
                return; // Skip these - they're handled as totals, not detail items
            }

            // Get P&L Impact value
            let plImpact = '';
            if (plImpactCol) {
                plImpact = String(record[plImpactCol] || '').trim().toLowerCase();
            }

            // Determine label (use field name or try to find a display name)
            const label = fieldName; // Use field name as label, can be enhanced later

            const lineItem: PnLLineItem = {
                label: label,
                fieldName: fieldName,
                indent: 2, // Detail items are indent 2
                isTotal: false
            };

            // Check if this is a compensation-related field for hierarchy
            const isCompensationField = fieldNameLower === 'totalcompensation_$mm' || 
                                       fieldNameLower === 'basecompensation_$mm' || 
                                       fieldNameLower === 'variablecompensation_$mm';
            
            if (fieldNameLower === 'totalcompensation_$mm') {
                totalCompensationItem = {
                    label: 'Total Compensation',
                    fieldName: fieldName,
                    indent: 1,
                    isTotal: true
                };
            } else if (fieldNameLower === 'basecompensation_$mm' || fieldNameLower === 'variablecompensation_$mm') {
                compensationFields.set(fieldName, lineItem);
            }

            // Only categorize non-compensation fields into revenue/expense items
            if (!isCompensationField) {
                // Categorize by P&L Impact
                if (plImpact.includes('revenue') || plImpact === 'revenue') {
                    revenueItems.push(lineItem);
                } else if (plImpact.includes('expense') || plImpact === 'expense') {
                    expenseItems.push(lineItem);
                } else if (plImpact.includes('margin') || plImpact === 'margin') {
                    marginItems.push(lineItem);
                } else {
                    // Default: if unclear, try to infer from field name
                    if (fieldNameLower.includes('rev') || fieldNameLower.includes('revenue')) {
                        revenueItems.push(lineItem);
                    } else if (fieldNameLower.includes('exp') || fieldNameLower.includes('expense')) {
                        expenseItems.push(lineItem);
                    } else {
                        // Default to expense if unclear
                        expenseItems.push(lineItem);
                    }
                }
            }
        });

        // Build structure: Section headers show totals directly, then details
        if (revenueItems.length > 0) {
            // Revenue section header shows TotalRevenue_$mm value directly (no separate total row)
            items.push({ label: 'Revenue', fieldName: 'TotalRevenue_$mm', isTotal: true, indent: 0 });
            items.push(...revenueItems);
        }

        if (expenseItems.length > 0) {
            // Expenses section header shows TotalExpense_$mm value directly (no separate total row)
            items.push({ label: 'Expenses', fieldName: 'TotalExpense_$mm', isTotal: true, indent: 0 });
            
            // Remove compensation items from expenseItems (they'll be added in hierarchy)
            const filteredExpenseItems = expenseItems.filter(item => {
                const itemFieldLower = item.fieldName.toLowerCase();
                return itemFieldLower !== 'basecompensation_$mm' && 
                       itemFieldLower !== 'variablecompensation_$mm' &&
                       itemFieldLower !== 'totalcompensation_$mm';
            });
            
            // Add all expense items together (compensation hierarchy will be mixed in)
            // First add non-compensation expenses
            items.push(...filteredExpenseItems);
            
            // Then add compensation hierarchy if it exists (alongside other expenses)
            if (totalCompensationItem) {
                // Add TotalCompensation_$mm with indent 1 (same level as other expenses)
                items.push(totalCompensationItem);
                
                // Add nested compensation items with indent 2 (under Total Compensation)
                let baseComp: PnLLineItem | undefined;
                let varComp: PnLLineItem | undefined;
                
                for (const [key, value] of compensationFields.entries()) {
                    const keyLower = key.toLowerCase();
                    if (keyLower === 'basecompensation_$mm') {
                        baseComp = value;
                    } else if (keyLower === 'variablecompensation_$mm') {
                        varComp = value;
                    }
                }
                
                if (baseComp) {
                    items.push({ ...baseComp, indent: 2 });
                }
                if (varComp) {
                    items.push({ ...varComp, indent: 2 });
                }
            }
        }

        return items;
    }, [excelData]);

    // Calculate base P&L data from Fact_Margin actuals
    const basePnLData = useMemo(() => {
        if (!excelData || !excelData.factMarginRecords || excelData.factMarginRecords.length === 0) {
            return {} as PnLData;
        }

        const data: PnLData = {};

        // Initialize all periods and fields
        const periods = new Set<string>();
        excelData.factMarginRecords.forEach(record => {
            if (!record) return;
            const quarterKey = Object.keys(record).find(key => key.toLowerCase() === 'quarter');
            if (quarterKey && record[quarterKey]) {
                periods.add(String(record[quarterKey]));
            }
        });

        periods.forEach(period => {
            data[period] = {};
            // Initialize all P&L fields
            pnlLineItems.forEach(item => {
                if (item.fieldName) {
                    data[period][item.fieldName] = 0;
                }
            });
            data[period]['Margin'] = 0;
            data[period]['MarginPct'] = 0;
            data[period]['Margin_$mm'] = 0;
        });

        // Aggregate data from Fact_Margin records (same as operational performance)
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

            // Aggregate amounts for each line item using getFieldValue (same as operational performance)
            pnlLineItems.forEach(item => {
                if (!item.fieldName) return;

                const fieldValue = getFieldValue(record, item.fieldName);
                if (fieldValue !== null && !isNaN(fieldValue)) {
                    if (data[period][item.fieldName] === undefined) {
                        data[period][item.fieldName] = 0;
                    }
                    data[period][item.fieldName] += fieldValue;
                }
            });
            
            // Aggregate Margin_$mm and MarginPct
            const marginValue = getFieldValue(record, 'Margin_$mm');
            if (marginValue !== null && !isNaN(marginValue)) {
                if (data[period]['Margin_$mm'] === undefined) data[period]['Margin_$mm'] = 0;
                data[period]['Margin_$mm'] += marginValue;
            }
            
            const marginPctValue = getFieldValue(record, 'MarginPct') || getFieldValue(record, 'Margin_%');
            if (marginPctValue !== null && !isNaN(marginPctValue)) {
                // Use the value from record (for now, could average if multiple records)
                if (data[period]['MarginPct'] === undefined || data[period]['MarginPct'] === 0) {
                    data[period]['MarginPct'] = marginPctValue;
                }
            }
        });

        // Set Margin from Margin_$mm and handle MarginPct
        Object.keys(data).forEach(period => {
            const periodData = data[period];
            
            // Use Margin_$mm directly from Fact_Margin data (don't calculate)
            const marginFromData = periodData['Margin_$mm'];
            if (marginFromData !== undefined && marginFromData !== null) {
                periodData['Margin'] = marginFromData;
            }
            
            // Handle MarginPct - check if it's a percentage or decimal
            if (periodData['MarginPct'] !== undefined && periodData['MarginPct'] !== null) {
                const marginPctValue = periodData['MarginPct'];
                if (Math.abs(marginPctValue) >= 1) {
                    // Already a percentage value (e.g., 83 means 83%)
                    periodData['MarginPct'] = marginPctValue;
                } else {
                    // Decimal value (e.g., 0.83 means 83%), multiply by 100
                    periodData['MarginPct'] = marginPctValue * 100;
                }
            }
        });

        console.log('basePnLData calculated:', Object.keys(data).length, 'periods');
        return data;
    }, [excelData, pnlLineItems]);

    // Build lever-to-field mapping from NamingConvention
    // Match lever name to "Report Naming" column, get impacted field from "Lever Impact" column
    const leverToFieldMapping = useMemo(() => {
        const mapping: Record<string, string[]> = {
            'Avg AUM': [],
            'Trading Volume': [],
            'Headcount FTE': [],
            'Acquisition Cost Per Client': []
        };

        if (!excelData?.namingConventionRecords || excelData.namingConventionRecords.length === 0) {
            console.warn('No NamingConvention records found for lever mapping');
            return mapping;
        }

        // Find column names
        const findColumnName = (records: NamingConventionRecord[], possibleNames: string[]): string | null => {
            if (records.length === 0) return null;
            const firstRecord = records[0];
            const keys = Object.keys(firstRecord);
            
            for (const possibleName of possibleNames) {
                const found = keys.find(k => k.toLowerCase() === possibleName.toLowerCase());
                if (found) return found;
            }
            return null;
        };

        const reportNamingCol = findColumnName(excelData.namingConventionRecords, [
            'Report Naming', 'Report naming', 'Report Naming Column', 'Report Field Name'
        ]);
        const leverImpactCol = findColumnName(excelData.namingConventionRecords, [
            'Lever Impact', 'Lever impact', 'Lever', 'Driver Impact', 'Driver impact'
        ]);

        if (!reportNamingCol || !leverImpactCol) {
            console.warn('Missing required columns for lever mapping:', {
                reportNamingCol,
                leverImpactCol,
                availableColumns: excelData.namingConventionRecords.length > 0 ? Object.keys(excelData.namingConventionRecords[0]) : []
            });
            return mapping;
        }

        // Build mapping: lever name (from Report Naming) -> impacted field (from Lever Impact)
        excelData.namingConventionRecords.forEach(record => {
            const reportNaming = String(record[reportNamingCol] || '').trim();
            const leverImpact = String(record[leverImpactCol] || '').trim();
            
            if (!reportNaming || !leverImpact) return;

            // Normalize lever name for matching
            const reportNamingLower = reportNaming.toLowerCase().trim();
            
            // Match to lever names
            if (reportNamingLower === 'avg aum' || reportNamingLower.includes('avg aum') || reportNamingLower === 'aum') {
                mapping['Avg AUM'].push(leverImpact);
                console.log(`Mapped lever "Avg AUM" (Report Naming: "${reportNaming}") to impacted field "${leverImpact}"`);
            } else if (reportNamingLower === 'trading volume' || reportNamingLower.includes('trading volume') || reportNamingLower === 'tradingvolume') {
                mapping['Trading Volume'].push(leverImpact);
                console.log(`Mapped lever "Trading Volume" (Report Naming: "${reportNaming}") to impacted field "${leverImpact}"`);
            } else if (reportNamingLower === 'headcount fte' || reportNamingLower.includes('headcount fte') || reportNamingLower === 'headcount' || reportNamingLower === 'fte') {
                mapping['Headcount FTE'].push(leverImpact);
                console.log(`Mapped lever "Headcount FTE" (Report Naming: "${reportNaming}") to impacted field "${leverImpact}"`);
            } else if (reportNamingLower === 'acquisition cost per client' || reportNamingLower.includes('acquisition cost per client') || reportNamingLower.includes('acquisition cost') || reportNamingLower === 'acquisition') {
                mapping['Acquisition Cost Per Client'].push(leverImpact);
                console.log(`Mapped lever "Acquisition Cost Per Client" (Report Naming: "${reportNaming}") to impacted field "${leverImpact}"`);
            }
        });

        console.log('Lever to Field Mapping (lever -> impacted fields):', mapping);
        return mapping;
    }, [excelData]);

    // Calculate impact percentages from actuals data
    // This calculates how a 1% change in each lever affects the P&L fields
    const impactPercentages = useMemo(() => {
        if (!excelData || !excelData.factMarginRecords || excelData.factMarginRecords.length === 0) {
            return {
                AvgAUM: {} as Record<string, number>, // Map of P&L field -> impact %
                TradingVolume: {} as Record<string, number>,
                HeadcountFTE: {} as Record<string, number>,
                AcquisitionCostPerClient: {} as Record<string, number>
            };
        }

        // Get all P&L fields from pnlLineItems that have fieldNames
        // Include both detail items and totals (like TotalRevenue_$mm, TotalExpense_$mm) for impact calculation
        const plFields = pnlLineItems
            .filter(item => item.fieldName)
            .map(item => item.fieldName);
        
        console.log('P&L fields available for impact calculation:', plFields);
        console.log('Lever to field mapping:', leverToFieldMapping);

        // Initialize impact maps
        const impacts: {
            AvgAUM: Record<string, number>;
            TradingVolume: Record<string, number>;
            HeadcountFTE: Record<string, number>;
            AcquisitionCostPerClient: Record<string, number>;
        } = {
            AvgAUM: {},
            TradingVolume: {},
            HeadcountFTE: {},
            AcquisitionCostPerClient: {}
        };

        // Initialize sums for correlation calculation
        const leverSums: Record<string, number> = {
            AvgAUM: 0,
            TradingVolume: 0,
            HeadcountFTE: 0,
            AcquisitionCostPerClient: 0
        };

        const fieldSums: Record<string, number> = {};
        plFields.forEach(field => {
            fieldSums[field] = 0;
        });

        const leverFieldSums: Record<string, Record<string, number>> = {};
        Object.keys(leverSums).forEach(lever => {
            leverFieldSums[lever] = {};
            plFields.forEach(field => {
                leverFieldSums[lever][field] = 0;
            });
        });

        let recordCount = 0;

        // Aggregate data from all records
        excelData.factMarginRecords.forEach(record => {
            if (!record) return;

            // Get lever values
            const avgAUM = getFieldValue(record, 'Avg AUM') || getFieldValue(record, 'AUM_$mm') || getFieldValue(record, 'AUM');
            const tradingVolume = getFieldValue(record, 'Trading Volume') || getFieldValue(record, 'TradingVolume_$mm') || getFieldValue(record, 'TradingVolume');
            const headcountFTE = getFieldValue(record, 'Headcount FTE') || getFieldValue(record, 'Headcount_FTE') || getFieldValue(record, 'Headcount');
            const acquisitionCostPerClient = getFieldValue(record, 'Acquisition Cost Per Client') || getFieldValue(record, 'AcquisitionCostPerClient') || getFieldValue(record, 'ClientAcquisitionSpend');

            // Get P&L field values
            const plFieldValues: Record<string, number> = {};
            plFields.forEach(field => {
                const value = getFieldValue(record, field);
                if (value !== null && !isNaN(value)) {
                    plFieldValues[field] = value;
                }
            });

            // Accumulate sums
            if (avgAUM !== null && !isNaN(avgAUM) && avgAUM !== 0) {
                leverSums.AvgAUM += avgAUM;
                plFields.forEach(field => {
                    if (plFieldValues[field] !== undefined) {
                        leverFieldSums.AvgAUM[field] += avgAUM * plFieldValues[field];
                    }
                });
            }

            if (tradingVolume !== null && !isNaN(tradingVolume) && tradingVolume !== 0) {
                leverSums.TradingVolume += tradingVolume;
                plFields.forEach(field => {
                    if (plFieldValues[field] !== undefined) {
                        leverFieldSums.TradingVolume[field] += tradingVolume * plFieldValues[field];
                    }
                });
            }

            if (headcountFTE !== null && !isNaN(headcountFTE) && headcountFTE !== 0) {
                leverSums.HeadcountFTE += headcountFTE;
                plFields.forEach(field => {
                    if (plFieldValues[field] !== undefined) {
                        leverFieldSums.HeadcountFTE[field] += headcountFTE * plFieldValues[field];
                    }
                });
            }

            if (acquisitionCostPerClient !== null && !isNaN(acquisitionCostPerClient) && acquisitionCostPerClient !== 0) {
                leverSums.AcquisitionCostPerClient += acquisitionCostPerClient;
                plFields.forEach(field => {
                    if (plFieldValues[field] !== undefined) {
                        leverFieldSums.AcquisitionCostPerClient[field] += acquisitionCostPerClient * plFieldValues[field];
                    }
                });
            }

            plFields.forEach(field => {
                if (plFieldValues[field] !== undefined) {
                    fieldSums[field] += plFieldValues[field];
                }
            });

            recordCount++;
        });

        // Calculate impact percentages from actuals data
        // For each lever, calculate the sensitivity to each impacted field based on actuals
        Object.keys(leverSums).forEach(lever => {
            const leverName = lever === 'AvgAUM' ? 'Avg AUM' :
                             lever === 'TradingVolume' ? 'Trading Volume' :
                             lever === 'HeadcountFTE' ? 'Headcount FTE' :
                             lever === 'AcquisitionCostPerClient' ? 'Acquisition Cost Per Client' : '';
            
            const mappedFields = leverToFieldMapping[leverName] || [];
            
            if (mappedFields.length === 0) {
                console.warn(`No fields mapped for lever "${leverName}"`);
                return;
            }
            
            // Get lever field name for Fact_Margin lookup
            const leverFieldName = leverName; // Use lever name directly
            
            // Helper function to normalize field names for matching
            const normalizeFieldName = (name: string): string => {
                return name.toLowerCase().trim().replace(/[_\s-]/g, '');
            };
            
            // Calculate correlation/sensitivity for each mapped field
            mappedFields.forEach(mappedField => {
                const normalizedMapped = normalizeFieldName(mappedField);
                
                // Find matching P&L field
                let matchedField: string | null = null;
                plFields.forEach(field => {
                    const normalizedField = normalizeFieldName(field);
                    
                    if (normalizedMapped === normalizedField || 
                        normalizedField.includes(normalizedMapped) || 
                        normalizedMapped.includes(normalizedField)) {
                        matchedField = field;
                    }
                });
                
                if (!matchedField) {
                    console.warn(`Could not match mapped field "${mappedField}" to any P&L field. Available fields:`, plFields);
                    return;
                }
                
                // Calculate sensitivity from actuals: collect lever and field values
                const leverValues: number[] = [];
                const fieldValues: number[] = [];
                
                excelData.factMarginRecords.forEach(record => {
                    if (!record) return;
                    
                    const leverValue = getFieldValue(record, leverFieldName);
                    const fieldValue = getFieldValue(record, matchedField);
                    
                    if (leverValue !== null && !isNaN(leverValue) && leverValue !== 0 &&
                        fieldValue !== null && !isNaN(fieldValue) && fieldValue !== 0) {
                        leverValues.push(leverValue);
                        fieldValues.push(fieldValue);
                    }
                });
                
                if (leverValues.length === 0 || fieldValues.length === 0) {
                    console.warn(`Insufficient data to calculate impact for lever "${leverName}" -> field "${matchedField}"`);
                    // Default to 1.0 (direct relationship)
                    impacts[lever as keyof typeof impacts][matchedField] = 1.0;
                    return;
                }
                
                // Calculate average values
                const avgLever = leverValues.reduce((a, b) => a + b, 0) / leverValues.length;
                const avgField = fieldValues.reduce((a, b) => a + b, 0) / fieldValues.length;
                
                if (avgLever === 0 || avgField === 0) {
                    console.warn(`Zero average values for lever "${leverName}" or field "${matchedField}"`);
                    impacts[lever as keyof typeof impacts][matchedField] = 1.0;
                    return;
                }
                
                // Calculate sensitivity: how much does field change when lever changes?
                // Use the ratio of relative changes: (Δfield/field) / (Δlever/lever)
                // Simplified: if field = k * lever, then sensitivity = 1.0
                // For more complex relationships, calculate correlation
                
                // Calculate correlation coefficient to measure relationship strength
                let sumProduct = 0;
                let sumLeverSq = 0;
                let sumFieldSq = 0;
                
                for (let i = 0; i < leverValues.length; i++) {
                    const leverDev = leverValues[i] - avgLever;
                    const fieldDev = fieldValues[i] - avgField;
                    sumProduct += leverDev * fieldDev;
                    sumLeverSq += leverDev * leverDev;
                    sumFieldSq += fieldDev * fieldDev;
                }
                
                const correlation = sumLeverSq > 0 && sumFieldSq > 0 
                    ? sumProduct / Math.sqrt(sumLeverSq * sumFieldSq)
                    : 0;
                
                // Calculate elasticity: how much does field change relative to lever change?
                // If field = k * lever (linear), elasticity = 1.0
                // Use the ratio of coefficients of variation as a proxy for elasticity
                const leverStdDev = Math.sqrt(sumLeverSq / leverValues.length);
                const fieldStdDev = Math.sqrt(sumFieldSq / fieldValues.length);
                const leverCV = avgLever !== 0 ? leverStdDev / avgLever : 0;
                const fieldCV = avgField !== 0 ? fieldStdDev / avgField : 0;
                
                // Elasticity = (fieldCV / leverCV) if both are non-zero
                // This represents: if lever changes by 1%, field changes by elasticity%
                let elasticity = 1.0; // Default to direct relationship
                if (leverCV > 0 && fieldCV > 0) {
                    elasticity = fieldCV / leverCV;
                } else if (Math.abs(correlation) > 0.3) {
                    // If there's a moderate correlation, use correlation as proxy
                    elasticity = Math.abs(correlation);
                }
                
                // Clamp elasticity to reasonable range (0.1 to 2.0)
                elasticity = Math.max(0.1, Math.min(2.0, elasticity));
                
                const impactPercent = elasticity;
                
                impacts[lever as keyof typeof impacts][matchedField] = impactPercent;
                
                console.log(`Calculated impact for lever "${leverName}" -> field "${matchedField}": correlation=${correlation.toFixed(3)}, impactPercent=${impactPercent.toFixed(3)}`);
            });
        });
        
        console.log('Calculated impact percentages:', impacts);

        return impacts;
    }, [excelData, pnlLineItems, leverToFieldMapping]);

    // Calculate scenario P&L with lever impacts
    const scenarioPnLData = useMemo(() => {
        if (!basePnLData || Object.keys(basePnLData).length === 0) {
            console.warn('No basePnLData available for scenario calculation');
            return {} as PnLData;
        }

        console.log('=== Scenario P&L Calculation ===');
        console.log('Base P&L Data periods:', Object.keys(basePnLData));
        console.log('Selected periods:', selectedPeriods);
        console.log('Lever values:', leverValues);
        console.log('Impact percentages:', impactPercentages);

        const data: PnLData = {};

        // Filter to selected periods only
        const periodsToProcess = selectedPeriods.length > 0 
            ? selectedPeriods.filter(p => basePnLData[p])
            : Object.keys(basePnLData);

        periodsToProcess.forEach(period => {
            const baseData = basePnLData[period];
            if (!baseData) {
                console.warn(`No base data for period ${period}`);
                return;
            }

            console.log(`Processing period ${period}:`, {
                TotalRevenue: baseData['TotalRevenue_$mm'],
                TotalExpense: baseData['TotalExpense_$mm'],
                Margin: baseData['Margin']
            });

            data[period] = { ...baseData };

            // Apply lever impacts to all affected P&L fields based on calculated impact percentages
            // Level 1: Avg AUM
            const avgAUMChange = leverValues.AvgAUM || 0;
            if (avgAUMChange !== 0) {
                console.log(`Applying Avg AUM lever change: ${avgAUMChange}%`);
                console.log(`Available impact percentages for AvgAUM:`, impactPercentages.AvgAUM);
                if (impactPercentages.AvgAUM && Object.keys(impactPercentages.AvgAUM).length > 0) {
                    Object.keys(impactPercentages.AvgAUM).forEach(field => {
                        const impactPercent = impactPercentages.AvgAUM[field] || 0;
                        if (impactPercent !== 0) {
                            const baseValue = baseData[field] || 0;
                            // Impact = baseValue * (leverChange / 100) * impactPercent
                            // impactPercent represents: 1% lever change = impactPercent% field change
                            // So if impactPercent = 1.0, then 1% lever change = 1% field change
                            const impact = baseValue * (avgAUMChange / 100) * impactPercent;
                            const newValue = (data[period][field] || baseValue) + impact;
                            data[period][field] = newValue;
                            console.log(`Avg AUM lever: ${avgAUMChange}% change, field ${field}: ${baseValue} -> ${newValue} (impact: ${impact})`);
                        }
                    });
                } else {
                    console.warn(`No impact percentages found for AvgAUM lever. Lever to field mapping:`, leverToFieldMapping);
                }
            }

            // Level 2: Trading Volume
            const tradingVolumeChange = leverValues.TradingVolume || 0;
            if (tradingVolumeChange !== 0 && impactPercentages.TradingVolume) {
                Object.keys(impactPercentages.TradingVolume).forEach(field => {
                    const impactPercent = impactPercentages.TradingVolume[field] || 0;
                    if (impactPercent !== 0) {
                        const baseValue = baseData[field] || 0;
                        const impact = baseValue * (tradingVolumeChange / 100) * impactPercent;
                        data[period][field] = (data[period][field] || baseValue) + impact;
                    }
                });
            }

            // Level 3: Headcount FTE
            const headcountFTEChange = leverValues.HeadcountFTE || 0;
            if (headcountFTEChange !== 0 && impactPercentages.HeadcountFTE) {
                Object.keys(impactPercentages.HeadcountFTE).forEach(field => {
                    const impactPercent = impactPercentages.HeadcountFTE[field] || 0;
                    if (impactPercent !== 0) {
                        const baseValue = baseData[field] || 0;
                        const impact = baseValue * (headcountFTEChange / 100) * impactPercent;
                        data[period][field] = (data[period][field] || baseValue) + impact;
                    }
                });
            }

            // Level 4: Acquisition Cost Per Client
            const acquisitionCostChange = leverValues.AcquisitionCostPerClient || 0;
            if (acquisitionCostChange !== 0 && impactPercentages.AcquisitionCostPerClient) {
                Object.keys(impactPercentages.AcquisitionCostPerClient).forEach(field => {
                    const impactPercent = impactPercentages.AcquisitionCostPerClient[field] || 0;
                    if (impactPercent !== 0) {
                        const baseValue = baseData[field] || 0;
                        const impact = baseValue * (acquisitionCostChange / 100) * impactPercent;
                        data[period][field] = (data[period][field] || baseValue) + impact;
                    }
                });
            }

            // Recalculate totals after applying lever impacts
            // Start with base totals and add impacts from detail items
            const baseTotalRevenue = baseData['TotalRevenue_$mm'] || 0;
            const baseTotalExpense = baseData['TotalExpense_$mm'] || 0;
            
            // Calculate impact on totals by summing changes to detail items
            let revenueImpact = 0;
            let expenseImpact = 0;
            
            // Sum impacts to revenue detail items
            let inRevenueSection = false;
            pnlLineItems.forEach(item => {
                if (item.label === 'Revenue' && item.fieldName === 'TotalRevenue_$mm') {
                    inRevenueSection = true;
                } else if (item.label === 'Expenses' && item.fieldName === 'TotalExpense_$mm') {
                    inRevenueSection = false;
                } else if (inRevenueSection && item.fieldName && !item.isTotal && item.indent === 2) {
                    // This is a revenue detail item - calculate impact
                    const baseValue = baseData[item.fieldName] || 0;
                    const newValue = data[period][item.fieldName] || 0;
                    revenueImpact += (newValue - baseValue);
                }
            });
            
            // Sum impacts to expense detail items
            let inExpenseSection = false;
            pnlLineItems.forEach(item => {
                if (item.label === 'Expenses' && item.fieldName === 'TotalExpense_$mm') {
                    inExpenseSection = true;
                } else if (inExpenseSection && item.fieldName && !item.isTotal && (item.indent === 1 || item.indent === 2)) {
                    // This is an expense detail item - calculate impact
                    const baseValue = baseData[item.fieldName] || 0;
                    const newValue = data[period][item.fieldName] || 0;
                    expenseImpact += (newValue - baseValue);
                }
            });
            
            // Apply impacts to totals
            data[period]['TotalRevenue_$mm'] = baseTotalRevenue + revenueImpact;
            data[period]['TotalExpense_$mm'] = baseTotalExpense + expenseImpact;
            
            // Use base Margin_$mm from Fact_Margin and adjust for impacts
            const baseMargin = baseData['Margin_$mm'] || baseData['Margin'] || 0;
            
            // Calculate the impact on margin from revenue and expense impacts
            const marginImpact = revenueImpact - expenseImpact;
            data[period]['Margin'] = baseMargin + marginImpact;
            
            // MarginPct should be recalculated based on new margin and revenue
            const finalTotalRevenue = data[period]['TotalRevenue_$mm'] || 0;
            data[period]['MarginPct'] = finalTotalRevenue !== 0 ? (data[period]['Margin'] / finalTotalRevenue) * 100 : 0;
        });

        return data;
    }, [basePnLData, leverValues, impactPercentages, selectedPeriods, pnlLineItems]);

    // Scenario levers configuration - New structure with 4 levels
    const scenarioLevers: ScenarioLever[] = [
        {
            id: 'AvgAUM',
            name: 'Avg AUM',
            factMarginFieldName: 'Avg AUM',
            reportFieldName: 'Avg AUM',
            currentValue: leverValues.AvgAUM || 0,
            minValue: -50,
            maxValue: 50,
            unit: '%',
            affectsField: 'Multiple P&L fields',
            affectsTotal: 'Multiple'
        },
        {
            id: 'TradingVolume',
            name: 'Trading Volume',
            factMarginFieldName: 'Trading Volume',
            reportFieldName: 'Trading Volume',
            currentValue: leverValues.TradingVolume || 0,
            minValue: -50,
            maxValue: 50,
            unit: '%',
            affectsField: 'Multiple P&L fields',
            affectsTotal: 'Multiple'
        },
        {
            id: 'HeadcountFTE',
            name: 'Headcount FTE',
            factMarginFieldName: 'Headcount FTE',
            reportFieldName: 'Headcount FTE',
            currentValue: leverValues.HeadcountFTE || 0,
            minValue: -50,
            maxValue: 50,
            unit: '%',
            affectsField: 'Multiple P&L fields',
            affectsTotal: 'Multiple'
        },
        {
            id: 'AcquisitionCostPerClient',
            name: 'Acquisition Cost Per Client',
            factMarginFieldName: 'Acquisition Cost Per Client',
            reportFieldName: 'Acquisition Cost Per Client',
            currentValue: leverValues.AcquisitionCostPerClient || 0,
            minValue: -50,
            maxValue: 50,
            unit: '%',
            affectsField: 'Multiple P&L fields',
            affectsTotal: 'Multiple'
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

    const getVisibleLineItems = (): (PnLLineItem & { combineWithHeader?: boolean; sectionHeader?: PnLLineItem })[] => {
        const visible: (PnLLineItem & { combineWithHeader?: boolean; sectionHeader?: PnLLineItem })[] = [];
        let currentSection: string | null = null;
        let currentSectionHeader: PnLLineItem | null = null;

        pnlLineItems.forEach((item, index) => {
            // Section headers (Revenue, Expenses) - now have fieldNames (TotalRevenue_$mm, TotalExpense_$mm)
            // They are always visible and show their values directly
            if (item.isTotal && (item.indent === 0 || item.label === 'Revenue' || item.label === 'Expenses')) {
                // Section headers are always visible and display their fieldName values
                    visible.push(item);

                if (item.label === 'Revenue') {
                    currentSection = 'Revenue';
                    currentSectionHeader = item;
                } else if (item.label === 'Expenses') {
                    currentSection = 'Expenses';
                    currentSectionHeader = item;
                }
            }
            // Total Compensation (indent 1) - only show if Expenses section is expanded
            else if (item.isTotal && item.fieldName && item.indent === 1) {
                // Check if this is Total Compensation - it should be hidden when Expenses is collapsed
                if (item.fieldName.toLowerCase().includes('totalcompensation')) {
                    // Only show if Expenses section is expanded
                    if (currentSection === 'Expenses' && expandedSections.has('Expenses')) {
                    visible.push(item);
                }
                } else {
                    // Other indent 1 items (if any) - show if their section is expanded
                    if (currentSection && expandedSections.has(currentSection)) {
                        visible.push(item);
                    }
                }
            }
            // Compensation nested items (indent 2, under Total Compensation) - only show if Expenses is expanded
            else if (item.indent === 2 && !item.isTotal && 
                     (item.fieldName.toLowerCase().includes('basecompensation') || 
                      item.fieldName.toLowerCase().includes('variablecompensation'))) {
                // Only show if Expenses section is expanded
                if (currentSection === 'Expenses' && expandedSections.has('Expenses')) {
                    visible.push(item);
                }
            }
            // Other detail lines (indent 2) - only show if section is expanded
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

    const toggleDriver = (driverId: string) => {
        setExpandedDrivers(prev => {
            const newSet = new Set(prev);
            if (newSet.has(driverId)) {
                newSet.delete(driverId);
            } else {
                newSet.add(driverId);
            }
            return newSet;
        });
    };

    // Helper to get amount for a driver from Fact_Margin record
    const getAmountForDriver = (record: FactMarginRecord, driverName: string): number | null => {
        const driverNameLower = driverName.toLowerCase().trim();
        
        // Try exact match first
        for (const [key, value] of Object.entries(record)) {
            const keyLower = key.toLowerCase().trim();
            if (keyLower.includes('id') || keyLower.includes('period') || keyLower.includes('date') || keyLower.includes('quarter')) continue;
            
            if (keyLower === driverNameLower) {
                const numValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
                if (!isNaN(numValue)) {
                    return numValue;
                }
            }
        }
        
        // Try partial match
        for (const [key, value] of Object.entries(record)) {
            const keyLower = key.toLowerCase().trim();
            if (keyLower.includes('id') || keyLower.includes('period') || keyLower.includes('date') || keyLower.includes('quarter')) continue;
            
            if (keyLower.includes(driverNameLower) || driverNameLower.includes(keyLower)) {
                const numValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
                if (!isNaN(numValue)) {
                    return numValue;
                }
            }
        }
        
        return null;
    };

    // Calculate base driver tree amounts from Fact_Margin for selected periods
    const baseDriverTreeData = useMemo(() => {
        if (!excelData || !excelData.tree || excelData.tree.length === 0 || !excelData.factMarginRecords) {
            return new Map<string, Map<string, number>>(); // Map of nodeId -> Map of period -> amount
        }

        const data = new Map<string, Map<string, number>>();
        const periodsToProcess = selectedPeriods.length > 0 ? selectedPeriods : availablePeriods;

        if (periodsToProcess.length === 0) {
            console.warn('No periods to process for driver tree', {
                selectedPeriods,
                availablePeriods,
                factMarginRecordCount: excelData.factMarginRecords?.length || 0
            });
            return data;
        }

        // Extract Level 4 driver names from tree
        const extractLevel4Names = (nodes: DriverTreeNode[]): string[] => {
            const names: string[] = [];
            const traverse = (node: DriverTreeNode) => {
                if (node.level === 4) {
                    names.push(node.name);
                }
                if (node.children) {
                    node.children.forEach(child => traverse(child));
                }
            };
            nodes.forEach(node => traverse(node));
            return names;
        };

        const level4Names = extractLevel4Names(excelData.tree);

        // Initialize all nodes
        const initializeNode = (node: DriverTreeNode) => {
            if (!data.has(node.id)) {
                data.set(node.id, new Map<string, number>());
            }
            if (node.children) {
                node.children.forEach(child => initializeNode(child));
            }
        };
        excelData.tree.forEach(node => initializeNode(node));

        // Aggregate Level 4 amounts from Fact_Margin for each period
        periodsToProcess.forEach(period => {
            excelData.factMarginRecords.forEach(record => {
                if (!record) return;

                // Check if this record matches the period
                const quarterKey = Object.keys(record).find(key => 
                    key.toLowerCase() === 'quarter'
                );
                if (!quarterKey) return;
                
                const quarter = String(record[quarterKey] || '').trim();
                // Normalize both for comparison (trim whitespace, case-insensitive)
                const normalizedQuarter = quarter.trim();
                const normalizedPeriod = String(period).trim();
                if (!quarter || normalizedQuarter !== normalizedPeriod) {
                    // Skip records that don't match the current period
                    return;
                }

                // For each Level 4 driver, get the amount using fuzzy matching
                level4Names.forEach(driverName => {
                    // Use the same fuzzy matching logic as getFieldValue
                    // This handles cases where driver name might be "TradingVolume_$mm" and Fact_Margin has "TradingVolume_$mm"
                    const amount = getFieldValue(record, driverName);
                    if (amount !== null && !isNaN(amount)) {
                        // Find the Level 4 node with this name using fuzzy matching
                        const findNode = (nodes: DriverTreeNode[]): DriverTreeNode | null => {
                            for (const node of nodes) {
                                if (node.level === 4) {
                                    // Use fuzzy matching to find the node
                                    const nodeNameLower = node.name.toLowerCase().trim();
                                    const driverNameLower = driverName.toLowerCase().trim();
                                    
                                    // Try exact match first
                                    if (nodeNameLower === driverNameLower) {
                                        return node;
                                    }
                                    
                                    // Try partial match
                                    if (nodeNameLower.includes(driverNameLower) || driverNameLower.includes(nodeNameLower)) {
                                        return node;
                                    }
                                    
                                    // Try normalized match (remove special chars, units)
                                    const normalize = (str: string) => str.replace(/[^a-z0-9]/g, '').toLowerCase();
                                    if (normalize(nodeNameLower) === normalize(driverNameLower)) {
                                        return node;
                                    }
                                }
                                if (node.children) {
                                    const found = findNode(node.children);
                                    if (found) return found;
                                }
                            }
                            return null;
                        };

                        const level4Node = findNode(excelData.tree);
                        if (level4Node) {
                            const nodeData = data.get(level4Node.id);
                            if (nodeData) {
                                // Ensure period is normalized (trimmed string) for consistent key matching
                                const normalizedPeriod = String(period).trim();
                                const currentAmount = nodeData.get(normalizedPeriod) || 0;
                                nodeData.set(normalizedPeriod, currentAmount + amount);
                            }
                        }
                    }
                });
            });
        });
        
        // Debug logging
        if (periodsToProcess.length > 0 && level4Names.length > 0 && excelData.factMarginRecords.length > 0) {
            console.log('Driver Tree Calculation Debug:', {
                periodsToProcess,
                level4Names: level4Names.slice(0, 5), // First 5 for debugging
                recordCount: excelData.factMarginRecords.length,
                firstRecordKeys: Object.keys(excelData.factMarginRecords[0] || {}).slice(0, 10)
            });
            
            // Check if we found any amounts
            let totalAmounts = 0;
            let sampleAmounts: Array<{nodeId: string, period: string, amount: number}> = [];
            data.forEach((periodData, nodeId) => {
                periodData.forEach((amount, period) => {
                    if (amount !== 0) {
                        totalAmounts++;
                        if (sampleAmounts.length < 10) {
                            sampleAmounts.push({nodeId, period, amount});
                        }
                    }
                });
            });
            console.log('Total non-zero amounts found:', totalAmounts);
            if (sampleAmounts.length > 0) {
                console.log('Sample amounts (first 10):', sampleAmounts);
                
                // Also show what's in the first Level 1 node
                const firstRootNode = excelData.tree[0];
                if (firstRootNode) {
                    const rootNodeData = data.get(firstRootNode.id);
                    if (rootNodeData) {
                        console.log('First root node data:', {
                            nodeId: firstRootNode.id,
                            nodeName: firstRootNode.name,
                            entries: Array.from(rootNodeData.entries())
                        });
                    }
                }
            } else {
                console.warn('No amounts found! Checking first record...');
                const firstRecord = excelData.factMarginRecords[0];
                if (firstRecord) {
                    const quarterKey = Object.keys(firstRecord).find(key => key.toLowerCase() === 'quarter');
                    console.log('First record quarter:', quarterKey ? firstRecord[quarterKey] : 'not found');
                    console.log('First record sample fields:', Object.keys(firstRecord).filter(k => 
                        !k.toLowerCase().includes('id') && 
                        !k.toLowerCase().includes('quarter') &&
                        !k.toLowerCase().includes('period')
                    ).slice(0, 10));
                    
                    // Try to match first level4 name
                    if (level4Names.length > 0) {
                        const testDriver = level4Names[0];
                        const testAmount = getFieldValue(firstRecord, testDriver);
                        console.log(`Test match for "${testDriver}":`, testAmount);
                    }
                }
            }
        }

        // Roll up from Level 4 to Level 3 to Level 2 to Level 1
        const rollUpAmounts = (node: DriverTreeNode) => {
            const nodePeriodData = data.get(node.id) || new Map<string, number>();

            if (node.children && node.children.length > 0) {
                node.children.forEach(child => {
                    rollUpAmounts(child);
                    const childData = data.get(child.id);
                    if (childData) {
                        periodsToProcess.forEach(period => {
                            // Normalize period for consistent key matching
                            const normalizedPeriod = String(period).trim();
                            const childAmount = childData.get(normalizedPeriod) || 0;
                            const currentAmount = nodePeriodData.get(normalizedPeriod) || 0;
                            nodePeriodData.set(normalizedPeriod, currentAmount + childAmount);
                        });
                    }
                });
            }

            data.set(node.id, nodePeriodData);
        };

        excelData.tree.forEach(node => rollUpAmounts(node));

        return data;
    }, [excelData, selectedPeriods, availablePeriods]);

    // Calculate scenario driver tree with lever impacts
    const scenarioDriverTreeData = useMemo(() => {
        if (!excelData || !excelData.tree || excelData.tree.length === 0) {
            return new Map<string, Map<string, number>>();
        }

        const data = new Map<string, Map<string, number>>();
        const periodsToProcess = selectedPeriods.length > 0 ? selectedPeriods : availablePeriods;

        // Start with base data
        baseDriverTreeData.forEach((periodData, nodeId) => {
            data.set(nodeId, new Map(periodData));
        });

        // Define levers for matching (using Fact_Margin field names)
        const levers = [
            { id: 'AUM', factMarginFieldName: 'AUM_$mm' },
            { id: 'TxnFeeRate', factMarginFieldName: 'TxnFeeRate_bps' },
            { id: 'TradingVolume', factMarginFieldName: 'TradingVolume_$mm' },
            { id: 'Headcount_FTE', factMarginFieldName: 'Headcount_FTE' }
        ];

        // Apply lever impacts directly to Level 4 nodes that match the lever's Fact_Margin field name
        // Each lever directly affects its corresponding driver field (e.g., AUM slider affects AUM_$mm)
        const applyLeverImpacts = (nodes: DriverTreeNode[]) => {
            nodes.forEach(node => {
                if (node.level === 4) {
                    const nodeNameLower = node.name.toLowerCase().trim();
                    const normalize = (str: string) => str.replace(/[^a-z0-9]/g, '').toLowerCase();
                    const nodeNameNormalized = normalize(nodeNameLower);
                    
                    // Check each lever and apply impact if this Level 4 node matches the lever's Fact_Margin field
                    levers.forEach(lever => {
                        const factMarginFieldLower = lever.factMarginFieldName.toLowerCase().trim();
                        const factMarginFieldNormalized = normalize(factMarginFieldLower);
                        
                        // Check if this Level 4 node matches the lever's Fact_Margin field name
                        const matches = 
                            nodeNameLower === factMarginFieldLower ||
                            nodeNameLower.includes(factMarginFieldLower) ||
                            factMarginFieldLower.includes(nodeNameLower) ||
                            nodeNameNormalized === factMarginFieldNormalized ||
                            nodeNameNormalized.includes(factMarginFieldNormalized) ||
                            factMarginFieldNormalized.includes(nodeNameNormalized);
                        
                        if (matches) {
                            const leverChange = leverValues[lever.id] || 0;
                            if (leverChange !== 0) {
                                periodsToProcess.forEach(period => {
                                    const nodeData = data.get(node.id);
                                    if (nodeData) {
                                        // Normalize period for consistent key matching
                                        const normalizedPeriod = String(period).trim();
                                        const baseAmount = nodeData.get(normalizedPeriod) || 0;
                                        // Apply percentage change directly to the driver value
                                        const impact = baseAmount * (leverChange / 100);
                                        nodeData.set(normalizedPeriod, baseAmount + impact);
                                    }
                                });
                            }
                        }
                    });
                }

                // Recursively process children
                if (node.children) {
                    applyLeverImpacts(node.children);
                }
            });
        };

        applyLeverImpacts(excelData.tree);

        // Re-roll up amounts after applying impacts
        const rollUpAmounts = (node: DriverTreeNode) => {
            // For Level 4 nodes, don't reset - they already have their values from base + impacts
            if (node.level === 4) {
                return;
            }
            
            let finalNodeData = data.get(node.id);
            if (!finalNodeData) {
                finalNodeData = new Map<string, number>();
                data.set(node.id, finalNodeData);
            }
            
            // Reset to 0 for roll-up (only for parent nodes)
            periodsToProcess.forEach(period => {
                // Normalize period for consistent key matching
                const normalizedPeriod = String(period).trim();
                finalNodeData!.set(normalizedPeriod, 0);
            });

            if (node.children && node.children.length > 0) {
                node.children.forEach(child => {
                    rollUpAmounts(child);
                    const childData = data.get(child.id);
                    if (childData) {
                        periodsToProcess.forEach(period => {
                            // Normalize period for consistent key matching
                            const normalizedPeriod = String(period).trim();
                            const childAmount = childData.get(normalizedPeriod) || 0;
                            const currentAmount = finalNodeData!.get(normalizedPeriod) || 0;
                            finalNodeData!.set(normalizedPeriod, currentAmount + childAmount);
                        });
                    }
                });
            }
        };

        excelData.tree.forEach(node => rollUpAmounts(node));

        return data;
    }, [baseDriverTreeData, leverValues, excelData, selectedPeriods, availablePeriods]);

    // Render driver tree node
    const renderDriverNode = (node: DriverTreeNode, depth: number = 0, parentIndex: string = '', rootIndex: number = 0) => {
        const nodeIndex = parentIndex 
            ? `${parentIndex}-${node.id}` 
            : `root-${rootIndex}-${node.id}`;
        const isExpanded = expandedDrivers.has(nodeIndex);
        const hasChildren = node.children && node.children.length > 0;
        
        const periodsToShow = selectedPeriods.length > 0 ? selectedPeriods : availablePeriods;
        const nodeData = scenarioDriverTreeData.get(node.id);
        const baseNodeData = baseDriverTreeData.get(node.id);
        
        // Debug logging for first node
        if (node.level === 1 && periodsToShow.length > 0) {
            console.log('Rendering driver node:', {
                nodeName: node.name,
                nodeId: node.id,
                periodsToShow,
                hasNodeData: !!nodeData,
                hasBaseNodeData: !!baseNodeData,
                nodeDataSample: nodeData ? Array.from(nodeData.entries()).slice(0, 2) : null,
                baseNodeDataSample: baseNodeData ? Array.from(baseNodeData.entries()).slice(0, 2) : null
            });
        }

        return (
            <div key={node.id} className="relative mb-1">
                {depth > 0 && (
                    <div className="absolute -left-4 top-3 w-4 h-0.5 bg-gray-300"></div>
                )}
                
                <div 
                    className="bg-gray-50 border border-gray-200 rounded p-3 shadow-sm hover:bg-gray-100 transition-colors"
                    style={{ marginLeft: `${depth * 20}px` }}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                            {hasChildren ? (
                                <button
                                    onClick={() => toggleDriver(nodeIndex)}
                                    className="flex items-center justify-center w-5 h-5 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                                >
                                    {isExpanded ? (
                                        <ChevronDown className="w-4 h-4 text-gray-600" />
                                    ) : (
                                        <ChevronRight className="w-4 h-4 text-gray-600" />
                                    )}
                                </button>
                            ) : (
                                <div className="w-5"></div>
                            )}
                            <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium text-gray-900">
                                    {getReportFieldName(node.name)}
                                </span>
                                {node.level && (
                                    <span className="text-xs text-gray-400 ml-2">(L{node.level})</span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center space-x-4 ml-4 flex-shrink-0">
                            {periodsToShow.length > 0 ? periodsToShow.map(period => {
                                // Normalize period for consistent key matching
                                const normalizedPeriod = String(period).trim();
                                // Show scenario amount (with lever impacts applied)
                                const scenarioAmount = nodeData?.get(normalizedPeriod) || 0;
                                
                                // Debug for first period of first node
                                if (node.level === 1 && period === periodsToShow[0] && scenarioAmount === 0) {
                                    const actualValue = nodeData?.get(period);
                                    const allEntries = nodeData ? Array.from(nodeData.entries()) : [];
                                    console.log('Zero amount detected:', {
                                        nodeName: node.name,
                                        nodeId: node.id,
                                        period,
                                        periodType: typeof period,
                                        periodLength: period?.length,
                                        hasNodeData: !!nodeData,
                                        nodeDataKeys: nodeData ? Array.from(nodeData.keys()) : [],
                                        nodeDataKeysTypes: nodeData ? Array.from(nodeData.keys()).map(k => ({key: k, type: typeof k, length: k?.length})) : [],
                                        allEntries: allEntries.slice(0, 3),
                                        actualValue,
                                        actualValueType: typeof actualValue,
                                        scenarioAmount
                                    });
                                    
                                    // Try to find a match with different comparison
                                    if (nodeData) {
                                        const matchingKey = Array.from(nodeData.keys()).find(k => 
                                            String(k).trim() === String(period).trim() ||
                                            String(k).toLowerCase() === String(period).toLowerCase()
                                        );
                                        if (matchingKey) {
                                            console.log('Found matching key:', matchingKey, 'value:', nodeData.get(matchingKey));
                                        }
                                    }
                                }
                                
                                return (
                                    <div key={period} className="text-right min-w-[100px]">
                                        <div className="text-sm font-medium text-gray-900">
                                            {formatCurrency(scenarioAmount)}
                                        </div>
                                    </div>
                                );
                            }) : (
                                <div className="text-sm text-gray-400">No periods selected</div>
                            )}
                        </div>
                    </div>

                    {isExpanded && hasChildren && (
                        <div className="mt-2 space-y-1">
                            {node.children!.map((child, childIndex) => 
                                renderDriverNode(child, depth + 1, nodeIndex, rootIndex)
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
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

                        {/* Margin Summary at Top */}
                        {Object.keys(scenarioPnLData).length > 0 && selectedPeriods.length > 0 && (
                            <div className="px-6 py-4 bg-blue-50 border-b-2 border-blue-200">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-4">
                                        <span className="text-lg font-semibold text-gray-900">Margin Summary:</span>
                                    </div>
                                    <div className="flex items-center space-x-6">
                                        {selectedPeriods.map(period => {
                                            const periodData = scenarioPnLData[period];
                                            const margin = periodData?.Margin || 0;
                                            const marginPct = periodData?.MarginPct || 0;
                                            return (
                                                <div key={period} className="text-right">
                                                    <div className="text-sm text-gray-600 mb-1">{period}</div>
                                                    <div className="text-lg font-bold text-gray-900">
                                                        ${(margin / 1000000).toFixed(2)}M
                                                    </div>
                                                    <div className="text-sm font-semibold text-blue-600">
                                                        {marginPct.toFixed(2)}%
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

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
                                            // Section headers are items with isTotal and indent 0 (Revenue/Expenses)
                                            const isSectionHeader = item.isTotal && (item.indent === 0 || item.label === 'Revenue' || item.label === 'Expenses');
                                            const isCombinedWithHeader = (item as any).combineWithHeader && (item as any).sectionHeader;
                                            
                                            // Determine if this is a collapsible section header
                                            const sectionName = (item as any).sectionHeader?.label === 'Revenue' ? 'Revenue' 
                                                                : (item as any).sectionHeader?.label === 'Expenses' ? 'Expenses'
                                                                : item.label === 'Revenue' ? 'Revenue' 
                                                                : item.label === 'Expenses' ? 'Expenses' 
                                                                : null;
                                            const isExpanded = sectionName ? expandedSections.has(sectionName) : false;
                                            
                                            // Use section header label if combined, otherwise use item label
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
                                                        // Use the item's fieldName - section headers now have fieldNames (TotalRevenue_$mm, TotalExpense_$mm)
                                                        const fieldNameToUse = item.fieldName || ((item as any).combineWithHeader ? item.fieldName : null);
                                                        const value = fieldNameToUse ? (scenarioPnLData[period]?.[fieldNameToUse] || 0) : 0;
                                                        const baseValue = fieldNameToUse ? (basePnLData[period]?.[fieldNameToUse] || 0) : 0;
                                                        const change = value - baseValue;
                                                        const displayValue = fieldNameToUse === 'MarginPct' 
                                                            ? formatPercentage(value)
                                                            : formatCurrency(value);
                                                        
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
                                                                        {change !== 0 && fieldNameToUse !== 'MarginPct' && (
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
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">Performance Driver Tree</h3>
                            <p className="text-xs text-gray-500">
                                Amounts reflect selected periods and lever adjustments
                            </p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 min-h-[400px] max-h-[600px] overflow-y-auto">
                            {excelData && excelData.tree.length > 0 && selectedPeriods.length > 0 ? (
                                <div>
                                    {/* Period headers */}
                                    <div className="flex items-center justify-end space-x-4 mb-4 pb-2 border-b border-gray-300">
                                        <div className="w-[200px]"></div> {/* Spacer for node name column */}
                                        {selectedPeriods.map(period => (
                                            <div key={period} className="text-xs font-semibold text-gray-700 min-w-[100px] text-right">
                                                {period}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="space-y-2">
                                        {excelData.tree.map((rootNode, index) => renderDriverNode(rootNode, 0, '', index))}
                                    </div>
                                </div>
                            ) : excelData && excelData.tree.length > 0 ? (
                                <p className="text-sm text-gray-500 text-center py-8">
                                    Please select at least one period to view driver tree amounts.
                                </p>
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
