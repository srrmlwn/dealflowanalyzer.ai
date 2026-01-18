import { chromium, Browser, BrowserContext, Page } from 'playwright';

export interface ScraperConfig {
  enabled: boolean;
  headless: boolean;
  minDelayMs: number;
  maxDelayMs: number;
  userAgentRotation: boolean;
  maxRetries: number;
  timeout: number;
  viewport: {
    width: number;
    height: number;
  };
}

// Common user agents for rotation
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
];

export class ScraperBrowser {
  private browser: Browser | null = null;
  private config: ScraperConfig;

  constructor(config: ScraperConfig) {
    this.config = config;
  }

  /**
   * Initialize the browser instance
   */
  async initialize(): Promise<void> {
    if (this.browser) {
      return;
    }

    console.log('Initializing Playwright browser...');

    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--window-position=0,0',
        '--ignore-certificate-errors',
        '--ignore-certificate-errors-spki-list',
      ],
    });

    console.log('Browser initialized successfully');
  }

  /**
   * Get a random user agent
   */
  getRandomUserAgent(): string {
    const index = Math.floor(Math.random() * USER_AGENTS.length);
    return USER_AGENTS[index] ?? USER_AGENTS[0]!;
  }

  /**
   * Create a new browser context with stealth settings
   */
  async createContext(): Promise<BrowserContext> {
    if (!this.browser) {
      await this.initialize();
    }

    const userAgent: string = this.config.userAgentRotation
      ? this.getRandomUserAgent()
      : USER_AGENTS[0]!;

    const context = await this.browser!.newContext({
      userAgent,
      viewport: this.config.viewport,
      locale: 'en-US',
      timezoneId: 'America/New_York',
      geolocation: { longitude: -82.9988, latitude: 39.9612 }, // Columbus, OH
      permissions: ['geolocation'],
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"macOS"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    // Add stealth scripts to evade detection
    // Note: This script runs in the browser context, not Node.js
    await context.addInitScript(`
      // Override navigator.webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Override chrome property
      Object.defineProperty(window, 'chrome', {
        get: () => ({
          runtime: {},
          loadTimes: () => ({}),
          csi: () => ({}),
          app: {},
        }),
      });

      // Override permissions
      const originalQuery = window.navigator.permissions.query.bind(window.navigator.permissions);
      window.navigator.permissions.query = (parameters) =>
        parameters.name === 'notifications'
          ? Promise.resolve({ state: 'denied' })
          : originalQuery(parameters);

      // Override plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
    `);

    return context;
  }

  /**
   * Create a new page with stealth settings
   */
  async createPage(): Promise<{ page: Page; context: BrowserContext }> {
    const context = await this.createContext();
    const page = await context.newPage();

    // Set default timeout
    page.setDefaultTimeout(this.config.timeout);
    page.setDefaultNavigationTimeout(this.config.timeout);

    return { page, context };
  }

  /**
   * Add random delay between requests
   */
  async randomDelay(): Promise<void> {
    const delay = Math.floor(
      Math.random() * (this.config.maxDelayMs - this.config.minDelayMs) + this.config.minDelayMs
    );
    console.log(`Waiting ${delay}ms before next request...`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Close a browser context
   */
  async closeContext(context: BrowserContext): Promise<void> {
    try {
      await context.close();
    } catch (error) {
      console.warn('Error closing browser context:', error);
    }
  }

  /**
   * Close the browser instance
   */
  async close(): Promise<void> {
    if (this.browser) {
      console.log('Closing browser...');
      await this.browser.close();
      this.browser = null;
      console.log('Browser closed');
    }
  }

  /**
   * Check if browser is initialized
   */
  isInitialized(): boolean {
    return this.browser !== null;
  }

  /**
   * Get the browser configuration
   */
  getConfig(): ScraperConfig {
    return this.config;
  }
}

/**
 * Load scraper configuration from file
 */
export function loadScraperConfig(configPath: string): ScraperConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path');

  const fullPath = path.resolve(configPath);
  const configContent = fs.readFileSync(fullPath, 'utf8');
  return JSON.parse(configContent) as ScraperConfig;
}
