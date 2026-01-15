import * as cron from 'node-cron';
import { PropertyService, PropertyServiceConfig } from './propertyService.js';
import { RecentlySoldService, FetchRecentlySoldOptions } from './recentlySoldService.js';
import { FinancialAnalysisService } from './financialAnalysisService.js';
import { AnalysisStorageService } from './analysisStorageService.js';
import { ZillowApiService } from './zillowService.js';
import { config } from '../config/config.js';

export interface SchedulerConfig {
  cronSchedule: string;
  enabled: boolean;
  timezone: string;
}

const SEPARATOR = '='.repeat(60);

function logSection(title: string): void {
  console.log(`\n${SEPARATOR}`);
  console.log(title);
  console.log(`${SEPARATOR}\n`);
}

export class DataCollectionScheduler {
  private propertyService: PropertyService;
  private recentlySoldService: RecentlySoldService;
  private financialAnalysisService: FinancialAnalysisService;
  private analysisStorageService: AnalysisStorageService;
  private zillowService: ZillowApiService;
  private schedulerConfig: SchedulerConfig;
  private task: cron.ScheduledTask | null = null;

  constructor(propertyServiceConfig: PropertyServiceConfig, schedulerConfig: SchedulerConfig) {
    this.propertyService = new PropertyService(propertyServiceConfig);

    this.zillowService = new ZillowApiService({
      apiKey: propertyServiceConfig.apiKey,
      host: propertyServiceConfig.apiHost,
      rateLimit: propertyServiceConfig.rateLimit,
      rateWindow: propertyServiceConfig.rateWindow
    });

    this.recentlySoldService = new RecentlySoldService(
      propertyServiceConfig.dataPath,
      this.zillowService
    );

    const hudDataPath = './data/hud-rental-data.json';
    this.financialAnalysisService = new FinancialAnalysisService(
      hudDataPath,
      propertyServiceConfig.dataPath
    );

    this.analysisStorageService = new AnalysisStorageService(
      propertyServiceConfig.dataPath
    );

    this.schedulerConfig = schedulerConfig;
  }

  /**
   * Start the scheduled data collection
   */
  start(): void {
    if (!this.schedulerConfig.enabled) {
      console.log('Data collection scheduler is disabled');
      return;
    }

    if (this.task) {
      console.log('Scheduler is already running');
      return;
    }

    console.log(`Starting data collection scheduler with cron: ${this.schedulerConfig.cronSchedule}`);
    
    this.task = cron.schedule(this.schedulerConfig.cronSchedule, async () => {
      await this.runDataCollection();
    }, {
      scheduled: true,
      timezone: this.schedulerConfig.timezone
    });

    console.log('Data collection scheduler started successfully');
  }

