import { ExcelDriverTreeData, DriverTreeNode, PeriodData } from './excel-parser';

/**
 * Extract metrics and KPIs from Excel data for Executive Summary tiles
 * Uses Fact_Margin records directly for accurate metrics
 */
export function extractExecutiveSummaryMetrics(excelData: ExcelDriverTreeData | null) {
    if (!excelData) {
        return null;
    }

    // Helper function to get field value with fuzzy matching
    const getFieldValue = (record: any, fieldName: string): number | null => {
        if (!record || !fieldName) return null;
        
        const normalizeFieldName = (name: string) => {
            return name
                .toLowerCase()
                .replace(/\$mm/g, '')
                .replace(/\$m(?![a-z])/g, '')
                .replace(/mm(?![a-z])/g, '')
                .replace(/[^a-z0-9]/g, '');
        };
        
        const targetNormalized = normalizeFieldName(fieldName);
        
        // Try exact match first
        for (const [key, value] of Object.entries(record)) {
            if (normalizeFieldName(key) === targetNormalized) {
                const numValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
                if (!isNaN(numValue)) return numValue;
            }
        }
        
        // Try partial match
        for (const [key, value] of Object.entries(record)) {
            const keyNormalized = normalizeFieldName(key);
            if (keyNormalized.includes(targetNormalized) || targetNormalized.includes(keyNormalized)) {
                const numValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
                if (!isNaN(numValue)) return numValue;
            }
        }
        
        return null;
    };

    // Calculate metrics from Fact_Margin records by quarter
    if (excelData.factMarginRecords && excelData.factMarginRecords.length > 0) {
        // Extract all quarters and find latest
        const quarters = new Set<string>();
        excelData.factMarginRecords.forEach(record => {
            if (!record) return;
            const quarterKey = Object.keys(record).find(key => key.toLowerCase() === 'quarter');
            if (quarterKey && record[quarterKey]) {
                quarters.add(String(record[quarterKey]).trim());
            }
        });
        
        const sortedQuarters = Array.from(quarters).sort();
        const latestQuarter = sortedQuarters.length > 0 ? sortedQuarters[sortedQuarters.length - 1] : null;
        const previousQuarter = sortedQuarters.length > 1 ? sortedQuarters[sortedQuarters.length - 2] : null;
        
        // Helper to calculate value for a specific quarter
        const calculateQuarterValue = (quarter: string | null, fieldNames: string[]): number => {
            if (!quarter) return 0;
            let total = 0;
            excelData.factMarginRecords.forEach(record => {
                if (!record) return;
                const quarterKey = Object.keys(record).find(key => key.toLowerCase() === 'quarter');
                if (quarterKey && String(record[quarterKey]).trim() === quarter) {
                    fieldNames.forEach(fieldName => {
                        const value = getFieldValue(record, fieldName) || 0;
                        total += value;
                    });
                }
            });
            return total;
        };

        // Helper to calculate trend (percentage change)
        const calculateTrend = (latest: number, previous: number): number => {
            if (previous === 0) return latest > 0 ? 100 : 0;
            return ((latest - previous) / Math.abs(previous)) * 100;
        };

        // Calculate latest quarter values
        const latestRevenue = calculateQuarterValue(latestQuarter, ['TotalRevenue', 'TotalRevenue_$mm']);
        const latestExpense = calculateQuarterValue(latestQuarter, ['TotalExpense', 'TotalExpense_$mm']);
        const latestMargin = calculateQuarterValue(latestQuarter, ['Margin', 'Margin_$mm']);
        const latestMarginPct = latestRevenue > 0 ? (latestMargin / latestRevenue) * 100 : 0;
        const latestAUM = calculateQuarterValue(latestQuarter, ['AUM', 'AUM_$mm']);
        const latestTradingVolume = calculateQuarterValue(latestQuarter, ['TradingVolume', 'TradingVolume_$mm']);
        const latestHeadcount = calculateQuarterValue(latestQuarter, ['Headcount', 'Headcount_FTE']);
        const latestTransactionFees = calculateQuarterValue(latestQuarter, ['Rev Transaction Fees', 'Rev_TransactionalFees_$mm']);
        const latestCustodySafekeeping = calculateQuarterValue(latestQuarter, ['Rev CustodySafekeeping', 'Rev_CustodySafekeeping_$mm']);
        const latestAdminFundExpense = calculateQuarterValue(latestQuarter, ['AdminFundExpense', 'Rev_AdminFundExpense_$mm']);
        const latestPerformanceFees = calculateQuarterValue(latestQuarter, ['PerformanceFees', 'Rev_PerformanceFees_$mm']);
        const latestInterestRateRevenue = calculateQuarterValue(latestQuarter, ['Interest Rate Revenue', 'Rev_InterestRateRevenue_$mm']);
        const latestCompBenefits = calculateQuarterValue(latestQuarter, ['Exp_CompBenefits', 'Exp_CompBenefits_$mm']);
        const latestTechData = calculateQuarterValue(latestQuarter, ['Exp_Tech and Data', 'Exp_TechData_$mm']);
        const latestSalesMktg = calculateQuarterValue(latestQuarter, ['Exp_SalesMktg', 'Exp_SalesMktg_$mm']);
        const latestOpsProfSvcs = calculateQuarterValue(latestQuarter, ['Exp_OpsProfSvcs', 'Exp_OpsProfSvcs_$mm']);

        // Calculate previous quarter values for trends
        const prevRevenue = calculateQuarterValue(previousQuarter, ['TotalRevenue', 'TotalRevenue_$mm']);
        const prevExpense = calculateQuarterValue(previousQuarter, ['TotalExpense', 'TotalExpense_$mm']);
        const prevMargin = calculateQuarterValue(previousQuarter, ['Margin', 'Margin_$mm']);
        const prevMarginPct = prevRevenue > 0 ? (prevMargin / prevRevenue) * 100 : 0;
        const prevAUM = calculateQuarterValue(previousQuarter, ['AUM', 'AUM_$mm']);
        const prevTradingVolume = calculateQuarterValue(previousQuarter, ['TradingVolume', 'TradingVolume_$mm']);
        const prevHeadcount = calculateQuarterValue(previousQuarter, ['Headcount', 'Headcount_FTE']);
        const prevTransactionFees = calculateQuarterValue(previousQuarter, ['Rev Transaction Fees', 'Rev_TransactionalFees_$mm']);
        const prevCustodySafekeeping = calculateQuarterValue(previousQuarter, ['Rev CustodySafekeeping', 'Rev_CustodySafekeeping_$mm']);
        const prevAdminFundExpense = calculateQuarterValue(previousQuarter, ['AdminFundExpense', 'Rev_AdminFundExpense_$mm']);
        const prevPerformanceFees = calculateQuarterValue(previousQuarter, ['PerformanceFees', 'Rev_PerformanceFees_$mm']);
        const prevInterestRateRevenue = calculateQuarterValue(previousQuarter, ['Interest Rate Revenue', 'Rev_InterestRateRevenue_$mm']);
        const prevCompBenefits = calculateQuarterValue(previousQuarter, ['Exp_CompBenefits', 'Exp_CompBenefits_$mm']);
        const prevTechData = calculateQuarterValue(previousQuarter, ['Exp_Tech and Data', 'Exp_TechData_$mm']);
        const prevSalesMktg = calculateQuarterValue(previousQuarter, ['Exp_SalesMktg', 'Exp_SalesMktg_$mm']);
        const prevOpsProfSvcs = calculateQuarterValue(previousQuarter, ['Exp_OpsProfSvcs', 'Exp_OpsProfSvcs_$mm']);

        // Calculate trends
        const revenueTrend = calculateTrend(latestRevenue, prevRevenue);
        const expenseTrend = calculateTrend(latestExpense, prevExpense);
        const marginTrend = calculateTrend(latestMargin, prevMargin);
        const marginPctTrend = calculateTrend(latestMarginPct, prevMarginPct);
        const aumTrend = calculateTrend(latestAUM, prevAUM);
        const tradingVolumeTrend = calculateTrend(latestTradingVolume, prevTradingVolume);
        const headcountTrend = calculateTrend(latestHeadcount, prevHeadcount);
        const transactionFeesTrend = calculateTrend(latestTransactionFees, prevTransactionFees);
        const custodySafekeepingTrend = calculateTrend(latestCustodySafekeeping, prevCustodySafekeeping);
        const adminFundExpenseTrend = calculateTrend(latestAdminFundExpense, prevAdminFundExpense);
        const performanceFeesTrend = calculateTrend(latestPerformanceFees, prevPerformanceFees);
        const interestRateRevenueTrend = calculateTrend(latestInterestRateRevenue, prevInterestRateRevenue);
        const compBenefitsTrend = calculateTrend(latestCompBenefits, prevCompBenefits);
        const techDataTrend = calculateTrend(latestTechData, prevTechData);
        const salesMktgTrend = calculateTrend(latestSalesMktg, prevSalesMktg);
        const opsProfSvcsTrend = calculateTrend(latestOpsProfSvcs, prevOpsProfSvcs);

        return {
            // Latest quarter values
            totalRevenue: latestRevenue,
            totalExpense: latestExpense,
            totalMargin: latestMargin,
            marginPct: latestMarginPct,
            totalAUM: latestAUM,
            totalTradingVolume: latestTradingVolume,
            totalHeadcount: latestHeadcount,
            totalTransactionFees: latestTransactionFees,
            totalCustodySafekeeping: latestCustodySafekeeping,
            totalAdminFundExpense: latestAdminFundExpense,
            totalPerformanceFees: latestPerformanceFees,
            totalInterestRateRevenue: latestInterestRateRevenue,
            totalCompBenefits: latestCompBenefits,
            totalTechData: latestTechData,
            totalSalesMktg: latestSalesMktg,
            totalOpsProfSvcs: latestOpsProfSvcs,
            // Trends (latest vs previous quarter)
            revenueTrend,
            expenseTrend,
            marginTrend,
            marginPctTrend,
            aumTrend,
            tradingVolumeTrend,
            headcountTrend,
            transactionFeesTrend,
            custodySafekeepingTrend,
            adminFundExpenseTrend,
            performanceFeesTrend,
            interestRateRevenueTrend,
            compBenefitsTrend,
            techDataTrend,
            salesMktgTrend,
            opsProfSvcsTrend,
            // Quarter information
            latestQuarter,
            previousQuarter,
            // Legacy fields for backward compatibility
            totalCosts: latestExpense,
            totalProfit: latestMargin,
            profitMargin: latestMarginPct,
            volume: latestTradingVolume,
            sales: latestRevenue,
            operationalTotal: latestCompBenefits + latestTechData + latestSalesMktg + latestOpsProfSvcs,
            efficiencyTotal: 0,
            qualityTotal: 0,
            level1Nodes: excelData.tree?.filter(node => node.level === 1) || [],
            allNodes: excelData.tree || []
        };
    }

    // Fallback to tree-based calculation if no Fact_Margin records
    if (!excelData.tree || excelData.tree.length === 0) {
        return null;
    }

    // Calculate total revenue (sum of all accounting amounts at root level)
    const calculateTotalRevenue = (nodes: DriverTreeNode[]): number => {
        let total = 0;
        nodes.forEach(node => {
            if (node.accountingAmount) {
                total += node.accountingAmount;
            }
            if (node.children) {
                total += calculateTotalRevenue(node.children);
            }
        });
        return total;
    };

    // Find nodes by name pattern
    const findNodesByName = (nodes: DriverTreeNode[], pattern: string): DriverTreeNode[] => {
        const results: DriverTreeNode[] = [];
        nodes.forEach(node => {
            if (node.name.toLowerCase().includes(pattern.toLowerCase())) {
                results.push(node);
            }
            if (node.children) {
                results.push(...findNodesByName(node.children, pattern));
            }
        });
        return results;
    };

    // Get latest period value
    const getLatestValue = (periods: PeriodData[] | undefined): number => {
        if (!periods || periods.length === 0) return 0;
        return periods[periods.length - 1].value;
    };

    // Calculate trend (percentage change from first to last)
    const calculateTrend = (periods: PeriodData[] | undefined): number => {
        if (!periods || periods.length < 2) return 0;
        const first = periods[0].value;
        const last = periods[periods.length - 1].value;
        if (first === 0) return 0;
        return ((last - first) / Math.abs(first)) * 100;
    };

    const totalRevenue = calculateTotalRevenue(excelData.tree);
    
    // Extract key metrics from tree structure
    const revenueNodes = findNodesByName(excelData.tree, 'revenue');
    const costNodes = findNodesByName(excelData.tree, 'cost');
    const profitNodes = findNodesByName(excelData.tree, 'profit');
    const marginNodes = findNodesByName(excelData.tree, 'margin');
    const volumeNodes = findNodesByName(excelData.tree, 'volume');
    const priceNodes = findNodesByName(excelData.tree, 'price');
    const marketNodes = findNodesByName(excelData.tree, 'market');
    const salesNodes = findNodesByName(excelData.tree, 'sales');
    const operationalNodes = findNodesByName(excelData.tree, 'operational');
    const efficiencyNodes = findNodesByName(excelData.tree, 'efficiency');
    const qualityNodes = findNodesByName(excelData.tree, 'quality');
    const inventoryNodes = findNodesByName(excelData.tree, 'inventory');
    const supplyChainNodes = findNodesByName(excelData.tree, 'supply chain');

    // Calculate metrics
    const revenue = revenueNodes.reduce((sum, node) => sum + (node.accountingAmount || 0), 0) || totalRevenue;
    const costs = costNodes.reduce((sum, node) => sum + (node.accountingAmount || 0), 0);
    const profit = profitNodes.reduce((sum, node) => sum + (node.accountingAmount || 0), 0) || (revenue - costs);
    const volume = volumeNodes.reduce((sum, node) => sum + (node.accountingAmount || 0), 0);
    const sales = salesNodes.reduce((sum, node) => sum + (node.accountingAmount || 0), 0) || revenue;

    // Get trends from accounting facts
    const revenueTrend = excelData.accountingFacts && revenueNodes.length > 0 
        ? calculateTrend(excelData.accountingFacts.get(revenueNodes[0].id))
        : 0;
    
    const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const costRatio = revenue > 0 ? (costs / revenue) * 100 : 0;

    // Find top level 1 nodes for categorization
    const level1Nodes = excelData.tree.filter(node => node.level === 1);
    
    // Extract operational metrics
    const operationalTotal = operationalNodes.reduce((sum, node) => sum + (node.accountingAmount || 0), 0);
    const efficiencyTotal = efficiencyNodes.reduce((sum, node) => sum + (node.accountingAmount || 0), 0);
    const qualityTotal = qualityNodes.reduce((sum, node) => sum + (node.accountingAmount || 0), 0);

    return {
        totalRevenue: revenue,
        totalCosts: costs,
        totalProfit: profit,
        profitMargin,
        costRatio,
        volume,
        sales,
        revenueTrend,
        operationalTotal,
        efficiencyTotal,
        qualityTotal,
        level1Nodes,
        allNodes: excelData.tree
    };
}

