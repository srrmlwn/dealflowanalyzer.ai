import { Page, BrowserContext } from 'playwright';
import { ScraperBrowser, ScraperConfig, loadScraperConfig } from './scraperBrowser.js';
import { Property, BuyboxConfig, PropertyType, ListingStatus } from '../../../shared/dist/types';
import * as path from 'path';

export interface ScraperSearchParams {
  location: string;
  statusType?: 'ForSale' | 'ForRent' | 'RecentlySold';
  homeType?: string;
  minPrice?: number;
  maxPrice?: number;
  bedsMin?: number;
  bedsMax?: number;
  bathsMin?: number;
  bathsMax?: number;
  sqftMin?: number;
  sqftMax?: number;
  buildYearMin?: number;
  buildYearMax?: number;
  daysOn?: string;
}

interface ZillowSearchState {
  filterState: {
    sortSelection?: { value: string };
    isForSaleByAgent?: { value: boolean };
    isForSaleByOwner?: { value: boolean };
    isNewConstruction?: { value: boolean };
    isComingSoon?: { value: boolean };
    isAuction?: { value: boolean };
    isForSaleForeclosure?: { value: boolean };
    price?: { min?: number; max?: number };
    beds?: { min?: number; max?: number };
    baths?: { min?: number; max?: number };
    sqft?: { min?: number; max?: number };
    built?: { min?: number; max?: number };
    doz?: { value: string };
    hoa?: { max?: number };
    singleFamily?: { value: boolean };
    condo?: { value: boolean };
    townhouse?: { value: boolean };
    multiFamily?: { value: boolean };
    manufactured?: { value: boolean };
    land?: { value: boolean };
  };
  isMapVisible?: boolean;
  isListVisible?: boolean;
  mapZoom?: number;
  pagination?: { currentPage: number };
}

interface ZillowPropertyData {
  zpid: string | number;
  address?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  price?: number;
  unformattedPrice?: number;
  bedrooms?: number;
  beds?: number;
  bathrooms?: number;
  baths?: number;
  livingArea?: number;
  livingAreaValue?: number;
  lotAreaValue?: number;
  lotAreaUnit?: string;
  homeType?: string;
  propertyType?: string;
  homeStatus?: string;
  statusType?: string;
  latitude?: number;
  longitude?: number;
  imgSrc?: string;
  rentZestimate?: number;
  zestimate?: number;
  priceChange?: number;
  daysOnZillow?: number;
  timeOnZillow?: string;
  datePriceChanged?: number;
  detailUrl?: string;
  hdpUrl?: string;
  has3DModel?: boolean;
  hasVideo?: boolean;
  hasImage?: boolean;
  country?: string;
  currency?: string;
  listingSubType?: {
    is_FSBA?: boolean;
    is_FSBO?: boolean;
    is_openHouse?: boolean;
  };
}

export class ZillowScraperService {
  private browser: ScraperBrowser;
  private config: ScraperConfig;
  private requestCount: number = 0;

  constructor(configPath?: string) {
    const scraperConfigPath = configPath || path.resolve(process.cwd(), '../config/scraper.json');
    this.config = loadScraperConfig(scraperConfigPath);
    this.browser = new ScraperBrowser(this.config);
  }

  /**
   * Initialize the browser
   */
  async initialize(): Promise<void> {
    await this.browser.initialize();
  }

  /**
   * Close the browser
   */
  async close(): Promise<void> {
    await this.browser.close();
  }

