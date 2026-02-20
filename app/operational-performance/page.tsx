'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
import { ExcelDriverTreeData, joinFactWithDimension, getDimensionTableNames, FactMarginRecord, NamingConventionRecord } from '@/lib/excel-parser';

interface PnLLineItem {
    label: string;
    fieldName: string;
    isTotal?: boolean;
    isMargin?: boolean;
    indent?: number;
}

interface PnLData {
    [rowKey: string]: {
        [period: string]: {
            [fieldName: string]: number;
        };
    };
}

export default function OperationalPerformance() {
    const searchParams = useSearchParams();
    const [excelData, setExcelData] = useState<ExcelDriverTreeData | null>(null);
    const [selectedDimensions, setSelectedDimensions] = useState<string[]>(['Geography']); // Default to Geography
    const [availableDimensions, setAvailableDimensions] = useState<string[]>([]);
    const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set()); // Track expanded sections
    const [hasScrolledToField, setHasScrolledToField] = useState(false);

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

    // Extract available dimensions and periods from data
    useEffect(() => {
        if (!excelData) return;

        // Get available dimension tables
        const dimTables = getDimensionTableNames(excelData.dimensionTables);
        setAvailableDimensions(dimTables.map(name => name.replace('Dim_', '').replace('DIM_', '')));

        // Extract unique quarters from 'Quarter' field in Fact_Margin records
        const quarters = new Set<string>();
        if (excelData.factMarginRecords && Array.isArray(excelData.factMarginRecords)) {
            excelData.factMarginRecords.forEach(record => {
                if (!record) return;
                // Look specifically for 'Quarter' field (case-insensitive)
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
        }
        const sortedQuarters = Array.from(quarters).sort();
        setAvailablePeriods(sortedQuarters);
    }, [excelData]);

    // Generate combinations of dimension values (must be defined before useMemo)
    const generateCombinations = (arrays: string[][]): string[][] => {
        if (!arrays || arrays.length === 0) return [[]];
        
        // Filter out empty arrays
        const validArrays = arrays.filter(arr => arr && arr.length > 0);
        if (validArrays.length === 0) return [[]];
        if (validArrays.length === 1) return validArrays[0].map(item => [item]);
        
        const [first, ...rest] = validArrays;
        const restCombinations = generateCombinations(rest);
        const combinations: string[][] = [];
        
        first.forEach(item => {
            restCombinations.forEach(combo => {
                combinations.push([item, ...combo]);
            });
        });
        
        return combinations;
    };

    // Helper function to get field value from record with fuzzy matching (must be defined before useMemo)
    const getFieldValue = (record: FactMarginRecord, fieldName: string): number | null => {
        if (!record || !fieldName) return null;
        
        // Normalize field name for matching - remove all special chars, spaces, units, etc.
        // This handles mappings like "TotalRevenue" (report) -> "TotalRevenue_$mm" (fact margin)
        const normalizeFieldName = (name: string) => {
            return name
                .toLowerCase()
                .replace(/\$mm/g, '') // Remove $mm unit first (e.g., "TotalRevenue_$mm" -> "totalrevenue_")
                .replace(/\$m(?![a-z])/g, '') // Remove $m unit (but not if followed by letter)
                .replace(/mm(?![a-z])/g, '') // Remove mm unit (standalone)
                .replace(/_bps/g, '') // Remove _bps suffix
                .replace(/_pct/g, '') // Remove _pct suffix
                .replace(/_annual/g, '') // Remove _annual suffix
                .replace(/_fte/g, '') // Remove _fte suffix
                .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric (spaces, underscores, etc.)
                .trim();
        };
        
        // Extract core words from field name (remove common prefixes/suffixes and units)
        const extractCoreWords = (name: string): string[] => {
            const normalized = name.toLowerCase()
                .replace(/\$mm/g, ' ') // Remove $mm unit
                .replace(/\$m(?![a-z])/g, ' ') // Remove $m unit
                .replace(/mm(?![a-z])/g, ' ') // Remove mm unit
                .replace(/_bps/g, ' ') // Remove _bps suffix
                .replace(/_pct/g, ' ') // Remove _pct suffix
                .replace(/_annual/g, ' ') // Remove _annual suffix
                .replace(/_fte/g, ' ') // Remove _fte suffix
                .replace(/[^a-z0-9\s_]/g, ' ') // Replace special chars with spaces
                .replace(/\s+/g, ' ')
                .trim();
            
            return normalized.split(/[\s_]+/)
                .filter(w => w.length > 1)
                .map(w => w.replace(/[^a-z0-9]/g, ''));
        };
        
        const targetNormalized = normalizeFieldName(fieldName);
        const targetCoreWords = extractCoreWords(fieldName);
        
        // Strategy 0: Try exact match first (case-insensitive)
        // This is the most reliable - field names from NamingConvention should match Fact_Margin exactly
        for (const [key, value] of Object.entries(record)) {
            const keyLower = key.toLowerCase().trim();
            const fieldNameLower = fieldName.toLowerCase().trim();
            
            // Skip ID, period, date, and quarter fields
            if (keyLower.includes('id') || keyLower.includes('period') || keyLower.includes('date') || keyLower.includes('quarter')) continue;
            
            // Exact match (case-insensitive)
            if (keyLower === fieldNameLower) {
                const numValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
                if (!isNaN(numValue)) {
                    return numValue;
                }
            }
        }
        
        // Strategy 1: Try exact normalized match (case-insensitive, no special chars, no units)
        // Example: "Total Revenue" -> "totalrevenue", "TotalRevenue_$mm" -> "totalrevenue"
        for (const [key, value] of Object.entries(record)) {
            const keyLower = key.toLowerCase();
            // Skip ID, period, date, and quarter fields
            if (keyLower.includes('id') || keyLower.includes('period') || keyLower.includes('date') || keyLower.includes('quarter')) continue;
            
            const keyNormalized = normalizeFieldName(key);
            if (keyNormalized === targetNormalized && keyNormalized.length > 0) {
                const numValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
                if (!isNaN(numValue)) {
                    return numValue;
                }
            }
        }
        
        // Strategy 2: Try normalized contains match
        // Example: "TotalRevenue" contains "Revenue" or vice versa
        for (const [key, value] of Object.entries(record)) {
            const keyLower = key.toLowerCase();
            if (keyLower.includes('id') || keyLower.includes('period') || keyLower.includes('date') || keyLower.includes('quarter')) continue;
            
            const keyNormalized = normalizeFieldName(key);
            // Check if normalized versions contain each other (and both are substantial)
            if (keyNormalized.length > 3 && targetNormalized.length > 3) {
                if (keyNormalized.includes(targetNormalized) || targetNormalized.includes(keyNormalized)) {
                    const numValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
                    if (!isNaN(numValue)) {
                        return numValue;
                    }
                }
            }
        }
        
        // Strategy 3: Word-by-word matching (fuzzy)
        // Example: "Rev Transaction Fees" matches "RevTransactionFees_$mm" by matching words
        if (targetCoreWords.length > 0) {
            for (const [key, value] of Object.entries(record)) {
                const keyLower = key.toLowerCase();
                if (keyLower.includes('id') || keyLower.includes('period') || keyLower.includes('date') || keyLower.includes('quarter')) continue;
                
                const keyCoreWords = extractCoreWords(key);
                // Check if all target core words appear in key (or vice versa)
                const allWordsMatch = targetCoreWords.length > 0 && 
                    targetCoreWords.every(tWord => 
                        tWord.length > 2 && keyCoreWords.some(kWord => 
                            kWord.includes(tWord) || tWord.includes(kWord) || 
                            kWord === tWord
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
        
        // Strategy 4: Partial word matching (most fuzzy - for cases like "TotalRevenue_$mm" matching "Total Revenue")
        for (const [key, value] of Object.entries(record)) {
            const keyLower = key.toLowerCase();
            if (keyLower.includes('id') || keyLower.includes('period') || keyLower.includes('date') || keyLower.includes('quarter')) continue;
            
            // Check if key contains all significant words from target
            const allWordsFound = targetCoreWords.length > 0 && 
                targetCoreWords.every(tWord => tWord.length > 2 && keyLower.includes(tWord));
            
            if (allWordsFound) {
                const numValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
                if (!isNaN(numValue)) {
                    return numValue;
                }
            }
        }
        
        // Strategy 5: Very loose matching - check if any significant word from target appears in key
        if (targetCoreWords.length > 0) {
            for (const [key, value] of Object.entries(record)) {
                const keyLower = key.toLowerCase();
                if (keyLower.includes('id') || keyLower.includes('period') || keyLower.includes('date') || keyLower.includes('quarter')) continue;
                
                // Check if at least 50% of target words appear in key
                const matchingWords = targetCoreWords.filter(tWord => 
                    tWord.length > 2 && keyLower.includes(tWord)
                );
                if (matchingWords.length > 0 && matchingWords.length >= Math.ceil(targetCoreWords.length * 0.5)) {
                    const numValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
                    if (!isNaN(numValue)) {
                        return numValue;
                    }
                }
            }
        }

        return null;
    };

    // Build P&L Line Items Structure dynamically from NamingConvention
    // Filters by Category = 'Financial Result' and structures by P&L Impact (Revenue, Expense, Margin)
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
                    indent: 2,
                    isTotal: true
                };
                // Don't add TotalCompensation_$mm to expenseItems - it will be added separately in hierarchy
            } else if (fieldNameLower === 'basecompensation_$mm' || fieldNameLower === 'variablecompensation_$mm') {
                compensationFields.set(fieldName, lineItem);
                // Don't add these to expenseItems yet - they'll be added as nested items
            } else {
                // Only categorize non-compensation fields into revenue/expense items
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
        // Note: TotalRevenue_$mm and TotalExpense_$mm come directly from Fact_Margin, not calculated
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
            if (totalCompensationItem !== null) {
                const compensationItem: PnLLineItem = totalCompensationItem;
                // Add TotalCompensation_$mm with indent 1 (same level as other expenses)
                items.push({
                    label: compensationItem.label,
                    fieldName: compensationItem.fieldName,
                    isTotal: compensationItem.isTotal,
                    indent: 1
                });
                
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
                    items.push({
                        label: baseComp.label,
                        fieldName: baseComp.fieldName,
                        isTotal: baseComp.isTotal,
                        indent: 2
                    });
                }
                if (varComp) {
                    items.push({
                        label: varComp.label,
                        fieldName: varComp.fieldName,
                        isTotal: varComp.isTotal,
                        indent: 2
                    });
                }
            }
        }

        // Margin items would be added here if needed, but Margin is calculated, not from individual fields
        // Margin = Total Revenue - Total Expense

        console.log('=== P&L Line Items Built ===');
        console.log('Total items:', items.length);
        console.log('Revenue items:', revenueItems.length);
        console.log('Expense items:', expenseItems.length);
        console.log('Field names to match:', items.filter(i => i.fieldName).map(i => i.fieldName));
        
        return items;
    }, [excelData]);

    // Handle scrolling to field from query parameter (must be after pnlLineItems is defined)
    useEffect(() => {
        const fieldParam = searchParams.get('field');
        if (fieldParam && pnlLineItems.length > 0 && !hasScrolledToField) {
            const fieldName = decodeURIComponent(fieldParam);
            
            // Normalize field name for matching (remove special chars, spaces, units)
            const normalizeFieldName = (name: string) => {
                return name.toLowerCase()
                    .replace(/\$mm/g, '')
                    .replace(/\$m(?![a-z])/g, '')
                    .replace(/mm(?![a-z])/g, '')
                    .replace(/_bps/g, '')
                    .replace(/_pct/g, '')
                    .replace(/_fte/g, '')
                    .replace(/[^a-z0-9]/g, '')
                    .trim();
            };
            
            const targetNormalized = normalizeFieldName(fieldName);
            
            // Find the field in pnlLineItems to determine which section it belongs to
            const fieldItem = pnlLineItems.find(item => {
                if (!item.fieldName) return false;
                const itemFieldNormalized = normalizeFieldName(item.fieldName);
                return itemFieldNormalized === targetNormalized || 
                       itemFieldNormalized.includes(targetNormalized) ||
                       targetNormalized.includes(itemFieldNormalized);
            });
            
            if (fieldItem && fieldItem.fieldName) {
                // Determine which section this field belongs to
                const fieldNameLower = fieldItem.fieldName.toLowerCase();
                let sectionToExpand: string | null = null;
                
                if (fieldNameLower.includes('revenue') || fieldNameLower.includes('advisory') || 
                    fieldNameLower.includes('transaction') || fieldNameLower.includes('aum') ||
                    fieldNameLower.includes('netflows') || fieldNameLower.includes('marketreturn') ||
                    fieldNameLower.includes('tradingvolume')) {
                    sectionToExpand = 'Revenue';
                } else if (fieldNameLower.includes('expense') || fieldNameLower.includes('compensation') ||
                           fieldNameLower.includes('acquisition') || fieldNameLower.includes('application') ||
                           fieldNameLower.includes('headcount') || fieldNameLower.includes('fte')) {
                    sectionToExpand = 'Expenses';
                }
                
                // Expand the section if needed
                if (sectionToExpand && !expandedSections.has(sectionToExpand)) {
                    setExpandedSections(prev => new Set([...prev, sectionToExpand!]));
                }
                
                // Wait a bit for the DOM to update, then scroll
                setTimeout(() => {
                    const elementId = `field-${fieldItem.fieldName.replace(/[^a-zA-Z0-9]/g, '-')}`;
                    const element = document.getElementById(elementId);
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        // Highlight the row briefly
                        element.classList.add('bg-yellow-100');
                        setTimeout(() => {
                            element.classList.remove('bg-yellow-100');
                        }, 2000);
                        setHasScrolledToField(true);
                    }
                }, 500);
            }
        }
    }, [searchParams, pnlLineItems, expandedSections, hasScrolledToField]);

    // Calculate P&L data based on selected dimensions and available periods (quarters)
    const pnlData = useMemo(() => {
        console.log('=== P&L Data Calculation Start ===');
        console.log('excelData exists:', !!excelData);
        console.log('factMarginRecords count:', excelData?.factMarginRecords?.length || 0);
        console.log('namingConventionRecords count:', excelData?.namingConventionRecords?.length || 0);
        console.log('availablePeriods:', availablePeriods);
        console.log('selectedDimensions:', selectedDimensions);
        console.log('pnlLineItems count:', pnlLineItems.length);
        
        if (!excelData || 
            !excelData.factMarginRecords || 
            !Array.isArray(excelData.factMarginRecords) ||
            excelData.factMarginRecords.length === 0 || 
            availablePeriods.length === 0) {
            console.warn('Missing data - returning empty P&L');
            return {} as PnLData;
        }

        if (pnlLineItems.length === 0) {
            console.warn('No P&L line items found - check NamingConvention data');
            return {} as PnLData;
        }

        try {
            const data: PnLData = {};
            
            // Ensure dimensionTables exists
            if (!excelData.dimensionTables) {
                excelData.dimensionTables = new Map();
            }
            
            // Debug: Log first record to see structure
            if (excelData.factMarginRecords.length > 0) {
                const firstRecord = excelData.factMarginRecords[0];
                console.log('First Fact_Margin record:', firstRecord);
                const allFields = Object.keys(firstRecord);
                console.log('All fields in first record:', allFields);
                const dataFields = allFields.filter(k => 
                    !k.toLowerCase().includes('id') && 
                    !k.toLowerCase().includes('period') && 
                    !k.toLowerCase().includes('date') && 
                    !k.toLowerCase().includes('quarter')
                );
                console.log('Data fields (non-ID, non-period):', dataFields);
                console.log('Fields we are trying to match:', pnlLineItems.filter(i => i.fieldName).map(i => i.fieldName));
            }
            
            // Get dimension values for selected dimensions
            const dimensionValues: { [dimName: string]: Set<string> } = {};
            selectedDimensions.forEach(dimName => {
                dimensionValues[dimName] = new Set();
            });

            // Extract dimension values from Fact_Margin records
            excelData.factMarginRecords.forEach(record => {
                if (!record) return;
                
                selectedDimensions.forEach(dimName => {
                    try {
                        // Special handling for dimension ID field names
                        let idFieldName: string;
                        if (dimName === 'LineOfBusiness') {
                            idFieldName = 'LOBID';
                        } else {
                            idFieldName = dimName + 'ID';
                        }
                        
                        const idValue = record[idFieldName];
                        if (idValue !== undefined && idValue !== null && idValue !== '') {
                            // Try both Dim_ and DIM_ prefix for dimension table name
                            const dimTableName = `Dim_${dimName}`;
                            const dimTableNameUpper = `DIM_${dimName}`;
                            
                            // Try Dim_ first, then DIM_
                            let dimRecord = joinFactWithDimension(record, excelData.dimensionTables, idFieldName, dimTableName);
                            if (!dimRecord) {
                                dimRecord = joinFactWithDimension(record, excelData.dimensionTables, idFieldName, dimTableNameUpper);
                            }
                            
                            // Debug logging for LineOfBusiness
                            if (dimName === 'LineOfBusiness' && !dimRecord) {
                                console.debug(`LineOfBusiness join failed: idFieldName=${idFieldName}, idValue=${idValue}, availableTables=`, 
                                    Array.from(excelData.dimensionTables.keys()));
                            }
                            
                            if (dimRecord) {
                                // Find the display field (usually name, description, or first non-ID field)
                                const displayField = Object.keys(dimRecord).find(key => 
                                    !key.toLowerCase().includes('id') && 
                                    (key.toLowerCase().includes('name') || 
                                     key.toLowerCase().includes('description') ||
                                     key.toLowerCase().includes('code'))
                                ) || Object.keys(dimRecord).find(key => !key.toLowerCase().includes('id'));
                                
                                if (displayField) {
                                    dimensionValues[dimName].add(String(dimRecord[displayField]));
                                }
                            } else {
                                // If no dimension record found, use the ID value
                                dimensionValues[dimName].add(String(idValue));
                            }
                        }
                    } catch (error) {
                        console.warn(`Error processing dimension ${dimName}:`, error);
                    }
                });
            });

            // Create row keys from dimension combinations
            const rowKeys: string[] = [];
            if (selectedDimensions.length === 0) {
                rowKeys.push('Total');
            } else {
                // Generate all combinations of dimension values
                const dimArrays = selectedDimensions.map(dim => {
                    const values = dimensionValues[dim];
                    return values && values.size > 0 ? Array.from(values) : [];
                }).filter(arr => arr.length > 0);
                
                if (dimArrays.length > 0) {
                    const combinations = generateCombinations(dimArrays);
                    combinations.forEach(combo => {
                        rowKeys.push(combo.join(' | '));
                    });
                }
                // Add grand total
                rowKeys.push('Total');
            }

        // Initialize data structure
        rowKeys.forEach(rowKey => {
            data[rowKey] = {};
            availablePeriods.forEach(period => {
                data[rowKey][period] = {};
                pnlLineItems.forEach(item => {
                    // Initialize all fields including totals (TotalRevenue_$mm, TotalExpense_$mm)
                    if (item.fieldName && !item.isMargin) {
                        data[rowKey][period][item.fieldName] = 0;
                    }
                });
                // Also initialize Margin and MarginPct
                data[rowKey][period]['Margin'] = 0;
                data[rowKey][period]['MarginPct'] = 0;
                data[rowKey][period]['Margin_$mm'] = 0;
            });
        });

            // Aggregate data from Fact_Margin records
            let processedRecords = 0;
            let skippedRecords = 0;
            
            excelData.factMarginRecords.forEach((record, recordIndex) => {
                if (!record) {
                    skippedRecords++;
                    return;
                }
                
                try {
                    // Get quarter from 'Quarter' field (case-insensitive)
                    const quarterKey = Object.keys(record).find(key => 
                        key.toLowerCase() === 'quarter'
                    );
                    if (!quarterKey) {
                        if (recordIndex === 0) {
                            console.warn('No Quarter field found in record. Available keys:', Object.keys(record));
                        }
                        skippedRecords++;
                        return;
                    }
                    const quarter = record[quarterKey];
                    if (!quarter || quarter === null || quarter === undefined || quarter === '') {
                        skippedRecords++;
                        return;
                    }
                    const period = String(quarter);
                    if (!availablePeriods.includes(period)) {
                        skippedRecords++;
                        return;
                    }
                    
                    processedRecords++;

                    // Find row key based on dimensions
                    let rowKey: string | null = null;
                    if (selectedDimensions.length > 0) {
                        const dimValues: string[] = [];
                        let allDimsFound = true;
                        
                        selectedDimensions.forEach(dimName => {
                            try {
                                // Special handling for dimension ID field names
                                let idFieldName: string;
                                if (dimName === 'LineOfBusiness') {
                                    idFieldName = 'LOBID';
                                } else {
                                    idFieldName = dimName + 'ID';
                                }
                                
                                const idValue = record[idFieldName];
                                if (idValue !== undefined && idValue !== null && idValue !== '') {
                                    // Try both Dim_ and DIM_ prefix for dimension table name
                                    const dimTableName = `Dim_${dimName}`;
                                    const dimTableNameUpper = `DIM_${dimName}`;
                                    
                                    // Try Dim_ first, then DIM_
                                    let dimRecord = joinFactWithDimension(record, excelData.dimensionTables, idFieldName, dimTableName);
                                    if (!dimRecord) {
                                        dimRecord = joinFactWithDimension(record, excelData.dimensionTables, idFieldName, dimTableNameUpper);
                                    }
                                    if (dimRecord) {
                                        const displayField = Object.keys(dimRecord).find(key => 
                                            !key.toLowerCase().includes('id') && 
                                            (key.toLowerCase().includes('name') || 
                                             key.toLowerCase().includes('description') ||
                                             key.toLowerCase().includes('code'))
                                        ) || Object.keys(dimRecord).find(key => !key.toLowerCase().includes('id'));
                                        
                                        if (displayField) {
                                            dimValues.push(String(dimRecord[displayField]));
                                        } else {
                                            allDimsFound = false;
                                        }
                                    } else {
                                        dimValues.push(String(idValue));
                                    }
                                } else {
                                    allDimsFound = false;
                                }
                            } catch (error) {
                                console.warn(`Error processing dimension ${dimName} for record:`, error);
                                allDimsFound = false;
                            }
                        });

                        if (allDimsFound && dimValues.length === selectedDimensions.length) {
                            rowKey = dimValues.join(' | ');
                        } else if (dimValues.length > 0) {
                            // Partial match - use what we have
                            rowKey = dimValues.join(' | ');
                        }
                    }
                    
                    // If no row key found or no dimensions selected, use Total
                    if (!rowKey) {
                        rowKey = 'Total';
                    }

                    // Aggregate amounts for each line item (including totals like TotalRevenue_$mm and TotalExpense_$mm)
                    let fieldsMatched = 0;
                    pnlLineItems.forEach(item => {
                        if (!item.fieldName || item.isMargin) return; // Include totals, exclude margin (handled separately)

                        try {
                            // Try to find matching field in record using fuzzy matching
                            const fieldValue = getFieldValue(record, item.fieldName);
                            if (fieldValue !== null && !isNaN(fieldValue)) {
                                if (!data[rowKey]) data[rowKey] = {};
                                if (!data[rowKey][period]) data[rowKey][period] = {};
                                if (!data[rowKey][period][item.fieldName]) data[rowKey][period][item.fieldName] = 0;
                                data[rowKey][period][item.fieldName] += fieldValue;
                                fieldsMatched++;
                                
                                // Log successful matches for first record
                                if (recordIndex === 0) {
                                    console.log(`✓ Matched "${item.fieldName}" = ${fieldValue}`);
                                }
                            } else if (recordIndex === 0) {
                                // Log failed matches for first record
                                console.warn(`✗ Failed to match "${item.fieldName}"`);
                            }
                        } catch (error) {
                            console.warn(`Error processing field ${item.fieldName}:`, error);
                        }
                    });
                    
                    // Also aggregate Margin_$mm and MarginPct if they exist in the record
                    try {
                        const marginValue = getFieldValue(record, 'Margin_$mm');
                        if (marginValue !== null && !isNaN(marginValue)) {
                            if (!data[rowKey]) data[rowKey] = {};
                            if (!data[rowKey][period]) data[rowKey][period] = {};
                            if (!data[rowKey][period]['Margin_$mm']) data[rowKey][period]['Margin_$mm'] = 0;
                            data[rowKey][period]['Margin_$mm'] += marginValue;
                        }
                        
                        // Try to get MarginPct (might be MarginPct, Margin_%, etc.)
                        const marginPctValue = getFieldValue(record, 'MarginPct') || getFieldValue(record, 'Margin_%');
                        if (marginPctValue !== null && !isNaN(marginPctValue)) {
                            if (!data[rowKey]) data[rowKey] = {};
                            if (!data[rowKey][period]) data[rowKey][period] = {};
                            // Check if value is already a percentage (>= 1) or a decimal (< 1)
                            // If it's already a percentage (e.g., 83 for 83%), use as-is
                            // If it's a decimal (e.g., 0.83 for 83%), we'll handle in calculation step
                            if (!data[rowKey][period]['MarginPct']) {
                                data[rowKey][period]['MarginPct'] = marginPctValue;
                            }
                        }
                    } catch (error) {
                        // Ignore margin aggregation errors
                    }
                    
                    if (recordIndex === 0 && fieldsMatched === 0) {
                        console.warn('=== FIELD MATCHING DEBUG (First Record) ===');
                        console.warn('Row Key:', rowKey);
                        console.warn('Period:', period);
                        console.warn('Trying to match fields:', pnlLineItems.filter(i => i.fieldName).map(i => i.fieldName));
                        const availableFields = Object.keys(record).filter(k => 
                            !k.toLowerCase().includes('id') && 
                            !k.toLowerCase().includes('period') && 
                            !k.toLowerCase().includes('date') && 
                            !k.toLowerCase().includes('quarter')
                        );
                        console.warn('Available fields in record:', availableFields);
                        
                        // Try matching each field and show detailed results
                        pnlLineItems.filter(i => i.fieldName).forEach(item => {
                            const matchedValue = getFieldValue(record, item.fieldName);
                            if (matchedValue !== null) {
                                console.log(`✓ "${item.fieldName}" matched, value:`, matchedValue);
                            } else {
                                // Show what normalized versions look like
                                const targetNorm = item.fieldName.toLowerCase().replace(/\$mm/g, '').replace(/\$m(?![a-z])/g, '').replace(/[^a-z0-9]/g, '');
                                console.warn(`✗ "${item.fieldName}" (normalized: "${targetNorm}") did not match`);
                                // Show similar fields
                                const similar = availableFields.filter(f => {
                                    const fNorm = f.toLowerCase().replace(/\$mm/g, '').replace(/\$m(?![a-z])/g, '').replace(/[^a-z0-9]/g, '');
                                    return fNorm.includes(targetNorm.substring(0, Math.min(5, targetNorm.length))) || 
                                           targetNorm.includes(fNorm.substring(0, Math.min(5, fNorm.length)));
                                });
                                if (similar.length > 0) {
                                    console.warn(`  Similar fields found:`, similar);
                                }
                            }
                        });
                        console.warn('=== END FIELD MATCHING DEBUG ===');
                    }
                } catch (error) {
                    console.warn('Error processing record:', error, record);
                    skippedRecords++;
                }
            });
            
            console.log(`Processed ${processedRecords} records, skipped ${skippedRecords} records`);
            console.log('Data structure after aggregation:', Object.keys(data));

            // Calculate totals and margins
            rowKeys.forEach(rowKey => {
                availablePeriods.forEach(period => {
                    try {
                        if (!data[rowKey] || !data[rowKey][period]) return;

                        const periodData = data[rowKey][period];

                        // TotalRevenue_$mm and TotalExpense_$mm come directly from Fact_Margin data
                        // They should already be populated from aggregation above
                        const totalRevenue = periodData['TotalRevenue_$mm'] || 0;
                        const totalExpense = periodData['TotalExpense_$mm'] || 0;

                        // Get Margin_$mm directly from Fact_Margin data (if available), otherwise calculate
                        const marginFromData = periodData['Margin_$mm'] !== undefined ? periodData['Margin_$mm'] : null;
                        const marginPctFromData = periodData['MarginPct'] !== undefined ? periodData['MarginPct'] : null;
                        
                        // Use Margin_$mm from source data if available, otherwise calculate
                        if (marginFromData !== null && marginFromData !== 0) {
                            periodData['Margin'] = marginFromData;
                        } else {
                            // Calculate Margin if not in source data
                            periodData['Margin'] = totalRevenue - totalExpense;
                        }
                        
                        // Use MarginPct from source data if available, otherwise calculate
                        if (marginPctFromData !== null && marginPctFromData !== 0) {
                            // Check if the value is already a percentage (>= 1) or a decimal (< 1)
                            // If it's already a percentage (e.g., 83 for 83%), use as-is
                            // If it's a decimal (e.g., 0.83 for 83%), multiply by 100
                            if (Math.abs(marginPctFromData) >= 1) {
                                // Already a percentage value (e.g., 83 means 83%)
                                periodData['MarginPct'] = marginPctFromData;
                            } else {
                                // Decimal value (e.g., 0.83 means 83%), multiply by 100
                                periodData['MarginPct'] = marginPctFromData * 100;
                            }
                        } else {
                            // Calculate Margin % if not in source data
                            periodData['MarginPct'] = totalRevenue !== 0 ? (periodData['Margin'] / totalRevenue) * 100 : 0;
                        }
                    } catch (error) {
                        console.warn(`Error calculating totals for ${rowKey}, ${period}:`, error);
                    }
                });
            });

            // Calculate grand totals
            if (rowKeys.includes('Total')) {
                availablePeriods.forEach(period => {
                    try {
                        const totalData: { [key: string]: number } = {};
                        
                        pnlLineItems.forEach(item => {
                            if (!item.fieldName) return;
                            totalData[item.fieldName] = 0;
                            
                            rowKeys.forEach(rowKey => {
                                if (rowKey !== 'Total' && data[rowKey] && data[rowKey][period]) {
                                    totalData[item.fieldName] += data[rowKey][period][item.fieldName] || 0;
                                }
                            });
                        });

                        // Calculate Margin and Margin % for grand total using direct values
                        const grandTotalRevenue = totalData['TotalRevenue_$mm'] || 0;
                        const grandTotalExpense = totalData['TotalExpense_$mm'] || 0;
                        totalData['Margin'] = grandTotalRevenue - grandTotalExpense;
                        // Calculate Margin % for grand total
                        totalData['MarginPct'] = grandTotalRevenue !== 0 ? (totalData['Margin'] / grandTotalRevenue) * 100 : 0;

                        if (!data['Total']) data['Total'] = {};
                        data['Total'][period] = totalData;
                    } catch (error) {
                        console.warn(`Error calculating grand total for ${period}:`, error);
                    }
                });
            }

            return data;
        } catch (error) {
            console.error('Error calculating P&L data:', error);
            return {} as PnLData;
        }
    }, [excelData, selectedDimensions, availablePeriods, pnlLineItems]);

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

    const toggleDimension = (dimension: string) => {
        setSelectedDimensions(prev => {
            if (prev.includes(dimension)) {
                return prev.filter(d => d !== dimension);
            } else {
                return [...prev, dimension];
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

    // Determine which line items to show based on expanded sections
    // Returns items with a flag indicating if they should be combined with their section header
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
            else if (item.indent === 2 && !item.isTotal && !item.isMargin && 
                     (item.fieldName.toLowerCase().includes('basecompensation') || 
                      item.fieldName.toLowerCase().includes('variablecompensation'))) {
                // Only show if Expenses section is expanded
                if (currentSection === 'Expenses' && expandedSections.has('Expenses')) {
                    visible.push(item);
                }
            }
            // Other detail lines (indent 2 or 3) - only show if section is expanded
            else if ((item.indent === 2 || item.indent === 3) && !item.isTotal && !item.isMargin) {
                if (currentSection && expandedSections.has(currentSection)) {
                    visible.push(item);
                }
            }
            // Margin lines - always visible (handled at top)
        });
        
        return visible;
    };


    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Profit & Loss Report</h1>
                        <p className="text-sm text-gray-600 mt-1">Operational performance analysis</p>
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
                    {/* Dimension Slicers */}
                    <div className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-3">
                            <Filter className="w-4 h-4 text-gray-600" />
                            <h3 className="text-sm font-semibold text-gray-900">Dimension Slicers</h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {availableDimensions.map(dim => (
                                <button
                                    key={dim}
                                    onClick={() => toggleDimension(dim)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                        selectedDimensions.includes(dim)
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    {dim}
                                </button>
                    ))}
                </div>
                        {selectedDimensions.length === 0 && (
                            <p className="text-xs text-gray-500 mt-2">No dimensions selected - showing totals only</p>
                        )}
            </div>

                    {/* Quarters Info */}
                    <div className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-3">
                            <BarChart3 className="w-4 h-4 text-gray-600" />
                            <h3 className="text-sm font-semibold text-gray-900">Quarters</h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {availablePeriods.length > 0 ? (
                                availablePeriods.map(quarter => (
                                    <span
                                        key={quarter}
                                        className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-100 text-green-700"
                                    >
                                        {quarter}
                                    </span>
                                ))
                            ) : (
                                <p className="text-xs text-gray-500">No quarters found in Fact_Margin data</p>
                            )}
                    </div>
                        <p className="text-xs text-gray-500 mt-2">
                            Quarters are displayed as columns in the P&L table below
                        </p>
                    </div>
                </div>
            </div>

            {/* P&L Table */}
            {availablePeriods.length > 0 && (
                <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b-2 border-gray-200">
                                <tr>
                                    <th className="text-left py-4 px-6 font-semibold text-gray-900 sticky left-0 bg-gray-50 z-10 min-w-[250px]">
                                        Line Item
                                    </th>
                                    {availablePeriods.map(period => (
                                        <th key={period} className="text-right py-4 px-3 font-semibold text-gray-900 min-w-[160px]">
                                            {period}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {Object.keys(pnlData).length > 0 ? (
                                    Object.keys(pnlData).sort((a, b) => {
                                        // Sort so "Total" comes last
                                        if (a === 'Total') return 1;
                                        if (b === 'Total') return -1;
                                        return a.localeCompare(b);
                                    }).map(rowKey => (
                                    <React.Fragment key={rowKey}>
                                        {/* Row Header with Margin values */}
                                        <tr className={rowKey === 'Total' ? 'bg-gray-100' : 'bg-blue-50'}>
                                            <td className={`py-3 px-6 font-bold ${
                                                rowKey === 'Total' ? 'text-gray-900' : 'text-blue-900'
                                            }`}>
                                                {rowKey}
                                            </td>
                                            {availablePeriods.map((period, periodIdx) => {
                                                const marginValue = pnlData[rowKey]?.[period]?.['Margin'] || 0;
                                                const marginPctValue = pnlData[rowKey]?.[period]?.['MarginPct'] || 0;
                                                
                                                // Calculate trend for margin vs previous quarter
                                                let trendValue: number | null = null;
                                                if (periodIdx > 0) {
                                                    const prevPeriod = availablePeriods[periodIdx - 1];
                                                    const prevMargin = pnlData[rowKey]?.[prevPeriod]?.['Margin'] || 0;
                                                    if (prevMargin !== 0) {
                                                        trendValue = ((marginValue - prevMargin) / Math.abs(prevMargin)) * 100;
                                                    } else if (marginValue !== 0) {
                                                        trendValue = marginValue > 0 ? 100 : -100;
                                                    }
                                                }
                                                
                                                const trendIsPositive = trendValue !== null && trendValue >= 0;
                                                const trendIsNegative = trendValue !== null && trendValue < 0;
                                                
                                                return (
                                                    <td 
                                                        key={period}
                                                        className={`py-3 px-3 text-right font-bold ${
                                                            rowKey === 'Total' ? 'text-gray-900' : 'text-blue-900'
                                                        }`}
                                                    >
                                                        <div className="flex flex-col items-end space-y-1">
                                                            <div className="flex items-center justify-end space-x-2">
                                                                <span>{formatCurrency(marginValue)}</span>
                                                                {trendValue !== null && (
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
                                                            <div className="text-xs font-normal opacity-75">
                                                                {formatPercentage(marginPctValue)}
                                                            </div>
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                        {/* P&L Line Items */}
                                        {getVisibleLineItems().map((item, idx) => {
                                            const isMarginSection = item.isMargin;
                                            // Section headers are items with isTotal and indent 0 (Revenue/Expenses)
                                            const isSectionHeader = item.isTotal && (item.indent === 0 || item.label === 'Revenue' || item.label === 'Expenses');
                                            const isCombinedWithHeader = item.combineWithHeader && item.sectionHeader;
                                            
                                            // Determine if this is a collapsible section header
                                            const sectionName = item.sectionHeader?.label === 'Revenue' ? 'Revenue' 
                                                                : item.sectionHeader?.label === 'Expenses' ? 'Expenses'
                                                                : item.label === 'Revenue' ? 'Revenue' 
                                                                : item.label === 'Expenses' ? 'Expenses' 
                                                                : null;
                                            const isExpanded = sectionName ? expandedSections.has(sectionName) : false;
                                            
                                            // Use section header label if combined, otherwise use item label
                                            const displayLabel = isCombinedWithHeader ? item.sectionHeader!.label : item.label;
                                            
                                            // Create a unique ID for this row based on fieldName for scrolling
                                            const rowId = item.fieldName 
                                                ? `field-${item.fieldName.replace(/[^a-zA-Z0-9]/g, '-')}`
                                                : `row-${rowKey}-${item.label}-${idx}`;
                                            
                                            return (
                                                <tr 
                                                    id={rowId}
                                                    key={`${rowKey}-${item.label}-${idx}`}
                                                    className={`hover:bg-gray-50 transition-colors ${
                                                        item.isTotal || item.isMargin ? 'bg-gray-50 font-semibold border-t border-gray-200' : ''
                                                    }`}
                                                >
                                                    <td className={`py-3 px-6 text-gray-900 sticky left-0 z-10 ${
                                                        item.isTotal || item.isMargin ? 'bg-gray-50' : 'bg-white'
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
                                                    {availablePeriods.map((period, periodIdx) => {
                                                        // Use the item's fieldName - section headers now have fieldNames (TotalRevenue_$mm, TotalExpense_$mm)
                                                        const fieldNameToUse = item.fieldName || (item.combineWithHeader ? item.fieldName : null);
                                                        const value = fieldNameToUse ? (pnlData[rowKey]?.[period]?.[fieldNameToUse] || 0) : 0;
                                                        const displayValue = fieldNameToUse === 'MarginPct' 
                                                            ? formatPercentage(value)
                                                            : formatCurrency(value);
                                                        
                                                        // Calculate trend vs previous quarter
                                                        let trendValue: number | null = null;
                                                        if (periodIdx > 0 && fieldNameToUse) {
                                                            const prevPeriod = availablePeriods[periodIdx - 1];
                                                            const prevValue = pnlData[rowKey]?.[prevPeriod]?.[fieldNameToUse] || 0;
                                                            if (prevValue !== 0) {
                                                                trendValue = ((value - prevValue) / Math.abs(prevValue)) * 100;
                                                            } else if (value !== 0) {
                                                                trendValue = value > 0 ? 100 : -100; // New value when prev was 0
                                                            }
                                                        }
                                                        
                                                        const isPositive = value >= 0;
                                                        const isNegative = value < 0;
                                                        const trendIsPositive = trendValue !== null && trendValue >= 0;
                                                        const trendIsNegative = trendValue !== null && trendValue < 0;
                                                        
                                                        return (
                                                            <td 
                                                                key={period}
                                                                className={`py-3 px-3 text-right ${
                                                                    item.isTotal || item.isMargin 
                                                                        ? 'font-semibold text-gray-900' 
                                                                        : 'text-gray-700'
                                                                } ${
                                                                    isMarginSection && isPositive ? 'text-green-600' : ''
                                                                } ${
                                                                    isMarginSection && isNegative ? 'text-red-600' : ''
                                                                }`}
                                                            >
                                                                {fieldNameToUse ? (
                                                                    <div className="flex items-center justify-end space-x-2">
                                                                        <span>{displayValue}</span>
                                                                        {trendValue !== null && (
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
                                                                ) : (
                                                                    '-'
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                        {/* Spacer row */}
                                        <tr>
                                            <td colSpan={availablePeriods.length + 1} className="py-2"></td>
                                        </tr>
                                    </React.Fragment>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={availablePeriods.length + 1} className="py-8 text-center text-gray-500">
                                            No data available. Please check that your Fact_Margin data contains the required fields.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {availablePeriods.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
                    <p className="text-amber-800 font-medium">No quarters found in Fact_Margin data. Please ensure the 'Quarter' field exists in your Excel file.</p>
                </div>
            )}

            {excelData && (!excelData.namingConventionRecords || excelData.namingConventionRecords.length === 0) && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
                    <p className="text-amber-800 font-medium">NamingConvention tab not found in Excel file. Please ensure your Excel file contains a 'NamingConvention' sheet with field mappings.</p>
                </div>
            )}

            {excelData && pnlLineItems.length === 0 && excelData.namingConventionRecords && excelData.namingConventionRecords.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
                    <p className="text-amber-800 font-medium">No fields found with Category = 'Financial Result' in NamingConvention. Please check your NamingConvention tab.</p>
                </div>
            )}

            {!excelData && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
                    <p className="text-blue-800 font-medium">Loading data... Please upload an Excel file with Fact_Margin data.</p>
                </div>
            )}
        </div>
    );
}

