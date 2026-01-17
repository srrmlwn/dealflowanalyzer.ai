import { readFileSync, existsSync, readdirSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Property } from '../../../shared/dist/types';
import { ZillowApiService, SearchParams } from './zillowService';

export interface PriceComparisonMetrics {
  avgRecentlySoldPrice: number;
  percentAboveMarket: number;
  soldCompsCount: number;
  marketCondition: 'HOT' | 'BALANCED' | 'COLD';
  medianSoldPrice: number;
  pricePerSqFt: number;
  avgPricePerSqFt: number;
}

export interface FetchRecentlySoldOptions {
  zipCode: string;
  minPrice?: number;
  maxPrice?: number;
  daysBack?: number; // How many days back to look for sold properties
  saveToFile?: boolean;
}

export class RecentlySoldService {
  private dataPath: string;
  private cache: Map<string, Property[]>;
  private zillowService: ZillowApiService | undefined;

  constructor(dataPath: string = './data', zillowService?: ZillowApiService) {
    this.dataPath = dataPath;
    this.cache = new Map();
    this.zillowService = zillowService;
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

  async fetchRecentlySoldFromAPI(options: FetchRecentlySoldOptions): Promise<Property[]> {
    if (!this.zillowService) {
      throw new Error('ZillowApiService not configured. Cannot fetch from API.');
    }

    const { zipCode, minPrice, maxPrice, daysBack = 180, saveToFile = true } = options;
    console.log(`Fetching recently sold properties for zip code ${zipCode}...`);

    const searchParams: SearchParams = {
      location: zipCode,
      statusType: 'RecentlySold',
      minPrice,
      maxPrice,
      daysOn: String(daysBack)
    };

    const response = await this.zillowService.searchProperties(searchParams);
    const properties = response.props || [];
    console.log(`Found ${properties.length} recently sold properties in ${zipCode}`);

    if (saveToFile && properties.length > 0) {
      this.saveRecentlySoldToFile(zipCode, properties);
    }

    const cacheKey = `${zipCode}-latest`;
    this.cache.set(cacheKey, properties);

    return properties;
  }

  async fetchRecentlySoldBatch(
    zipCodes: string[],
    options: Omit<FetchRecentlySoldOptions, 'zipCode'> = {}
  ): Promise<Map<string, Property[]>> {
    const results = new Map<string, Property[]>();
    const lastIndex = zipCodes.length - 1;

    for (let i = 0; i < zipCodes.length; i++) {
      const zipCode = zipCodes[i]!;
      try {
        const properties = await this.fetchRecentlySoldFromAPI({ zipCode, ...options });
        results.set(zipCode, properties);

        if (i < lastIndex) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`Failed to fetch recently sold for ${zipCode}:`, error);
        results.set(zipCode, []);
      }
    }

    return results;
  }

  private saveRecentlySoldToFile(zipCode: string, properties: Property[]): void {
    const today = new Date().toISOString().split('T')[0]!;
    const dirPath = join(this.dataPath, 'recently-sold', zipCode, today);
    mkdirSync(dirPath, { recursive: true });

    const filePath = join(dirPath, `recently-sold-${zipCode}.json`);
    const data = {
      zipCode,
      fetchDate: today,
      count: properties.length,
      properties
    };

    writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Saved ${properties.length} recently sold properties to ${filePath}`);
  }
}
