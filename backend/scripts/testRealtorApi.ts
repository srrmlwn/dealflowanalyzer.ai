/**
 * Test script for the Realtor.com API
 * Run with: npx tsx scripts/testRealtorApi.ts
 */

import { RealtorApiService } from '../src/services/realtorApiService.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  console.log('Testing Realtor.com API Service...\n');

  const apiKey = process.env['RAPIDAPI_KEY'];
  const apiHost = process.env['RAPIDAPI_HOST'] || 'realty-in-us.p.rapidapi.com';

  if (!apiKey) {
    console.error('ERROR: RAPIDAPI_KEY not set in .env file');
    process.exit(1);
  }

  console.log('API Host:', apiHost);
  console.log('API Key:', apiKey.substring(0, 10) + '...');

  const service = new RealtorApiService({
    apiKey,
    host: apiHost,
    rateLimit: 100,
    rateWindow: 86400
  });

  try {
    // First, test a simple search without filters to see if API works at all
    console.log('\n=== TEST 1: Simple search without filters ===');
    const simpleProperties = await service.searchProperties({
      location: '43211',
      limit: 10
    });
    console.log(`Simple search returned: ${simpleProperties.length} properties\n`);

    // Test with a single zip code and price range
    console.log('=== TEST 2: Search with price filters ===');
    const testBuybox = {
      name: 'Test Buybox',
      zipCodes: ['43211'],
      priceRange: {
        min: 0,
        max: 250000
      }
    };

    console.log('Starting API test for:', testBuybox.name);
    console.log('Zip codes:', testBuybox.zipCodes);
    console.log('Price range:', testBuybox.priceRange);
    console.log('');

    const properties = await service.searchPropertiesForBuybox(testBuybox);

    console.log('\n=== RESULTS ===');
    console.log(`Total properties found: ${properties.length}`);

    if (properties.length > 0) {
      console.log('\nSample property:');
      const sample = properties[0];
      console.log(JSON.stringify(sample, null, 2));

      console.log('\nAll property addresses:');
      properties.slice(0, 10).forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.address} - $${p.price.toLocaleString()}`);
      });

      if (properties.length > 10) {
        console.log(`  ... and ${properties.length - 10} more`);
      }
    }

    console.log('\n=== API Stats ===');
    console.log(`Requests used: ${service.getRequestCount()}`);
    console.log(`Remaining requests: ${service.getRemainingRequests()}`);

    console.log('\n=== TEST COMPLETE ===');

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

main();
