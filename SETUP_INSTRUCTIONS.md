# Setup Instructions - Storage Credentials

## Step 1: Add Credentials to .env.local

Add these lines to your `.env.local` file (create it if it doesn't exist):

```bash
# Upstash Redis Configuration (using KV_* naming)
KV_REST_API_URL=https://rapid-vulture-54099.upstash.io
KV_REST_API_TOKEN=AdNTAAIncDJiNTA3ZDU4MTg4MzM0ZDMwOTFlZWY5ZWEzNzlmNTViZXAyNTQwOTk

# Required for AI features
GEMINI_API_KEY=your_gemini_api_key_here
```

**Important:** 
- Never commit `.env.local` to git (it should be in `.gitignore`)
- These credentials are sensitive - keep them secure

## Step 2: Verify Setup

### Option A: Test with Node Script

1. Install dotenv if needed:
   ```bash
   npm install --save-dev dotenv
   ```

2. Run the test script:
   ```bash
   node test-storage.js
   ```

3. Expected output:
   ```
   ✅ Write successful
   ✅ Read successful
   ✅ Dataset key format test successful
   ✅ All tests passed! Storage is working correctly.
   ```

### Option B: Test via Dev Server

1. Start the dev server:
   ```bash
   npm run dev
   ```

2. Check console output:
   - Should NOT show warning about in-memory storage
   - Should connect to Upstash Redis successfully

3. Test upload:
   - Navigate to Data Upload page
   - Upload an Excel file
   - Should succeed without errors

4. Test query:
   - Navigate to Search/Dashboard
   - Ask a question about the uploaded data
   - Should return results

## Step 3: Verify It's Working

The storage system should now:
- ✅ Connect to Upstash Redis using your KV_* credentials
- ✅ Store datasets with key format: `dataset:${uploadId}`
- ✅ Retrieve datasets successfully
- ✅ Work with `/api/ask` endpoint

## Troubleshooting

### Issue: "Upstash Redis not configured" warning
**Solution:** 
- Check that `.env.local` exists and has the correct variable names
- Restart the dev server after adding env vars
- Verify no typos in variable names

### Issue: Connection errors
**Solution:**
- Verify credentials are correct
- Check Upstash console to ensure instance is active
- Test network connectivity

### Issue: Test script fails
**Solution:**
- Make sure `dotenv` is installed: `npm install --save-dev dotenv`
- Verify `.env.local` file is in the project root
- Check that credentials are on separate lines (no spaces around `=`)

## Security Notes

⚠️ **Never commit credentials to git:**
- `.env.local` should be in `.gitignore`
- Don't share credentials in public repositories
- Rotate credentials if accidentally exposed

