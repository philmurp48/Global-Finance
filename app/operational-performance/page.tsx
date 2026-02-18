'use client';

import { motion } from 'framer-motion';
import {
    Activity,
    AlertTriangle,
    CheckCircle,
    Factory,
    TrendingUp,
    Users,
    Package,
    Target,
    Shield
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { ExcelDriverTreeData } from '@/lib/excel-parser';
import { extractOperationalMetrics } from '@/lib/excel-metrics';

export default function OperationalPerformance() {
    const selectedPeriod = 'November 2024';
    const selectedComparison = 'vs Plan';
    const [excelData, setExcelData] = useState<ExcelDriverTreeData | null>(null);

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
                    }
                }
            } catch (error) {
                console.error('Failed to load Excel data:', error);
            }
        };

        loadData();
    }, []);

    // Extract operational metrics from Excel
    const excelMetrics = useMemo(() => extractOperationalMetrics(excelData), [excelData]);

    // Manufacturing Performance - use Excel data if available
    const manufacturingMetrics = useMemo(() => {
        if (excelMetrics) {
            return [
                {
                    label: 'Overall Equipment Effectiveness (OEE)',
                    value: `${excelMetrics.oee.toFixed(1)}%`,
                    target: `${(excelMetrics.oee * 0.93).toFixed(1)}%`,
                    change: ((excelMetrics.oee - (excelMetrics.oee * 0.93)) / (excelMetrics.oee * 0.93)) * 100,
                    status: excelMetrics.oee > 70 ? 'above' : 'warning',
                    trend: [],
                    description: 'From Excel data'
                },
                {
                    label: 'Production Volume',
                    value: `${(excelMetrics.productionVolume / 1000).toFixed(1)}K units`,
                    target: `${((excelMetrics.productionVolume * 0.95) / 1000).toFixed(1)}K units`,
                    change: 5.0,
                    status: 'above',
                    trend: [],
                    description: 'From Excel data'
                },
                {
                    label: 'Quality Rate',
                    value: `${excelMetrics.qualityRate.toFixed(1)}%`,
                    target: `${(excelMetrics.qualityRate * 0.997).toFixed(1)}%`,
                    change: ((excelMetrics.qualityRate - (excelMetrics.qualityRate * 0.997)) / (excelMetrics.qualityRate * 0.997)) * 100,
                    status: excelMetrics.qualityRate > 95 ? 'above' : 'warning',
                    trend: [],
                    description: 'From Excel data'
                },
                {
                    label: 'On-Time Delivery',
                    value: `${excelMetrics.onTimeDelivery.toFixed(1)}%`,
                    target: `${(excelMetrics.onTimeDelivery * 0.98).toFixed(1)}%`,
                    change: ((excelMetrics.onTimeDelivery - (excelMetrics.onTimeDelivery * 0.98)) / (excelMetrics.onTimeDelivery * 0.98)) * 100,
                    status: excelMetrics.onTimeDelivery > 90 ? 'above' : 'warning',
                    trend: [],
                    description: 'From Excel data'
                }
            ];
        }
        // Default metrics
        return [
            {
                label: 'Overall Equipment Effectiveness (OEE)',
                value: '75%',
                target: '70%',
                change: 5.0,
                status: 'above',
                trend: [68, 69, 70, 71, 72, 73, 74, 75],
                description: 'Exceeding target through improved maintenance and scheduling'
            },
            {
                label: 'Production Volume',
                value: '2.8M units',
                target: '2.65M units',
                change: 5.7,
                status: 'above',
                trend: [2.5, 2.55, 2.6, 2.65, 2.7, 2.75, 2.8],
                description: 'Strong demand driving higher production'
            },
            {
                label: 'Quality Rate',
                value: '99.8%',
                target: '99.5%',
                change: 0.3,
                status: 'above',
                trend: [99.2, 99.3, 99.4, 99.5, 99.6, 99.7, 99.8],
                description: 'Zero critical defects in November'
            },
            {
                label: 'On-Time Delivery',
                value: '94%',
                target: '92%',
                change: 2.1,
                status: 'above',
                trend: [90, 91, 91.5, 92, 92.5, 93, 94],
                description: 'Supply chain coordination improving'
            }
        ];
    }, [excelMetrics]);

    // Production by Plant
    const plantPerformance = [
        {
            plant: 'Arlington',
            volume: '485K',
            oee: '78%',
            quality: '99.9%',
            onTime: '96%',
            status: 'excellent'
        },
        {
            plant: 'Detroit',
            volume: '520K',
            oee: '76%',
            quality: '99.8%',
            onTime: '94%',
            status: 'good'
        },
        {
            plant: 'Flint',
            volume: '385K',
            oee: '72%',
            quality: '99.7%',
            onTime: '91%',
            status: 'warning'
        },
        {
            plant: 'Lansing',
            volume: '425K',
            oee: '74%',
            quality: '99.8%',
            onTime: '93%',
            status: 'good'
        },
        {
            plant: 'Spring Hill',
            volume: '485K',
            oee: '75%',
            quality: '99.9%',
            onTime: '95%',
            status: 'good'
        }
    ];

    // Supply Chain Metrics - use Excel data if available
    const supplyChainMetrics = useMemo(() => {
        if (excelMetrics && excelMetrics.inventoryNodes.length > 0) {
            const inventoryTotal = excelMetrics.inventoryNodes.reduce((sum, node) => sum + (node.accountingAmount || 0), 0);
            return [
                {
                    label: 'Inventory Turns',
                    value: `${excelMetrics.inventoryTurns.toFixed(1)}x`,
                    target: `${(excelMetrics.inventoryTurns * 0.96).toFixed(1)}x`,
                    change: ((excelMetrics.inventoryTurns - (excelMetrics.inventoryTurns * 0.96)) / (excelMetrics.inventoryTurns * 0.96)) * 100,
                    status: excelMetrics.inventoryTurns > 10 ? 'above' : 'warning',
                    description: 'From Excel data'
                },
                {
                    label: 'Days of Inventory',
                    value: `${(365 / excelMetrics.inventoryTurns).toFixed(0)} days`,
                    target: `${(365 / (excelMetrics.inventoryTurns * 0.96)).toFixed(0)} days`,
                    change: -3,
                    status: 'warning',
                    description: 'From Excel data'
                },
                {
                    label: 'Supplier On-Time Delivery',
                    value: `${excelMetrics.onTimeDelivery.toFixed(1)}%`,
                    target: '90%',
                    change: excelMetrics.onTimeDelivery - 90,
                    status: excelMetrics.onTimeDelivery > 90 ? 'above' : 'warning',
                    description: 'From Excel data'
                },
                {
                    label: 'Supply Chain Cost',
                    value: `$${(inventoryTotal / 1000000000).toFixed(2)}B`,
                    target: `$${((inventoryTotal * 0.98) / 1000000000).toFixed(2)}B`,
                    change: 2.4,
                    status: 'warning',
                    description: 'From Excel data'
                }
            ];
        }
        // Default metrics
        return [
            {
                label: 'Inventory Turns',
                value: '12.5x',
                target: '12.0x',
                change: 0.5,
                status: 'above',
                description: 'Efficient inventory management'
            },
            {
                label: 'Days of Inventory',
                value: '45 days',
                target: '42 days',
                change: -3,
                status: 'warning',
                description: 'Slightly elevated due to demand uncertainty'
            },
            {
                label: 'Supplier On-Time Delivery',
                value: '88%',
                target: '90%',
                change: -2,
                status: 'warning',
                description: 'Chip shortage impacting some suppliers'
            },
            {
                label: 'Supply Chain Cost',
                value: '$2.1B',
                target: '$2.05B',
                change: 2.4,
                status: 'warning',
                description: 'Freight costs elevated'
            }
        ];
    }, [excelMetrics]);

    // Digital & Innovation Metrics - use Excel data if available
    const digitalMetrics = useMemo(() => {
        if (excelMetrics && excelMetrics.digitalNodes.length > 0) {
            return [
                {
                    label: 'Digital Services Revenue',
                    value: `$${(excelMetrics.digitalRevenue / 1000000).toFixed(0)}M`,
                    change: 42.0,
                    status: 'excellent',
                    description: 'From Excel data'
                },
                {
                    label: 'Digital Engagement',
                    value: `${excelMetrics.digitalNodes.length > 0 ? (excelMetrics.digitalNodes[0].rateAmount || 0) * 100 : 0}%`,
                    change: 18.5,
                    status: 'excellent',
                    description: 'From Excel data'
                },
                {
                    label: 'Digital Sales Channel',
                    value: `${excelMetrics.digitalNodes.length > 1 ? (excelMetrics.digitalNodes[1].rateAmount || 0) * 100 : 12.5}%`,
                    change: 35.0,
                    status: 'good',
                    description: 'From Excel data'
                },
                {
                    label: 'Customer Digital Engagement',
                    value: `${excelMetrics.digitalNodes.length > 2 ? (excelMetrics.digitalNodes[2].rateAmount || 0) * 100 : 68}%`,
                    change: 8.2,
                    status: 'good',
                    description: 'From Excel data'
                }
            ];
        }
        // Default metrics
        return [
            {
                label: 'Digital Services Revenue',
                value: '$650M',
                change: 42.0,
                status: 'excellent',
                description: 'Connected services growth accelerating'
            },
            {
                label: 'OnStar Subscriptions',
                value: '8.2M',
                change: 18.5,
                status: 'excellent',
                description: 'Strong adoption of new features'
            },
            {
                label: 'Digital Sales Channel',
                value: '12.5%',
                change: 35.0,
                status: 'good',
                description: 'Online sales penetration increasing'
            },
            {
                label: 'Customer Digital Engagement',
                value: '68%',
                change: 8.2,
                status: 'good',
                description: 'Mobile app usage growing'
            }
        ];
    }, [excelMetrics]);

    // Operational Efficiency Drivers
    const efficiencyDrivers = [
        {
            driver: 'Automation & Robotics',
            impact: '+2.5pp OEE',
            investment: '$45M',
            roi: '24%',
            status: 'implemented'
        },
        {
            driver: 'Predictive Maintenance',
            impact: '-15% downtime',
            investment: '$12M',
            roi: '18%',
            status: 'implemented'
        },
        {
            driver: 'Lean Manufacturing',
            impact: '+8% efficiency',
            investment: '$8M',
            roi: '22%',
            status: 'in-progress'
        },
        {
            driver: 'Supplier Integration',
            impact: '+5% on-time delivery',
            investment: '$6M',
            roi: '15%',
            status: 'planned'
        }
    ];

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'above': case 'excellent': case 'good': return 'text-green-600 bg-green-50';
            case 'warning': return 'text-yellow-600 bg-yellow-50';
            case 'below': return 'text-red-600 bg-red-50';
            default: return 'text-gray-600 bg-gray-50';
        }
    };

    return (
        <div className="space-y-6">
            {/* Manufacturing Performance Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {manufacturingMetrics.map((metric) => (
                    <motion.div
                        key={metric.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-xl shadow-md border border-gray-200 p-5"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="text-sm font-medium text-gray-600">{metric.label}</div>
                            <div className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(metric.status)}`}>
                                {metric.status === 'above' ? 'Above Target' : 'On Track'}
                            </div>
                        </div>
                        <div className="text-2xl font-bold text-gray-900 mb-1">{metric.value}</div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Target: {metric.target}</span>
                            <span className={`font-semibold ${metric.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {metric.change >= 0 ? '+' : ''}{metric.change}%
                            </span>
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-100">
                            <p className="text-xs text-gray-500">{metric.description}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Plant Performance */}
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
                <div className="flex items-center space-x-3 mb-6">
                    <div className="p-2 bg-blue-100 rounded-lg">
                        <Factory className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Plant Performance</h2>
                        <p className="text-sm text-gray-600">Manufacturing operations by facility</p>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-200">
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Plant</th>
                                <th className="text-right py-3 px-4 font-semibold text-gray-700">Volume</th>
                                <th className="text-right py-3 px-4 font-semibold text-gray-700">OEE</th>
                                <th className="text-right py-3 px-4 font-semibold text-gray-700">Quality</th>
                                <th className="text-right py-3 px-4 font-semibold text-gray-700">On-Time</th>
                                <th className="text-center py-3 px-4 font-semibold text-gray-700">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {plantPerformance.map((plant) => (
                                <tr key={plant.plant} className="hover:bg-gray-50">
                                    <td className="py-3 px-4 font-semibold text-gray-900">{plant.plant}</td>
                                    <td className="py-3 px-4 text-right text-gray-900">{plant.volume}</td>
                                    <td className="py-3 px-4 text-right text-gray-900">{plant.oee}</td>
                                    <td className="py-3 px-4 text-right text-gray-900">{plant.quality}</td>
                                    <td className="py-3 px-4 text-right text-gray-900">{plant.onTime}</td>
                                    <td className="py-3 px-4 text-center">
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(plant.status)}`}>
                                            {plant.status === 'excellent' ? 'Excellent' : plant.status === 'good' ? 'Good' : 'Watch'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Supply Chain Performance */}
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
                <div className="flex items-center space-x-3 mb-6">
                    <div className="p-2 bg-purple-100 rounded-lg">
                        <Package className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Supply Chain Performance</h2>
                        <p className="text-sm text-gray-600">Inventory and logistics metrics</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {supplyChainMetrics.map((metric) => (
                        <div key={metric.label} className="p-4 border border-gray-200 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                                <div className="text-sm font-medium text-gray-600">{metric.label}</div>
                                <div className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(metric.status)}`}>
                                    {metric.status === 'above' ? 'Good' : metric.status === 'warning' ? 'Watch' : 'Below'}
                                </div>
                            </div>
                            <div className="text-xl font-bold text-gray-900 mb-1">{metric.value}</div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">Target: {metric.target}</span>
                                <span className={`font-semibold ${metric.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {metric.change >= 0 ? '+' : ''}{metric.change}%
                                </span>
                            </div>
                            <div className="mt-2 pt-2 border-t border-gray-100">
                                <p className="text-xs text-gray-500">{metric.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Digital & Innovation */}
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
                <div className="flex items-center space-x-3 mb-6">
                    <div className="p-2 bg-green-100 rounded-lg">
                        <Activity className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Digital & Innovation</h2>
                        <p className="text-sm text-gray-600">Digital transformation metrics</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {digitalMetrics.map((metric) => (
                        <div key={metric.label} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                            <div className="text-sm font-medium text-gray-600 mb-2">{metric.label}</div>
                            <div className="flex items-center justify-between mb-3">
                                <div className="text-xl font-bold text-gray-900">{metric.value}</div>
                                <div className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(metric.status)}`}>
                                    {metric.status === 'excellent' ? 'Excellent' : 'Good'}
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                <TrendingUp className="w-4 h-4 text-green-600" />
                                <span className="text-sm font-semibold text-green-600">+{metric.change}%</span>
                                <span className="text-xs text-gray-500">vs Last Year</span>
                            </div>
                            <div className="mt-2 pt-2 border-t border-gray-100">
                                <p className="text-xs text-gray-500">{metric.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Operational Efficiency Drivers */}
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
                <div className="flex items-center space-x-3 mb-6">
                    <div className="p-2 bg-orange-100 rounded-lg">
                        <Target className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Operational Efficiency Initiatives</h2>
                        <p className="text-sm text-gray-600">Key drivers of performance improvement</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {efficiencyDrivers.map((driver) => (
                        <div key={driver.driver} className="p-5 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h3 className="font-semibold text-gray-900 mb-1">{driver.driver}</h3>
                                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                                        <span className="font-semibold text-green-600">{driver.impact}</span>
                                        <span>impact</span>
                                    </div>
                                </div>
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    driver.status === 'implemented' ? 'bg-green-100 text-green-800' :
                                    driver.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-blue-100 text-blue-800'
                                }`}>
                                    {driver.status === 'implemented' ? 'Implemented' :
                                     driver.status === 'in-progress' ? 'In Progress' : 'Planned'}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">Investment</div>
                                    <div className="font-semibold text-gray-900">{driver.investment}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">ROI</div>
                                    <div className="font-semibold text-green-600">{driver.roi}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}