  /**
   * Build Zillow search URL from parameters
   */
  private buildSearchUrl(params: ScraperSearchParams): string {
    const baseUrl = 'https://www.zillow.com';
    const location = params.location.replace(/\s+/g, '-').toLowerCase();

    // Build filter state object
    const filterState: ZillowSearchState['filterState'] = {
      sortSelection: { value: 'days' },
      isForSaleByAgent: { value: true },
      isForSaleByOwner: { value: true },
      isNewConstruction: { value: false },
      isComingSoon: { value: false },
      isAuction: { value: false },
      isForSaleForeclosure: { value: true },
    };

    // Add price filter
    if (params.minPrice !== undefined || params.maxPrice !== undefined) {
      filterState.price = {};
      if (params.minPrice !== undefined) filterState.price.min = params.minPrice;
      if (params.maxPrice !== undefined) filterState.price.max = params.maxPrice;
    }

    // Add bedroom filter
    if (params.bedsMin !== undefined || params.bedsMax !== undefined) {
      filterState.beds = {};
      if (params.bedsMin !== undefined) filterState.beds.min = params.bedsMin;
      if (params.bedsMax !== undefined) filterState.beds.max = params.bedsMax;
    }

    // Add bathroom filter
    if (params.bathsMin !== undefined || params.bathsMax !== undefined) {
      filterState.baths = {};
      if (params.bathsMin !== undefined) filterState.baths.min = params.bathsMin;
      if (params.bathsMax !== undefined) filterState.baths.max = params.bathsMax;
    }

    // Add sqft filter
    if (params.sqftMin !== undefined || params.sqftMax !== undefined) {
      filterState.sqft = {};
      if (params.sqftMin !== undefined) filterState.sqft.min = params.sqftMin;
      if (params.sqftMax !== undefined) filterState.sqft.max = params.sqftMax;
    }

    // Add year built filter
    if (params.buildYearMin !== undefined || params.buildYearMax !== undefined) {
      filterState.built = {};
      if (params.buildYearMin !== undefined) filterState.built.min = params.buildYearMin;
      if (params.buildYearMax !== undefined) filterState.built.max = params.buildYearMax;
    }

    // Add days on Zillow filter
    if (params.daysOn) {
      filterState.doz = { value: params.daysOn };
    }

    // Add property type filters
    if (params.homeType) {
      const types = params.homeType.split(',');
      filterState.singleFamily = { value: types.includes('SINGLE_FAMILY') };
      filterState.condo = { value: types.includes('CONDO') };
      filterState.townhouse = { value: types.includes('TOWNHOUSE') };
      filterState.multiFamily = { value: types.includes('MULTI_FAMILY') };
      filterState.manufactured = { value: types.includes('MANUFACTURED') };
      filterState.land = { value: types.includes('LOT') || types.includes('LAND') };
    }

    const searchQueryState: ZillowSearchState = {
      filterState,
      isMapVisible: true,
      isListVisible: true,
    };

    const encodedState = encodeURIComponent(JSON.stringify(searchQueryState));
    return `${baseUrl}/${location}/?searchQueryState=${encodedState}`;
  }

  /**
   * Check if page shows a CAPTCHA or access denied message
   */
  private async checkForBlocking(page: Page): Promise<{ blocked: boolean; reason?: string }> {
    const title = await page.title();

    // Check for common blocking indicators
    if (title.toLowerCase().includes('access') && title.toLowerCase().includes('denied')) {
      return { blocked: true, reason: 'Access denied - CAPTCHA or bot detection triggered' };
    }

    // Check for "Press & Hold" verification
    const bodyText = await page.evaluate(`
      (() => document.body?.innerText?.substring(0, 500) || '')()
    `) as string;

    if (bodyText.includes('Press & Hold') || bodyText.includes('confirm you are')) {
      return { blocked: true, reason: 'Human verification required (Press & Hold CAPTCHA)' };
    }

    if (bodyText.includes('blocked') || bodyText.includes('unusual traffic')) {
      return { blocked: true, reason: 'IP blocked or unusual traffic detected' };
    }

    return { blocked: false };
  }

  /**
   * Extract properties from page's embedded JSON data
   */
  private async extractPropertiesFromPage(page: Page): Promise<Property[]> {
    const properties: Property[] = [];

    try {
      // Wait for the page to load
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
        console.log('Network idle timeout, continuing with current state...');
      });

      // Check if we're blocked
      const blockStatus = await this.checkForBlocking(page);
      if (blockStatus.blocked) {
        console.error(`BLOCKED: ${blockStatus.reason}`);
        console.error('Consider: increasing delays, using proxies, or running during off-peak hours');
        return [];
      }

