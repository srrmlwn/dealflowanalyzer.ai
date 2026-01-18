import * as cron from 'node-cron';
import { PropertyService, PropertyServiceConfig } from './propertyService.js';
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
  private schedulerConfig: SchedulerConfig;
  private task: cron.ScheduledTask | null = null;

  constructor(propertyServiceConfig: PropertyServiceConfig, schedulerConfig: SchedulerConfig) {
    this.propertyService = new PropertyService(propertyServiceConfig);
    this.schedulerConfig = schedulerConfig;
  }

  /**
   * Get the property service instance
   */
  getPropertyService(): PropertyService {
    return this.propertyService;
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
   * Run data collection manually - Complete pipeline using Realtor.com API
   */
  async runDataCollection(): Promise<void> {
    const startTime = Date.now();
    logSection(`Starting data collection pipeline (Realtor.com API) at ${new Date(startTime).toISOString()}`);

    try {
      const buyboxConfig = config.getBuyboxConfig();

      const apiStats = this.propertyService.getApiStats();
      if (apiStats.remainingRequests <= 0) {
        console.log(`No API requests remaining. Next reset in ${Math.ceil(apiStats.timeUntilReset / 1000)} seconds.`);
        return;
      }
      console.log(`API requests remaining: ${apiStats.remainingRequests}\n`);

      // Fetch current listings using Realtor.com API
      const listingsResult = await this.fetchListings(buyboxConfig);
      if (!listingsResult) return;

      // Final summary
      this.logPipelineSummary(startTime, listingsResult.stats);

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
    logSection('Fetching current property listings via Realtor.com API');

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

  private logPipelineSummary(
    startTime: number,
    listingsStats: { totalProperties: number; apiRequestsUsed: number; remainingRequests: number }
  ): void {
    const durationSeconds = (Date.now() - startTime) / 1000;

    logSection('PIPELINE SUMMARY');
    console.log(`Pipeline completed in ${durationSeconds.toFixed(2)} seconds`);
    console.log(`\nListings: ${listingsStats.totalProperties} properties fetched`);
    console.log(`API Requests: ${listingsStats.apiRequestsUsed} used, ${listingsStats.remainingRequests} remaining`);
    console.log(`\nData saved to: ${this.propertyService.getDataPath()}/properties/`);
    console.log(`Note: Financial analysis will be computed on-demand when requested via API`);
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
