import { Property, FinancialConfig } from '/Users/sriram/projects/dealflowanalyzer.ai/shared/dist/types';
import { HudDataService, HudMatch } from './hudDataService';

export interface RentalEstimate {
  monthlyRent: number;
  source: 'HUD' | 'ZILLOW' | 'FALLBACK';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  hudMatch?: HudMatch;
  details: string;
}

export class RentalEstimationService {
  private hudDataService: HudDataService;

  constructor(hudDataPath?: string) {
    this.hudDataService = new HudDataService(hudDataPath);
  }

  /**
   * Estimate rental income for a property using multiple data sources
   */
  async estimateRental(property: Property, config: FinancialConfig): Promise<RentalEstimate> {
    // Priority 1: Try HUD data if configured
    if (config.rental.useHudData) {
      const hudEstimate = await this.estimateFromHudData(property);
      if (hudEstimate.monthlyRent > 0) {
        return hudEstimate;
      }
    }

    // Priority 2: Use Zillow rent estimate if available
    if (property.rentZestimate && property.rentZestimate > 0) {
      return {
        monthlyRent: property.rentZestimate,
        source: 'ZILLOW',
        confidence: 'MEDIUM',
        details: `Zillow rent estimate: $${property.rentZestimate}/month`
      };
    }

    // Priority 3: Fallback to percentage of purchase price
    return this.estimateFromFallback(property, config);
  }

  /**
   * Estimate rental using HUD data
   */
  private async estimateFromHudData(property: Property): Promise<RentalEstimate> {
    const hudMatch = await this.hudDataService.matchPropertyToHudData(property);
    
    if (hudMatch.matched && hudMatch.hudRent) {
      return {
        monthlyRent: hudMatch.hudRent,
        source: 'HUD',
        confidence: hudMatch.confidence,
        hudMatch,
        details: `HUD Fair Market Rent: $${hudMatch.hudRent}/month (${hudMatch.matchCriteria})`
      };
    }

    return {
      monthlyRent: 0,
      source: 'HUD',
      confidence: 'LOW',
      hudMatch,
      details: `HUD data not available: ${hudMatch.matchCriteria || 'No match found'}`
    };
  }

  /**
   * Estimate rental using fallback percentage method
   */
  private estimateFromFallback(property: Property, config: FinancialConfig): RentalEstimate {
    const fallbackPercent = config.rental.fallbackRentPercent || 0.8;
    const monthlyRent = (property.price * (fallbackPercent / 100)) / 12;
    
    return {
      monthlyRent: Math.round(monthlyRent * 100) / 100,
      source: 'FALLBACK',
      confidence: 'LOW',
      details: `Fallback estimate: ${fallbackPercent}% of purchase price annually ($${Math.round(monthlyRent)}/month)`
    };
  }

  /**
   * Get HUD data service for direct access
   */
  getHudDataService(): HudDataService {
    return this.hudDataService;
  }

  /**
   * Test rental estimation with sample data
   */
  async testRentalEstimation(): Promise<{
    hudDataAvailable: boolean;
    hudDataStats: any;
    testResults: any[];
  }> {
    let hudDataStats = null;
    
    try {
      await this.hudDataService.loadHudData();
      hudDataStats = this.hudDataService.getHudDataStats();
    } catch (error) {
      console.log('HUD data not available for testing');
    }

    // Create sample properties for testing
    const testProperties = [
      {
        zpid: 'test1',
        address: '123 Test St, Columbus, OH 43211',
        price: 150000,
        bedrooms: 3,
        bathrooms: 2,
        livingArea: 1200,
        rentZestimate: 1200
      }
    ];

    const testConfig = {
      rental: {
        useHudData: true,
        fallbackRentPercent: 0.8
      }
    };

    const testResults = [];
    for (const property of testProperties) {
      const estimate = await this.estimateRental(property as any, testConfig as any);
      testResults.push({
        property: {
          address: property.address,
          price: property.price,
          bedrooms: property.bedrooms,
          rentZestimate: property.rentZestimate
        },
        estimate
      });
    }

    return {
      hudDataAvailable: !!hudDataStats,
      hudDataStats,
      testResults
    };
  }
}