import { readFileSync, existsSync } from 'fs';
import { z } from 'zod';
import { Property } from '/Users/sriram/projects/dealflowanalyzer.ai/shared/dist/types';

// HUD Rental Data Schema
export const HudRentalDataSchema = z.object({
  zipCode: z.string(),
  bedrooms: z.number(),
  fairMarketRent: z.number(),
  year: z.number(),
  county: z.string(),
  state: z.string(),
  propertyType: z.string().optional()
});

export type HudRentalData = z.infer<typeof HudRentalDataSchema>;

export interface HudMatch {
  matched: boolean;
  hudRent?: number;
  matchCriteria?: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  hudData?: HudRentalData;
}

export class HudDataService {
  private hudData: HudRentalData[] = [];
  private hudDataLoaded: boolean = false;
  private hudDataPath: string;

  constructor(hudDataPath: string = './data/hud-rental-data.json') {
    this.hudDataPath = hudDataPath;
  }

  /**
   * Load HUD rental data from JSON file
   */
  async loadHudData(): Promise<HudRentalData[]> {
    try {
      if (this.hudDataLoaded && this.hudData.length > 0) {
        return this.hudData;
      }

      if (!existsSync(this.hudDataPath)) {
        console.warn(`HUD data file not found at ${this.hudDataPath}`);
        return [];
      }

      const fileContent = readFileSync(this.hudDataPath, 'utf-8');
      const rawData = JSON.parse(fileContent);
      
      // Validate and parse HUD data
      this.hudData = this.validateHudData(rawData);
      this.hudDataLoaded = true;
      
      console.log(`Loaded ${this.hudData.length} HUD rental records from ${this.hudDataPath}`);
      return this.hudData;
    } catch (error) {
      console.error('Error loading HUD data:', error);
      throw new Error(`Failed to load HUD data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate HUD data using Zod schema
   */
  validateHudData(rawData: any[]): HudRentalData[] {
    const validData: HudRentalData[] = [];
    const errors: string[] = [];

    if (!Array.isArray(rawData)) {
      throw new Error('HUD data must be an array');
    }

    rawData.forEach((item, index) => {
      try {
        const validatedItem = HudRentalDataSchema.parse(item);
        validData.push(validatedItem);
      } catch (error) {
        errors.push(`Row ${index + 1}: ${error instanceof Error ? error.message : 'Validation error'}`);
      }
    });

    if (errors.length > 0) {
      console.warn(`HUD data validation warnings: ${errors.length} invalid records found`);
      console.warn('First 5 errors:', errors.slice(0, 5));
    }

    return validData;
  }

  /**
   * Match property to HUD rental data
   */
  async matchPropertyToHudData(property: Property): Promise<HudMatch> {
    try {
      // Ensure HUD data is loaded
      if (!this.hudDataLoaded) {
        await this.loadHudData();
      }

      if (this.hudData.length === 0) {
        return {
          matched: false,
          confidence: 'LOW',
          matchCriteria: 'No HUD data available'
        };
      }

      // Extract zip code from property address
      const propertyZipCode = this.extractZipCodeFromAddress(property.address);
      if (!propertyZipCode) {
        return {
          matched: false,
          confidence: 'LOW',
          matchCriteria: 'Could not extract zip code from property address'
        };
      }

      // Find matches by zip code and bedrooms
      const matches = this.hudData.filter(hudItem => {
        return hudItem.zipCode === propertyZipCode && 
               hudItem.bedrooms === property.bedrooms;
      });

      if (matches.length > 0) {
        // Use the most recent year if multiple matches
        const bestMatch = matches.reduce((latest, current) => 
          current.year > latest.year ? current : latest
        );

        return {
          matched: true,
          hudRent: bestMatch.fairMarketRent,
          matchCriteria: `Exact match: ${propertyZipCode}, ${property.bedrooms} bedrooms, ${bestMatch.year}`,
          confidence: 'HIGH',
          hudData: bestMatch
        };
      }

      // Try fallback matching strategies
      return this.tryFallbackMatching(property, propertyZipCode);

    } catch (error) {
      console.error('Error matching property to HUD data:', error);
      return {
        matched: false,
        confidence: 'LOW',
        matchCriteria: `Error during matching: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Try fallback matching strategies when exact match fails
   */
  private tryFallbackMatching(property: Property, zipCode: string): HudMatch {
    // Strategy 1: Same zip code, different bedroom count
    const sameZipMatches = this.hudData.filter(hudItem => 
      hudItem.zipCode === zipCode
    );

    if (sameZipMatches.length > 0) {
      // Find closest bedroom count
      const closestMatch = sameZipMatches.reduce((closest, current) => {
        const currentDiff = Math.abs(current.bedrooms - property.bedrooms);
        const closestDiff = Math.abs(closest.bedrooms - property.bedrooms);
        return currentDiff < closestDiff ? current : closest;
      });

      // Use the most recent year for the closest bedroom match
      const bestMatch = sameZipMatches
        .filter(item => item.bedrooms === closestMatch.bedrooms)
        .reduce((latest, current) => current.year > latest.year ? current : latest);

      return {
        matched: true,
        hudRent: bestMatch.fairMarketRent,
        matchCriteria: `Fallback match: ${zipCode}, ${bestMatch.bedrooms} bedrooms (property has ${property.bedrooms}), ${bestMatch.year}`,
        confidence: 'MEDIUM',
        hudData: bestMatch
      };
    }

    // Strategy 2: Nearby zip codes (if we had geographic data)
    // For now, return no match
    return {
      matched: false,
      confidence: 'LOW',
      matchCriteria: `No HUD data found for zip code ${zipCode}`
    };
  }

  /**
   * Extract zip code from property address
   */
  private extractZipCodeFromAddress(address: string): string | null {
    // Typical format: "123 Main St, City, State ZIP"
    const addressParts = address.split(',');
    if (addressParts.length < 2) {
      return null;
    }

    const lastPart = addressParts[addressParts.length - 1]?.trim();
    if (!lastPart) {
      return null;
    }

    // Extract 5-digit zip code (optionally followed by +4)
    const zipMatch = lastPart.match(/\b(\d{5})(?:-\d{4})?\b/);
    return zipMatch ? zipMatch[1]! : null;
  }

  /**
   * Get HUD data statistics
   */
  getHudDataStats(): {
    totalRecords: number;
    uniqueZipCodes: number;
    bedroomRange: { min: number; max: number };
    yearRange: { min: number; max: number };
    averageRent: number;
  } {
    if (this.hudData.length === 0) {
      return {
        totalRecords: 0,
        uniqueZipCodes: 0,
        bedroomRange: { min: 0, max: 0 },
        yearRange: { min: 0, max: 0 },
        averageRent: 0
      };
    }

    const uniqueZipCodes = new Set(this.hudData.map(item => item.zipCode)).size;
    const bedrooms = this.hudData.map(item => item.bedrooms);
    const years = this.hudData.map(item => item.year);
    const rents = this.hudData.map(item => item.fairMarketRent);

    return {
      totalRecords: this.hudData.length,
      uniqueZipCodes,
      bedroomRange: {
        min: Math.min(...bedrooms),
        max: Math.max(...bedrooms)
      },
      yearRange: {
        min: Math.min(...years),
        max: Math.max(...years)
      },
      averageRent: Math.round((rents.reduce((sum, rent) => sum + rent, 0) / rents.length) * 100) / 100
    };
  }

  /**
   * Search HUD data by criteria
   */
  searchHudData(criteria: {
    zipCode?: string;
    bedrooms?: number;
    minRent?: number;
    maxRent?: number;
    year?: number;
  }): HudRentalData[] {
    return this.hudData.filter(item => {
      if (criteria.zipCode && item.zipCode !== criteria.zipCode) return false;
      if (criteria.bedrooms && item.bedrooms !== criteria.bedrooms) return false;
      if (criteria.minRent && item.fairMarketRent < criteria.minRent) return false;
      if (criteria.maxRent && item.fairMarketRent > criteria.maxRent) return false;
      if (criteria.year && item.year !== criteria.year) return false;
      return true;
    });
  }

  /**
   * Check if HUD data is loaded and available
   */
  isHudDataAvailable(): boolean {
    return this.hudDataLoaded && this.hudData.length > 0;
  }

  /**
   * Reload HUD data (useful for testing or data updates)
   */
  async reloadHudData(): Promise<HudRentalData[]> {
    this.hudDataLoaded = false;
    this.hudData = [];
    return this.loadHudData();
  }
}