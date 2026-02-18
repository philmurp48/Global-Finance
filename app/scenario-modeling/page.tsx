'use client';

import { motion } from 'framer-motion';
import {
    ChevronRight,
    DollarSign,
    Loader,
    Play,
    RefreshCw,
    Save,
    Send,
    Sliders
} from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { parseScenarioFromText } from './scenario-parser';
import { ExcelDriverTreeData, DriverTreeNode } from '@/lib/excel-parser';
import { extractScenarioLevers } from '@/lib/excel-metrics';

interface Lever {
    id: string;
    name: string;
    category: string;
    currentValue: number;
    minValue: number;
    maxValue: number;
    unit: string;
    impact: 'high' | 'medium' | 'low';
}

interface Scenario {
    id: string;
    name: string;
    description: string;
    impact: number;
    confidence: number;
    levers: Record<string, number>;
}


// Generate scenarios from Excel data
const generateScenariosFromExcel = (excelData: ExcelDriverTreeData | null, levers: Lever[]): Scenario[] => {
    try {
        if (!levers || levers.length === 0) {
            // Return default scenarios
            return [
            {
                id: 'tariff-escalation',
                name: 'Tariff Escalation',
                description: '25% tariffs + retaliation',
                impact: -850,
                confidence: 75,
                levers: {
                    'tariffs': 25,
                    'market-share': -2,
                    'price-change': 3,
                    'volume-growth': -5,
                    'material-inflation': 2,
                    'fx-rate': -3
                }
            },
            {
                id: 'recession',
                name: 'Recession Scenario',
                description: 'Economic downturn',
                impact: -1200,
                confidence: 60,
                levers: {
                    'market-share': -3,
                    'price-change': -5,
                    'volume-growth': -15,
                    'labor-productivity': -2,
                    'supply-chain': -10
                }
            },
            {
                id: 'moderate-tariffs',
                name: 'Moderate Tariffs',
                description: '10% targeted tariffs',
                impact: -320,
                confidence: 85,
                levers: {
                    'tariffs': 10,
                    'market-share': -0.5,
                    'price-change': 1.5,
                    'volume-growth': -2,
                    'material-inflation': 1
                }
            },
            {
                id: 'growth',
                name: 'Growth Scenario',
                description: 'Market expansion',
                impact: 650,
                confidence: 70,
                levers: {
                    'market-share': 2,
                    'price-change': 2,
                    'volume-growth': 8,
                    'labor-productivity': 3,
                    'operational-efficiency': 5
                }
            }
        ];
    }

        // Generate scenarios based on top levers
        const topLevers = levers
            .filter(l => l && Math.abs(l.currentValue || 0) > 0)
            .sort((a, b) => Math.abs(b.currentValue || 0) - Math.abs(a.currentValue || 0))
            .slice(0, 6);

        if (topLevers.length === 0) {
            return [];
        }

    const scenarios: Scenario[] = [];

    // Optimistic scenario (increase top 3 levers by 10%)
    if (topLevers.length >= 3) {
        const optimisticLevers: Record<string, number> = {};
        topLevers.slice(0, 3).forEach(lever => {
            optimisticLevers[lever.id] = lever.unit === '%' ? 10 : lever.currentValue * 0.1;
        });
        scenarios.push({
            id: 'optimistic',
            name: 'Optimistic Scenario',
            description: '10% increase in top drivers',
            impact: Object.values(optimisticLevers).reduce((sum, val) => sum + val, 0),
            confidence: 70,
            levers: optimisticLevers
        });
    }

    // Pessimistic scenario (decrease top 3 levers by 10%)
    if (topLevers.length >= 3) {
        const pessimisticLevers: Record<string, number> = {};
        topLevers.slice(0, 3).forEach(lever => {
            pessimisticLevers[lever.id] = lever.unit === '%' ? -10 : lever.currentValue * -0.1;
        });
        scenarios.push({
            id: 'pessimistic',
            name: 'Pessimistic Scenario',
            description: '10% decrease in top drivers',
            impact: Object.values(pessimisticLevers).reduce((sum, val) => sum + val, 0),
            confidence: 70,
            levers: pessimisticLevers
        });
    }

    // Category-based scenarios
    const categoryGroups = new Map<string, Lever[]>();
    topLevers.forEach(lever => {
        if (!categoryGroups.has(lever.category)) {
            categoryGroups.set(lever.category, []);
        }
        categoryGroups.get(lever.category)!.push(lever);
    });

    categoryGroups.forEach((levers, category) => {
        if (levers.length > 0) {
            const categoryLevers: Record<string, number> = {};
            levers.forEach(lever => {
                categoryLevers[lever.id] = lever.unit === '%' ? 5 : lever.currentValue * 0.05;
            });
            scenarios.push({
                id: `category-${category.toLowerCase().replace(/\s+/g, '-')}`,
                name: `${category} Impact`,
                description: `5% change in ${category}`,
                impact: Object.values(categoryLevers).reduce((sum, val) => sum + val, 0),
                confidence: 75,
                levers: categoryLevers
            });
        }
    });

        return scenarios.slice(0, 4); // Limit to 4 scenarios
    } catch (error) {
        console.error('Error generating scenarios from Excel:', error);
        // Return default scenarios on error
        return [
            {
                id: 'default-1',
                name: 'Default Scenario',
                description: 'Default scenario',
                impact: 0,
                confidence: 50,
                levers: {}
            }
        ];
    }
};

