export interface PeriodData {
    value: number;
    period?: string;
}

export interface DriverTreeNode {
    id: string;
    name: string;
    level: number;
    parentId?: string;
    accountingAmount?: number;
    rateAmount?: number;
    rawAmount?: number;
    feeRate?: number;
    accountingPeriods?: PeriodData[];
    ratePeriods?: PeriodData[];
    accountingTrend?: number;
    rateTrend?: number;
    isFeeRateDriver?: boolean;
    children?: DriverTreeNode[];
}

// Fact_Margin record - main transaction records
export interface FactMarginRecord {
    [key: string]: any; // Dynamic fields including ID fields and amount type fields
    // Common ID fields (will be detected dynamically)
    // Amount type fields (will match Driver Level 4 fields)
}

// Dimension table record - generic structure for DIM_... tables
export interface DimensionRecord {
    [key: string]: any; // All fields from dimension table
}

// Map of dimension table name to records keyed by ID
export type DimensionTables = Map<string, Map<string, DimensionRecord>>;

// NamingConvention record - mapping table for field names
export interface NamingConventionRecord {
    [key: string]: any; // Dynamic fields including Fact_Margin naming, Category, P&L Impact
}

export interface ExcelDriverTreeData {
    tree: DriverTreeNode[];
    factMarginRecords: FactMarginRecord[]; // All records from Fact_Margin tab
    dimensionTables: DimensionTables; // Map of dimension table name -> Map of ID -> Record
    // Maps for aggregating amounts by driver (from Driver Level 4)
    accountingFacts: Map<string, PeriodData[]>; // Driver Level 4 name -> periods
    accountingFactRecords?: FactMarginRecord[]; // Full records for detailed analysis
    namingConventionRecords?: NamingConventionRecord[]; // Records from NamingConvention tab
}

/**
 * Parse Excel file with new structure:
 * - Fact_Margin: transaction records with ID fields and amount type fields
 * - DIM_...: dimension tables joined by ID fields
 * - DriverTree: Driver Level 1-4 hierarchy
 */
export async function parseDriverTreeExcel(file: File): Promise<ExcelDriverTreeData> {
    let XLSX: any;
    try {
        const xlsxModule = await import('xlsx');
        XLSX = xlsxModule.default || xlsxModule;
    } catch (error) {
        throw new Error('Failed to load xlsx library. Please ensure it is installed.');
    }
    
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                if (!data) {
                    reject(new Error('Failed to read file'));
                    return;
                }

                if (!XLSX || typeof XLSX.read !== 'function') {
                    reject(new Error('XLSX library not properly loaded'));
                    return;
                }

                const workbook = XLSX.read(data, { type: 'binary' });
                
                // Parse DriverTree tab
                const driverTreeSheet = workbook.Sheets['DriverTree'] || 
                                      workbook.Sheets['Driver Tree'] ||
                                      workbook.Sheets[workbook.SheetNames.find((name: string) => name.toLowerCase().includes('driver')) || ''];
                if (!driverTreeSheet) {
                    reject(new Error('DriverTree sheet not found. Please ensure a sheet named "DriverTree" exists.'));
                    return;
                }

                // Parse Fact_Margin tab
                const factMarginSheet = workbook.Sheets['Fact_Margin'] || 
                                       workbook.Sheets[workbook.SheetNames.find((name: string) => name.toLowerCase().includes('fact_margin') || name.toLowerCase().includes('fact margin')) || ''];
                if (!factMarginSheet) {
                    reject(new Error('Fact_Margin sheet not found. Please ensure a sheet named "Fact_Margin" exists.'));
                    return;
                }

                // Parse all DIM_... tabs
                const dimensionTables = parseDimensionTables(workbook, XLSX);

                // Parse NamingConvention tab (optional) - try multiple variations
                const namingConventionSheet = workbook.Sheets['NamingConvention'] || 
                                           workbook.Sheets['Naming Convention'] ||
                                           workbook.Sheets['Naming_Convention'] ||
                                           workbook.Sheets[workbook.SheetNames.find((name: string) => {
                                               const nameLower = name.toLowerCase().trim();
                                               return nameLower === 'namingconvention' || 
                                                      nameLower === 'naming convention' ||
                                                      nameLower === 'naming_convention' ||
                                                      (nameLower.includes('naming') && nameLower.includes('convention'));
                                           }) || ''];
                
                // Log available sheet names for debugging
                console.log('Available Excel sheet names:', workbook.SheetNames);
                if (namingConventionSheet) {
                    console.log('✓ NamingConvention sheet found');
                } else {
                    console.warn('✗ NamingConvention sheet not found. Available sheets:', workbook.SheetNames);
                }
                
                const namingConventionRecords = namingConventionSheet ? parseNamingConventionSheet(namingConventionSheet, XLSX) : [];
                console.log(`Parsed ${namingConventionRecords.length} NamingConvention records`);

                // Extract driver tree structure (Driver Level 1-4)
                const tree = parseDriverTreeSheet(driverTreeSheet, XLSX);
                
                // Extract Fact_Margin records
                const factMarginRecords = parseFactMarginSheet(factMarginSheet, XLSX);
                
                // Map Fact_Margin amounts to Driver Level 4 fields and aggregate
                const { accountingFacts, accountingFactRecords } = mapFactMarginToDrivers(
                    factMarginRecords, 
                    tree
                );

                // Map amounts to tree nodes
                mapAmountsToTree(tree, accountingFacts);

                const result = {
                    tree,
                    factMarginRecords,
                    dimensionTables,
                    accountingFacts,
                    accountingFactRecords: factMarginRecords,
                    namingConventionRecords
                };

                console.log('Excel parsing complete. NamingConvention records:', namingConventionRecords.length);

                resolve(result);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsBinaryString(file);
    });
}

