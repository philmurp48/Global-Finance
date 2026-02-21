/**
 * Utility hook for making ask queries with uploadId management
 * Handles localStorage persistence and 404 error handling
 */

const STORAGE_KEY = 'globalFinanceUploadId';

export interface AskQueryOptions {
    question: string;
    uploadId?: string;
    selectedQuarter?: string;
    pageContext?: any;
}

export interface AskQueryResponse {
    summary: string;
    keyFindings: any[];
    topResults: any[];
    error?: string;
    uploadId?: string;
    message?: string;
}

/**
 * Get uploadId from localStorage or provided value
 */
export function getUploadId(providedId?: string): string | null {
    return providedId || localStorage.getItem(STORAGE_KEY);
}

/**
 * Clear stored uploadId
 */
export function clearUploadId(): void {
    localStorage.removeItem(STORAGE_KEY);
}

/**
 * Store uploadId
 */
export function setUploadId(uploadId: string): void {
    localStorage.setItem(STORAGE_KEY, uploadId);
}

/**
 * Make ask query with automatic uploadId handling
 */
export async function askQuery(options: AskQueryOptions): Promise<AskQueryResponse> {
    const { question, uploadId: providedUploadId, selectedQuarter, pageContext } = options;
    
    // Get uploadId from state or localStorage
    const uploadId = getUploadId(providedUploadId);
    
    if (!uploadId) {
        throw new Error('No uploadId available. Please upload your Excel file first.');
    }

    try {
        const response = await fetch('/api/ask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                question,
                uploadId,
                selectedQuarter,
                pageContext
            })
        });

        const data = await response.json();

        // Handle 404 DATASET_NOT_FOUND
        if (response.status === 404 && data.error === 'DATASET_NOT_FOUND') {
            // Clear stale uploadId
            clearUploadId();
            
            // Return error that UI can handle
            return {
                summary: data.message || 'Dataset not found. Please re-upload your file.',
                keyFindings: [],
                topResults: [],
                error: 'DATASET_NOT_FOUND',
                message: 'Dataset not found (server restarted or expired). Please re-upload.',
                uploadId: data.uploadId
            };
        }

        // Handle other errors
        if (!response.ok) {
            throw new Error(data.error || data.message || 'Failed to process query');
        }

        // Success - return data
        return {
            summary: data.summary || '',
            keyFindings: data.keyFindings || [],
            topResults: data.topResults || [],
            uploadId: data.uploadId || uploadId
        };

    } catch (error) {
        console.error('[useAskQuery] Error:', error);
        throw error;
    }
}

