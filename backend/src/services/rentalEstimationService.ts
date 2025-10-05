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
  async estimateRental(
    property: Property, 
    config: FinancialConfig
  ): Promise<RentalEstimate> {
    try {
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
      const fallbackEstimate = this.estimateFromFallback(property, config);
      return fallbackEstimate;

    } catch (error) {
      console.error('Error estimating rental income:', error);
      
      // Return fallback estimate on error
      return this.estimateFromFallback(property, config);
    }
  }

  /**
   * Estimate rental using HUD data
   */
  private async estimateFromHudData(property: Property): Promise<RentalEstimate> {
    try {
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

    } catch (error) {
      console.error('Error getting HUD rental estimate:', error);
      return {
        monthlyRent: 0,
        source: 'HUD',
        confidence: 'LOW',
        details: `HUD data error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Estimate rental using fallback percentage method
   */
  private estimateFromFallback(
    property: Property, 
    config: FinancialConfig
  ): RentalEstimate {
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
   * Get rental estimation statistics for multiple properties
   */
  async getRentalEstimationStats(
    properties: Property[],
    config: FinancialConfig
  ): Promise<{
    totalProperties: number;
    hudMatches: number;
    zillowEstimates: number;
    fallbackEstimates: number;
    averageRent: number;
    rentRange: { min: number; max: number };
    sourceBreakdown: Record<string, number>;
    confidenceBreakdown: Record<string, number>;
  }> {
    const estimates: RentalEstimate[] = [];
    
    for (const property of properties) {
      const estimate = await this.estimateRental(property, config);
      estimates.push(estimate);
    }

    const rents = estimates.map(e => e.monthlyRent).filter(r => r > 0);
    const sourceBreakdown = estimates.reduce((acc, e) => {
      acc[e.source] = (acc[e.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const confidenceBreakdown = estimates.reduce((acc, e) => {
      acc[e.confidence] = (acc[e.confidence] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalProperties: properties.length,
      hudMatches: sourceBreakdown['HUD'] || 0,
      zillowEstimates: sourceBreakdown['ZILLOW'] || 0,
      fallbackEstimates: sourceBreakdown['FALLBACK'] || 0,
      averageRent: rents.length > 0 ? Math.round((rents.reduce((sum, r) => sum + r, 0) / rents.length) * 100) / 100 : 0,
      rentRange: rents.length > 0 ? { min: Math.min(...rents), max: Math.max(...rents) } : { min: 0, max: 0 },
      sourceBreakdown,
      confidenceBreakdown
    };
  }

  /**
   * Validate rental estimate reasonableness
   */
  validateRentalEstimate(
    property: Property,
    estimate: RentalEstimate
  ): {
    isReasonable: boolean;
    warnings: string[];
    suggestions: string[];
  } {
    const warnings: string[] = [];
    const suggestions: string[] = [];
    
    // Check rent-to-price ratio (typical range: 0.5% - 2% monthly)
    const monthlyRentToPrice = (estimate.monthlyRent / property.price) * 100;
    
    if (monthlyRentToPrice < 0.3) {
      warnings.push(`Very low rent-to-price ratio: ${monthlyRentToPrice.toFixed(2)}% (typical range: 0.5-2%)`);
      suggestions.push('Consider reviewing rental market data or property condition');
    } else if (monthlyRentToPrice > 3) {
      warnings.push(`Very high rent-to-price ratio: ${monthlyRentToPrice.toFixed(2)}% (typical range: 0.5-2%)`);
      suggestions.push('Verify property price and rental estimate accuracy');
    }
    
    // Check rent per square foot (typical range varies by market)
    if (property.livingArea > 0) {
      const rentPerSqFt = estimate.monthlyRent / property.livingArea;
      if (rentPerSqFt < 0.5) {
        warnings.push(`Low rent per sq ft: $${rentPerSqFt.toFixed(2)}`);
      } else if (rentPerSqFt > 5) {
        warnings.push(`High rent per sq ft: $${rentPerSqFt.toFixed(2)}`);
      }
    }
    
    // Check confidence level
    if (estimate.confidence === 'LOW') {
      suggestions.push('Consider getting professional rental market analysis');
    }
    
    // Check data source reliability
    if (estimate.source === 'FALLBACK') {
      suggestions.push('Try to obtain actual rental comps for more accurate estimates');
    }
    
    const isReasonable = warnings.length === 0 && estimate.monthlyRent > 0;
    
    return {
      isReasonable,
      warnings,
      suggestions
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
    const hudDataAvailable = this.hudDataService.isHudDataAvailable();
    let hudDataStats = null;
    
    if (!hudDataAvailable) {
      try {
        await this.hudDataService.loadHudData();
        hudDataStats = this.hudDataService.getHudDataStats();
      } catch (error) {
        console.log('HUD data not available for testing');
      }
    } else {
      hudDataStats = this.hudDataService.getHudDataStats();
    }

    // Create sample properties for testing
    const testProperties: Property[] = [
      {
        zpid: 'test1',
        address: '123 Test St, Columbus, OH 43211',
        price: 150000,
        bedrooms: 3,
        bathrooms: 2,
        livingArea: 1200,
        lotAreaValue: 5000,
        lotAreaUnit: 'sqft',
        propertyType: 'SINGLE_FAMILY',
        listingStatus: 'FOR_SALE',
        latitude: 40.0,
        longitude: -83.0,
        rentZestimate: 1200,
        daysOnZillow: 30,
        detailUrl: 'test',
        has3DModel: false,
        hasVideo: false,
        hasImage: true,
        country: 'US',
        currency: 'USD'
      }
    ];

    const testConfig: FinancialConfig = {
      mortgage: {
        interestRate: 7.5,
        downPaymentPercent: 20,
        loanTermYears: 30
      },
      operatingExpenses: {
        propertyManagementPercent: 10,
        maintenancePercent: 8,
        vacancyRate: 5,
        insurancePercent: 0.5,
        propertyTaxPercent: 1.2
      },
      appreciation: {
        annualAppreciationPercent: 3,
        holdingPeriodYears: 10
      },
      rental: {
        useHudData: true,
        hudDataPath: './data/hud-rental-data.json',
        fallbackRentPercent: 0.8
      }
    };

    const testResults = [];
    for (const property of testProperties) {
      const estimate = await this.estimateRental(property, testConfig);
      const validation = this.validateRentalEstimate(property, estimate);
      testResults.push({
        property: {
          address: property.address,
          price: property.price,
          bedrooms: property.bedrooms,
          rentZestimate: property.rentZestimate
        },
        estimate,
        validation
      });
    }

    return {
      hudDataAvailable: this.hudDataService.isHudDataAvailable(),
      hudDataStats,
      testResults
    };
  }
}