/**
 * Parse all DIM_... sheets from workbook
 */
function parseDimensionTables(workbook: any, XLSX: any): DimensionTables {
    const dimensionTables: DimensionTables = new Map();
    
    workbook.SheetNames.forEach((sheetName: string) => {
        // Check if sheet name starts with "DIM_" or "Dim_"
        if (sheetName.toUpperCase().startsWith('DIM_')) {
            const sheet = workbook.Sheets[sheetName];
            const dimMap = parseDimensionSheet(sheet, XLSX);
            dimensionTables.set(sheetName, dimMap);
        }
    });
    
    return dimensionTables;
}

/**
 * Parse a single dimension sheet (DIM_...)
 * Returns Map of ID -> Record
 */
function parseDimensionSheet(sheet: any, XLSX: any): Map<string, DimensionRecord> {
    const dimMap = new Map<string, DimensionRecord>();
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (!jsonData || jsonData.length === 0) {
        return dimMap;
    }

    const headerRow = jsonData[0] as any[];
    if (!headerRow || headerRow.length === 0) {
        return dimMap;
    }

    // Find ID column (usually the first column or column with "ID" in name)
    let idColumnIndex = -1;
    headerRow.forEach((header, index) => {
        const headerStr = String(header).toLowerCase().trim();
        if (headerStr.includes('id') && idColumnIndex === -1) {
            idColumnIndex = index;
        }
    });
    
    // Default to first column if no ID column found
    if (idColumnIndex === -1) idColumnIndex = 0;

    // Process data rows
    for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        if (!row || row.length === 0) continue;

        const id = row[idColumnIndex];
        if (!id) continue;

        const idStr = String(id).trim();
        if (!idStr) continue;

        // Create record object with all fields
        const record: DimensionRecord = {};
        headerRow.forEach((header, index) => {
            const headerStr = String(header).trim();
            const value = row[index];
            record[headerStr] = value;
        });

        dimMap.set(idStr, record);
    }

    return dimMap;
}

/**
 * Parse DriverTree sheet with Driver Level 1-4 columns
 */
