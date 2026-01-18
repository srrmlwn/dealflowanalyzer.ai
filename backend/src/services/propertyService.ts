import { RealtorApiService, RealtorApiConfig } from './realtorApiService.js';
import { DataStorageService } from './dataStorage.js';
import { Property, BuyboxConfig, ErrorRecord } from '../../../shared/dist/types';

export interface PropertyServiceConfig {
  apiKey: string;
  apiHost: string;
  rateLimit: number;
  rateWindow: number;
  dataPath: string;
}

export class PropertyService {
  private realtorApi: RealtorApiService;
  private dataStorage: DataStorageService;
  private config: PropertyServiceConfig;

  constructor(config: PropertyServiceConfig) {
    this.config = config;

    const apiConfig: RealtorApiConfig = {
      apiKey: config.apiKey,
      host: config.apiHost,
      rateLimit: config.rateLimit,
      rateWindow: config.rateWindow
    };

    this.realtorApi = new RealtorApiService(apiConfig);
    this.dataStorage = new DataStorageService(config.dataPath);
  }

  /**
   * Fetch and save properties for a buybox using Realtor.com API
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
      timestamp: string;
    };
  }> {
    const errors: ErrorRecord[] = [];
    const allProperties: Property[] = [];
    let totalApiRequests = 0;

    console.log(`Fetching properties for buybox: ${buybox.name} (using Realtor.com API)`);

    try {
      // Fetch properties for all zip codes in the buybox
      const properties = await this.realtorApi.searchPropertiesForBuybox(buybox);
      allProperties.push(...properties);
      totalApiRequests = this.realtorApi.getRequestCount();

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
        remainingRequests: this.realtorApi.getRemainingRequests(),
        timestamp: new Date().toISOString()
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
          remainingRequests: this.realtorApi.getRemainingRequests(),
          timestamp: new Date().toISOString()
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
      requestsUsed: this.realtorApi.getRequestCount(),
      remainingRequests: this.realtorApi.getRemainingRequests(),
      timeUntilReset: this.realtorApi.getTimeUntilReset()
    };
  }

  /**
   * Get the timestamp of the most recent property fetch
   */
  getLastFetchTimestamp(): string | null {
    try {
      const zipCodes = this.dataStorage.getAvailableZipCodes();
      if (zipCodes.length === 0) {
        return null;
      }

      // Check all zip codes to find the most recent timestamp
      let mostRecentTimestamp: string | null = null;
      
      for (const zipCode of zipCodes) {
        const dates = this.dataStorage.getAvailableDates(zipCode);
        if (dates.length > 0) {
          const latestDate = dates[0];
          const properties = this.loadProperties(zipCode, latestDate);
          
          if (properties && properties.length > 0) {
            // Try to read the actual file to get the timestamp
            try {
              const fs = require('fs');
              const path = require('path');
              const dateDir = path.join(this.config.dataPath, 'properties', zipCode, latestDate);
              
              if (fs.existsSync(dateDir)) {
                const files = fs.readdirSync(dateDir).filter((f: string) => f.endsWith('.json'));
                if (files.length > 0) {
                  const filePath = path.join(dateDir, files[0]);
                  const fileData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                  if (fileData.timestamp) {
                    const timestamp = fileData.timestamp;
                    if (!mostRecentTimestamp || timestamp > mostRecentTimestamp) {
                      mostRecentTimestamp = timestamp;
                    }
                  }
                }
              }
            } catch (e) {
              // Ignore errors for individual files
            }
          }
        }
      }

      return mostRecentTimestamp;
    } catch (error) {
      console.error('Error getting last fetch timestamp:', error);
      return null;
    }
  }

  /**
   * Clean up old data
   */
  cleanupOldData(daysToKeep: number = 30): void {
    this.dataStorage.cleanupOldData(daysToKeep);
  }

  /**
   * Get data path
   */
  getDataPath(): string {
    return this.config.dataPath;
  }

  /**
   * Load properties from disk for a zip code (most recent date)
   */
  loadPropertiesFromDisk(zipCode: string): Property[] {
    const availableDates = this.dataStorage.getAvailableDates(zipCode);

    if (availableDates.length === 0) {
      console.log(`No data found for zip code ${zipCode}`);
      return [];
    }

    const mostRecentDate = availableDates[0];
    console.log(`Loading properties for ${zipCode} from ${mostRecentDate}`);

    return this.dataStorage.loadProperties(zipCode, mostRecentDate) ?? [];
  }

  /**
   * Group properties by zip code extracted from address
   * Address format: "123 Main St, City, State ZIP" or "123 Main St, City, State, ZIP"
   * Handles various address formats and validates zip codes
   */
  private groupPropertiesByZipCode(properties: Property[]): Record<string, Property[]> {
    return properties.reduce<Record<string, Property[]>>((grouped, property) => {
      let zipCode = 'unknown';

      try {
        // Try to extract zip code from address
        // Common formats:
        // "123 Main St, City, State 12345"
        // "123 Main St, City, State, 12345"
        // "123 Main St, City, State ZIP 12345"
        const addressParts = property.address.split(',');
        const lastPart = addressParts[addressParts.length - 1]?.trim() || '';
        
        // Try to find 5-digit zip code
        const zipMatch = lastPart.match(/\b(\d{5})\b/);
        if (zipMatch?.[1]) {
          zipCode = zipMatch[1];
        } else {
          // Fallback: try to extract from the entire address
          const fullZipMatch = property.address.match(/\b(\d{5})\b/);
          if (fullZipMatch?.[1]) {
            zipCode = fullZipMatch[1];
          } else {
            console.warn(`Could not extract zip code from address: ${property.address}`);
          }
        }
      } catch (error) {
        console.warn(`Error extracting zip code from property ${property.zpid}:`, error);
      }

      const zipArray = grouped[zipCode] || [];
      grouped[zipCode] = zipArray;
      zipArray.push(property);
      return grouped;
    }, {});
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

    for (const property of properties) {
      const missingFields = this.getMissingFields(property);

      for (const field of missingFields) {
        missingDataFields[field] = (missingDataFields[field] ?? 0) + 1;
      }

      const hasRequiredFields = this.hasRequiredFields(property);
      if (hasRequiredFields) {
        validProperties.push(property);
      } else {
        invalidProperties.push(property);
      }
    }

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

  private hasRequiredFields(property: Property): boolean {
    return Boolean(
      property.zpid &&
      property.address &&
      property.price && property.price > 0 &&
      property.livingArea && property.livingArea > 0
    );
  }

  private getMissingFields(property: Property): string[] {
    const missing: string[] = [];

    // Required fields
    if (!property.zpid) missing.push('zpid');
    if (!property.address) missing.push('address');
    if (!property.price || property.price <= 0) missing.push('price');
    if (!property.livingArea || property.livingArea <= 0) missing.push('livingArea');

    // Optional fields
    if (!property.rentZestimate) missing.push('rentZestimate');
    if (!property.zestimate) missing.push('zestimate');
    if (!property.imgSrc) missing.push('imgSrc');

    return missing;
  }
}