      // Try to find __NEXT_DATA__ script (contains all property data)
      // Using page.evaluate with string template to run code in browser context
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nextDataContent = await page.evaluate(`
        (() => {
          const nextDataScript = document.getElementById('__NEXT_DATA__');
          if (nextDataScript) {
            try {
              return JSON.parse(nextDataScript.textContent || '{}');
            } catch {
              return null;
            }
          }
          return null;
        })()
      `) as Record<string, unknown> | null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nextDataAny = nextDataContent as any;
      if (nextDataAny?.props?.pageProps?.searchPageState?.cat1?.searchResults?.listResults) {
        const listResults = nextDataAny.props.pageProps.searchPageState.cat1.searchResults.listResults as ZillowPropertyData[];
        console.log(`Found ${listResults.length} properties in __NEXT_DATA__`);

        for (const item of listResults) {
          const property = this.mapZillowDataToProperty(item);
          if (property) {
            properties.push(property);
          }
        }
      } else {
        // Fallback: Try to extract from Apollo cache or other embedded data
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const apolloState = await page.evaluate(`
          (() => {
            // Look for Apollo cache in window
            const scripts = document.querySelectorAll('script');
            for (const script of scripts) {
              const content = script.textContent || '';
              if (content.includes('listResults') && content.includes('zpid')) {
                try {
                  // Try to extract JSON from script content
                  const match = content.match(/{"props":{.*}}/);
                  if (match) {
                    return JSON.parse(match[0]);
                  }
                } catch {
                  continue;
                }
              }
            }
            return null;
          })()
        `) as Record<string, unknown> | null;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const apolloAny = apolloState as any;
        if (apolloAny?.props?.pageProps?.searchPageState?.cat1?.searchResults?.listResults) {
          const listResults = apolloAny.props.pageProps.searchPageState.cat1.searchResults.listResults as ZillowPropertyData[];
          console.log(`Found ${listResults.length} properties in script content`);

          for (const item of listResults) {
            const property = this.mapZillowDataToProperty(item);
            if (property) {
              properties.push(property);
            }
          }
        } else {
          // Last resort: Try to parse property cards from DOM
          console.log('Attempting DOM-based extraction...');
          const domProperties = await this.extractFromDOM(page);
          properties.push(...domProperties);
        }
      }
    } catch (error) {
      console.error('Error extracting properties from page:', error);
    }

    return properties;
  }

  /**
   * Fallback: Extract properties from DOM when JSON extraction fails
   */
  private async extractFromDOM(page: Page): Promise<Property[]> {
    const properties: Property[] = [];

    try {
      const propertyCards = await page.$$('article[data-test="property-card"]');
      console.log(`Found ${propertyCards.length} property cards in DOM`);

      for (const card of propertyCards) {
        try {
          const zpid = await card.getAttribute('data-test-zpid');
          if (!zpid) continue;

          const priceText = await card.$eval('[data-test="property-card-price"]', el => el.textContent).catch(() => null);
          const addressText = await card.$eval('[data-test="property-card-addr"]', el => el.textContent).catch(() => null);
          const detailsText = await card.$eval('[data-test="property-card-details"]', el => el.textContent).catch(() => null);
          const linkElement = await card.$('a[data-test="property-card-link"]');
          const href = linkElement ? await linkElement.getAttribute('href') : null;

          if (!addressText || !priceText) continue;

          // Parse price
          const priceMatch = priceText.match(/[\d,]+/);
          const price = priceMatch ? parseInt(priceMatch[0].replace(/,/g, ''), 10) : 0;

          // Parse details (e.g., "3 bd | 2 ba | 1,500 sqft")
          let bedrooms = 0;
          let bathrooms = 0;
          let livingArea = 0;

          if (detailsText) {
            const bedMatch = detailsText.match(/(\d+)\s*bd/);
            const bathMatch = detailsText.match(/(\d+)\s*ba/);
            const sqftMatch = detailsText.match(/([\d,]+)\s*sqft/);

            bedrooms = bedMatch ? parseInt(bedMatch[1], 10) : 0;
            bathrooms = bathMatch ? parseInt(bathMatch[1], 10) : 0;
            livingArea = sqftMatch ? parseInt(sqftMatch[1].replace(/,/g, ''), 10) : 0;
          }

          const property: Property = {
            zpid,
            address: addressText,
            price,
            bedrooms,
            bathrooms,
            livingArea,
            lotAreaValue: 0,
            lotAreaUnit: 'sqft',
            propertyType: 'SINGLE_FAMILY',
            listingStatus: 'FOR_SALE',
            latitude: 0,
            longitude: 0,
            daysOnZillow: 0,
            detailUrl: href ? `https://www.zillow.com${href}` : '',
            has3DModel: false,
            hasVideo: false,
            hasImage: true,
            country: 'United States',
            currency: 'USD',
          };

          properties.push(property);
        } catch (error) {
          console.warn('Error parsing property card:', error);
        }
      }
    } catch (error) {
      console.error('Error in DOM extraction:', error);
    }

    return properties;
  }

  /**
   * Map Zillow API data format to Property type
   */
  private mapZillowDataToProperty(data: ZillowPropertyData): Property | null {
    try {
      const zpid = String(data.zpid);
      if (!zpid || zpid === 'undefined') {
        return null;
      }

      // Build address from components or use full address
      let address = data.address || '';
      if (!address && data.streetAddress) {
        address = [
          data.streetAddress,
          data.city,
          data.state,
          data.zipcode,
        ]
          .filter(Boolean)
          .join(', ');
      }

      const price = data.unformattedPrice || data.price || 0;
      const bedrooms = data.beds || data.bedrooms || 0;
      const bathrooms = data.baths || data.bathrooms || 0;
      const livingArea = data.livingAreaValue || data.livingArea || 0;

      // Map property type
      const homeType = (data.homeType || data.propertyType || 'SINGLE_FAMILY').toUpperCase();
      const propertyTypeMap: Record<string, PropertyType> = {
        SINGLE_FAMILY: 'SINGLE_FAMILY',
        CONDO: 'CONDO',
        TOWNHOUSE: 'TOWNHOUSE',
        MULTI_FAMILY: 'MULTI_FAMILY',
        APARTMENT: 'APARTMENT',
        MANUFACTURED: 'MANUFACTURED',
        LOT: 'LOT',
        LAND: 'LAND',
      };
      const propertyType: PropertyType = propertyTypeMap[homeType] || 'SINGLE_FAMILY';

      // Map listing status
      const homeStatus = (data.homeStatus || data.statusType || 'FOR_SALE').toUpperCase();
      const statusMap: Record<string, ListingStatus> = {
        FOR_SALE: 'FOR_SALE',
        FOR_RENT: 'FOR_RENT',
        RECENTLY_SOLD: 'RECENTLY_SOLD',
        COMING_SOON: 'COMING_SOON',
      };
      const listingStatus: ListingStatus = statusMap[homeStatus] || 'FOR_SALE';

      // Parse days on Zillow
      let daysOnZillow = data.daysOnZillow || 0;
      if (data.timeOnZillow && typeof data.timeOnZillow === 'string') {
        const daysMatch = data.timeOnZillow.match(/(\d+)\s*day/i);
        if (daysMatch && daysMatch[1]) {
          daysOnZillow = parseInt(daysMatch[1], 10);
        }
      }

      // Build detail URL
      let detailUrl = data.detailUrl || data.hdpUrl || '';
      if (detailUrl && !detailUrl.startsWith('http')) {
        detailUrl = `https://www.zillow.com${detailUrl}`;
      }

      const property: Property = {
        zpid,
        address,
        price,
        bedrooms,
        bathrooms,
        livingArea,
        lotAreaValue: data.lotAreaValue || 0,
        lotAreaUnit: data.lotAreaUnit || 'sqft',
        propertyType,
        listingStatus,
        latitude: data.latitude || 0,
        longitude: data.longitude || 0,
        imgSrc: data.imgSrc,
        rentZestimate: data.rentZestimate,
        zestimate: data.zestimate,
        priceChange: data.priceChange,
        daysOnZillow,
        datePriceChanged: data.datePriceChanged,
        detailUrl,
        has3DModel: data.has3DModel || false,
        hasVideo: data.hasVideo || false,
        hasImage: data.hasImage ?? true,
        country: data.country || 'United States',
        currency: data.currency || 'USD',
        listingSubType: data.listingSubType,
      };

      return property;
    } catch (error) {
      console.error('Error mapping property data:', error);
      return null;
    }
  }

  /**
   * Search properties with given parameters
   */
  async searchProperties(params: ScraperSearchParams): Promise<Property[]> {
    let context: BrowserContext | null = null;

    try {
      const url = this.buildSearchUrl(params);
      console.log(`Scraping URL: ${url}`);

      const result = await this.browser.createPage();
      context = result.context;
      const page = result.page;

      // Navigate to the search page
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      this.requestCount++;

      // Wait for content to load
      await page.waitForSelector('article[data-test="property-card"], #__NEXT_DATA__', {
        timeout: 15000,
      }).catch(() => {
        console.log('Selector timeout, attempting extraction anyway...');
      });

      // Extract properties
      const properties = await this.extractPropertiesFromPage(page);
      console.log(`Extracted ${properties.length} properties from ${params.location}`);

      return properties;
    } catch (error) {
      console.error(`Error scraping properties for ${params.location}:`, error);
      throw error;
    } finally {
      if (context) {
        await this.browser.closeContext(context);
      }
    }
  }

  /**
   * Search properties for a buybox configuration
   */
  async searchPropertiesForBuybox(buybox: BuyboxConfig): Promise<Property[]> {
    const allProperties: Property[] = [];

    console.log(`Starting scrape for buybox: ${buybox.name}`);
    console.log(`Zip codes: ${buybox.zipCodes.join(', ')}`);

    // Initialize browser before starting
    await this.initialize();

    try {
      for (const zipCode of buybox.zipCodes) {
        console.log(`\nScraping zip code: ${zipCode}`);

        const searchParams: ScraperSearchParams = {
          location: zipCode,
          statusType: 'ForSale',
        };

        // Add optional parameters only if they have values
        const homeType = buybox.propertyTypes?.join(',');
        if (homeType) searchParams.homeType = homeType;
        if (buybox.priceRange?.min !== undefined) searchParams.minPrice = buybox.priceRange.min;
        if (buybox.priceRange?.max !== undefined) searchParams.maxPrice = buybox.priceRange.max;
        if (buybox.bedrooms?.min !== undefined) searchParams.bedsMin = buybox.bedrooms.min;
        if (buybox.bedrooms?.max !== undefined) searchParams.bedsMax = buybox.bedrooms.max;
        if (buybox.bathrooms?.min !== undefined) searchParams.bathsMin = buybox.bathrooms.min;
        if (buybox.bathrooms?.max !== undefined) searchParams.bathsMax = buybox.bathrooms.max;
        if (buybox.squareFeet?.min !== undefined) searchParams.sqftMin = buybox.squareFeet.min;
        if (buybox.squareFeet?.max !== undefined) searchParams.sqftMax = buybox.squareFeet.max;
        if (buybox.yearBuilt?.min !== undefined) searchParams.buildYearMin = buybox.yearBuilt.min;
        if (buybox.yearBuilt?.max !== undefined) searchParams.buildYearMax = buybox.yearBuilt.max;
        if (buybox.daysOnMarket) searchParams.daysOn = buybox.daysOnMarket;

        try {
          const properties = await this.searchProperties(searchParams);
          allProperties.push(...properties);

          // Add delay between zip code requests
          if (buybox.zipCodes.indexOf(zipCode) < buybox.zipCodes.length - 1) {
            await this.browser.randomDelay();
          }
        } catch (error) {
          console.error(`Error scraping zip code ${zipCode}:`, error);
          // Continue with other zip codes
        }
      }

      console.log(`\nCompleted scrape for buybox: ${buybox.name}`);
      console.log(`Total properties found: ${allProperties.length}`);

      return allProperties;
    } finally {
      await this.close();
    }
  }

  /**
   * Get request count
   */
  getRequestCount(): number {
    return this.requestCount;
  }

  /**
   * Check if scraper is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get scraper configuration
   */
  getConfig(): ScraperConfig {
    return this.config;
  }
}