function parseDriverTreeSheet(sheet: any, XLSX: any): DriverTreeNode[] {
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    
    if (!jsonData || jsonData.length === 0) {
        return [];
    }

    const firstRow = jsonData[0] as any[];
    
    // Find Driver Level columns
    const levelColumns: { index: number; level: number }[] = [];
    firstRow.forEach((header, index) => {
        if (typeof header === 'string') {
            const levelMatch = header.toLowerCase().match(/driver\s*level\s*(\d+)/i) || 
                             header.toLowerCase().match(/level\s*(\d+)/i);
            if (levelMatch) {
                levelColumns.push({ index, level: parseInt(levelMatch[1]) });
            }
        }
    });

    // Sort by level
    levelColumns.sort((a, b) => a.level - b.level);

    if (levelColumns.length === 0) {
        // Fallback: try to detect structure
        return parseHierarchicalColumn(jsonData);
    }

    // Build tree from level columns
    const tree: DriverTreeNode[] = [];
    const nodeMap = new Map<string, DriverTreeNode>();
    let nodeIdCounter = 0;

    // Process data rows (skip header)
    for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        if (!row || row.every(cell => !cell)) continue;

        let parentNode: DriverTreeNode | null = null;

        // Process each level from 0 to 5
        for (let colIdx = 0; colIdx < levelColumns.length; colIdx++) {
            const { index: colIndex, level } = levelColumns[colIdx];
            // Support levels 0-5
            if (level < 0 || level > 5) continue;
            
            const cellValue = row[colIndex];
            
            if (!cellValue || !String(cellValue).trim()) {
                break;
            }

            const nodeName = String(cellValue).trim();
            if (!nodeName) continue;

            // Create unique key for this node
            const nodeKey = `${nodeName}|${level}|${parentNode?.id || 'root'}`;
            
            let currentNode: DriverTreeNode | undefined = nodeMap.get(nodeKey);
            
            if (!currentNode) {
                const nodeId = `node-${nodeIdCounter++}`;
                currentNode = {
                    id: nodeId,
                    name: nodeName,
                    level: level,
                    parentId: parentNode ? parentNode.id : undefined,
                    children: []
                };
                nodeMap.set(nodeKey, currentNode);

                if (parentNode) {
                    if (!parentNode.children) parentNode.children = [];
                    parentNode.children.push(currentNode);
                } else {
                    tree.push(currentNode);
                }
            }
            
            parentNode = currentNode;
        }
    }

    return tree;
}

/**
 * Parse hierarchical column structure (fallback)
 */
function parseHierarchicalColumn(data: any[][]): DriverTreeNode[] {
    const tree: DriverTreeNode[] = [];
    const nodeMap = new Map<string, DriverTreeNode>();
    let nodeIdCounter = 0;
    const stack: DriverTreeNode[] = [];

    for (let i = 0; i < data.length; i++) {
        const row = data[i] as any[];
        if (!row || row.length === 0) continue;

        const firstCell = row[0];
        if (!firstCell) continue;

        const cellValue = String(firstCell).trim();
        if (!cellValue) continue;

        const indentMatch = cellValue.match(/^(\s*|-+|•+)/);
        const indentLevel = indentMatch ? Math.floor(indentMatch[1].length / 2) : 0;
        const cleanName = cellValue.replace(/^[\s\-•]+/, '').trim();

        if (!cleanName) continue;

        const nodeId = `node-${nodeIdCounter++}`;
        const node: DriverTreeNode = {
            id: nodeId,
            name: cleanName,
            level: indentLevel + 1,
            children: []
        };

        while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
            stack.pop();
        }

        if (stack.length > 0) {
            const parent = stack[stack.length - 1];
            node.parentId = parent.id;
            if (!parent.children) parent.children = [];
            parent.children.push(node);
        } else {
            tree.push(node);
        }

        stack.push(node);
        nodeMap.set(nodeId, node);
    }

    return tree;
}

/**
 * Parse Fact_Margin sheet - transaction records with ID fields and amount type fields
 */
function parseFactMarginSheet(sheet: any, XLSX: any): FactMarginRecord[] {
    const records: FactMarginRecord[] = [];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (!jsonData || jsonData.length === 0) {
        return records;
    }

    const headerRow = jsonData[0] as any[];
    if (!headerRow || headerRow.length === 0) {
        return records;
    }

    // Process data rows
    for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        if (!row || row.length === 0) continue;

        // Create record object with all fields
        const record: FactMarginRecord = {};
        headerRow.forEach((header, index) => {
            const headerStr = String(header).trim();
            const value = row[index];
            record[headerStr] = value;
        });

        records.push(record);
    }

    return records;
}

/**
 * Parse NamingConvention sheet - mapping table for field names
 */
