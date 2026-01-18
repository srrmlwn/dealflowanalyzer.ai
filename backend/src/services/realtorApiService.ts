import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { Property, BuyboxConfig, PropertyType, ListingStatus } from '../../../shared/dist/types';

export interface RealtorApiConfig {
  apiKey: string;
  host: string;
  rateLimit: number;
  rateWindow: number; // in seconds
}

export interface SearchParams {
  location: string; // zip code or city, state
  statusType?: 'for_sale' | 'for_rent' | 'sold';
  homeType?: string;
  minPrice?: number;
  maxPrice?: number;
  bedsMin?: number;
  bedsMax?: number;
  bathsMin?: number;
  bathsMax?: number;
  sqftMin?: number;
  sqftMax?: number;
  limit?: number;
  offset?: number;
}

// Realtor.com API response structure
interface RealtorPropertyResult {
  property_id?: string;
  listing_id?: string;
  list_price?: number;
  list_price_min?: number;
  list_price_max?: number;
  description?: {
    beds?: number;
    beds_min?: number;
    beds_max?: number;
    baths?: number;
    baths_min?: number;
    baths_max?: number;
    sqft?: number;
    sqft_min?: number;
    sqft_max?: number;
    lot_sqft?: number;
    type?: string;
    year_built?: number;
  };
  location?: {
    address?: {
      line?: string;
      city?: string;
      state_code?: string;
      postal_code?: string;
      coordinate?: {
        lat?: number;
        lon?: number;
      };
    };
  };
  photos?: Array<{ href?: string }>;
  primary_photo?: { href?: string };
  status?: string;
  list_date?: string;
  last_update_date?: string;
  permalink?: string;
  price_reduced_amount?: number;
  estimates?: {
    estimate?: number;
  };
  rental_estimate?: {
    estimate?: number;
  };
}

interface RealtorApiResponse {
  // Documented Realtor.com API structure
  meta?: {
    returned_rows?: number;
    total_rows?: number;
    schema?: string;
    [key: string]: any;
  };
  properties?: RealtorPropertyResult[];
  // Alternative response structures (for compatibility)
  data?: {
    home_search?: {
      results?: RealtorPropertyResult[];
      total?: number;
      count?: number;
    };
    results?: RealtorPropertyResult[];
    properties?: RealtorPropertyResult[];
  };
  results?: RealtorPropertyResult[];
  listings?: RealtorPropertyResult[];
  total?: number;
  count?: number;
}

export class RealtorApiService {
  private client: AxiosInstance;
  private config: RealtorApiConfig;
  private requestCount: number = 0;
  private lastResetTime: number = Date.now();