// Default levers (fallback if no Excel data)
const defaultScenarioLevers: Lever[] = [
    // Market & Demand
    { id: 'tariffs', name: 'Tariff Impact', category: 'Market & Demand', currentValue: 0, minValue: 0, maxValue: 50, unit: '%', impact: 'high' },
    { id: 'market-share', name: 'Market Share', category: 'Market & Demand', currentValue: 0, minValue: -10, maxValue: 10, unit: '%', impact: 'high' },
    { id: 'price-change', name: 'Pricing Power', category: 'Pricing Power', currentValue: 0, minValue: -10, maxValue: 10, unit: '%', impact: 'high' },
    { id: 'volume-growth', name: 'Volume Growth', category: 'Volume Growth', currentValue: 0, minValue: -20, maxValue: 20, unit: '%', impact: 'high' },

    // Operations
    { id: 'material-inflation', name: 'Material Inflation', category: 'Operations', currentValue: 0, minValue: -5, maxValue: 15, unit: '%', impact: 'medium' },
    { id: 'labor-productivity', name: 'Labor Productivity', category: 'Operations', currentValue: 0, minValue: -10, maxValue: 10, unit: '%', impact: 'medium' },
    { id: 'supply-chain', name: 'Supply Chain Efficiency', category: 'Operations', currentValue: 0, minValue: -15, maxValue: 15, unit: '%', impact: 'medium' },
    { id: 'warranty-costs', name: 'Warranty Costs', category: 'Operations', currentValue: 0, minValue: -20, maxValue: 20, unit: '%', impact: 'medium' },
    { id: 'marketing-spend', name: 'Marketing Spend', category: 'Operations', currentValue: 0, minValue: -30, maxValue: 30, unit: '%', impact: 'medium' },

    // Financial
    { id: 'fx-rate', name: 'FX Rate Impact', category: 'Financial', currentValue: 0, minValue: -10, maxValue: 10, unit: '%', impact: 'low' },
    { id: 'interest-rates', name: 'Interest Rates', category: 'Financial', currentValue: 0, minValue: -5, maxValue: 5, unit: '%', impact: 'low' }
];

// Simplified to only P&L Impact tab

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

// Helper function to format numbers with commas
const formatNumber = (num: number, decimals: number = 0): string => {
    return num.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
};