function parseNamingConventionSheet(sheet: any, XLSX: any): NamingConventionRecord[] {
    const records: NamingConventionRecord[] = [];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (!jsonData || jsonData.length === 0) {
        return records;
    }

    const headerRow = jsonData[0] as any[];
    if (!headerRow || headerRow.length === 0) {
        return records;
    }

    // Process data rows
    for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        if (!row || row.length === 0) continue;

        // Create record object with all fields
        const record: NamingConventionRecord = {};
        headerRow.forEach((header, index) => {
            const headerStr = String(header).trim();
            const value = row[index];
            record[headerStr] = value;
        });

        records.push(record);
    }

    return records;
}

/**
 * Map Fact_Margin records to Driver Level 4 fields
 * Amount type field names in Fact_Margin should match Driver Level 4 field names
 */
function mapFactMarginToDrivers(
    factMarginRecords: FactMarginRecord[],
    tree: DriverTreeNode[]
): { accountingFacts: Map<string, PeriodData[]>; accountingFactRecords: FactMarginRecord[] } {
    const accountingFacts = new Map<string, PeriodData[]>();
    
    // Extract Driver Level 4 field names from tree
    const driverLevel4Names = extractDriverLevel4Names(tree);
    
    // Find period field in Fact_Margin (common names: Period, Date, TimePeriod, etc.)
    let periodFieldName: string | null = null;
    if (factMarginRecords.length > 0) {
        const firstRecord = factMarginRecords[0];
        periodFieldName = Object.keys(firstRecord).find(key => 
            key.toLowerCase().includes('period') || 
            key.toLowerCase().includes('date') ||
            key.toLowerCase().includes('time')
        ) || null;
    }

    // Group records by period if period field exists
    const recordsByPeriod = new Map<string, FactMarginRecord[]>();
    factMarginRecords.forEach(record => {
        const period = periodFieldName ? String(record[periodFieldName] || '').trim() : 'All';
        if (!recordsByPeriod.has(period)) {
            recordsByPeriod.set(period, []);
        }
        recordsByPeriod.get(period)!.push(record);
    });

    // For each Driver Level 4 name, aggregate amounts from Fact_Margin
    driverLevel4Names.forEach(driverName => {
        const periods: PeriodData[] = [];
        
        // For each period, sum the amounts for this driver
        recordsByPeriod.forEach((records, period) => {
            let totalAmount = 0;
            
            records.forEach(record => {
                // Check if this record has a field matching the driver name
                const amount = getAmountForDriver(record, driverName);
                if (amount !== null && !isNaN(amount)) {
                    totalAmount += amount;
                }
            });
            
            if (totalAmount !== 0 || periods.length === 0) {
                periods.push({
                    value: totalAmount,
                    period: period !== 'All' ? period : undefined
                });
            }
        });

        if (periods.length > 0) {
            accountingFacts.set(driverName, periods);
        }
    });

    return { accountingFacts, accountingFactRecords: factMarginRecords };
}

/**
 * Extract Driver Level 4 field names from tree
 */
function extractDriverLevel4Names(tree: DriverTreeNode[]): string[] {
    const level4Names: string[] = [];
    
    const traverse = (nodes: DriverTreeNode[]) => {
        nodes.forEach(node => {
            if (node.level === 4) {
                level4Names.push(node.name);
            }
            if (node.children) {
                traverse(node.children);
            }
        });
    };
    
    traverse(tree);
    return level4Names;
}

/**
 * Get amount for a driver from a Fact_Margin record
 * Checks if any field name matches the driver name (case-insensitive, partial match)
 */
function getAmountForDriver(record: FactMarginRecord, driverName: string): number | null {
    const driverNameLower = driverName.toLowerCase().trim();
    
    // Try exact match first
    for (const [key, value] of Object.entries(record)) {
        const keyLower = key.toLowerCase().trim();
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
        // Skip ID fields and period fields
        if (keyLower.includes('id') || keyLower.includes('period') || keyLower.includes('date')) {
            continue;
        }
        
        if (keyLower.includes(driverNameLower) || driverNameLower.includes(keyLower)) {
            const numValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
            if (!isNaN(numValue)) {
                return numValue;
            }
        }
    }
    
    return null;
}

/**
 * Parse period string to date for sorting
 */