  constructor(config: RealtorApiConfig) {
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
      (reqConfig) => {
        this.checkRateLimit();
        // Increment counter before request (will be decremented on error)
        this.requestCount++;
        return reqConfig;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        // Decrement counter on error since request didn't complete successfully
        if (this.requestCount > 0) {
          this.requestCount--;
        }
        console.error('Realtor API request failed:', error.message);
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

  /**
   * Search properties using the Realtor.com API v3
   * Uses POST /properties/v3/list endpoint with JSON body
   * Supports pagination to fetch all results
   */
  async searchProperties(params: SearchParams, fetchAllPages: boolean = false): Promise<Property[]> {
    try {
      const allProperties: Property[] = [];
      let offset = params.offset || 0;
      const limit = params.limit || 50;
      let hasMore = true;

      while (hasMore) {
        // Determine if location is a zip code or city/state
        const isZipCode = /^\d{5}$/.test(params.location.trim());

        // Build request body for v3 API (POST with JSON)
        const requestBody: Record<string, any> = {
          limit,
          offset,
          sort: {
            direction: 'desc',
            field: 'list_date'
          }
        };

        // Add location
        if (isZipCode) {
          requestBody.postal_code = params.location.trim();
        } else {
          // Assume city, state format
          const parts = params.location.split(',').map(p => p.trim());
          if (parts.length >= 2 && parts[0] && parts[1]) {
            requestBody.city = parts[0];
            requestBody.state_code = parts[1];
          } else if (parts[0]) {
            requestBody.city = parts[0];
          }
        }

        // Add status - v3 API uses an array
        if (params.statusType) {
          requestBody.status = [params.statusType];
        } else {
          // Default to for_sale if not specified
          requestBody.status = ['for_sale'];
        }

        // Add home type if provided
        if (params.homeType) {
          requestBody.home_type = params.homeType;
        }

        // Add price filters (v3 uses nested objects)
        if (params.minPrice !== undefined || params.maxPrice !== undefined) {
          requestBody.price = {};
          if (params.minPrice !== undefined) {
            requestBody.price.min = params.minPrice;
          }
          if (params.maxPrice !== undefined) {
            requestBody.price.max = params.maxPrice;
          }
        }

        // Add bedroom filters
        if (params.bedsMin !== undefined || params.bedsMax !== undefined) {
          requestBody.beds = {};
          if (params.bedsMin !== undefined) {
            requestBody.beds.min = params.bedsMin;
          }
          if (params.bedsMax !== undefined) {
            requestBody.beds.max = params.bedsMax;
          }
        }

        // Add bathroom filters
        if (params.bathsMin !== undefined || params.bathsMax !== undefined) {
          requestBody.baths = {};
          if (params.bathsMin !== undefined) {
            requestBody.baths.min = params.bathsMin;
          }
          if (params.bathsMax !== undefined) {
            requestBody.baths.max = params.bathsMax;
          }
        }

        // Add sqft filters
        if (params.sqftMin !== undefined || params.sqftMax !== undefined) {
          requestBody.sqft = {};
          if (params.sqftMin !== undefined) {
            requestBody.sqft.min = params.sqftMin;
          }
          if (params.sqftMax !== undefined) {
            requestBody.sqft.max = params.sqftMax;
          }
        }

        console.log(`Searching Realtor API v3 with body:`, JSON.stringify(requestBody, null, 2));
        console.log(`Full URL: https://${this.config.host}/properties/v3/list`);

        const response: AxiosResponse<RealtorApiResponse> = await this.client.post(
          '/properties/v3/list',
          requestBody
        );

        // Debug: Log response structure (only in verbose mode or on first request)
        if (offset === 0) {
          console.log('=== API RESPONSE DEBUG ===');
          console.log('Response status:', response.status);
          console.log('Response data keys:', Object.keys(response.data || {}));
          console.log('Response preview:', JSON.stringify(response.data, null, 2).substring(0, 1000));
          console.log('=== END DEBUG ===');
        }
        
        // Handle empty or error responses
        if (response.status === 204 || !response.data) {
          console.warn('API returned 204 No Content or empty response');
          hasMore = false;
          continue;
        }

        // Handle different response structures
        // According to Realtor.com API docs, response has 'meta' and 'properties' keys
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const responseData = response.data as any;
        
        // Try the documented structure first: { meta: {...}, properties: [...] }
        let results = responseData?.properties || [];
        
        // Fallback to other possible structures
        if (results.length === 0) {
          results = responseData?.data?.home_search?.results ||
                   responseData?.data?.results ||
                   responseData?.results ||
                   responseData?.listings ||
                   responseData?.data?.properties ||
                   [];
        }

        // Get total from meta or other locations
        const total = responseData?.meta?.returned_rows ||
                     responseData?.meta?.total_rows ||
                     responseData?.data?.home_search?.total ||
                     responseData?.data?.total ||
                     responseData?.total ||
                     responseData?.data?.home_search?.count ||
                     responseData?.data?.count ||
                     responseData?.count ||
                     results.length;

        console.log(`Realtor API returned ${results.length} properties (offset: ${offset}, total: ${total})`);
        if (results.length === 0 && responseData) {
          console.warn('No properties found. Response structure:', JSON.stringify(responseData, null, 2).substring(0, 500));
        }

        const mappedProperties = (results as RealtorPropertyResult[])
          .map(item => this.mapToProperty(item))
          .filter((p): p is Property => p !== null);

        allProperties.push(...mappedProperties);

        // Check if we should fetch more pages
        if (fetchAllPages && results.length === limit && offset + limit < total) {
          offset += limit;
          // Add a small delay between paginated requests
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          hasMore = false;
        }
      }

      console.log(`Total properties fetched: ${allProperties.length}`);
      return allProperties;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }
        if (error.response?.status === 401 || error.response?.status === 403) {
          throw new Error('Invalid API key. Please check your RapidAPI credentials.');
        }
        console.error('API Error Details:', error.response?.data);
        throw new Error(`API request failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Map Realtor API response to our Property type
   */
  private mapToProperty(data: RealtorPropertyResult): Property | null {
    try {
      const propertyId = data.property_id || data.listing_id || '';
      if (!propertyId) {
        console.warn('Property missing ID, skipping:', JSON.stringify(data).substring(0, 200));
        return null;
      }

      // Build address - handle missing location gracefully
      const addr = data.location?.address;
      if (!addr) {
        console.warn(`Property ${propertyId} missing location data`);
        return null;
      }

      const addressParts = [
        addr.line,
        addr.city,
        addr.state_code,
        addr.postal_code
      ].filter(Boolean);

      if (addressParts.length === 0) {
        console.warn(`Property ${propertyId} has no address information`);
        return null;
      }

      const address = addressParts.join(', ');

      const price = data.list_price || data.list_price_min || data.list_price_max || 0;
      if (price <= 0) {
        console.warn(`Property ${propertyId} has invalid price: ${price}`);
        return null;
      }

      const desc = data.description || {};

      // Map property type
      const typeStr = (desc?.type || 'single_family').toLowerCase();
      const propertyTypeMap: Record<string, PropertyType> = {
        'single_family': 'SINGLE_FAMILY',
        'single-family': 'SINGLE_FAMILY',
        'condo': 'CONDO',
        'condos': 'CONDO',
        'condominium': 'CONDO',
        'townhouse': 'TOWNHOUSE',
        'townhomes': 'TOWNHOUSE',
        'town-home': 'TOWNHOUSE',
        'multi_family': 'MULTI_FAMILY',
        'multi-family': 'MULTI_FAMILY',
        'apartment': 'APARTMENT',
        'mobile': 'MANUFACTURED',
        'manufactured': 'MANUFACTURED',
        'land': 'LAND',
        'lot': 'LOT',
      };
      const propertyType: PropertyType = propertyTypeMap[typeStr] || 'SINGLE_FAMILY';

      // Map listing status
      const statusStr = (data.status || 'for_sale').toLowerCase();
      const statusMap: Record<string, ListingStatus> = {
        'for_sale': 'FOR_SALE',
        'for_rent': 'FOR_RENT',
        'sold': 'RECENTLY_SOLD',
        'pending': 'FOR_SALE',
        'off_market': 'RECENTLY_SOLD',
        'coming_soon': 'COMING_SOON',
      };
      const listingStatus: ListingStatus = statusMap[statusStr] || 'FOR_SALE';

      // Calculate days on market (ensure non-negative)
      let daysOnMarket = 0;
      if (data.list_date) {
        try {
          const listDate = new Date(data.list_date);
          const now = new Date();
          const diff = Math.floor((now.getTime() - listDate.getTime()) / (1000 * 60 * 60 * 24));
          daysOnMarket = Math.max(0, diff); // Ensure non-negative
        } catch (e) {
          console.warn(`Invalid list_date for property ${propertyId}: ${data.list_date}`);
        }
      }

      // Get photo
      const imgSrc = data.primary_photo?.href || data.photos?.[0]?.href || '';

      // Build detail URL - handle different permalink formats
      let detailUrl = '';
      if (data.permalink) {
        if (data.permalink.startsWith('http')) {
          detailUrl = data.permalink;
        } else {
          detailUrl = `https://www.realtor.com/realestateandhomes-detail/${data.permalink}`;
        }
      }

      const property: Property = {
        zpid: propertyId,
        address,
        price,
        bedrooms: desc?.beds || desc?.beds_min || 0,
        bathrooms: desc?.baths || desc?.baths_min || 0,
        livingArea: desc?.sqft || desc?.sqft_min || 0,
        lotAreaValue: desc?.lot_sqft || 0,
        lotAreaUnit: 'sqft',
        propertyType,
        listingStatus,
        latitude: addr?.coordinate?.lat || 0,
        longitude: addr?.coordinate?.lon || 0,
        imgSrc,
        rentZestimate: data.rental_estimate?.estimate,
        zestimate: data.estimates?.estimate,
        priceChange: data.price_reduced_amount ? -Math.abs(data.price_reduced_amount) : undefined,
        daysOnZillow: daysOnMarket,
        detailUrl,
        has3DModel: false,
        hasVideo: false,
        hasImage: Boolean(imgSrc),
        country: 'United States',
        currency: 'USD',
      };

      return property;

    } catch (error) {
      console.error('Error mapping property:', error, 'Data:', JSON.stringify(data).substring(0, 200));
      return null;
    }
  }