/**
 * Extract scenario levers from Excel data
 */
export function extractScenarioLevers(excelData: ExcelDriverTreeData | null) {
    if (!excelData || !excelData.tree || excelData.tree.length === 0) {
        return [];
    }

    try {
        // Find Level 4 nodes (leaf nodes in new structure) that can be adjusted
        const findLevel4Nodes = (nodes: DriverTreeNode[]): DriverTreeNode[] => {
            const results: DriverTreeNode[] = [];
            if (!nodes || !Array.isArray(nodes)) {
                return results;
            }
            nodes.forEach(node => {
                if (!node) return;
                // In new structure, Driver Level 4 is the leaf level that matches Fact_Margin amount types
                if (node.level === 4 || (!node.children || node.children.length === 0)) {
                    if (node.accountingAmount !== undefined || node.rateAmount !== undefined) {
                        results.push(node);
                    }
                }
                if (node.children && Array.isArray(node.children)) {
                    results.push(...findLevel4Nodes(node.children));
                }
            });
            return results;
        };

        const level4Nodes = findLevel4Nodes(excelData.tree);

        // Convert to lever format
        return level4Nodes.map(node => {
            const currentValue = node.accountingAmount || node.rateAmount || 0;
            const absValue = Math.abs(currentValue);
            return {
                id: node.id || `lever-${Math.random()}`,
                name: node.name || 'Unnamed Lever',
                category: getCategoryFromPath(node, excelData.tree),
                currentValue: currentValue,
                minValue: currentValue * 0.5, // Allow 50% reduction
                maxValue: currentValue * 2, // Allow 100% increase
                unit: node.rateAmount !== undefined ? '%' : '$',
                impact: absValue > 1000 ? 'high' : absValue > 100 ? 'medium' : 'low',
                node: node
            };
        });
    } catch (error) {
        console.error('Error extracting scenario levers:', error);
        return [];
    }
}

