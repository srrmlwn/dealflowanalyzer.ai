import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { Property } from '/Users/sriram/projects/dealflowanalyzer.ai/shared/dist/types';

export interface PriceComparisonMetrics {
  avgRecentlySoldPrice: number;
  percentAboveMarket: number;
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

  loadRecentlySold(zipCode: string, date?: string): Property[] {
    const cacheKey = `${zipCode}-${date || 'latest'}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const properties = this.loadRecentlySoldFromDisk(zipCode, date);
    this.cache.set(cacheKey, properties);

    if (properties.length > 0) {
      console.log(`Loaded ${properties.length} recently sold properties for zip ${zipCode}`);
    }

    return properties;
  }

  private loadRecentlySoldFromDisk(zipCode: string, date?: string): Property[] {
    try {
      const recentlySoldPath = join(this.dataPath, 'recently-sold', zipCode);

      if (!existsSync(recentlySoldPath)) {
        console.log(`No recently sold data for zip code ${zipCode}`);
        return [];
      }

      const dateToLoad = date || this.getMostRecentDate(recentlySoldPath);
      if (!dateToLoad) {
        return [];
      }

      const dateDir = join(recentlySoldPath, dateToLoad);
      if (!existsSync(dateDir)) {
        return [];
      }

      const jsonFiles = readdirSync(dateDir).filter(f => f.endsWith('.json'));
      if (jsonFiles.length === 0) {
        return [];
      }

      const firstFile = jsonFiles[0];
      if (!firstFile) {
        return [];
      }

      const filePath = join(dateDir, firstFile);
      const data = JSON.parse(readFileSync(filePath, 'utf-8'));

      return data.properties || [];
    } catch (error) {
      console.error(`Error loading recently sold data for zip ${zipCode}:`, error);
      return [];
    }
  }

  private getMostRecentDate(directoryPath: string): string | null {
    const dates = this.getSubdirectoryNames(directoryPath).sort().reverse();
    const mostRecent = dates[0];
    return mostRecent || null;
  }

  calculatePriceComparison(
    currentListing: Property,
    zipCode: string
  ): PriceComparisonMetrics | null {
    try {
      const recentlySold = this.loadRecentlySold(zipCode);

      if (recentlySold.length === 0) {
        return null;
      }

      const comps = this.selectComparableProperties(currentListing, recentlySold);
      const avgSoldPrice = this.calculateAverage(comps.map(p => p.price));
      const medianSoldPrice = this.calculateMedian(comps.map(p => p.price));
      const percentAboveMarket = ((currentListing.price - avgSoldPrice) / avgSoldPrice) * 100;
      const marketCondition = this.determineMarketCondition(percentAboveMarket);
      const pricePerSqFt = currentListing.price / currentListing.livingArea;
      const avgPricePerSqFt = this.calculateAverage(comps.map(p => p.price / p.livingArea));

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

  private selectComparableProperties(listing: Property, soldProperties: Property[]): Property[] {
    const comparables = soldProperties.filter(sold => {
      const bedroomMatch = Math.abs(sold.bedrooms - listing.bedrooms) <= 1;
      const sizeRatio = sold.livingArea / listing.livingArea;
      const sizeMatch = sizeRatio >= 0.7 && sizeRatio <= 1.3;

      return bedroomMatch && sizeMatch;
    });

    return comparables.length >= 3 ? comparables : soldProperties;
  }

  private calculateAverage(values: number[]): number {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private calculateMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      const lower = sorted[middle - 1];
      const upper = sorted[middle];
      return (lower !== undefined && upper !== undefined) ? (lower + upper) / 2 : 0;
    }

    return sorted[middle] ?? 0;
  }

  private determineMarketCondition(percentAboveMarket: number): 'HOT' | 'BALANCED' | 'COLD' {
    if (percentAboveMarket > 5) {
      return 'COLD';
    }

    if (percentAboveMarket < -5) {
      return 'HOT';
    }

    return 'BALANCED';
  }

  getAvailableZipCodes(): string[] {
    try {
      const recentlySoldPath = join(this.dataPath, 'recently-sold');

      if (!existsSync(recentlySoldPath)) {
        return [];
      }

      return this.getSubdirectoryNames(recentlySoldPath).sort();
    } catch (error) {
      console.error('Error getting available zip codes for recently sold:', error);
      return [];
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  private getSubdirectoryNames(directoryPath: string): string[] {
    return readdirSync(directoryPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
  }
}
