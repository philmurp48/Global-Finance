# Dataset Persistence Fix - End-to-End Implementation

## Problem
"Dataset with ID upload_xxx not found" errors in both dev and Vercel due to:
- Upload route not persisting data before returning uploadId
- Client not storing uploadId persistently
- /api/ask not properly validating uploadId
- No clear error handling for missing datasets

## Solution Implemented

### 1. Storage Backend Consistency (`lib/storage.ts`)

**Changes:**
- ✅ Prefer `KV_REST_API_*` over `UPSTASH_REDIS_REST_*` for backward compatibility
- ✅ Added DEV-only logging:
  - Initialization: logs which backend is used (KV_REST_API vs UPSTASH_REDIS_REST vs in-memory)
  - `saveDataset`: logs uploadId, backend, key, HIT status
  - `getDataset`: logs uploadId, backend, key, HIT/MISS status
- ✅ No secrets logged - only backend type and uploadId

**Key Code:**
```typescript
// Prefer KV_REST_API_* first
const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

// DEV logging
console.log(`[STORAGE] SAVE: uploadId=${uploadId}, backend=${backend}, key=${key}, HIT`);
console.log(`[STORAGE] GET: uploadId=${uploadId}, backend=${backend}, key=${key}, ${result ? 'HIT' : 'MISS'}`);
```

### 2. Upload API Route (`app/api/upload/route.ts`)

**New File Created:**
- ✅ Accepts parsed Excel data from client
- ✅ Generates uploadId via `generateUploadId()`
- ✅ Calls `await saveDataset()` and validates success
- ✅ Returns 500 error if save fails
- ✅ Only returns uploadId in 200 response if save succeeded
- ✅ DEV-only log: `[UPLOAD] saved dataset: uploadId=..., records=..., quarters=...`

**Key Features:**
- Validates data structure before saving
- Converts Maps to JSON-serializable format
- Extracts metadata (recordCount, quarterRange, fileName)
- Returns uploadId only on successful save

### 3. /api/ask Route Updates (`app/api/ask/route.ts`)

**Changes:**
- ✅ Validates uploadId is provided (returns 400 if missing)
- ✅ Uses `getDataset()` from `lib/storage.ts` (single source of truth)
- ✅ Returns 404 with `DATASET_NOT_FOUND` error code if dataset missing
- ✅ DEV-only log: `[ASK] uploadId=..., found=true/false`

**Error Response Format:**
```json
{
  "error": "DATASET_NOT_FOUND",
  "uploadId": "upload_xxx",
  "message": "Please upload your Excel file again.",
  ...
}
```

### 4. Client-Side Updates

#### ExcelUpload Component (`components/ExcelUpload.tsx`)
- ✅ After parsing Excel, calls `/api/upload` endpoint
- ✅ Stores uploadId in localStorage: `globalFinanceUploadId`
- ✅ Updated callback signature: `onDataLoaded(data, uploadId)`
- ✅ Handles upload errors gracefully

#### Ask Query Utility (`lib/useAskQuery.ts`)
- ✅ New utility for making ask queries
- ✅ Gets uploadId from localStorage if not provided
- ✅ Handles 404 `DATASET_NOT_FOUND` responses:
  - Clears localStorage
  - Returns error message for UI display
- ✅ Functions: `getUploadId()`, `setUploadId()`, `clearUploadId()`, `askQuery()`

**Usage:**
```typescript
import { askQuery } from '@/lib/useAskQuery';

const result = await askQuery({
  question: "What cost center has best margin?",
  uploadId: state.uploadId, // Optional - falls back to localStorage
  selectedQuarter: "2025Q3"
});

if (result.error === 'DATASET_NOT_FOUND') {
  // Show toast: "Dataset not found. Please re-upload."
  // Clear UI state
}
```

### 5. TTL / Expiration

**Status:** No TTL currently applied in storage code
- Redis `set()` calls do not include `EX` (expiration) parameter
- Datasets persist indefinitely until manually deleted
- This is intentional for debugging and user experience

## Files Changed

1. **`lib/storage.ts`**
   - Added DEV logging
   - Fixed env var preference (KV_* first)
   - Added backend tracking

2. **`app/api/upload/route.ts`** (NEW)
   - Complete upload endpoint
   - Validates save success before returning uploadId

3. **`app/api/ask/route.ts`**
   - Added uploadId validation
   - Proper 404 handling with DATASET_NOT_FOUND
   - DEV logging

4. **`components/ExcelUpload.tsx`**
   - Calls upload API
   - Stores uploadId in localStorage
   - Updated callback signature

5. **`lib/useAskQuery.ts`** (NEW)
   - Utility for ask queries
   - Handles uploadId persistence
   - Handles 404 errors

## Testing Steps

### Local Development Test

#### 1. Upload File → Confirm uploadId Returned

**Steps:**
1. Start dev server: `npm run dev`
2. Navigate to Data Upload page
3. Upload an Excel file
4. Check browser console for:
   - `[UPLOAD] saved dataset: uploadId=upload_xxx, records=N, quarters=M`