function parsePeriodDate(period: string | undefined): Date | null {
    if (!period) return null;
    
    const periodStr = String(period).trim();
    
    // Try quarterly formats
    const quarterlyMatch1 = periodStr.match(/Q(\d)\s+(\d{4})/i);
    if (quarterlyMatch1) {
        const quarter = parseInt(quarterlyMatch1[1]);
        const year = parseInt(quarterlyMatch1[2]);
        return new Date(year, (quarter - 1) * 3, 1);
    }
    
    const quarterlyMatch2 = periodStr.match(/(\d{4})-Q(\d)/i);
    if (quarterlyMatch2) {
        const year = parseInt(quarterlyMatch2[1]);
        const quarter = parseInt(quarterlyMatch2[2]);
        return new Date(year, (quarter - 1) * 3, 1);
    }
    
    // Try year-month formats
    const yearMonthMatch1 = periodStr.match(/(\d{4})M(\d{2})/);
    if (yearMonthMatch1) {
        const year = parseInt(yearMonthMatch1[1]);
        const month = parseInt(yearMonthMatch1[2]) - 1;
        return new Date(year, month, 1);
    }
    
    const yearMonthMatch2 = periodStr.match(/(\d{4})(\d{2})/);
    if (yearMonthMatch2 && yearMonthMatch2[0].length === 6) {
        const year = parseInt(yearMonthMatch2[1]);
        const month = parseInt(yearMonthMatch2[2]) - 1;
        if (month >= 0 && month <= 11) {
            return new Date(year, month, 1);
        }
    }
    
    // Try standard date formats
    const directDate = new Date(periodStr);
    if (!isNaN(directDate.getTime())) {
        return directDate;
    }
    
    const mmddyyyyMatch = periodStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (mmddyyyyMatch) {
        const month = parseInt(mmddyyyyMatch[1]) - 1;
        const day = parseInt(mmddyyyyMatch[2]);
        const year = parseInt(mmddyyyyMatch[3]);
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
            return date;
        }
    }
    
    const yyyymmddMatch = periodStr.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (yyyymmddMatch) {
        const year = parseInt(yyyymmddMatch[1]);
        const month = parseInt(yyyymmddMatch[2]) - 1;
        const day = parseInt(yyyymmddMatch[3]);
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
            return date;
        }
    }
    
    return null;
}

/**
 * Calculate trend percentage from min period date to max period date
 */
function calculateTrend(periods: PeriodData[]): number | undefined {
    if (!periods || periods.length < 2) return undefined;
    
    const periodsWithDates = periods.map(p => ({
        ...p,
        date: parsePeriodDate(p.period)
    }));
    
    const validPeriods = periodsWithDates.filter(p => p.date !== null);
    
    if (validPeriods.length < 2) {
        const firstValue = periods[0].value;
        const lastValue = periods[periods.length - 1].value;
        
        if (Math.abs(firstValue) < 0.0001) {
            if (Math.abs(lastValue) < 0.0001) {
                return 0;
            }
            return undefined;
        }
        
        const trend = ((lastValue - firstValue) / Math.abs(firstValue)) * 100;
        if (isNaN(trend) || !isFinite(trend)) {
            return undefined;
        }
        return trend;
    }
    
    validPeriods.sort((a, b) => {
        if (!a.date || !b.date) return 0;
        return a.date.getTime() - b.date.getTime();
    });
    
    const minPeriod = validPeriods[0];
    const maxPeriod = validPeriods[validPeriods.length - 1];
    
    const minValue = minPeriod.value;
    const maxValue = maxPeriod.value;
    
    if (Math.abs(minValue) < 0.0001) {
        if (Math.abs(maxValue) < 0.0001) {
            return 0;
        }
        return undefined;
    }
    
    const trend = ((maxValue - minValue) / Math.abs(minValue)) * 100;
    
    if (isNaN(trend) || !isFinite(trend)) {
        return undefined;
    }
    
    return trend;
}

/**
 * Map amounts to tree nodes and aggregate upward
 */