  /**
   * Stop the scheduled data collection
   */
  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.log('Data collection scheduler stopped');
    }
  }

  /**
   * Run data collection manually - Complete pipeline
   */
  async runDataCollection(): Promise<void> {
    const startTime = Date.now();
    logSection(`Starting complete data pipeline at ${new Date(startTime).toISOString()}`);

    try {
      const buyboxConfig = config.getBuyboxConfig();
      const financialConfig = config.getFinancialConfig();

      if (!process.env['RAPIDAPI_KEY']) {
        console.error('RAPIDAPI_KEY not configured. Skipping data collection.');
        return;
      }

      const apiStats = this.propertyService.getApiStats();
      if (apiStats.remainingRequests <= 0) {
        console.log(`No API requests remaining. Next reset in ${Math.ceil(apiStats.timeUntilReset / 1000)} seconds.`);
        return;
      }
      console.log(`API requests remaining: ${apiStats.remainingRequests}\n`);

      // STEP 1: Fetch current listings
      const listingsResult = await this.fetchListings(buyboxConfig);
      if (!listingsResult) return;

      // STEP 2: Fetch recently sold data
      await this.fetchRecentlySold(buyboxConfig);

      // STEP 3: Run financial analysis
      const analysisStats = await this.runAnalysis(buyboxConfig, financialConfig);

      // Final summary
      this.logPipelineSummary(startTime, listingsResult.stats, analysisStats);

      // Clean up old data (keep last 30 days)
      console.log(`\nCleaning up old data (keeping last 30 days)...`);
      this.propertyService.cleanupOldData(30);
      console.log(`Cleanup complete\n`);

    } catch (error) {
      const durationSeconds = (Date.now() - startTime) / 1000;
      console.error(`\nPipeline failed after ${durationSeconds.toFixed(2)} seconds:`, error);
    }
  }

  private async fetchListings(buyboxConfig: ReturnType<typeof config.getBuyboxConfig>): Promise<Awaited<ReturnType<PropertyService['fetchAndSaveProperties']>> | null> {
    logSection('STEP 1: Fetching current property listings');

    const result = await this.propertyService.fetchAndSaveProperties(buyboxConfig);

    if (!result.success) {
      console.error('Failed to fetch listings. Aborting pipeline.');
      result.errors.forEach(error => {
        console.error(`- ${error.errorType}: ${error.errorMessage}`);
      });
      return null;
    }

    console.log(`Fetched ${result.stats.totalProperties} properties across ${result.stats.zipCodesProcessed} zip codes`);
    console.log(`Used ${result.stats.apiRequestsUsed} API requests, ${result.stats.remainingRequests} remaining\n`);
    return result;
  }

  private async fetchRecentlySold(buyboxConfig: ReturnType<typeof config.getBuyboxConfig>): Promise<void> {
    logSection('STEP 2: Fetching recently sold properties for comparison');

    try {
      const fetchOptions: Omit<FetchRecentlySoldOptions, 'zipCode'> = {
        daysBack: 180,
        saveToFile: true
      };

      if (buyboxConfig.priceRange?.min !== undefined) {
        fetchOptions.minPrice = buyboxConfig.priceRange.min;
      }
      if (buyboxConfig.priceRange?.max !== undefined) {
        fetchOptions.maxPrice = buyboxConfig.priceRange.max;
      }

      const results = await this.recentlySoldService.fetchRecentlySoldBatch(
        buyboxConfig.zipCodes,
        fetchOptions
      );

      let total = 0;
      for (const [zipCode, properties] of results) {
        console.log(`${zipCode}: ${properties.length} recently sold properties`);
        total += properties.length;
      }
      console.log(`Fetched ${total} recently sold properties\n`);
    } catch (error) {
      console.error('Failed to fetch recently sold data:', error);
      console.log('Continuing with analysis without recently sold data...\n');
    }
  }

  private async runAnalysis(
    buyboxConfig: ReturnType<typeof config.getBuyboxConfig>,
    financialConfig: ReturnType<typeof config.getFinancialConfig>
  ): Promise<{ analyzed: number; successful: number; failed: number }> {
    logSection('STEP 3: Running financial analysis');

    const stats = { analyzed: 0, successful: 0, failed: 0 };

    for (const zipCode of buyboxConfig.zipCodes) {
      try {
        console.log(`\nAnalyzing properties in zip code ${zipCode}...`);

        const properties = this.propertyService.loadPropertiesFromDisk(zipCode);
        if (properties.length === 0) {
          console.log(`No properties found for ${zipCode}`);
          continue;
        }

        const result = await this.financialAnalysisService.analyzeBatch(properties, financialConfig);

        await this.analysisStorageService.saveAnalysisResults(
          zipCode,
          result.results,
          buyboxConfig.name
        );

        stats.analyzed += result.totalProperties;
        stats.successful += result.successfulAnalyses;
        stats.failed += result.failedAnalyses;

        console.log(`${zipCode}: Analyzed ${result.successfulAnalyses}/${result.totalProperties} properties`);
        console.log(`   - Avg Cash Flow: $${result.summary.averageCashFlow.toFixed(2)}`);
        console.log(`   - Avg ROI: ${result.summary.averageROI.toFixed(2)}%`);
        console.log(`   - Avg Cap Rate: ${result.summary.averageCapRate.toFixed(2)}%`);

      } catch (error) {
        console.error(`Failed to analyze properties in ${zipCode}:`, error);
        stats.failed++;
      }
    }

    return stats;
  }

  private logPipelineSummary(
    startTime: number,
    listingsStats: { totalProperties: number; apiRequestsUsed: number; remainingRequests: number },
    analysisStats: { analyzed: number; successful: number; failed: number }
  ): void {
    const durationSeconds = (Date.now() - startTime) / 1000;

    logSection('PIPELINE SUMMARY');
    console.log(`Pipeline completed in ${durationSeconds.toFixed(2)} seconds`);
    console.log(`\nListings: ${listingsStats.totalProperties} properties fetched`);
    console.log(`Analysis: ${analysisStats.successful}/${analysisStats.analyzed} properties analyzed`);
    if (analysisStats.failed > 0) {
      console.log(`Failures: ${analysisStats.failed} properties failed analysis`);
    }
    console.log(`API Requests: ${listingsStats.apiRequestsUsed} used, ${listingsStats.remainingRequests} remaining`);
    console.log(`\nData saved to: ${this.propertyService.getDataPath()}/analysis/`);
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    running: boolean;
    nextRun: string | null;
    cronSchedule: string;
    enabled: boolean;
  } {
    return {
      running: this.task !== null,
      nextRun: this.task ? this.getNextRunTime() : null,
      cronSchedule: this.schedulerConfig.cronSchedule,
      enabled: this.schedulerConfig.enabled
    };
  }

  /**
   * Get next scheduled run time
   */
  private getNextRunTime(): string | null {
    if (!this.task) return null;
    
    // This is a simplified implementation
    // In a real scenario, you'd want to use a proper cron parser
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(2, 0, 0, 0); // Assuming daily at 2 AM
    
    return tomorrow.toISOString();
  }

  /**
   * Update scheduler configuration
   */
  updateConfig(newConfig: Partial<SchedulerConfig>): void {
    this.schedulerConfig = { ...this.schedulerConfig, ...newConfig };
    
    if (this.task) {
      this.stop();
      this.start();
    }
  }
}
