'use client';

import { useState } from 'react';
import { Upload, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { parseDriverTreeExcel, ExcelDriverTreeData } from '@/lib/excel-parser';

interface ExcelUploadProps {
    onDataLoaded: (data: ExcelDriverTreeData) => void;
}

export default function ExcelUpload({ onDataLoaded }: ExcelUploadProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);

    const handleFile = async (file: File) => {
        if (!file.name.match(/\.(xlsx|xls)$/i)) {
            setError('Please upload an Excel file (.xlsx or .xls)');
            return;
        }

        setError(null);
        setIsProcessing(true);
        setFileName(file.name);

        try {
            const data = await parseDriverTreeExcel(file);
            onDataLoaded(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to parse Excel file');
            setFileName(null);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);

        const file = e.dataTransfer.files[0];
        if (file) {
            handleFile(file);
        }
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFile(file);
        }
    };

    return (
        <div className="w-full">
            <div
                className={`
                    border-2 border-dashed rounded-lg p-6 text-center transition-all
                    ${isDragging 
                        ? 'border-cyan-500 bg-cyan-50' 
                        : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                    }
                    ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
                onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
            >
                <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileInput}
                    className="hidden"
                    id="excel-upload"
                    disabled={isProcessing}
                />
                <label htmlFor="excel-upload" className="cursor-pointer">
                    <Upload className={`w-8 h-8 mx-auto mb-2 ${isDragging ? 'text-cyan-600' : 'text-gray-400'}`} />
                    <p className="text-sm font-medium text-gray-700 mb-1">
                        {isProcessing ? 'Processing...' : 'Upload Excel File'}
                    </p>
                    <p className="text-xs text-gray-500">
                        Drag and drop or click to select
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                        Required sheets: Driver Tree, Accounting Fact, Rate Fact
                    </p>
                </label>
            </div>

            {fileName && !error && (
                <div className="mt-2 flex items-center space-x-2 text-sm text-green-600">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Loaded: {fileName}</span>
                </div>
            )}

            {error && (
                <div className="mt-2 flex items-center space-x-2 text-sm text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
}

