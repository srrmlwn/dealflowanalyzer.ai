import { Router, Request, Response } from 'express';
import { PropertyService, PropertyServiceConfig } from '../services/propertyService';
import { config } from '../config/config';
import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

const router = Router();

// Initialize property service
const propertyServiceConfig: PropertyServiceConfig = {
  apiKey: process.env['RAPIDAPI_KEY'] || '',
  apiHost: process.env['RAPIDAPI_HOST'] || 'zillow-com1.p.rapidapi.com',
  rateLimit: parseInt(process.env['API_RATE_LIMIT'] || '10'),
  rateWindow: parseInt(process.env['API_RATE_WINDOW'] || '86400'),
  dataPath: process.env['DATA_PATH'] || './data'
};

const propertyService = new PropertyService(propertyServiceConfig);

/**
 * GET /api/properties/fetch
 * Fetch properties for the configured buybox
 */
router.get('/fetch', async (req: Request, res: Response) => {
  try {
    const buyboxConfig = config.getBuyboxConfig();
    
    if (!process.env['RAPIDAPI_KEY']) {
      return res.status(400).json({
        error: 'API key not configured',
        message: 'Please set RAPIDAPI_KEY environment variable'
      });
    }

    const result = await propertyService.fetchAndSaveProperties(buyboxConfig);
    
    return res.json({
      success: result.success,
      message: result.success 
        ? `Successfully fetched ${result.stats.totalProperties} properties`
        : 'Failed to fetch properties',
      stats: result.stats,
      errors: result.errors,
      properties: result.properties.slice(0, 10) // Return first 10 for preview
    });

  } catch (error) {
    console.error('Error fetching properties:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/properties
 * Get stored properties for a specific zip code and date
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { zipCode, date, buyboxName } = req.query;

    if (!zipCode || typeof zipCode !== 'string') {
      return res.status(400).json({
        error: 'Missing required parameter',
        message: 'zipCode is required'
      });
    }

    const properties = propertyService.loadProperties(
      zipCode,
      date as string,
      buyboxName as string
    );

    if (!properties) {
      return res.status(404).json({
        error: 'No data found',
        message: `No properties found for zip code ${zipCode}${date ? ` on ${date}` : ''}`
      });
    }

    return res.json({
      zipCode,
      date: date || 'latest',
      buyboxName: buyboxName || 'default',
      propertyCount: properties.length,
      properties
    });

  } catch (error) {
    console.error('Error loading properties:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/properties/zipcodes
 * Get all available zip codes with data
 */
router.get('/zipcodes', async (req: Request, res: Response) => {
  try {
    const zipCodes = propertyService.getAvailableZipCodes();
    
    res.json({
      zipCodes,
      count: zipCodes.length
    });

  } catch (error) {
    console.error('Error getting zip codes:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/properties/dates/:zipCode
 * Get available dates for a specific zip code
 */
router.get('/dates/:zipCode', async (req: Request, res: Response) => {
  try {
    const { zipCode } = req.params;
    const dates = propertyService.getAvailableDates(zipCode as string);
    
    res.json({
      zipCode,
      dates,
      count: dates.length
    });

  } catch (error) {
    console.error('Error getting dates:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/properties/stats
 * Get API usage statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = propertyService.getApiStats();
    
    res.json({
      apiStats: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/properties/adhoc
 * Adhoc fetch of listings from Zillow API with custom parameters
 */
router.post('/adhoc', async (req: Request, res: Response) => {
  try {
    const { zipCodes, minPrice, maxPrice, statusType } = req.body;
    
    if (!process.env['RAPIDAPI_KEY']) {
      return res.status(400).json({
        error: 'API key not configured',
        message: 'Please set RAPIDAPI_KEY environment variable'
      });
    }

    if (!zipCodes || !Array.isArray(zipCodes) || zipCodes.length === 0) {
      return res.status(400).json({
        error: 'Invalid parameters',
        message: 'zipCodes array is required'
      });
    }

    // Create a temporary buybox config for this adhoc request
    const adhocBuybox = {
      name: 'adhoc-request',
      zipCodes: zipCodes,
      priceRange: {
        min: minPrice || 0,
        max: maxPrice || 1000000
      },
      statusType: statusType || 'ForSale'
    };

    const result = await propertyService.fetchAndSaveProperties(adhocBuybox);
    
    return res.json({
      success: result.success,
      message: result.success 
        ? `Successfully fetched ${result.stats.totalProperties} properties`
        : 'Failed to fetch properties',
      stats: result.stats,
      errors: result.errors,
      properties: result.properties.slice(0, 50) // Return first 50 for preview
    });

  } catch (error) {
    console.error('Error in adhoc property fetch:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/properties/export/csv
 * Export properties data to CSV format
 */
router.get('/export/csv', async (req: Request, res: Response) => {
  try {
    const { zipCode, date, buyboxName } = req.query;

    // Get all available zip codes if none specified
    const zipCodes = zipCode ? [zipCode as string] : propertyService.getAvailableZipCodes();
    
    if (zipCodes.length === 0) {
      return res.status(404).json({
        error: 'No data found',
        message: 'No properties data available for export'
      });
    }

    const allProperties: any[] = [];
    const dateToUse = date as string || 'latest';

    // Collect properties from all zip codes
    for (const zip of zipCodes) {
      const properties = propertyService.loadProperties(zip, dateToUse, buyboxName as string);
      if (properties) {
        properties.forEach(prop => {
          allProperties.push({
            ...prop,
            zipCode: zip,
            exportDate: new Date().toISOString()
          });
        });
      }
    }

    if (allProperties.length === 0) {
      return res.status(404).json({
        error: 'No data found',
        message: 'No properties found for the specified criteria'
      });
    }

    // Generate CSV
    const csvHeaders = [
      'zpid', 'address', 'price', 'bedrooms', 'bathrooms', 'livingArea', 
      'lotAreaValue', 'rentZestimate', 'zestimate', 'priceChange', 
      'daysOnZillow', 'listingStatus', 'propertyType', 'latitude', 'longitude',
      'imgSrc', 'detailUrl', 'zipCode', 'exportDate'
    ];

    const csvRows = allProperties.map(prop => 
      csvHeaders.map(header => {
        const value = prop[header];
        // Handle null/undefined values and escape commas/quotes
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        // Escape quotes and wrap in quotes if contains comma
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      })
    );

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.join(','))
    ].join('\n');

    // Set response headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="properties-${dateToUse}.csv"`);
    
    return res.send(csvContent);

  } catch (error) {
    console.error('Error exporting CSV:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/properties/cleanup
 * Clean up old data
 */
router.post('/cleanup', async (req: Request, res: Response) => {
  try {
    const { daysToKeep = 30 } = req.body;
    
    if (typeof daysToKeep !== 'number' || daysToKeep < 1) {
      return res.status(400).json({
        error: 'Invalid parameter',
        message: 'daysToKeep must be a positive number'
      });
    }

    propertyService.cleanupOldData(daysToKeep);
    
    return res.json({
      message: `Cleanup completed. Keeping data from last ${daysToKeep} days.`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error during cleanup:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
