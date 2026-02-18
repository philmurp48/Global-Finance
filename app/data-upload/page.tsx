'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Upload, CheckCircle2, AlertCircle, FileSpreadsheet, Database } from 'lucide-react';
import ExcelUpload from '@/components/ExcelUpload';
import { ExcelDriverTreeData } from '@/lib/excel-parser';

export default function DataUploadPage() {
    const [excelData, setExcelData] = useState<ExcelDriverTreeData | null>(null);
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Load existing data on mount
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
                        setUploadStatus('success');
                    }
                }
            } catch (error) {
                console.error('Failed to load Excel data:', error);
            }
        };

        loadData();
    }, []);

    const handleDataLoaded = async (data: ExcelDriverTreeData) => {
        setUploadStatus('uploading');
        setErrorMessage(null);

        try {
            // Save to server
            const dataToSave = {
                tree: data.tree,
                accountingFacts: Array.from(data.accountingFacts.entries()),
                rateFacts: Array.from(data.rateFacts.entries() as any),
                accountingFactRecords: data.accountingFactRecords || [],
                productDIM: Array.from((data.productDIM || new Map()).entries())
            };

            const response = await fetch('/api/excel-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: dataToSave })
            });

            if (response.ok) {
                setExcelData(data);
                setUploadStatus('success');
            } else {
                throw new Error('Failed to save data to server');
            }
        } catch (error) {
            setUploadStatus('error');
            setErrorMessage(error instanceof Error ? error.message : 'Failed to upload data');
        }
    };

    const getDataSummary = () => {
        if (!excelData) return null;

        const totalNodes = (nodes: any[]): number => {
            return nodes.reduce((count, node) => {
                return count + 1 + (node.children ? totalNodes(node.children) : 0);
            }, 0);
        };

        return {
            totalDrivers: totalNodes(excelData.tree),
            accountingFacts: excelData.accountingFacts.size,
            rateFacts: excelData.rateFacts.size,
            products: excelData.productDIM?.size || 0
        };
    };

    const summary = getDataSummary();

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="p-3 bg-purple-gradient rounded-xl shadow-lg glow-purple">
                                <Upload className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Data Upload</h1>
                                <p className="text-gray-600">Upload Excel file to drive all pages</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-4xl mx-auto px-6 py-8">
                <div className="space-y-6">
                    {/* Upload Section */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Excel File</h2>
                        <p className="text-sm text-gray-600 mb-6">
                            Upload an Excel file with the following sheets:
                        </p>
                        <ul className="list-disc list-inside text-sm text-gray-600 mb-6 space-y-2">
                            <li><strong>Driver Tree</strong> - Hierarchical structure of performance drivers</li>
                            <li><strong>Accounting Fact</strong> - Accounting amounts by driver and period</li>
                            <li><strong>Rate Fact</strong> or <strong>Fee Rate Fact</strong> - Rate data by driver and period</li>
                            <li><strong>Product DIM</strong> (optional) - Product dimension data</li>
                        </ul>

                        <ExcelUpload onDataLoaded={handleDataLoaded} />

                        {uploadStatus === 'success' && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-4 flex items-center space-x-2 text-green-600"
                            >
                                <CheckCircle2 className="w-5 h-5" />
                                <span className="font-medium">Data uploaded successfully!</span>
                            </motion.div>
                        )}

                        {uploadStatus === 'error' && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-4 flex items-center space-x-2 text-red-600"
                            >
                                <AlertCircle className="w-5 h-5" />
                                <span className="font-medium">{errorMessage || 'Upload failed'}</span>
                            </motion.div>
                        )}
                    </div>

                    {/* Data Summary */}
                    {summary && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Data Summary</h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="flex items-center space-x-2 mb-2">
                                        <Database className="w-5 h-5 text-purple-600" />
                                        <p className="text-sm font-medium text-gray-600">Total Drivers</p>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900">{summary.totalDrivers}</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="flex items-center space-x-2 mb-2">
                                        <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                                        <p className="text-sm font-medium text-gray-600">Accounting Facts</p>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900">{summary.accountingFacts}</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="flex items-center space-x-2 mb-2">
                                        <FileSpreadsheet className="w-5 h-5 text-green-600" />
                                        <p className="text-sm font-medium text-gray-600">Rate Facts</p>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900">{summary.rateFacts}</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="flex items-center space-x-2 mb-2">
                                        <Database className="w-5 h-5 text-orange-600" />
                                        <p className="text-sm font-medium text-gray-600">Products</p>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900">{summary.products}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Information Section */}
                    <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
                        <h3 className="text-md font-semibold text-gray-900 mb-3">How It Works</h3>
                        <div className="space-y-3 text-sm text-gray-700">
                            <p>
                                Once you upload an Excel file, the data will be used across all pages:
                            </p>
                            <ul className="list-disc list-inside space-y-1 ml-4">
                                <li><strong>Executive Summary</strong> - Key metrics and insights from your data</li>
                                <li><strong>Scenario Modeling</strong> - Performance Driver Tree visualization and what-if analysis</li>
                                <li><strong>Operational Performance</strong> - Operational metrics and KPIs</li>
                            </ul>
                            <p className="mt-4">
                                The data is stored securely and shared across all pages in real-time.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

