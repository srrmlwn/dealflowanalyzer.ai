import { ZillowApiService, ZillowApiConfig } from './zillowService';
import { DataStorageService } from './dataStorage';
import { Property, BuyboxConfig, ErrorRecord } from '/Users/sriram/projects/dealflowanalyzer.ai/shared/dist/types';

export interface PropertyServiceConfig {
  apiKey: string;
  apiHost: string;
  rateLimit: number;
  rateWindow: number;
  dataPath: string;
}

export class PropertyService {
  private zillowApi: ZillowApiService;
  private dataStorage: DataStorageService;
  private config: PropertyServiceConfig;

  constructor(config: PropertyServiceConfig) {
    this.config = config;
    
    const apiConfig: ZillowApiConfig = {
      apiKey: config.apiKey,
      host: config.apiHost,
      rateLimit: config.rateLimit,
      rateWindow: config.rateWindow
    };

    this.zillowApi = new ZillowApiService(apiConfig);
    this.dataStorage = new DataStorageService(config.dataPath);
  }

  /**
   * Fetch and save properties for a buybox
   */
  async fetchAndSaveProperties(buybox: BuyboxConfig): Promise<{
    success: boolean;
    properties: Property[];
    errors: ErrorRecord[];
    stats: {
      totalProperties: number;
      zipCodesProcessed: number;
      apiRequestsUsed: number;
      remainingRequests: number;
    };
  }> {
    const errors: ErrorRecord[] = [];
    const allProperties: Property[] = [];
    let totalApiRequests = 0;

    console.log(`Fetching properties for buybox: ${buybox.name}`);

    try {
      // Fetch properties for all zip codes in the buybox
      const properties = await this.zillowApi.searchPropertiesForBuybox(buybox);
      allProperties.push(...properties);
      totalApiRequests = this.zillowApi.getRequestCount();

      // Save properties grouped by zip code
      const propertiesByZip = this.groupPropertiesByZipCode(properties);
      
      for (const [zipCode, zipProperties] of Object.entries(propertiesByZip)) {
        try {
          this.dataStorage.saveProperties(zipCode, zipProperties, buybox.name);
        } catch (error) {
          const errorRecord: ErrorRecord = {
            timestamp: new Date().toISOString(),
            errorType: 'STORAGE_ERROR',
            errorMessage: `Failed to save properties for zip code ${zipCode}`,
            errorDetails: error instanceof Error ? error.message : 'Unknown error',
            context: {
              zipCode,
              buyboxName: buybox.name,
              operation: 'save_properties'
            }
          };
          errors.push(errorRecord);
          this.dataStorage.saveError(errorRecord);
        }
      }

      const stats = {
        totalProperties: allProperties.length,
        zipCodesProcessed: Object.keys(propertiesByZip).length,
        apiRequestsUsed: totalApiRequests,
        remainingRequests: this.zillowApi.getRemainingRequests()
      };

      console.log(`Property fetch completed for buybox: ${buybox.name}`, stats);

      return {
        success: true,
        properties: allProperties,
        errors,
        stats
      };

    } catch (error) {
      const errorRecord: ErrorRecord = {
        timestamp: new Date().toISOString(),
        errorType: 'API_ERROR',
        errorMessage: `Failed to fetch properties for buybox ${buybox.name}`,
        errorDetails: error instanceof Error ? error.message : 'Unknown error',
        context: {
          buyboxName: buybox.name,
          operation: 'fetch_properties'
        }
      };
      errors.push(errorRecord);
      this.dataStorage.saveError(errorRecord);

      console.error(`Property fetch failed for buybox: ${buybox.name}`, error);

      return {
        success: false,
        properties: allProperties,
        errors,
        stats: {
          totalProperties: allProperties.length,
          zipCodesProcessed: 0,
          apiRequestsUsed: totalApiRequests,
          remainingRequests: this.zillowApi.getRemainingRequests()
        }
      };
    }
  }

  /**
   * Load properties for a specific zip code and date
   */
  loadProperties(zipCode: string, date?: string, buyboxName?: string): Property[] | null {
    return this.dataStorage.loadProperties(zipCode, date, buyboxName);
  }

  /**
   * Get all available zip codes with data
   */
  getAvailableZipCodes(): string[] {
    return this.dataStorage.getAvailableZipCodes();
  }

  /**
   * Get available dates for a zip code
   */
  getAvailableDates(zipCode: string): string[] {
    return this.dataStorage.getAvailableDates(zipCode);
  }

  /**
   * Get API usage statistics
   */
  getApiStats(): {
    requestsUsed: number;
    remainingRequests: number;
    timeUntilReset: number;
  } {
    return {
      requestsUsed: this.zillowApi.getRequestCount(),
      remainingRequests: this.zillowApi.getRemainingRequests(),
      timeUntilReset: this.zillowApi.getTimeUntilReset()
    };
  }

  /**
   * Clean up old data
   */
  cleanupOldData(daysToKeep: number = 30): void {
    this.dataStorage.cleanupOldData(daysToKeep);
  }

  /**
   * Group properties by zip code
   */
  private groupPropertiesByZipCode(properties: Property[]): Record<string, Property[]> {
    const grouped: Record<string, Property[]> = {};

    properties.forEach(property => {
      // Extract zip code from address (assuming format: "123 Main St, City, State ZIP")
      const addressParts = property.address.split(',');
      const zipCode = addressParts[addressParts.length - 1]?.trim().split(' ').pop() || 'unknown';
      
      if (!grouped[zipCode]) {
        grouped[zipCode] = [];
      }
      grouped[zipCode].push(property);
    });

    return grouped;
  }

  /**
   * Validate properties data quality
   */
  validateProperties(properties: Property[]): {
    validProperties: Property[];
    invalidProperties: Property[];
    qualityReport: {
      totalCount: number;
      validCount: number;
      invalidCount: number;
      missingDataFields: Record<string, number>;
    };
  } {
    const validProperties: Property[] = [];
    const invalidProperties: Property[] = [];
    const missingDataFields: Record<string, number> = {};

    properties.forEach(property => {
      let isValid = true;
      const missingFields: string[] = [];

      // Check required fields
      if (!property.zpid) {
        missingFields.push('zpid');
        isValid = false;
      }
      if (!property.address) {
        missingFields.push('address');
        isValid = false;
      }
      if (!property.price || property.price <= 0) {
        missingFields.push('price');
        isValid = false;
      }
      if (!property.livingArea || property.livingArea <= 0) {
        missingFields.push('livingArea');
        isValid = false;
      }

      // Track missing optional fields
      if (!property.rentZestimate) missingFields.push('rentZestimate');
      if (!property.zestimate) missingFields.push('zestimate');
      if (!property.imgSrc) missingFields.push('imgSrc');

      // Count missing fields
      missingFields.forEach(field => {
        missingDataFields[field] = (missingDataFields[field] || 0) + 1;
      });

      if (isValid) {
        validProperties.push(property);
      } else {
        invalidProperties.push(property);
      }
    });

    return {
      validProperties,
      invalidProperties,
      qualityReport: {
        totalCount: properties.length,
        validCount: validProperties.length,
        invalidCount: invalidProperties.length,
        missingDataFields
      }
    };
  }
}
