# Storage Fix Summary - Environment Variable Support

## Changes Made

### 1. Updated `lib/storage.ts`

**Changes:**
- ✅ Accepts both environment variable sets:
  - `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (preferred)
  - `KV_REST_API_URL` / `KV_REST_API_TOKEN` (alternative/legacy)
- ✅ Falls back to in-memory storage in dev mode (`NODE_ENV !== "production"`) if neither is configured
- ✅ Throws clear error in production if neither is configured
- ✅ Key prefix remains unchanged: `dataset:${uploadId}`
- ✅ Error handling: Falls back to in-memory on Redis errors in dev mode

**Implementation Details:**
```typescript
// Accepts either set of env vars
const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

// Dev fallback to in-memory Map
if (!url || !token) {
    if (process.env.NODE_ENV !== 'production') {
        // Use in-memory storage with warning
    } else {
        // Throw error in production
    }
}
```

### 2. Updated `.env.example`

**Changes:**
- ✅ Documented both environment variable options
- ✅ Clarified that either set can be used
- ✅ Added note about dev mode fallback behavior

---

## Files Changed

1. **`lib/storage.ts`** - Added support for both env var sets with dev fallback
2. **`.env.example`** - Updated documentation for both env var options

---

## Test Steps

### Prerequisites
- Node.js >= 18.0.0
- Dev server running (`npm run dev`)
- Environment variables configured (see below)

### Test 1: Using KV_REST_API_URL/TOKEN (Local Dev)

1. **Set environment variables:**
   ```bash
   # In your .env.local or .env file
   KV_REST_API_URL=your_upstash_redis_url_here
   KV_REST_API_TOKEN=your_upstash_redis_token_here
   GEMINI_API_KEY=your_gemini_key_here
   ```

2. **Start dev server:**
   ```bash
   npm run dev
   ```

3. **Verify storage initialization:**
   - Check console output - should NOT show warning about in-memory storage
   - Should connect to Upstash Redis using KV_* env vars

4. **Test dataset upload:**
   - Navigate to Data Upload page
   - Upload an Excel file
   - Verify upload succeeds
   - Check console for any errors

5. **Test dataset retrieval:**
   - Navigate to Search/Dashboard page
   - Ask a question that requires the uploaded dataset
   - Verify query succeeds and returns results
   - Check that dataset is retrieved correctly

### Test 2: Using UPSTASH_REDIS_REST_URL/TOKEN (Preferred)

1. **Set environment variables:**
   ```bash
   # In your .env.local or .env file
   UPSTASH_REDIS_REST_URL=your_upstash_redis_url_here
   UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token_here
   GEMINI_API_KEY=your_gemini_key_here
   ```

2. **Follow steps 2-5 from Test 1**

### Test 3: Dev Mode Fallback (No Redis Config)

1. **Remove/comment out Redis env vars:**
   ```bash
   # KV_REST_API_URL=...
   # KV_REST_API_TOKEN=...
   # UPSTASH_REDIS_REST_URL=...
   # UPSTASH_REDIS_REST_TOKEN=...
   ```

2. **Ensure NODE_ENV is not "production":**
   ```bash
   # Default for npm run dev
   ```

3. **Start dev server:**
   ```bash
   npm run dev
   ```

4. **Verify fallback behavior:**
   - Check console output - should show warning:
     ```
     ⚠️  Upstash Redis not configured. Using in-memory storage (DEV ONLY - data will be lost on server restart).
     ```
   - Server should start successfully

5. **Test dataset upload (in-memory):**
   - Upload an Excel file
   - Should succeed (stored in memory)
   - Data will be lost on server restart

6. **Test dataset retrieval (in-memory):**
   - Query the uploaded dataset
   - Should succeed if server hasn't restarted
   - After restart, dataset will be gone

### Test 4: Production Mode (Error on Missing Config)

1. **Set NODE_ENV to production:**
   ```bash
   NODE_ENV=production npm start
   ```

2. **Remove Redis env vars** (or set invalid values)

3. **Verify error:**
   - Server should fail to start with clear error:
     ```
     Error: Upstash Redis not configured. Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL and KV_REST_API_TOKEN) environment variables.
     ```

### Test 5: API Route Integration

1. **With KV_* env vars set:**
   ```bash
   KV_REST_API_URL=your_url
   KV_REST_API_TOKEN=your_token
   ```

2. **Test `/api/ask` endpoint:**
   ```bash
   curl -X POST http://localhost:3002/api/ask \
     -H "Content-Type: application/json" \
     -d '{
       "question": "What cost center has best margin?",
       "uploadId": "your_upload_id"
     }'
   ```

3. **Verify:**
   - Request succeeds
   - Dataset is retrieved from Redis
   - Response contains expected data

---

## Verification Checklist

- ✅ Storage accepts `KV_REST_API_URL` / `KV_REST_API_TOKEN`
- ✅ Storage accepts `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
- ✅ Dev mode falls back to in-memory storage with warning
- ✅ Production mode throws error if neither is configured
- ✅ Key prefix `dataset:${uploadId}` is unchanged
- ✅ Upload functionality works with KV_* vars
- ✅ `/api/ask` endpoint works with KV_* vars
- ✅ Dataset retrieval works correctly
- ✅ Error handling works (fallback on Redis errors in dev)

---

## Expected Behavior

### Development Mode (NODE_ENV !== "production")

| Env Vars Set | Behavior |
|-------------|----------|
| `KV_REST_API_URL/TOKEN` | ✅ Uses Upstash Redis with KV vars |
| `UPSTASH_REDIS_REST_URL/TOKEN` | ✅ Uses Upstash Redis with Upstash vars |
| Neither set | ⚠️ Falls back to in-memory storage (with warning) |
| Both sets | ✅ Uses `UPSTASH_REDIS_REST_URL/TOKEN` (preferred) |

### Production Mode (NODE_ENV === "production")

| Env Vars Set | Behavior |
|-------------|----------|
| `KV_REST_API_URL/TOKEN` | ✅ Uses Upstash Redis with KV vars |
| `UPSTASH_REDIS_REST_URL/TOKEN` | ✅ Uses Upstash Redis with Upstash vars |
| Neither set | ❌ Throws error (server won't start) |
| Both sets | ✅ Uses `UPSTASH_REDIS_REST_URL/TOKEN` (preferred) |

---

## Troubleshooting

### Issue: "Upstash Redis not configured" warning in dev
**Solution:** This is expected if no env vars are set. Either:
- Set `KV_REST_API_URL/TOKEN` or `UPSTASH_REDIS_REST_URL/TOKEN`
- Or accept in-memory storage (data lost on restart)

### Issue: Server fails to start in production
**Solution:** Ensure at least one set of Redis env vars is configured:
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- OR `KV_REST_API_URL` and `KV_REST_API_TOKEN`

### Issue: Dataset not persisting
**Solution:** 
- Check that env vars are set correctly
- Verify Upstash Redis credentials are valid
- Check console for errors
- In dev mode without Redis, data is in-memory only (lost on restart)

---

## Summary

The storage system now:
- ✅ Accepts both `UPSTASH_REDIS_REST_URL/TOKEN` and `KV_REST_API_URL/TOKEN`
- ✅ Falls back to in-memory storage in dev mode
- ✅ Requires Redis in production mode
- ✅ Maintains backward compatibility with existing KV_* env vars
- ✅ Uses correct key prefix: `dataset:${uploadId}`

All upload and `/api/ask` functionality should work correctly with either set of environment variables.