5. Check localStorage: `localStorage.getItem('globalFinanceUploadId')` should return uploadId
6. Verify response includes `{ uploadId, metadata: { recordCount, quarterRange, fileName } }`

**Expected:**
- ✅ Upload succeeds
- ✅ uploadId returned in response
- ✅ uploadId stored in localStorage
- ✅ Server logs show `[STORAGE] SAVE: ... HIT`

#### 2. Ask Question → Confirm Dataset HIT

**Steps:**
1. Navigate to Search/Dashboard page
2. Ask a question (e.g., "What cost center has best margin?")
3. Check browser console for no errors
4. Check server logs for:
   - `[ASK] uploadId=upload_xxx, found=true`
   - `[STORAGE] GET: uploadId=upload_xxx, backend=KV_REST_API, key=dataset:upload_xxx, HIT`
5. Verify answer returns with data

**Expected:**
- ✅ Query succeeds
- ✅ Dataset retrieved from storage
- ✅ Answer returned with results
- ✅ Server logs show HIT

#### 3. Refresh Page → Ask Again → Still Works

**Steps:**
1. Refresh the page (F5)
2. Ask the same question again
3. Check server logs:
   - If using Redis/KV: Should still show HIT (persistent)
   - If using in-memory: Will show MISS (data lost on restart)

**Expected:**
- ✅ With Redis/KV: Still works (persistent storage)
- ✅ With in-memory: Shows MISS, prompts re-upload (expected behavior)

#### 4. Test 404 Handling

**Steps:**
1. Manually set invalid uploadId: `localStorage.setItem('globalFinanceUploadId', 'invalid_upload_123')`
2. Ask a question
3. Check response: Should return 404 with `error: "DATASET_NOT_FOUND"`
4. Check localStorage: Should be cleared
5. Verify UI shows error message

**Expected:**
- ✅ Returns 404 status
- ✅ Error object includes `DATASET_NOT_FOUND`
- ✅ localStorage cleared
- ✅ UI shows "Dataset not found. Please re-upload."

### Vercel Production Test

#### 1. Upload → Ask → Refresh → Ask Again

**Steps:**
1. Deploy to Vercel with env vars:
   - `KV_REST_API_URL` or `UPSTASH_REDIS_REST_URL`
   - `KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_TOKEN`
2. Upload Excel file
3. Ask a question → verify works
4. Refresh page (F5)
5. Ask again → should still work (Redis persistence)

**Expected:**
- ✅ Upload succeeds
- ✅ First ask works
- ✅ After refresh, ask still works (Redis persistence)
- ✅ No "Dataset not found" errors

#### 2. Verify Storage Backend

**Steps:**
1. Check Vercel function logs
2. Look for `[STORAGE] Initialized: Using KV_REST_API backend` or `UPSTASH_REDIS_REST backend`
3. Verify no in-memory fallback warnings

**Expected:**
- ✅ Uses Redis/KV backend (not in-memory)
- ✅ Logs show which backend is used

## Debugging

### Check Storage Backend

**In Dev Console:**
```javascript
// Check which backend is initialized
// Look for: [STORAGE] Initialized: Using KV_REST_API backend
```

**In Server Logs:**
```
[STORAGE] Initialized: Using KV_REST_API backend
[STORAGE] SAVE: uploadId=upload_123, backend=KV_REST_API, key=dataset:upload_123, HIT
[STORAGE] GET: uploadId=upload_123, backend=KV_REST_API, key=dataset:upload_123, HIT
```

### Check uploadId Flow

1. **After Upload:**
   - Browser: `localStorage.getItem('globalFinanceUploadId')` should return uploadId
   - Server: `[UPLOAD] saved dataset: uploadId=...`

2. **During Ask:**
   - Browser: Check network tab - request body includes `uploadId`
   - Server: `[ASK] uploadId=..., found=true/false`
   - Server: `[STORAGE] GET: ... HIT/MISS`

### Common Issues

**Issue: "Dataset not found" after upload**
- Check: Server logs show `[STORAGE] SAVE: ... HIT`
- Check: uploadId returned in upload response
- Check: localStorage has uploadId

**Issue: "Dataset not found" after refresh (with Redis)**
- Check: Redis credentials are correct
- Check: Server logs show which backend is used
- Check: Redis instance is active in Upstash console

**Issue: uploadId not persisting**
- Check: localStorage is enabled in browser
- Check: No errors in browser console
- Check: uploadId returned from upload API

## Summary

✅ **Storage:** Consistent backend with DEV logging
✅ **Upload:** Only returns uploadId if save succeeds
✅ **Ask:** Validates uploadId, proper 404 handling
✅ **Client:** Persists uploadId, handles 404s
✅ **TTL:** No expiration (datasets persist indefinitely)

The system now guarantees:
- Dataset is persisted before uploadId is returned
- uploadId is stored client-side and reused
- /api/ask uses same storage module and key scheme
- Missing datasets clear stale uploadId and prompt re-upload
- DEV logs identify HIT/MISS and backend used

