import * as cron from 'node-cron';
import { PropertyService, PropertyServiceConfig } from './propertyService';
import { config } from '../config/config';

export interface SchedulerConfig {
  cronSchedule: string;
  enabled: boolean;
  timezone: string;
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
   * Run data collection manually
   */
  async runDataCollection(): Promise<void> {
    const startTime = new Date();
    console.log(`Starting scheduled data collection at ${startTime.toISOString()}`);

    try {
      const buyboxConfig = config.getBuyboxConfig();
      
      // Check if API key is configured
      if (!process.env['RAPIDAPI_KEY']) {
        console.error('RAPIDAPI_KEY not configured. Skipping data collection.');
        return;
      }

      // Check API rate limit before starting
      const apiStats = this.propertyService.getApiStats();
      if (apiStats.remainingRequests <= 0) {
        console.log(`No API requests remaining. Next reset in ${Math.ceil(apiStats.timeUntilReset / 1000)} seconds.`);
        return;
      }

      console.log(`API requests remaining: ${apiStats.remainingRequests}`);

      // Fetch and save properties
      const result = await this.propertyService.fetchAndSaveProperties(buyboxConfig);

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      if (result.success) {
        console.log(`Data collection completed successfully in ${duration}ms`);
        console.log(`Fetched ${result.stats.totalProperties} properties across ${result.stats.zipCodesProcessed} zip codes`);
        console.log(`Used ${result.stats.apiRequestsUsed} API requests, ${result.stats.remainingRequests} remaining`);
      } else {
        console.error(`Data collection failed after ${duration}ms`);
        console.error(`Errors: ${result.errors.length}`);
        result.errors.forEach(error => {
          console.error(`- ${error.errorType}: ${error.errorMessage}`);
        });
      }

      // Clean up old data (keep last 30 days)
      this.propertyService.cleanupOldData(30);

    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      console.error(`Data collection failed after ${duration}ms:`, error);
    }
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