/**
 * Get category from node path in tree
 */
function getCategoryFromPath(node: DriverTreeNode, tree: DriverTreeNode[]): string {
    try {
        if (!node || !node.id || !tree || !Array.isArray(tree)) {
            return 'Other';
        }
        
        const findPath = (nodes: DriverTreeNode[], targetId: string, path: string[] = []): string[] | null => {
            if (!nodes || !Array.isArray(nodes)) {
                return null;
            }
            for (const n of nodes) {
                if (!n || !n.id) continue;
                if (n.id === targetId) {
                    return [...path, n.name || 'Unnamed'];
                }
                if (n.children && Array.isArray(n.children)) {
                    const result = findPath(n.children, targetId, [...path, n.name || 'Unnamed']);
                    if (result) return result;
                }
            }
            return null;
        };

        const path = findPath(tree, node.id);
        if (path && path.length > 1) {
            return path[0]; // Use first level as category
        }
        return 'Other';
    } catch (error) {
        console.error('Error getting category from path:', error);
        return 'Other';
    }
}

/**
 * Extract operational performance metrics from Excel data
 */
export function extractOperationalMetrics(excelData: ExcelDriverTreeData | null) {
    if (!excelData || !excelData.tree || excelData.tree.length === 0) {
        return null;
    }

    // Find nodes by operational keywords
    const findNodesByKeywords = (nodes: DriverTreeNode[], keywords: string[]): DriverTreeNode[] => {
        const results: DriverTreeNode[] = [];
        nodes.forEach(node => {
            const nameLower = node.name.toLowerCase();
            if (keywords.some(keyword => nameLower.includes(keyword))) {
                results.push(node);
            }
            if (node.children) {
                results.push(...findNodesByKeywords(node.children, keywords));
            }
        });
        return results;
    };

    // Manufacturing metrics
    const oeeNodes = findNodesByKeywords(excelData.tree, ['oee', 'overall equipment effectiveness', 'efficiency']);
    const productionNodes = findNodesByKeywords(excelData.tree, ['production', 'volume', 'output', 'units']);
    const qualityNodes = findNodesByKeywords(excelData.tree, ['quality', 'defect', 'yield', 'first pass']);
    const deliveryNodes = findNodesByKeywords(excelData.tree, ['delivery', 'on-time', 'on time', 'schedule']);

    // Supply chain metrics
    const inventoryNodes = findNodesByKeywords(excelData.tree, ['inventory', 'stock', 'turn', 'days']);
    const supplyChainNodes = findNodesByKeywords(excelData.tree, ['supply chain', 'logistics', 'procurement']);

    // Digital metrics
    const digitalNodes = findNodesByKeywords(excelData.tree, ['digital', 'connected', 'subscription', 'service']);

    // Calculate values
    const oee = oeeNodes.length > 0 ? oeeNodes[0].rateAmount || oeeNodes[0].accountingAmount || 0 : 0;
    const productionVolume = productionNodes.reduce((sum, node) => sum + (node.accountingAmount || 0), 0);
    const qualityRate = qualityNodes.length > 0 ? qualityNodes[0].rateAmount || 0 : 0;
    const onTimeDelivery = deliveryNodes.length > 0 ? deliveryNodes[0].rateAmount || 0 : 0;
    const inventoryTurns = inventoryNodes.find(n => n.name.toLowerCase().includes('turn'))?.rateAmount || 0;
    const digitalRevenue = digitalNodes.reduce((sum, node) => sum + (node.accountingAmount || 0), 0);

    return {
        oee: oee > 1 ? oee : oee * 100, // Convert to percentage if needed
        productionVolume,
        qualityRate: qualityRate > 1 ? qualityRate : qualityRate * 100,
        onTimeDelivery: onTimeDelivery > 1 ? onTimeDelivery : onTimeDelivery * 100,
        inventoryTurns,
        digitalRevenue,
        oeeNodes,
        productionNodes,
        qualityNodes,
        deliveryNodes,
        inventoryNodes,
        digitalNodes
    };
}

