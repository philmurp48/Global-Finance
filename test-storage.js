/**
 * Quick test script to verify storage connection
 * Run with: node test-storage.js
 * 
 * Make sure your .env.local or .env file has:
 * KV_REST_API_URL=https://rapid-vulture-54099.upstash.io
 * KV_REST_API_TOKEN=AdNTAAIncDJiNTA3ZDU4MTg4MzM0ZDMwOTFlZWY5ZWEzNzlmNTViZXAyNTQwOTk
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const { Redis } = require('@upstash/redis');

async function testStorage() {
    console.log('Testing Upstash Redis connection...\n');
    
    // Check env vars
    const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
    
    console.log('Environment variables:');
    console.log(`  URL: ${url ? '✅ Set' : '❌ Missing'}`);
    console.log(`  Token: ${token ? '✅ Set' : '❌ Missing'}`);
    console.log(`  Using: ${process.env.KV_REST_API_URL ? 'KV_REST_API_*' : process.env.UPSTASH_REDIS_REST_URL ? 'UPSTASH_REDIS_REST_*' : 'None'}\n`);
    
    if (!url || !token) {
        console.error('❌ Missing required environment variables!');
        console.error('Please set either:');
        console.error('  - UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN');
        console.error('  - OR KV_REST_API_URL and KV_REST_API_TOKEN');
        process.exit(1);
    }
    
    try {
        // Initialize Redis client
        const redis = new Redis({
            url,
            token,
        });
        
        console.log('Testing connection...');
        
        // Test write
        const testKey = `test:${Date.now()}`;
        const testValue = { message: 'Hello from Global Finance!', timestamp: new Date().toISOString() };
        
        await redis.set(testKey, JSON.stringify(testValue));
        console.log('✅ Write successful');
        
        // Test read
        const retrieved = await redis.get(testKey);
        const parsed = JSON.parse(retrieved);
        console.log('✅ Read successful');
        console.log(`  Retrieved: ${JSON.stringify(parsed)}`);
        
        // Test dataset key format
        const datasetKey = 'dataset:test_upload_123';
        const datasetValue = {
            uploadId: 'test_upload_123',
            data: { factMarginRecords: [] },
            uploadedAt: new Date().toISOString()
        };
        
        await redis.set(datasetKey, JSON.stringify(datasetValue));
        console.log('✅ Dataset key format test successful');
        
        const retrievedDataset = await redis.get(datasetKey);
        const parsedDataset = JSON.parse(retrievedDataset);
        console.log('✅ Dataset retrieval test successful');
        console.log(`  Upload ID: ${parsedDataset.uploadId}`);
        
        // Cleanup test keys
        await redis.del(testKey);
        await redis.del(datasetKey);
        console.log('✅ Cleanup successful');
        
        console.log('\n✅ All tests passed! Storage is working correctly.');
        console.log('You can now use the app with these credentials.');
        
    } catch (error) {
        console.error('\n❌ Connection test failed:');
        console.error(error.message);
        console.error('\nPlease verify:');
        console.error('  1. Your Upstash Redis credentials are correct');
        console.error('  2. Your Upstash Redis instance is active');
        console.error('  3. Network connectivity to Upstash');
        process.exit(1);
    }
}

testStorage().catch(console.error);

