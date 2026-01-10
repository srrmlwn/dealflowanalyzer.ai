import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { Property } from '/Users/sriram/projects/dealflowanalyzer.ai/shared/dist/types';

export interface PriceComparisonMetrics {
  avgRecentlySoldPrice: number;
  percentAboveMarket: number; // Positive = overpriced, negative = underpriced
  soldCompsCount: number;
  marketCondition: 'HOT' | 'BALANCED' | 'COLD';
  medianSoldPrice: number;
  pricePerSqFt: number;
  avgPricePerSqFt: number;
}

export class RecentlySoldService {
  private dataPath: string;
  private cache: Map<string, Property[]>;

  constructor(dataPath: string = './data') {
    this.dataPath = dataPath;
    this.cache = new Map();
  }

  /**
   * Load recently sold properties from disk (no API calls)
   */
  loadRecentlySold(zipCode: string, date?: string): Property[] {
    try {
      const cacheKey = `${zipCode}-${date || 'latest'}`;

      // Check cache first
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey)!;
      }

      const recentlySoldPath = join(this.dataPath, 'recently-sold', zipCode);

      if (!existsSync(recentlySoldPath)) {
        console.log(`No recently sold data for zip code ${zipCode}`);
        return [];
      }

      // Get the most recent date if not specified
      let dateToLoad = date;
      if (!dateToLoad) {
        const dates = readdirSync(recentlySoldPath, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => dirent.name)
          .sort()
          .reverse();

        if (dates.length === 0) {
          return [];
        }

        dateToLoad = dates[0]!;
      }

      const dateDir = join(recentlySoldPath, dateToLoad);
      if (!existsSync(dateDir)) {
        return [];
      }

      // Look for any JSON file in the directory
      const files = readdirSync(dateDir).filter(f => f.endsWith('.json'));
      if (files.length === 0) {
        return [];
      }

      const filePath = join(dateDir, files[0]!);
      const data = JSON.parse(readFileSync(filePath, 'utf-8'));

      const properties = data.properties || [];

      // Cache the result
      this.cache.set(cacheKey, properties);

      console.log(`Loaded ${properties.length} recently sold properties for zip ${zipCode}`);
      return properties;
    } catch (error) {
      console.error(`Error loading recently sold data for zip ${zipCode}:`, error);
      return [];
    }
  }

  /**
   * Calculate price comparison metrics for a property
   */
  calculatePriceComparison(
    currentListing: Property,
    zipCode: string
  ): PriceComparisonMetrics | null {
    try {
      // Load recently sold properties in the same zip code
      const recentlySold = this.loadRecentlySold(zipCode);

      if (recentlySold.length === 0) {
        return null;
      }

      // Filter comparable properties (similar size, bedrooms)
      const comparables = recentlySold.filter(sold => {
        // Match bedroom count (±1)
        const bedroomMatch = Math.abs(sold.bedrooms - currentListing.bedrooms) <= 1;

        // Match size within 30%
        const sizeRatio = sold.livingArea / currentListing.livingArea;
        const sizeMatch = sizeRatio >= 0.7 && sizeRatio <= 1.3;

        return bedroomMatch && sizeMatch;
      });

      // If not enough comparables, use all recently sold in zip
      const comps = comparables.length >= 3 ? comparables : recentlySold;

      // Calculate average sold price
      const avgSoldPrice = comps.reduce((sum, p) => sum + p.price, 0) / comps.length;

      // Calculate median sold price
      const sortedPrices = comps.map(p => p.price).sort((a, b) => a - b);
      const medianSoldPrice = sortedPrices[Math.floor(sortedPrices.length / 2)] || avgSoldPrice;

      // Calculate percent above/below market
      const percentAboveMarket = ((currentListing.price - avgSoldPrice) / avgSoldPrice) * 100;

      // Determine market condition
      let marketCondition: 'HOT' | 'BALANCED' | 'COLD';
      if (percentAboveMarket > 5) {
        marketCondition = 'COLD'; // Overpriced = less likely to sell
      } else if (percentAboveMarket < -5) {
        marketCondition = 'HOT'; // Underpriced = likely to sell quickly
      } else {
        marketCondition = 'BALANCED';
      }

      // Calculate price per sqft
      const pricePerSqFt = currentListing.price / currentListing.livingArea;
      const avgPricePerSqFt = comps.reduce((sum, p) => sum + (p.price / p.livingArea), 0) / comps.length;

      return {
        avgRecentlySoldPrice: Math.round(avgSoldPrice),
        percentAboveMarket: Number(percentAboveMarket.toFixed(2)),
        soldCompsCount: comps.length,
        marketCondition,
        medianSoldPrice: Math.round(medianSoldPrice),
        pricePerSqFt: Math.round(pricePerSqFt),
        avgPricePerSqFt: Math.round(avgPricePerSqFt)
      };
    } catch (error) {
      console.error('Error calculating price comparison:', error);
      return null;
    }
  }

  /**
   * Get available zip codes with recently sold data
   */
  getAvailableZipCodes(): string[] {
    try {
      const recentlySoldPath = join(this.dataPath, 'recently-sold');

      if (!existsSync(recentlySoldPath)) {
        return [];
      }

      const zipCodes = readdirSync(recentlySoldPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .sort();

      return zipCodes;
    } catch (error) {
      console.error('Error getting available zip codes for recently sold:', error);
      return [];
    }
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}