export default function ScenarioModelingPage() {
    const [selectedScenario, setSelectedScenario] = useState<string>('');
    const [leverValues, setLeverValues] = useState<Record<string, number>>({});
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isProcessingChat, setIsProcessingChat] = useState(false);
    const [showChatDetails, setShowChatDetails] = useState(false);
    const [excelData, setExcelData] = useState<ExcelDriverTreeData | null>(null);
    const [expandedDrivers, setExpandedDrivers] = useState<Set<string>>(new Set());

    // Get scenario levers from Excel data or use defaults
    const scenarioLevers = useMemo(() => {
        try {
            if (excelData && excelData.tree && excelData.tree.length > 0) {
                const excelLevers = extractScenarioLevers(excelData);
                if (excelLevers && excelLevers.length > 0) {
                    return excelLevers.map(lever => ({
                        id: lever.id || `lever-${Math.random()}`,
                        name: lever.name || 'Unnamed Lever',
                        category: lever.category || 'Other',
                        currentValue: lever.currentValue || 0,
                        minValue: lever.minValue || 0,
                        maxValue: lever.maxValue || 0,
                        unit: lever.unit || '$',
                        impact: (lever.impact === 'high' || lever.impact === 'medium' || lever.impact === 'low') 
                            ? lever.impact 
                            : 'low' as 'high' | 'medium' | 'low'
                    }));
                }
            }
        } catch (error) {
            console.error('Error extracting scenario levers:', error);
        }
        return defaultScenarioLevers;
    }, [excelData]);

    // Generate scenarios from Excel data
    const scenarios = useMemo(() => generateScenariosFromExcel(excelData, scenarioLevers), [excelData, scenarioLevers]);

    // Initialize lever values when scenarioLevers change
    useEffect(() => {
        try {
            const initialValues: Record<string, number> = {};
            if (scenarioLevers && Array.isArray(scenarioLevers)) {
                scenarioLevers.forEach(lever => {
                    if (lever && lever.id) {
                        initialValues[lever.id] = lever.currentValue || 0;
                    }
                });
            }
            setLeverValues(initialValues);
        } catch (error) {
            console.error('Error initializing lever values:', error);
        }
    }, [scenarioLevers]);

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
                            rateFacts: new Map(parsed.rateFacts || []) as Map<string, any>,
                            accountingFactRecords: parsed.accountingFactRecords || [],
                            productDIM: new Map(parsed.productDIM || [])
                        };
                        setExcelData(restoredData);
                        
                        // Expand to level 3 by default
                        if (restoredData.tree && restoredData.tree.length > 0) {
                            const expanded = expandToLevel3(restoredData.tree);
                            setExpandedDrivers(expanded);
                        }
                    }
                }
            } catch (error) {
                console.error('Failed to load Excel data:', error);
            }
        };

        loadData();
    }, []);

    // Expand all nodes up to level 3
    const expandToLevel3 = (nodes: DriverTreeNode[], parentIndex: string = '', expandedSet: Set<string> = new Set()): Set<string> => {
        if (!nodes || nodes.length === 0) {
            return expandedSet;
        }
        
        nodes.forEach((node, index) => {
            const nodeIndex = parentIndex 
                ? `${parentIndex}-${node.id}` 
                : `root-${index}-${node.id}`;
            
            if (node.level && node.level <= 3) {
                expandedSet.add(nodeIndex);
            }
            
            if (node.children && node.children.length > 0) {
                expandToLevel3(node.children, nodeIndex, expandedSet);
            }
        });
        
        return expandedSet;
    };

    // Toggle driver expansion
    const toggleDriver = (driverId: string) => {
        const newExpanded = new Set(expandedDrivers);
        if (newExpanded.has(driverId)) {
            newExpanded.delete(driverId);
        } else {
            newExpanded.add(driverId);
        }
        setExpandedDrivers(newExpanded);
    };

    // Format currency
    const formatCurrency = (amount?: number) => {
        if (amount === undefined || amount === null) return 'N/A';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    // Calculate node amounts
    const calculateNodeAmounts = (node: DriverTreeNode): { 
        accounting: number; 
        rate: number; 
        total: number;
    } => {
        let accounting = node.accountingAmount ?? 0;
        let rate = node.rateAmount ?? 0;

        if (node.children && node.children.length > 0) {
            node.children.forEach(child => {
                const childAmounts = calculateNodeAmounts(child);
                accounting += childAmounts.accounting;
                rate += childAmounts.rate;
            });
        }

        return {
            accounting,
            rate,
            total: accounting + rate
        };
    };

    // Render Excel-based driver tree node
    const renderExcelDriverNode = (node: DriverTreeNode, depth: number = 0, parentIndex: string = '', rootIndex: number = 0) => {
        const nodeIndex = parentIndex 
            ? `${parentIndex}-${node.id}` 
            : `root-${rootIndex}-${node.id}`;
        const isExpanded = expandedDrivers.has(nodeIndex);
        const hasChildren = node.children && node.children.length > 0;
        
        const amounts = calculateNodeAmounts(node);
        const hasAmount = amounts.total !== 0;

        return (
            <div key={node.id} className="relative mb-1">
                {depth > 0 && (
                    <div className="absolute -left-4 top-3 w-4 h-0.5 bg-gray-300"></div>
                )}
                
                <div 
                    className="bg-gray-50 border border-gray-200 rounded p-2 shadow-sm"
                    style={{ marginLeft: `${depth * 16}px` }}
                >
                    <div
                        className={`flex items-center justify-between ${hasChildren ? 'cursor-pointer' : ''}`}
                        onClick={() => hasChildren && toggleDriver(nodeIndex)}
                    >
                        <div className="flex items-center space-x-1 flex-1 min-w-0">
                            {hasChildren ? (
                                <ChevronRight className={`w-3 h-3 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
                            ) : (
                                <div className="w-3 h-3 flex-shrink-0"></div>
                            )}
                            <span className="text-xs font-medium text-gray-900 truncate">
                                {node.name}
                                {node.level && <span className="text-gray-400 ml-1">(L{node.level})</span>}
                            </span>
                        </div>
                        <div className="flex items-center space-x-2 ml-2 flex-shrink-0 flex-wrap justify-end">
                            {hasAmount ? (
                                <>
                                    {amounts.accounting !== 0 && (
                                        <span className="text-xs text-blue-600 font-medium">
                                            Acc: {formatCurrency(amounts.accounting)}
                                        </span>
                                    )}
                                    {amounts.rate !== 0 && (
                                        <span className="text-xs text-green-600 font-medium">
                                            Rate: {formatCurrency(amounts.rate)}
                                        </span>
                                    )}
                                </>
                            ) : (
                                <span className="text-xs text-gray-400">No data</span>
                            )}
                        </div>
                    </div>

                    {isExpanded && hasChildren && (
                        <div className="mt-2 space-y-1">
                            {node.children!.map((child) => renderExcelDriverNode(child, depth + 1, nodeIndex, rootIndex))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const handleScenarioSelect = (scenarioId: string) => {
        setSelectedScenario(scenarioId);
        const scenario = scenarios.find(s => s.id === scenarioId);
        if (scenario) {
            const newValues: Record<string, number> = { ...leverValues };
            Object.keys(scenario.levers).forEach(leverId => {
                newValues[leverId] = scenario.levers[leverId];
            });
            setLeverValues(newValues);
        }
    };

    const handleLeverChange = (leverId: string, value: number) => {
        setLeverValues(prev => ({ ...prev, [leverId]: value }));
        setSelectedScenario(''); // Clear scenario selection on manual adjustment
    };

    const handleChatSubmit = async () => {
        if (!chatInput.trim() || isProcessingChat) return;

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: chatInput,
            timestamp: new Date()
        };

        setChatMessages(prev => [...prev, userMessage]);
        setChatInput('');
        setIsProcessingChat(true);

        // Simulate AI processing delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Parse scenario and get lever adjustments
        const { levers, explanation } = parseScenarioFromText(chatInput);

        // Apply lever adjustments
        const newLeverValues: Record<string, number> = { ...leverValues };
        Object.keys(levers).forEach(leverId => {
            const lever = scenarioLevers.find(l => l.id === leverId);
            if (lever) {
                newLeverValues[leverId] = Math.max(
                    lever.minValue,
                    Math.min(lever.maxValue, levers[leverId])
                );
            }
        });

        setLeverValues(newLeverValues);
        setSelectedScenario(''); // Clear scenario selection

        const assistantMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `${explanation}\n\nI've adjusted the following levers:\n${Object.entries(levers).map(([id, value]) => {
                const lever = scenarioLevers.find(l => l.id === id);
                return `• ${lever?.name}: ${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
            }).join('\n')}\n\nThe P&L impact has been calculated and is shown below.`,
            timestamp: new Date()
        };

        setChatMessages(prev => [...prev, assistantMessage]);
        setIsProcessingChat(false);
    };

    const calculateImpact = () => {
        try {
            // Calculate base revenue from Excel data if available
            let baseRevenue = 31000; // Default $31B
            
            if (excelData && excelData.tree && excelData.tree.length > 0) {
            // Sum all accounting amounts at root level as base revenue
            const calculateTotal = (nodes: DriverTreeNode[]): number => {
                let total = 0;
                nodes.forEach(node => {
                    if (node.accountingAmount) {
                        total += node.accountingAmount;
                    }
                    if (node.children) {
                        total += calculateTotal(node.children);
                    }
                });
                return total;
            };
            const totalFromExcel = calculateTotal(excelData.tree);
            if (totalFromExcel > 0) {
                baseRevenue = totalFromExcel / 1000000; // Convert to millions
            }
        }
        
        // Automotive-specific P&L calculation
        
        // Revenue breakdown by segment (typical automotive)
        const basePassengerVehicles = 18600; // 60% of revenue
        const baseCommercialVehicles = 4650; // 15% of revenue
        const basePartsAndServices = 7750; // 25% of revenue

        // Cost of Sales (COGS) - Automotive specific
        const baseMaterials = 10850; // 35% of revenue (steel, aluminum, plastics, electronics)
        const baseLabor = 4650; // 15% of revenue
        const baseManufacturingOverhead = 3100; // 10% of revenue (facilities, utilities, depreciation)
        const baseCOGS = baseMaterials + baseLabor + baseManufacturingOverhead; // 18600 total

        // Gross Profit
        const baseGrossProfit = baseRevenue - baseCOGS; // 12400

        // Operating Expenses - Automotive specific
        const baseRD = 2325; // 7.5% of revenue (R&D is critical for automotive)
        const baseMarketing = 1550; // 5% of revenue (Marketing spend)
        const baseWarranty = 775; // 2.5% of revenue (Warranty costs)
        const baseSGandA = 3100; // 10% of revenue (Sales, Admin - excluding Marketing)
        const baseOtherOpEx = 775; // 2.5% of revenue
        const baseOpEx = baseRD + baseMarketing + baseWarranty + baseSGandA + baseOtherOpEx; // 8525 total

        // EBIT
        const baseEBIT = baseGrossProfit - baseOpEx; // 3875 (12.5% margin maintained)

        // Other Income/Expense
        const baseInterest = 350;
        const baseOtherIncome = 100;

        // EBT
        const baseEBT = baseEBIT - baseInterest + baseOtherIncome; // 3625

        // Tax
        const baseTax = 906; // 25% tax rate
        const baseNetIncome = baseEBT - baseTax; // 2719

        // Revenue impact from volume, price, and market share
        // Try to find matching levers by name pattern, or use defaults
        const volumeLever = scenarioLevers.find(l => l.name.toLowerCase().includes('volume') || l.name.toLowerCase().includes('growth'));
        const priceLever = scenarioLevers.find(l => l.name.toLowerCase().includes('price') || l.name.toLowerCase().includes('pricing'));
        const marketLever = scenarioLevers.find(l => l.name.toLowerCase().includes('market') || l.name.toLowerCase().includes('share'));
        
        const volumeChange = volumeLever ? (leverValues[volumeLever.id] || 0) : (leverValues['volume-growth'] || 0);
        const priceChange = priceLever ? (leverValues[priceLever.id] || 0) : (leverValues['price-change'] || 0);
        const marketChange = marketLever ? (leverValues[marketLever.id] || 0) : (leverValues['market-share'] || 0);
        
        const revenueImpact = baseRevenue * (
            (volumeChange / 100) +
            (priceChange / 100) +
            (marketChange / 100) * 0.5
        );

        // Segment revenue impacts (proportional)
        const passengerVehiclesImpact = basePassengerVehicles * (
            (volumeChange / 100) +
            (priceChange / 100) +
            (marketChange / 100) * 0.5
        );
        const commercialVehiclesImpact = baseCommercialVehicles * (
            (volumeChange / 100) * 0.8 + // Commercial vehicles less price sensitive
            (priceChange / 100) * 0.6 +
            (marketChange / 100) * 0.3
        );
        const partsAndServicesImpact = basePartsAndServices * (
            (volumeChange / 100) * 0.6 + // Parts/services more stable
            (priceChange / 100) * 0.4 +
            (marketChange / 100) * 0.2
        );

        // COGS impact - Find relevant levers
        const materialLever = scenarioLevers.find(l => l.name.toLowerCase().includes('material') || l.name.toLowerCase().includes('cost'));
        const tariffLever = scenarioLevers.find(l => l.name.toLowerCase().includes('tariff'));
        const supplyChainLever = scenarioLevers.find(l => l.name.toLowerCase().includes('supply') || l.name.toLowerCase().includes('chain'));
        const laborLever = scenarioLevers.find(l => l.name.toLowerCase().includes('labor') || l.name.toLowerCase().includes('productivity'));
        
        const materialChange = materialLever ? (leverValues[materialLever.id] || 0) : (leverValues['material-inflation'] || 0);
        const tariffChange = tariffLever ? (leverValues[tariffLever.id] || 0) : (leverValues['tariffs'] || 0);
        const supplyChainChange = supplyChainLever ? (leverValues[supplyChainLever.id] || 0) : (leverValues['supply-chain'] || 0);
        const laborChange = laborLever ? (leverValues[laborLever.id] || 0) : (leverValues['labor-productivity'] || 0);
        
        const materialsImpact = baseMaterials * (
            (volumeChange / 100) + // Materials scale with volume
            (materialChange / 100) * 0.8 + // Material inflation directly impacts
            (tariffChange / 100) * 0.05 + // Tariffs impact imported materials
            (supplyChainChange / 100) * -0.15 // Supply chain efficiency reduces material costs
        );

        const laborImpact = baseLabor * (
            (volumeChange / 100) + // Labor scales with volume
            (laborChange / 100) * -0.3 // Productivity reduces labor costs
        );

        const mfgOverheadImpact = baseManufacturingOverhead * (
            (volumeChange / 100) * 0.6 + // Some overhead is fixed
            (supplyChainChange / 100) * -0.1 // Efficiency reduces overhead
        );

        const cogsImpact = materialsImpact + laborImpact + mfgOverheadImpact;

        // Gross Profit impact
        const grossProfitImpact = revenueImpact - cogsImpact;

        // Operating Expenses impact
        const marketingLever = scenarioLevers.find(l => l.name.toLowerCase().includes('marketing'));
        const warrantyLever = scenarioLevers.find(l => l.name.toLowerCase().includes('warranty'));
        
        const marketingChange = marketingLever ? (leverValues[marketingLever.id] || 0) : (leverValues['marketing-spend'] || 0);
        const warrantyChange = warrantyLever ? (leverValues[warrantyLever.id] || 0) : (leverValues['warranty-costs'] || 0);
        
        const rdImpact = baseRD * (
            (volumeChange / 100) * 0.2 // R&D is mostly fixed
        );

        const marketingImpact = baseMarketing * (
            (marketingChange / 100) + // Marketing spend directly impacts
            (volumeChange / 100) * 0.3 // Some marketing scales with growth
        );

        const warrantyImpact = baseWarranty * (
            (warrantyChange / 100) + // Warranty costs directly impact
            (volumeChange / 100) * 0.6 // Warranty scales with volume
        );

        const sgaImpact = baseSGandA * (
            (volumeChange / 100) * 0.5 + // Some SG&A is variable
            (laborChange / 100) * -0.2 // Productivity reduces SG&A
        );

        const otherOpExImpact = baseOtherOpEx * (
            (volumeChange / 100) * 0.3
        );

        const opExImpact = rdImpact + marketingImpact + warrantyImpact + sgaImpact + otherOpExImpact;

        // EBIT impact
        const ebitImpact = grossProfitImpact - opExImpact;

        // Interest impact
        const interestLever = scenarioLevers.find(l => l.name.toLowerCase().includes('interest') || l.name.toLowerCase().includes('rate'));
        const fxLever = scenarioLevers.find(l => l.name.toLowerCase().includes('fx') || l.name.toLowerCase().includes('currency') || l.name.toLowerCase().includes('exchange'));
        
        const interestChange = interestLever ? (leverValues[interestLever.id] || 0) : (leverValues['interest-rates'] || 0);
        const fxChange = fxLever ? (leverValues[fxLever.id] || 0) : (leverValues['fx-rate'] || 0);
        
        const interestImpact = baseInterest * (
            (interestChange / 100) * 0.5 + // Interest rates affect borrowing costs
            (fxChange / 100) * 0.1 // FX can affect foreign debt
        );

        // EBT impact
        const ebtImpact = ebitImpact - interestImpact;

        // Tax impact (25% tax rate)
        const taxImpact = ebtImpact * 0.25;

        // Net Income impact
        const netIncomeImpact = ebtImpact - taxImpact;

            const newRevenue = baseRevenue + revenueImpact;
            const newEBIT = baseEBIT + ebitImpact;

            return {
                revenue: revenueImpact,
                // Segment breakdowns
                passengerVehicles: passengerVehiclesImpact,
                commercialVehicles: commercialVehiclesImpact,
                partsAndServices: partsAndServicesImpact,
                // COGS breakdowns
                materials: materialsImpact,
                labor: laborImpact,
                manufacturingOverhead: mfgOverheadImpact,
                cogs: cogsImpact,
                grossProfit: grossProfitImpact,
                // Operating Expenses breakdowns
                rd: rdImpact,
                marketing: marketingImpact,
                warranty: warrantyImpact,
                sga: sgaImpact,
                otherOpEx: otherOpExImpact,
                opEx: opExImpact,
                ebit: ebitImpact,
                interest: interestImpact,
                ebt: ebtImpact,
                tax: taxImpact,
                netIncome: netIncomeImpact,
                ebitMargin: newRevenue > 0 ? (newEBIT / newRevenue) * 100 : 12.5,
                // Base values for display
                baseRevenue,
                basePassengerVehicles,
                baseCommercialVehicles,
                basePartsAndServices,
                baseMaterials,
                baseLabor,
                baseManufacturingOverhead,
                baseCOGS,
                baseGrossProfit,
                baseRD,
                baseMarketing,
                baseWarranty,
                baseSGandA,
                baseOtherOpEx,
                baseOpEx,
                baseEBIT,
                baseInterest,
                baseOtherIncome,
                baseEBT,
                baseTax,
                baseNetIncome
            };
        } catch (error) {
            console.error('Error calculating impact:', error);
            // Return default/zero impact on error
            return {
                revenue: 0,
                passengerVehicles: 0,
                commercialVehicles: 0,
                partsAndServices: 0,
                materials: 0,
                labor: 0,
                manufacturingOverhead: 0,
                cogs: 0,
                grossProfit: 0,
                rd: 0,
                marketing: 0,
                warranty: 0,
                sga: 0,
                otherOpEx: 0,
                opEx: 0,
                ebit: 0,
                interest: 0,
                ebt: 0,
                tax: 0,
                netIncome: 0,
                ebitMargin: 12.5,
                baseRevenue: 31000,
                basePassengerVehicles: 18600,
                baseCommercialVehicles: 4650,
                basePartsAndServices: 7750,
                baseMaterials: 10850,
                baseLabor: 4650,
                baseManufacturingOverhead: 3100,
                baseCOGS: 18600,
                baseGrossProfit: 12400,
                baseRD: 2325,
                baseMarketing: 1550,
                baseWarranty: 775,
                baseSGandA: 3100,
                baseOtherOpEx: 775,
                baseOpEx: 8525,
                baseEBIT: 3875,
                baseInterest: 350,
                baseOtherIncome: 100,
                baseEBT: 3625,
                baseTax: 906,
                baseNetIncome: 2719
            };
        }
    };

    // Memoize impact calculation to prevent unnecessary recalculations
    const impact = useMemo(() => {
        try {
            return calculateImpact();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            console.error('Error calculating impact:', err);
            // Don't set error state here as it causes re-render issues
            // Return default/zero impact if calculation fails
            return {
                revenue: 0,
                passengerVehicles: 0,
                commercialVehicles: 0,
                partsAndServices: 0,
                materials: 0,
                labor: 0,
                manufacturingOverhead: 0,
                cogs: 0,
                grossProfit: 0,
                rd: 0,
                marketing: 0,
                warranty: 0,
                sga: 0,
                otherOpEx: 0,
                opEx: 0,
                ebit: 0,
                interest: 0,
                ebt: 0,
                tax: 0,
                netIncome: 0,
                ebitMargin: 12.5,
                baseRevenue: 31000,
                basePassengerVehicles: 18600,
                baseCommercialVehicles: 4650,
                basePartsAndServices: 7750,
                baseMaterials: 10850,
                baseLabor: 4650,
                baseManufacturingOverhead: 3100,
                baseCOGS: 18600,
                baseGrossProfit: 12400,
                baseRD: 2325,
                baseMarketing: 1550,
                baseWarranty: 775,
                baseSGandA: 3100,
                baseOtherOpEx: 775,
                baseOpEx: 8525,
                baseEBIT: 3875,
                baseInterest: 350,
                baseOtherIncome: 100,
                baseEBT: 3625,
                baseTax: 906,
                baseNetIncome: 2719
            };
        }
    }, [leverValues]);

    // Early return if impact calculation failed
    if (!impact) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-red-600 mb-4">Error Loading Page</h1>
                    <p className="text-gray-600">Impact calculation failed. Please refresh the page.</p>
                </div>
            </div>
        );
    }

    // Ensure leverValues is properly initialized
    if (!leverValues || Object.keys(leverValues).length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-red-600 mb-4">Loading...</h1>
                    <p className="text-gray-600">Initializing scenario modeling...</p>
                </div>
            </div>
        );
    }

    return (
            <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="p-3 bg-cyan-gradient rounded-xl shadow-lg glow-cyan">
                                <Sliders className="w-8 h-8 text-navy-900" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Scenario Modeling</h1>
                                <p className="text-gray-600">What-if analysis with P&L impact</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-4">
                            <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center space-x-2">
                                <RefreshCw className="w-4 h-4" />
                                <span>Reset</span>
                            </button>
                            <button className="px-4 py-2 bg-cyan-gradient text-navy-900 font-semibold rounded-lg glow-cyan-hover transition-all flex items-center space-x-2">
                                <Save className="w-4 h-4" />
                                <span>Save</span>
                            </button>
                            <button
                                className="px-6 py-2 bg-cyan-gradient text-navy-900 font-semibold rounded-lg glow-cyan-hover transition-all flex items-center space-x-2"
                            >
                                <Play className="w-4 h-4" />
                                <span>Run Scenario</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>


            {/* Scenario Chat - Horizontal */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-6 py-3">
                    <div className="flex items-center space-x-4">
                        <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Describe the scenario:</label>
                        <div className="flex-1 flex items-center space-x-2">
                            {chatMessages.length > 0 && (
                                <div className="flex items-center space-x-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                                    <span className="text-gray-600">Applied:</span>
                                    <span className="font-medium text-gray-900">
                                        {chatMessages[chatMessages.length - 1]?.role === 'assistant' 
                                            ? chatMessages[chatMessages.length - 1].content.split('\n')[0].replace('Applied ', '').replace('.', '')
                                            : 'Processing...'}
                                    </span>
                                    <button
                                        onClick={() => setShowChatDetails(!showChatDetails)}
                                        className="ml-2 text-gray-500 hover:text-gray-700 transition-colors"
                                        title={showChatDetails ? "Hide details" : "Show details"}
                                    >
                                        <ChevronRight className={`w-4 h-4 transition-transform ${showChatDetails ? 'rotate-90' : ''}`} />
                                    </button>
                                </div>
                            )}
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleChatSubmit()}
                                placeholder="e.g., What if tariffs increase by 25%?"
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan focus:border-transparent"
                                disabled={isProcessingChat}
                            />
                            <button
                                onClick={handleChatSubmit}
                                disabled={!chatInput.trim() || isProcessingChat}
                                className="px-4 py-2 bg-cyan-gradient text-navy-900 font-semibold rounded-lg glow-cyan-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                            >
                                {isProcessingChat ? (
                                    <Loader className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Send className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                    </div>
                    {showChatDetails && chatMessages.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-3 pt-3 border-t border-gray-200"
                        >
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {chatMessages.map((message) => (
                                    <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] rounded-lg p-2 text-sm ${
                                            message.role === 'user'
                                                ? 'bg-cyan text-navy-900'
                                                : 'bg-gray-50 border border-gray-200'
                                        }`}>
                                            <p className="whitespace-pre-wrap">{message.content}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Scenarios Horizontal Selector */}
            {scenarios.length > 0 && (
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Scenarios</h3>
                    <div className="flex space-x-3">
                        {scenarios.map(scenario => (
                            <button
                                key={scenario.id}
                                onClick={() => handleScenarioSelect(scenario.id)}
                                className={`px-4 py-2 rounded-lg border-2 transition-all ${selectedScenario === scenario.id
                                        ? 'border-cyan bg-cyan-50'
                                        : 'border-gray-200 hover:border-gray-300 bg-white'
                                    }`}
                            >
                                <div className="flex items-center space-x-3">
                                    <div className="text-left">
                                        <h4 className="font-semibold text-gray-900 text-sm">{scenario.name}</h4>
                                        <p className="text-xs text-gray-600">{scenario.description}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-sm font-bold ${scenario.impact >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {scenario.impact >= 0 ? '+' : ''}{scenario.impact}M
                                        </p>
                                        <p className="text-xs text-gray-500">{scenario.confidence}%</p>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            )}

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="grid grid-cols-12 gap-8">
                    {/* Left Panel - Adjust Levers */}
                    <div className="col-span-5">
                        <div className="bg-white rounded-xl p-6 shadow-sm">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Adjust Levers</h3>
                            <div className="space-y-4">
                                {scenarioLevers.map(lever => (
                                    <div key={lever.id}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div>
                                                <label className="text-sm font-medium text-gray-700">{lever.name}</label>
                                                <p className="text-xs text-gray-500">{lever.category}</p>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <span className={`text-sm font-semibold ${(leverValues[lever.id] ?? 0) > 0 ? 'text-green-600' :
                                                        (leverValues[lever.id] ?? 0) < 0 ? 'text-red-600' :
                                                            'text-gray-600'
                                                    }`}>
                                                    {(leverValues[lever.id] ?? 0) > 0 ? '+' : ''}{leverValues[lever.id] ?? 0}{lever.unit}
                                                </span>
                                                <span className={`px-2 py-1 text-xs rounded-full ${lever.impact === 'high' ? 'bg-red-100 text-red-700' :
                                                        lever.impact === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                                            'bg-gray-100 text-gray-700'
                                                    }`}>
                                                    {lever.impact}
                                                </span>
                                            </div>
                                        </div>
                                        <input
                                            type="range"
                                            min={lever.minValue}
                                            max={lever.maxValue}
                                            step="0.5"
                                            value={leverValues[lever.id] ?? 0}
                                            onChange={(e) => handleLeverChange(lever.id, parseFloat(e.target.value))}
                                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                            style={{
                                                background: `linear-gradient(to right, #e5e7eb ${(((leverValues[lever.id] ?? 0) - lever.minValue) / (lever.maxValue - lever.minValue)) * 100
                                                    }%, #A100FF ${(((leverValues[lever.id] ?? 0) - lever.minValue) / (lever.maxValue - lever.minValue)) * 100
                                                    }%)`
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Panel - Performance Driver Tree */}
                    <div className="col-span-7">
                        <div className="space-y-6">
                                    {/* Performance Driver Tree */}
                                    <div className="bg-white rounded-xl p-6 shadow-sm">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Driver Tree</h3>
                                        <p className="text-sm text-gray-600 mb-4">
                                            Visualize how drivers impact performance. {excelData && excelData.tree.length > 0 ? 'Showing data from uploaded Excel file.' : 'Upload Excel data to see your actual driver tree.'}
                                        </p>
                                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 min-h-[400px] max-h-[600px] overflow-y-auto">
                                            {excelData && excelData.tree.length > 0 ? (
                                                <div className="space-y-2">
                                                    {excelData.tree.map((rootNode, index) => renderExcelDriverNode(rootNode, 0, '', index))}
                                                </div>
                                            ) : (
                                                <p className="text-sm text-gray-500 text-center py-8">
                                                    Performance Driver Tree will appear here when Excel data is uploaded.
                                                    <br />
                                                    <span className="text-xs mt-2 block">Go to Data Upload page to upload your Excel file.</span>
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Detailed Automotive P&L Impact */}
                                    <div className="bg-white rounded-xl p-6 shadow-sm">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Automotive P&L Flow-Through Impact</h3>
                                        
                                        {/* Summary Cards */}
                                        <div className="grid grid-cols-4 gap-4 mb-6">
                                            <div className="bg-gray-50 rounded-lg p-4">
                                                <p className="text-xs text-gray-600 mb-1">Revenue Impact</p>
                                                <p className={`text-xl font-bold ${impact.revenue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {impact.revenue >= 0 ? '+' : ''}${Math.abs(impact.revenue).toFixed(0)}M
                                                </p>
                                            </div>
                                            <div className="bg-gray-50 rounded-lg p-4">
                                                <p className="text-xs text-gray-600 mb-1">EBIT Impact</p>
                                                <p className={`text-xl font-bold ${impact.ebit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {impact.ebit >= 0 ? '+' : ''}${Math.abs(impact.ebit).toFixed(0)}M
                                                </p>
                                            </div>
                                            <div className="bg-gray-50 rounded-lg p-4">
                                                <p className="text-xs text-gray-600 mb-1">Net Income Impact</p>
                                                <p className={`text-xl font-bold ${impact.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {impact.netIncome >= 0 ? '+' : ''}${Math.abs(impact.netIncome).toFixed(0)}M
                                                </p>
                                            </div>
                                            <div className="bg-gray-50 rounded-lg p-4">
                                                <p className="text-xs text-gray-600 mb-1">EBIT Margin</p>
                                                <p className="text-xl font-bold text-gray-900">
                                                    {impact.ebitMargin.toFixed(1)}%
                                                </p>
                                            </div>
                                        </div>

                                        {/* Detailed P&L Table */}
                                        <div className="border-t border-gray-200 pt-4">
                                            <h4 className="text-sm font-semibold text-gray-900 mb-3">Automotive P&L Line Item Details</h4>
                                            <div className="space-y-2">
                                                {/* Revenue - with segment breakdown */}
                                                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium text-gray-900">Revenue</p>
                                                        <p className="text-xs text-gray-500">Base: ${formatNumber(impact.baseRevenue)}M</p>
                                                    </div>
                                                    <div className="text-right w-32">
                                                        <p className={`text-sm font-semibold ${impact.revenue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {impact.revenue >= 0 ? '+' : ''}${formatNumber(Math.abs(impact.revenue))}M
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            ${formatNumber(impact.baseRevenue + impact.revenue)}M
                                                        </p>
                                                    </div>
                                                </div>
                                                {/* Revenue Segments */}
                                                <div className="ml-4 space-y-1 border-l-2 border-gray-200 pl-3">
                                                    <div className="flex items-center justify-between py-1">
                                                        <div className="flex-1">
                                                            <p className="text-xs text-gray-700">Passenger Vehicles</p>
                                                            <p className="text-xs text-gray-500">Base: ${formatNumber(impact.basePassengerVehicles)}M</p>
                                                        </div>
                                                        <div className="text-right w-28">
                                                            <p className={`text-xs font-medium ${impact.passengerVehicles >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                {impact.passengerVehicles >= 0 ? '+' : ''}${formatNumber(Math.abs(impact.passengerVehicles))}M
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between py-1">
                                                        <div className="flex-1">
                                                            <p className="text-xs text-gray-700">Commercial Vehicles</p>
                                                            <p className="text-xs text-gray-500">Base: ${formatNumber(impact.baseCommercialVehicles)}M</p>
                                                        </div>
                                                        <div className="text-right w-28">
                                                            <p className={`text-xs font-medium ${impact.commercialVehicles >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                {impact.commercialVehicles >= 0 ? '+' : ''}${formatNumber(Math.abs(impact.commercialVehicles))}M
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between py-1">
                                                        <div className="flex-1">
                                                            <p className="text-xs text-gray-700">Parts & Services</p>
                                                            <p className="text-xs text-gray-500">Base: ${formatNumber(impact.basePartsAndServices)}M</p>
                                                        </div>
                                                        <div className="text-right w-28">
                                                            <p className={`text-xs font-medium ${impact.partsAndServices >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                {impact.partsAndServices >= 0 ? '+' : ''}${formatNumber(Math.abs(impact.partsAndServices))}M
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Cost of Sales - with breakdown */}
                                                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium text-gray-900">Cost of Sales</p>
                                                        <p className="text-xs text-gray-500">Base: ${formatNumber(impact.baseCOGS)}M</p>
                                                    </div>
                                                    <div className="text-right w-32">
                                                        <p className={`text-sm font-semibold ${impact.cogs <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {impact.cogs >= 0 ? '+' : ''}${formatNumber(Math.abs(impact.cogs))}M
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            ${formatNumber(impact.baseCOGS + impact.cogs)}M
                                                        </p>
                                                    </div>
                                                </div>
                                                {/* COGS Breakdown */}
                                                <div className="ml-4 space-y-1 border-l-2 border-gray-200 pl-3">
                                                    <div className="flex items-center justify-between py-1">
                                                        <div className="flex-1">
                                                            <p className="text-xs text-gray-700">Materials & Components</p>
                                                            <p className="text-xs text-gray-500">Base: ${formatNumber(impact.baseMaterials)}M</p>
                                                        </div>
                                                        <div className="text-right w-28">
                                                            <p className={`text-xs font-medium ${impact.materials <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                {impact.materials >= 0 ? '+' : ''}${formatNumber(Math.abs(impact.materials))}M
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between py-1">
                                                        <div className="flex-1">
                                                            <p className="text-xs text-gray-700">Direct Labor</p>
                                                            <p className="text-xs text-gray-500">Base: ${formatNumber(impact.baseLabor)}M</p>
                                                        </div>
                                                        <div className="text-right w-28">
                                                            <p className={`text-xs font-medium ${impact.labor <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                {impact.labor >= 0 ? '+' : ''}${formatNumber(Math.abs(impact.labor))}M
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between py-1">
                                                        <div className="flex-1">
                                                            <p className="text-xs text-gray-700">Manufacturing Overhead</p>
                                                            <p className="text-xs text-gray-500">Base: ${formatNumber(impact.baseManufacturingOverhead)}M</p>
                                                        </div>
                                                        <div className="text-right w-28">
                                                            <p className={`text-xs font-medium ${impact.manufacturingOverhead <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                {impact.manufacturingOverhead >= 0 ? '+' : ''}${formatNumber(Math.abs(impact.manufacturingOverhead))}M
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Gross Profit */}
                                                <div className="flex items-center justify-between py-2 border-b border-gray-200 bg-gray-50 px-2 rounded">
                                                    <div className="flex-1">
                                                        <p className="text-sm font-semibold text-gray-900">Gross Profit</p>
                                                        <p className="text-xs text-gray-500">Base: ${formatNumber(impact.baseGrossProfit)}M</p>
                                                    </div>
                                                    <div className="text-right w-32">
                                                        <p className={`text-sm font-semibold ${impact.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {impact.grossProfit >= 0 ? '+' : ''}${formatNumber(Math.abs(impact.grossProfit))}M
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            ${formatNumber(impact.baseGrossProfit + impact.grossProfit)}M
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Operating Expenses - with breakdown */}
                                                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium text-gray-900">Operating Expenses</p>
                                                        <p className="text-xs text-gray-500">Base: ${formatNumber(impact.baseOpEx)}M</p>
                                                    </div>
                                                    <div className="text-right w-32">
                                                        <p className={`text-sm font-semibold ${impact.opEx <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {impact.opEx >= 0 ? '+' : ''}${formatNumber(Math.abs(impact.opEx))}M
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            ${formatNumber(impact.baseOpEx + impact.opEx)}M
                                                        </p>
                                                    </div>
                                                </div>
                                                {/* OpEx Breakdown */}
                                                <div className="ml-4 space-y-1 border-l-2 border-gray-200 pl-3">
                                                    <div className="flex items-center justify-between py-1">
                                                        <div className="flex-1">
                                                            <p className="text-xs text-gray-700">R&D Expenses</p>
                                                            <p className="text-xs text-gray-500">Base: ${formatNumber(impact.baseRD)}M</p>
                                                        </div>
                                                        <div className="text-right w-28">
                                                            <p className={`text-xs font-medium ${impact.rd <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                {impact.rd >= 0 ? '+' : ''}${formatNumber(Math.abs(impact.rd))}M
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between py-1">
                                                        <div className="flex-1">
                                                            <p className="text-xs text-gray-700">Marketing Expenses</p>
                                                            <p className="text-xs text-gray-500">Base: ${formatNumber(impact.baseMarketing)}M</p>
                                                        </div>
                                                        <div className="text-right w-28">
                                                            <p className={`text-xs font-medium ${impact.marketing <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                {impact.marketing >= 0 ? '+' : ''}${formatNumber(Math.abs(impact.marketing))}M
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between py-1">
                                                        <div className="flex-1">
                                                            <p className="text-xs text-gray-700">Warranty Costs</p>
                                                            <p className="text-xs text-gray-500">Base: ${formatNumber(impact.baseWarranty)}M</p>
                                                        </div>
                                                        <div className="text-right w-28">
                                                            <p className={`text-xs font-medium ${impact.warranty <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                {impact.warranty >= 0 ? '+' : ''}${formatNumber(Math.abs(impact.warranty))}M
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between py-1">
                                                        <div className="flex-1">
                                                            <p className="text-xs text-gray-700">SG&A Expenses</p>
                                                            <p className="text-xs text-gray-500">Base: ${formatNumber(impact.baseSGandA)}M</p>
                                                        </div>
                                                        <div className="text-right w-28">
                                                            <p className={`text-xs font-medium ${impact.sga <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                {impact.sga >= 0 ? '+' : ''}${formatNumber(Math.abs(impact.sga))}M
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between py-1">
                                                        <div className="flex-1">
                                                            <p className="text-xs text-gray-700">Other Operating Expenses</p>
                                                            <p className="text-xs text-gray-500">Base: ${formatNumber(impact.baseOtherOpEx)}M</p>
                                                        </div>
                                                        <div className="text-right w-28">
                                                            <p className={`text-xs font-medium ${impact.otherOpEx <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                {impact.otherOpEx >= 0 ? '+' : ''}${formatNumber(Math.abs(impact.otherOpEx))}M
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* EBIT */}
                                                <div className="flex items-center justify-between py-2 border-b border-gray-200 bg-gray-50 px-2 rounded">
                                                    <div className="flex-1">
                                                        <p className="text-sm font-semibold text-gray-900">EBIT</p>
                                                        <p className="text-xs text-gray-500">Base: ${formatNumber(impact.baseEBIT)}M</p>
                                                    </div>
                                                    <div className="text-right w-32">
                                                        <p className={`text-sm font-semibold ${impact.ebit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {impact.ebit >= 0 ? '+' : ''}${formatNumber(Math.abs(impact.ebit))}M
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            ${formatNumber(impact.baseEBIT + impact.ebit)}M
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Interest */}
                                                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium text-gray-900">Interest Expense</p>
                                                        <p className="text-xs text-gray-500">Base: ${formatNumber(impact.baseInterest)}M</p>
                                                    </div>
                                                    <div className="text-right w-32">
                                                        <p className={`text-sm font-semibold ${impact.interest <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {impact.interest >= 0 ? '+' : ''}${formatNumber(Math.abs(impact.interest))}M
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            ${formatNumber(impact.baseInterest + impact.interest)}M
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* EBT */}
                                                <div className="flex items-center justify-between py-2 border-b border-gray-200 bg-gray-50 px-2 rounded">
                                                    <div className="flex-1">
                                                        <p className="text-sm font-semibold text-gray-900">EBT (Earnings Before Tax)</p>
                                                        <p className="text-xs text-gray-500">Base: ${formatNumber(impact.baseEBT)}M</p>
                                                    </div>
                                                    <div className="text-right w-32">
                                                        <p className={`text-sm font-semibold ${impact.ebt >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {impact.ebt >= 0 ? '+' : ''}${formatNumber(Math.abs(impact.ebt))}M
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            ${formatNumber(impact.baseEBT + impact.ebt)}M
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Tax */}
                                                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium text-gray-900">Income Tax</p>
                                                        <p className="text-xs text-gray-500">Base: ${formatNumber(impact.baseTax)}M (25%)</p>
                                                    </div>
                                                    <div className="text-right w-32">
                                                        <p className={`text-sm font-semibold ${impact.tax <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {impact.tax >= 0 ? '+' : ''}${formatNumber(Math.abs(impact.tax))}M
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            ${formatNumber(impact.baseTax + impact.tax)}M
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Net Income */}
                                                <div className="flex items-center justify-between py-3 border-t-2 border-gray-300 bg-gradient-to-r from-gray-50 to-gray-100 px-3 rounded">
                                                    <div className="flex-1">
                                                        <p className="text-sm font-bold text-gray-900">Net Income</p>
                                                        <p className="text-xs text-gray-500">Base: ${formatNumber(impact.baseNetIncome)}M</p>
                                                    </div>
                                                    <div className="text-right w-32">
                                                        <p className={`text-base font-bold ${impact.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {impact.netIncome >= 0 ? '+' : ''}${formatNumber(Math.abs(impact.netIncome))}M
                                                        </p>
                                                        <p className="text-sm font-semibold text-gray-900">
                                                            ${formatNumber(impact.baseNetIncome + impact.netIncome)}M
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
