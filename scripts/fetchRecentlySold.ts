import * as dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';
import { ZillowApiService } from '../backend/src/services/zillowService';
import { RecentlySoldService } from '../backend/src/services/recentlySoldService';
import { BuyboxConfig } from '../shared/dist/types';

dotenv.config();

const DEFAULT_API_HOST = 'zillow56.p.rapidapi.com';
const DAYS_BACK = 180;

async function fetchRecentlySoldData(): Promise<void> {
  console.log('=== Fetching Recently Sold Properties ===\n');

  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    throw new Error('RAPIDAPI_KEY not found in environment variables');
  }

  const buyboxPath = join(__dirname, '../config/buybox.json');
  const buyboxConfig: BuyboxConfig = JSON.parse(readFileSync(buyboxPath, 'utf-8'));

  console.log(`Buybox: ${buyboxConfig.name}`);
  console.log(`Zip Codes: ${buyboxConfig.zipCodes.join(', ')}`);
  console.log(`Price Range: $${buyboxConfig.priceRange?.min || 0} - $${buyboxConfig.priceRange?.max || 'unlimited'}\n`);

  const zillowService = new ZillowApiService({
    apiKey,
    host: process.env.RAPIDAPI_HOST || DEFAULT_API_HOST,
    rateLimit: 50,
    rateWindow: 60
  });

  const dataPath = join(__dirname, '../backend/data');
  const recentlySoldService = new RecentlySoldService(dataPath, zillowService);

  const startTime = Date.now();
  const results = await recentlySoldService.fetchRecentlySoldBatch(
    buyboxConfig.zipCodes,
    {
      minPrice: buyboxConfig.priceRange?.min,
      maxPrice: buyboxConfig.priceRange?.max,
      daysBack: DAYS_BACK,
      saveToFile: true
    }
  );

  let totalFetched = 0;
  console.log('\n=== Fetch Summary ===');
  for (const [zipCode, properties] of results) {
    console.log(`${zipCode}: ${properties.length} recently sold properties`);
    totalFetched += properties.length;
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\nTotal: ${totalFetched} recently sold properties`);
  console.log(`Duration: ${duration}s`);
  console.log(`API Requests Used: ${zillowService.getRequestCount()}`);
  console.log(`\nData saved to: backend/data/recently-sold/{zipCode}/{date}/`);
}

if (require.main === module) {
  fetchRecentlySoldData()
    .then(() => {
      console.log('\nRecently sold data fetch complete.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nFailed to fetch recently sold data:', error);
      process.exit(1);
    });
}

export { fetchRecentlySoldData };
