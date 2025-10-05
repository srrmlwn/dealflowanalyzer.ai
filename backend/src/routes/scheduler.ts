import { Router, Request, Response } from 'express';
import { DataCollectionScheduler, SchedulerConfig } from '../services/scheduler';
import { PropertyServiceConfig } from '../services/propertyService';
import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

const router = Router();

// Initialize scheduler
const propertyServiceConfig: PropertyServiceConfig = {
  apiKey: process.env['RAPIDAPI_KEY'] || '',
  apiHost: process.env['RAPIDAPI_HOST'] || 'zillow-com1.p.rapidapi.com',
  rateLimit: parseInt(process.env['API_RATE_LIMIT'] || '100'),
  rateWindow: parseInt(process.env['API_RATE_WINDOW'] || '86400'),
  dataPath: process.env['DATA_PATH'] || './data'
};

const schedulerConfig: SchedulerConfig = {
  cronSchedule: process.env['SCHEDULER_CRON'] || '0 2 * * *', // Daily at 2 AM
  enabled: process.env['SCHEDULER_ENABLED'] === 'true',
  timezone: process.env['SCHEDULER_TIMEZONE'] || 'America/New_York'
};

const scheduler = new DataCollectionScheduler(propertyServiceConfig, schedulerConfig);

// Start scheduler on module load
scheduler.start();

/**
 * GET /api/scheduler/status
 * Get scheduler status
 */
router.get('/status', (req: Request, res: Response) => {
  try {
    const status = scheduler.getStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting scheduler status:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/scheduler/run
 * Run data collection manually
 */
router.post('/run', async (req: Request, res: Response) => {
  try {
    console.log('Manual data collection triggered via API');
    
    // Run in background to avoid timeout
    scheduler.runDataCollection().catch(error => {
      console.error('Manual data collection failed:', error);
    });
    
    res.json({
      message: 'Data collection started',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error starting manual data collection:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/scheduler/start
 * Start the scheduler
 */
router.post('/start', (req: Request, res: Response) => {
  try {
    scheduler.start();
    res.json({
      message: 'Scheduler started',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error starting scheduler:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/scheduler/stop
 * Stop the scheduler
 */
router.post('/stop', (req: Request, res: Response) => {
  try {
    scheduler.stop();
    res.json({
      message: 'Scheduler stopped',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error stopping scheduler:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/scheduler/config
 * Update scheduler configuration
 */
router.put('/config', (req: Request, res: Response) => {
  try {
    const { cronSchedule, enabled, timezone } = req.body;
    
    const newConfig: Partial<SchedulerConfig> = {};
    if (cronSchedule !== undefined) newConfig.cronSchedule = cronSchedule;
    if (enabled !== undefined) newConfig.enabled = enabled;
    if (timezone !== undefined) newConfig.timezone = timezone;
    
    scheduler.updateConfig(newConfig);
    
    res.json({
      message: 'Scheduler configuration updated',
      config: scheduler.getStatus(),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error updating scheduler config:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