  /**
   * Search properties for a buybox configuration
   */
  async searchPropertiesForBuybox(buybox: BuyboxConfig): Promise<Property[]> {
    const allProperties: Property[] = [];

    console.log(`Fetching properties for buybox: ${buybox.name}`);

    try {
      for (const zipCode of buybox.zipCodes) {
        console.log(`Searching zip code: ${zipCode}`);

        const searchParams: SearchParams = {
          location: zipCode,
          // Note: statusType 'for_sale' is optional since endpoint is /list-for-sale
          // Try without it first, API might not need it
          // statusType: 'for_sale',
          limit: 200, // Max results per request
        };

        // Add optional parameters only if they have values
        if (buybox.priceRange?.min !== undefined) searchParams.minPrice = buybox.priceRange.min;
        if (buybox.priceRange?.max !== undefined) searchParams.maxPrice = buybox.priceRange.max;
        if (buybox.bedrooms?.min !== undefined) searchParams.bedsMin = buybox.bedrooms.min;
        if (buybox.bedrooms?.max !== undefined) searchParams.bedsMax = buybox.bedrooms.max;
        if (buybox.bathrooms?.min !== undefined) searchParams.bathsMin = buybox.bathrooms.min;
        if (buybox.bathrooms?.max !== undefined) searchParams.bathsMax = buybox.bathrooms.max;
        if (buybox.squareFeet?.min !== undefined) searchParams.sqftMin = buybox.squareFeet.min;
        if (buybox.squareFeet?.max !== undefined) searchParams.sqftMax = buybox.squareFeet.max;

        try {
          // Fetch all pages for each zip code
          const properties = await this.searchProperties(searchParams, true);
          allProperties.push(...properties);

          // Add a small delay between zip code requests to be respectful
          if (buybox.zipCodes.indexOf(zipCode) < buybox.zipCodes.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          console.error(`Error fetching zip code ${zipCode}:`, error);
          // Continue with other zip codes
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