function mapAmountsToTree(
    tree: DriverTreeNode[],
    accountingFacts: Map<string, PeriodData[]>
): void {
    // Map amounts to all nodes
    const mapToNode = (node: DriverTreeNode) => {
        // Try to find matching fact by name (case-insensitive, exact or partial match)
        let accountingMatched = false;

        for (const [factKey, periods] of accountingFacts.entries()) {
            const factKeyLower = factKey.toLowerCase().trim();
            const nodeNameLower = node.name.toLowerCase().trim();
            
            // Exact match
            if (factKeyLower === nodeNameLower) {
                node.accountingPeriods = periods;
                node.accountingAmount = periods.length > 0 ? periods[periods.length - 1].value : 0;
                node.accountingTrend = calculateTrend(periods);
                accountingMatched = true;
                break;
            }
        }

        // If no exact match, try partial match
        if (!accountingMatched) {
            for (const [factKey, periods] of accountingFacts.entries()) {
                const factKeyLower = factKey.toLowerCase().trim();
                const nodeNameLower = node.name.toLowerCase().trim();
                
                if (factKeyLower.includes(nodeNameLower) || nodeNameLower.includes(factKeyLower)) {
                    node.accountingPeriods = periods;
                    node.accountingAmount = periods.length > 0 ? periods[periods.length - 1].value : 0;
                    node.accountingTrend = calculateTrend(periods);
                    break;
                }
            }
        }

        // Recursively map children
        if (node.children) {
            node.children.forEach(child => mapToNode(child));
        }
    };

    // Map amounts to all nodes
    tree.forEach(node => mapToNode(node));

    // Aggregate amounts upward from children to parents
    const aggregateUpward = (node: DriverTreeNode): { 
        accounting: number; 
        accountingPeriods: PeriodData[];
    } => {
        let accountingTotal = node.accountingAmount || 0;
        let accountingPeriods: PeriodData[] = node.accountingPeriods ? [...node.accountingPeriods] : [];

        // Sum from children
        if (node.children && node.children.length > 0) {
            node.children.forEach(child => {
                const childTotals = aggregateUpward(child);
                accountingTotal += childTotals.accounting;
                
                if (childTotals.accountingPeriods.length > 0) {
                    if (accountingPeriods.length === 0) {
                        accountingPeriods = childTotals.accountingPeriods.map(p => ({ ...p }));
                    } else {
                        childTotals.accountingPeriods.forEach(childPeriod => {
                            const matchingPeriod = accountingPeriods.find(p => p.period === childPeriod.period);
                            if (matchingPeriod) {
                                matchingPeriod.value += childPeriod.value;
                            } else {
                                accountingPeriods.push({ ...childPeriod });
                            }
                        });
                    }
                }
            });
        }

        // Update node with aggregated data
        if (accountingPeriods.length > 0) {
            node.accountingPeriods = accountingPeriods;
            node.accountingAmount = accountingTotal;
            node.accountingTrend = calculateTrend(accountingPeriods);
        }

        return { 
            accounting: accountingTotal, 
            accountingPeriods
        };
    };

    // Aggregate from root nodes
    tree.forEach(node => aggregateUpward(node));
}

/**
 * Flatten tree structure for easier rendering
 */
export function flattenTree(nodes: DriverTreeNode[]): DriverTreeNode[] {
    const result: DriverTreeNode[] = [];
    
    const traverse = (node: DriverTreeNode) => {
        result.push(node);
        if (node.children) {
            node.children.forEach(child => traverse(child));
        }
    };

    nodes.forEach(node => traverse(node));
    return result;
}

/**
 * Join Fact_Margin records with dimension tables
 * @param factMarginRecord - Record from Fact_Margin
 * @param dimensionTables - Map of dimension tables
 * @param idFieldName - Name of ID field in Fact_Margin (e.g., "LegalEntityID")
 * @param dimensionTableName - Name of dimension table (e.g., "Dim_LegalEntity")
 */
export function joinFactWithDimension(
    factMarginRecord: FactMarginRecord,
    dimensionTables: DimensionTables,
    idFieldName: string,
    dimensionTableName: string
): DimensionRecord | null {
    const idValue = factMarginRecord[idFieldName];
    if (!idValue && idValue !== 0) return null; // Allow 0 as valid ID
    
    // Try exact table name first
    let dimensionTable = dimensionTables.get(dimensionTableName);
    
    // If not found, try case-insensitive match
    if (!dimensionTable) {
        for (const [tableName, table] of dimensionTables.entries()) {
            if (tableName.toLowerCase() === dimensionTableName.toLowerCase()) {
                dimensionTable = table;
                break;
            }
        }
    }
    
    if (!dimensionTable) return null;
    
    const idStr = String(idValue).trim();
    return dimensionTable.get(idStr) || null;
}

/**
 * Get all dimension table names
 */
export function getDimensionTableNames(dimensionTables: DimensionTables): string[] {
    return Array.from(dimensionTables.keys());
}
