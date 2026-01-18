/**
 * Diagnostic script to identify the correct API endpoint
 * Run with: npx tsx scripts/diagnoseApi.ts
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function testEndpoint(host: string, endpoint: string, params: Record<string, any>) {
  try {
    console.log(`\nTesting: https://${host}${endpoint}`);
    console.log('Params:', params);
    
    const response = await axios.get(`https://${host}${endpoint}`, {
      params,
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!,
        'X-RapidAPI-Host': host,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log(`✅ Status: ${response.status}`);
    console.log(`Response type: ${typeof response.data}`);
    
    if (response.data) {
      console.log('Response keys:', Object.keys(response.data));
      console.log('Response preview:', JSON.stringify(response.data, null, 2).substring(0, 500));
      
      // Check for properties
      const properties = response.data.properties || 
                        response.data.data?.properties ||
                        response.data.data?.home_search?.results ||
                        response.data.results ||
                        [];
      
      if (Array.isArray(properties) && properties.length > 0) {
        console.log(`✅ SUCCESS! Found ${properties.length} properties`);
        return true;
      } else {
        console.log(`⚠️  Response received but no properties found`);
      }
    } else {
      console.log('⚠️  Empty response body');
    }
    
    return false;
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      console.log(`❌ Status: ${error.response?.status || 'Network Error'}`);
      if (error.response?.status === 204) {
        console.log('   → 204 No Content (endpoint might not exist)');
      } else if (error.response?.status === 404) {
        console.log('   → 404 Not Found (endpoint path is wrong)');
      } else if (error.response?.status === 403) {
        console.log('   → 403 Forbidden (check API key and subscription)');
      } else {
        console.log('   → Error:', error.message);
      }
    } else {
      console.log(`❌ Error: ${error.message}`);
    }
    return false;
  }
}

async function main() {
  console.log('🔍 API Endpoint Diagnostic Tool\n');
  console.log('This script will test different API hosts and endpoints to find the correct configuration.\n');

  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    console.error('ERROR: RAPIDAPI_KEY not set in .env file');
    process.exit(1);
  }

  const testParams = {
    postal_code: '43211',
    limit: 10
  };

  const endpointsToTest = [
    // Current configuration
    { host: 'realty-in-us.p.rapidapi.com', endpoint: '/properties/v2/list-for-sale' },
    
    // Standard Realtor.com API
    { host: 'realtor.p.rapidapi.com', endpoint: '/properties/v2/list-for-sale' },
    { host: 'realtor.p.rapidapi.com', endpoint: '/properties/list-for-sale' },
    
    // Alternative paths
    { host: 'realty-in-us.p.rapidapi.com', endpoint: '/properties/list-for-sale' },
    { host: 'realty-in-us.p.rapidapi.com', endpoint: '/list-for-sale' },
    { host: 'realty-in-us.p.rapidapi.com', endpoint: '/v2/list-for-sale' },
  ];

  console.log('Testing different API configurations...\n');
  console.log('='.repeat(60));

  let foundWorking = false;

  for (const config of endpointsToTest) {
    const success = await testEndpoint(config.host, config.endpoint, testParams);
    if (success) {
      foundWorking = true;
      console.log('\n' + '='.repeat(60));
      console.log('✅ FOUND WORKING CONFIGURATION!');
      console.log('='.repeat(60));
      console.log(`API Host: ${config.host}`);
      console.log(`Endpoint: ${config.endpoint}`);
      console.log('\nUpdate your .env file:');
      console.log(`RAPIDAPI_HOST=${config.host}`);
      console.log('\nAnd update the endpoint in realtorApiService.ts if needed.');
      break;
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  if (!foundWorking) {
    console.log('\n' + '='.repeat(60));
    console.log('❌ No working configuration found.');
    console.log('='.repeat(60));
    console.log('\nPossible issues:');
    console.log('1. API key is invalid or expired');
    console.log('2. API subscription doesn\'t include these endpoints');
    console.log('3. API host name is different (check RapidAPI dashboard)');
    console.log('4. Endpoint path is different (check API documentation)');
    console.log('\nNext steps:');
    console.log('1. Go to https://rapidapi.com and check your subscriptions');
    console.log('2. Find the Realtor.com API you\'re subscribed to');
    console.log('3. Check the exact API host and endpoint paths in the documentation');
    console.log('4. Update this script with the correct values and run again');
  }

  console.log('\n✅ Diagnostic complete');
}

main().catch(console.error);
