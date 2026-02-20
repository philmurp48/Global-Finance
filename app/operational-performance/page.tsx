'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
import { ExcelDriverTreeData, joinFactWithDimension, getDimensionTableNames, FactMarginRecord } from '@/lib/excel-parser';

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
    const [excelData, setExcelData] = useState<ExcelDriverTreeData | null>(null);
    const [selectedDimensions, setSelectedDimensions] = useState<string[]>(['Geography']); // Default to Geography
    const [availableDimensions, setAvailableDimensions] = useState<string[]>([]);
    const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set()); // Track expanded sections

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

    // P&L Line Items Structure
    // fieldName uses "Report Field Name" from mapping table, which maps to "Fact_Margin Field Name" via fuzzy matching
    // Example: "TotalRevenue" (report) → "TotalRevenue_$mm" (fact margin)
    // Structure matches hierarchy: TotalRevenue/TotalExpense → Detail items
    // Note: Margin and Margin % are displayed on the Geography header row, not as separate line items
    const pnlLineItems: PnLLineItem[] = [
        // Revenue Section
        { label: 'Revenue', fieldName: '', isTotal: true, indent: 0 },
        { label: 'Total Revenue', fieldName: 'TotalRevenue', isTotal: true, indent: 1 }, // Maps to TotalRevenue_$mm
        { label: 'Rev Transaction Fees', fieldName: 'Rev Transaction Fees', indent: 2 }, // Maps to Rev_TransactionalFees_$mm
        { label: 'Rev CustodySafekeeping', fieldName: 'Rev CustodySafekeeping', indent: 2 }, // Maps to Rev_CustodySafekeeping_$mm
        { label: 'AdminFundExpense', fieldName: 'AdminFundExpense', indent: 2 }, // Maps to Rev_AdminFundExpense_$mm
        { label: 'PerformanceFees', fieldName: 'PerformanceFees', indent: 2 }, // Maps to Rev_PerformanceFees_$mm
        { label: 'Interest Rate Revenue', fieldName: 'Interest Rate Revenue', indent: 2 }, // Maps to Rev_InterestRateRevenue_$mm
        
        // Expense Section
        { label: 'Expenses', fieldName: '', isTotal: true, indent: 0 },
        { label: 'Total Expense', fieldName: 'Total Expense', isTotal: true, indent: 1 }, // Maps to TotalExpense_$mm
        { label: 'Exp_CompBenefits', fieldName: 'Exp_CompBenefits', indent: 2 }, // Maps to Exp_CompBenefits_$mm
        { label: 'Exp_Tech and Data', fieldName: 'Exp_Tech and Data', indent: 2 }, // Maps to Exp_TechData_$mm
        { label: 'Exp_SalesMktg', fieldName: 'Exp_SalesMktg', indent: 2 }, // Maps to Exp_SalesMktg_$mm
        { label: 'Exp_OpsProfSvcs', fieldName: 'Exp_OpsProfSvcs', indent: 2 }, // Maps to Exp_OpsProfSvcs_$mm
    ];

    // Calculate P&L data based on selected dimensions and available periods (quarters)
    const pnlData = useMemo(() => {
        console.log('=== P&L Data Calculation Start ===');
        console.log('excelData exists:', !!excelData);
        console.log('factMarginRecords count:', excelData?.factMarginRecords?.length || 0);
        console.log('availablePeriods:', availablePeriods);
        console.log('selectedDimensions:', selectedDimensions);
        
        if (!excelData || 
            !excelData.factMarginRecords || 
            !Array.isArray(excelData.factMarginRecords) ||
            excelData.factMarginRecords.length === 0 || 
            availablePeriods.length === 0) {
            console.warn('Missing data - returning empty P&L');
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
                console.log('First Fact_Margin record:', excelData.factMarginRecords[0]);
                console.log('Available fields in first record:', Object.keys(excelData.factMarginRecords[0]));
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
                        const idFieldName = dimName + 'ID';
                        const idValue = record[idFieldName];
                        if (idValue !== undefined && idValue !== null && idValue !== '') {
                            const dimTableName = `Dim_${dimName}`;
                            const dimRecord = joinFactWithDimension(record, excelData.dimensionTables, idFieldName, dimTableName);
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
                    if (item.fieldName && !item.isTotal && !item.isMargin) {
                        data[rowKey][period][item.fieldName] = 0;
                    }
                });
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
                                const idFieldName = dimName + 'ID';
                                const idValue = record[idFieldName];
                                if (idValue !== undefined && idValue !== null && idValue !== '') {
                                    const dimTableName = `Dim_${dimName}`;
                                    const dimRecord = joinFactWithDimension(record, excelData.dimensionTables, idFieldName, dimTableName);
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

                    // Aggregate amounts for each line item
                    let fieldsMatched = 0;
                    pnlLineItems.forEach(item => {
                        if (!item.fieldName || item.isTotal || item.isMargin) return;

                        try {
                            // Try to find matching field in record using fuzzy matching
                            const fieldValue = getFieldValue(record, item.fieldName);
                            if (fieldValue !== null && !isNaN(fieldValue)) {
                                if (!data[rowKey]) data[rowKey] = {};
                                if (!data[rowKey][period]) data[rowKey][period] = {};
                                if (!data[rowKey][period][item.fieldName]) data[rowKey][period][item.fieldName] = 0;
                                data[rowKey][period][item.fieldName] += fieldValue;
                                fieldsMatched++;
                            }
                        } catch (error) {
                            console.warn(`Error processing field ${item.fieldName}:`, error);
                        }
                    });
                    
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

                        // Calculate Total Revenue - sum all revenue components
                        const totalRevenue = 
                            (periodData['Rev Transaction Fees'] || 0) +
                            (periodData['Rev CustodySafekeeping'] || 0) +
                            (periodData['AdminFundExpense'] || 0) +
                            (periodData['PerformanceFees'] || 0) +
                            (periodData['Interest Rate Revenue'] || 0);
                        periodData['TotalRevenue'] = totalRevenue;

                        // Calculate Total Expense - sum all expense components
                        const totalExpense = 
                            (periodData['Exp_CompBenefits'] || 0) +
                            (periodData['Exp_Tech and Data'] || 0) +
                            (periodData['Exp_SalesMktg'] || 0) +
                            (periodData['Exp_OpsProfSvcs'] || 0);
                        periodData['Total Expense'] = totalExpense; // Using "Total Expense" (with space) per mapping table

                        // Calculate Margin
                        periodData['Margin'] = totalRevenue - totalExpense;

                        // Calculate Margin %
                        periodData['MarginPct'] = totalRevenue !== 0 ? (periodData['Margin'] / totalRevenue) * 100 : 0;
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
    }, [excelData, selectedDimensions, availablePeriods]);

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
            // Section headers (Revenue, Expenses) - always visible
            if (item.isTotal && !item.fieldName) {
                // Find the corresponding total line (next item that is a total with fieldName)
                const nextItem = pnlLineItems[index + 1];
                if (nextItem && nextItem.isTotal && nextItem.fieldName) {
                    // Combine section header with total
                    visible.push({
                        ...nextItem,
                        combineWithHeader: true,
                        sectionHeader: item
                    });
                } else {
                    visible.push(item);
                }
                
                if (item.label === 'Revenue') {
                    currentSection = 'Revenue';
                    currentSectionHeader = item;
                } else if (item.label === 'Expenses') {
                    currentSection = 'Expenses';
                    currentSectionHeader = item;
                }
            }
            // Total lines (indent 1) - skip if already combined with header
            else if (item.isTotal && item.fieldName && item.indent === 1) {
                // Check if this was already added as combined
                const alreadyAdded = visible.some(v => v.label === item.label && v.combineWithHeader);
                if (!alreadyAdded) {
                    visible.push(item);
                }
            }
            // Detail lines (indent 2) - only show if section is expanded
            else if (item.indent === 2 && !item.isTotal && !item.isMargin) {
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
                                            const isSectionHeader = item.isTotal && !item.fieldName;
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
                                            
                                            return (
                                                <tr 
                                                    key={`${rowKey}-${item.label}-${idx}`}
                                                    className={`hover:bg-gray-50 ${
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
                                                        // Use the item's fieldName (which will be the total field if combined)
                                                        const fieldNameToUse = item.combineWithHeader ? item.fieldName : item.fieldName;
                                                        const value = pnlData[rowKey]?.[period]?.[fieldNameToUse] || 0;
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

            {!excelData && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
                    <p className="text-blue-800 font-medium">Loading data... Please upload an Excel file with Fact_Margin data.</p>
                </div>
            )}
        </div>
    );
}
