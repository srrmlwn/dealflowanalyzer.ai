import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { ZillowApiResponse, Property, BuyboxConfig } from '/Users/sriram/projects/dealflowanalyzer.ai/shared/dist/types';

export interface ZillowApiConfig {
  apiKey: string;
  host: string;
  rateLimit: number;
  rateWindow: number; // in seconds
}

export interface SearchParams {
  location: string;
  statusType?: 'ForSale' | 'ForRent' | 'RecentlySold';
  homeType?: string | undefined;
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
  bedsMin?: number | undefined;
  bedsMax?: number | undefined;
  bathsMin?: number | undefined;
  bathsMax?: number | undefined;
  sqftMin?: number | undefined;
  sqftMax?: number | undefined;
  buildYearMin?: number | undefined;
  buildYearMax?: number | undefined;
  daysOn?: string | undefined;
  page?: number | undefined;
}

export class ZillowApiService {
  private client: AxiosInstance;
  private config: ZillowApiConfig;
  private requestCount: number = 0;
  private lastResetTime: number = Date.now();

  constructor(config: ZillowApiConfig) {
    this.config = config;
    
    this.client = axios.create({
      baseURL: `https://${config.host}`,
      headers: {
        'X-RapidAPI-Key': config.apiKey,
        'X-RapidAPI-Host': config.host,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    // Add request interceptor for rate limiting
    this.client.interceptors.request.use(
      (config) => {
        this.checkRateLimit();
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        this.requestCount++;
        return response;
      },
      (error) => {
        console.error('Zillow API request failed:', error.message);
        return Promise.reject(error);
      }
    );
  }

  private checkRateLimit(): void {
    const now = Date.now();
    const timeSinceReset = now - this.lastResetTime;
    
    // Reset counter if we're past the rate window
    if (timeSinceReset >= this.config.rateWindow * 1000) {
      this.requestCount = 0;
      this.lastResetTime = now;
    }

    // Check if we've exceeded the rate limit
    if (this.requestCount >= this.config.rateLimit) {
      const waitTime = this.config.rateWindow * 1000 - timeSinceReset;
      throw new Error(`Rate limit exceeded. Wait ${Math.ceil(waitTime / 1000)} seconds before making more requests.`);
    }
  }

  async searchProperties(params: SearchParams): Promise<ZillowApiResponse> {
    try {
      const requestParams = {
        location: params.location,
        status_type: params.statusType || 'ForSale',
        home_type: params.homeType,
        minPrice: params.minPrice,
        maxPrice: params.maxPrice,
        bedsMin: params.bedsMin,
        bedsMax: params.bedsMax,
        bathsMin: params.bathsMin,
        bathsMax: params.bathsMax,
        sqftMin: params.sqftMin,
        sqftMax: params.sqftMax,
        buildYearMin: params.buildYearMin,
        buildYearMax: params.buildYearMax,
        daysOn: params.daysOn,
        page: params.page || 1
      };

      const response: AxiosResponse<ZillowApiResponse> = await this.client.get('/propertyExtendedSearch', {
        params: requestParams
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }
        if (error.response?.status === 401) {
          throw new Error('Invalid API key. Please check your RapidAPI credentials.');
        }
        throw new Error(`API request failed: ${error.message}`);
      }
      throw error;
    }
  }

  async searchPropertiesForBuybox(buybox: BuyboxConfig): Promise<Property[]> {
    const allProperties: Property[] = [];
    const zipCodes = buybox.zipCodes.join(';');
    
    const searchParams: SearchParams = {
      location: zipCodes,
      statusType: 'ForSale',
      homeType: buybox.propertyTypes?.join(','),
      minPrice: buybox.priceRange?.min,
      maxPrice: buybox.priceRange?.max,
      bedsMin: buybox.bedrooms?.min,
      bedsMax: buybox.bedrooms?.max,
      bathsMin: buybox.bathrooms?.min,
      bathsMax: buybox.bathrooms?.max,
      sqftMin: buybox.squareFeet?.min,
      sqftMax: buybox.squareFeet?.max,
      buildYearMin: buybox.yearBuilt?.min,
      buildYearMax: buybox.yearBuilt?.max,
      daysOn: buybox.daysOnMarket
    };

    try {
      let currentPage = 1;
      let hasMorePages = true;

      while (hasMorePages) {
        console.log(`Fetching page ${currentPage} for buybox: ${buybox.name}`);
        
        const response = await this.searchProperties({
          ...searchParams,
          page: currentPage
        });

        allProperties.push(...response.props);

        // Check if there are more pages
        hasMorePages = currentPage < response.totalPages;
        currentPage++;

        // Add a small delay between requests to be respectful
        if (hasMorePages) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`Fetched ${allProperties.length} properties for buybox: ${buybox.name}`);
      return allProperties;

    } catch (error) {
      console.error(`Error fetching properties for buybox ${buybox.name}:`, error);
      throw error;
    }
  }

  getRequestCount(): number {
    return this.requestCount;
  }

  getRemainingRequests(): number {
    const now = Date.now();
    const timeSinceReset = now - this.lastResetTime;
    
    if (timeSinceReset >= this.config.rateWindow * 1000) {
      return this.config.rateLimit;
    }
    
    return Math.max(0, this.config.rateLimit - this.requestCount);
  }

  getTimeUntilReset(): number {
    const now = Date.now();
    const timeSinceReset = now - this.lastResetTime;
    return Math.max(0, this.config.rateWindow * 1000 - timeSinceReset);
  }
}
