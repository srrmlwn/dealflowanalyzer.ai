/**
 * Test script for the Zillow scraper
 * Run with: npx tsx scripts/testScraper.ts
 */

import { ZillowScraperService } from '../src/services/zillowScraperService.js';
import { ScraperBrowser, loadScraperConfig } from '../src/services/scraperBrowser.js';
import * as path from 'path';
import * as fs from 'fs';

async function debugScrape() {
  console.log('Debug mode: checking page content...\n');

  const scraperConfigPath = path.resolve(__dirname, '../../config/scraper.json');
  const config = loadScraperConfig(scraperConfigPath);

  // Run with headless for debugging
  const browser = new ScraperBrowser(config);
  await browser.initialize();

  const { page, context } = await browser.createPage();

  try {
    const url = 'https://www.zillow.com/columbus-oh-43211/';
    console.log('Navigating to:', url);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Wait a bit for JS to load
    await page.waitForTimeout(5000);

    // Take screenshot
    const screenshotPath = path.resolve(__dirname, '../data/debug-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log('Screenshot saved to:', screenshotPath);

    // Check for CAPTCHA or blocking
    const pageTitle = await page.title();
    console.log('Page title:', pageTitle);

    // Check for __NEXT_DATA__
    const hasNextData = await page.evaluate(`
      (() => {
        const el = document.getElementById('__NEXT_DATA__');
        return el ? el.textContent?.substring(0, 500) : 'NOT FOUND';
      })()
    `);
    console.log('__NEXT_DATA__ preview:', hasNextData);

    // Check for property cards
    const cardCount = await page.evaluate(`
      (() => {
        return document.querySelectorAll('article[data-test="property-card"]').length;
      })()
    `);
    console.log('Property cards found:', cardCount);

    // Check for any error messages
    const bodyText = await page.evaluate(`
      (() => {
        return document.body?.innerText?.substring(0, 1000) || 'No body text';
      })()
    `);
    console.log('\nPage body preview:\n', bodyText);

  } finally {
    await browser.closeContext(context);
    await browser.close();
  }
}

async function main() {
  // First run debug to see what's on the page
  await debugScrape();

  console.log('\n\n=== Running full scraper test ===\n');

  const scraperConfigPath = path.resolve(__dirname, '../../config/scraper.json');
  const scraper = new ZillowScraperService(scraperConfigPath);

  try {
    // Test with a single zip code
    const testBuybox = {
      name: 'Test Buybox',
      zipCodes: ['43211'],
      priceRange: {
        min: 0,
        max: 250000
      }
    };

    console.log('Starting scrape for:', testBuybox.name);
    console.log('Zip codes:', testBuybox.zipCodes);
    console.log('Price range:', testBuybox.priceRange);
    console.log('');

    const properties = await scraper.searchPropertiesForBuybox(testBuybox);

    console.log('\n=== RESULTS ===');
    console.log(`Total properties found: ${properties.length}`);

    if (properties.length > 0) {
      console.log('\nSample property:');
      const sample = properties[0];
      console.log(JSON.stringify(sample, null, 2));

      console.log('\nAll property addresses:');
      properties.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.address} - $${p.price.toLocaleString()}`);
      });
    }

    console.log('\n=== TEST COMPLETE ===');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

main();
