import { Router, Request, Response } from 'express';
import { join } from 'path';
import { FinancialAnalysisService } from '../services/financialAnalysisService';
import { AnalysisStorageService } from '../services/analysisStorageService';
import { PropertyService } from '../services/propertyService';
import { config } from '../config/config';
import { Property, FinancialConfig } from '/Users/sriram/projects/dealflowanalyzer.ai/shared/dist/types';

const router = Router();

// Initialize services with absolute paths
const dataPath = join(__dirname, '../../data');
const analysisService = new FinancialAnalysisService(
  join(dataPath, 'hud-rental-data.json'),
  dataPath
);
const analysisStorage = new AnalysisStorageService(dataPath);

// Helper function to get financial config
function getFinancialConfig(): FinancialConfig {
  try {
    return config.getConfig().financial;
  } catch (error) {
    throw new Error('Failed to load financial configuration');
  }
}

/**
 * POST /api/analysis/property
 * Analyze a single property
 */
router.post('/property', async (req: Request, res: Response): Promise<void> => {
  try {
    const { property } = req.body;
    
    if (!property) {
      res.status(400).json({ 
        error: 'Property data is required',
        message: 'Please provide property data in the request body'
      });
      return;
    }

    const financialConfig = getFinancialConfig();
    const result = await analysisService.analyzeProperty(property, financialConfig);
    
    res.json({
      success: true,
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Property analysis error:', error);
    res.status(500).json({
      error: 'Analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/analysis/batch
 * Analyze multiple properties
 */
router.post('/batch', async (req: Request, res: Response): Promise<void> => {
  try {
    const { properties, saveResults = true } = req.body;
    
    if (!properties || !Array.isArray(properties)) {
      res.status(400).json({ 
        error: 'Properties array is required',
        message: 'Please provide an array of properties in the request body'
      });
      return;
    }

    if (properties.length === 0) {
      res.status(400).json({ 
        error: 'Empty properties array',
        message: 'Please provide at least one property to analyze'
      });
      return;
    }

    const financialConfig = getFinancialConfig();
    const batchResult = await analysisService.analyzeBatch(properties, financialConfig);

    // Save results if requested
    if (saveResults && batchResult.results.length > 0) {
      try {
        analysisStorage.saveBatchAnalysisResult(batchResult, undefined, properties);
      } catch (saveError) {
        console.error('Failed to save batch analysis results:', saveError);
        // Continue without failing the request
      }
    }
    
    res.json({
      success: true,
      result: batchResult,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Batch analysis error:', error);
    res.status(500).json({
      error: 'Batch analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/analysis/zipcode
 * Analyze properties from stored data by zip code
 */
router.post('/zipcode', async (req: Request, res: Response): Promise<void> => {
  try {
    const { zipCode, date, buyboxName, saveResults = true } = req.body;
    
    if (!zipCode) {
      res.status(400).json({ 
        error: 'Zip code is required',
        message: 'Please provide a zip code to analyze'
      });
      return;
    }

    // Load properties from storage
    const propertyService = new PropertyService({
      apiKey: process.env['RAPIDAPI_KEY'] || '',
      apiHost: process.env['RAPIDAPI_HOST'] || '',
      rateLimit: parseInt(process.env['API_RATE_LIMIT'] || '100'),
      rateWindow: parseInt(process.env['API_RATE_WINDOW'] || '86400'),
      dataPath: process.env['DATA_PATH'] || './data'
    });

    const properties = propertyService.loadProperties(zipCode, date, buyboxName);
    
    if (!properties || properties.length === 0) {
      res.status(404).json({
        error: 'No properties found',
        message: `No property data found for zip code ${zipCode}${date ? ` on ${date}` : ''}`
      });
      return;
    }

    const financialConfig = getFinancialConfig();
    const batchResult = await analysisService.analyzeBatch(properties, financialConfig);

    // Save results if requested
    if (saveResults && batchResult.results.length > 0) {
      try {
        analysisStorage.saveBatchAnalysisResult(batchResult, buyboxName, properties);
      } catch (saveError) {
        console.error('Failed to save analysis results:', saveError);
        // Continue without failing the request
      }
    }
    
    res.json({
      success: true,
      result: batchResult,
      propertiesAnalyzed: properties.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Zip code analysis error:', error);
    res.status(500).json({
      error: 'Zip code analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analysis/results
 * Get stored analysis results
 */
router.get('/results', async (req: Request, res: Response) => {
  try {
    const { 
      zipCodes, 
      startDate, 
      endDate, 
      minCashFlow, 
      maxPrice, 
      minROI, 
      buyboxName 
    } = req.query;

    const criteria: any = {};
    
    if (zipCodes) {
      criteria.zipCodes = Array.isArray(zipCodes) ? zipCodes : [zipCodes];
    }
    
    if (startDate && endDate) {
      criteria.dateRange = { 
        startDate: startDate as string, 
        endDate: endDate as string 
      };
    }
    
    if (minCashFlow) {
      criteria.minCashFlow = parseFloat(minCashFlow as string);
    }
    
    if (maxPrice) {
      criteria.maxPrice = parseFloat(maxPrice as string);
    }
    
    if (minROI) {
      criteria.minROI = parseFloat(minROI as string);
    }
    
    if (buyboxName) {
      criteria.buyboxName = buyboxName as string;
    }

    const results = analysisStorage.loadAnalysisResultsWithFilter(criteria);
    
    res.json({
      success: true,
      results,
      count: results.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error loading analysis results:', error);
    res.status(500).json({
      error: 'Failed to load analysis results',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analysis/statistics
 * Get analysis statistics
 */
router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const { zipCodes } = req.query;

    let zipCodeArray: string[] | undefined;
    if (zipCodes) {
      zipCodeArray = Array.isArray(zipCodes) ? zipCodes as string[] : [zipCodes as string];
    }

    const filterCriteria: any = {};
    if (zipCodeArray) {
      filterCriteria.zipCodes = zipCodeArray;
    }
    const results = analysisStorage.loadAnalysisResultsWithFilter(filterCriteria);
    
    const statistics = {
      totalProperties: results.length,
      averageCashFlow: results.length > 0 ? results.reduce((sum, r) => sum + r.financialMetrics.annualCashFlow, 0) / results.length : 0,
      averageROI: results.length > 0 ? results.reduce((sum, r) => sum + r.financialMetrics.cashOnCashReturn, 0) / results.length : 0,
      positiveFlowCount: results.filter(r => r.financialMetrics.annualCashFlow > 0).length
    };
    
    res.json({
      success: true,
      statistics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting analysis statistics:', error);
    res.status(500).json({
      error: 'Failed to get analysis statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analysis/export/csv
 * Export analysis results to CSV
 */
router.get('/export/csv', async (req: Request, res: Response) => {
  try {
    const { 
      zipCodes, 
      startDate, 
      endDate, 
      columns,
      filename = 'analysis-results.csv'
    } = req.query;

    let zipCodeArray: string[] = [];
    if (zipCodes) {
      zipCodeArray = Array.isArray(zipCodes) ? zipCodes as string[] : [zipCodes as string];
    } else {
      // Get all available zip codes if none specified
      zipCodeArray = analysisStorage.getAvailableZipCodes();
    }
    
    let dateRange: { startDate: string; endDate: string } | undefined;
    if (startDate && endDate) {
      dateRange = { 
        startDate: startDate as string, 
        endDate: endDate as string 
      };
    }

    let includeColumns: string[] | undefined;
    if (columns) {
      includeColumns = Array.isArray(columns) ? columns as string[] : [columns as string];
    }

    const csvContent = analysisStorage.exportAnalysisToCSV(zipCodeArray, dateRange, includeColumns);
    
    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Error exporting analysis to CSV:', error);
    res.status(500).json({
      error: 'CSV export failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});



/**
 * GET /api/analysis/columns
 * Get available export columns
 */
router.get('/columns', (req: Request, res: Response) => {
  try {
    const columns = analysisStorage.getAvailableExportColumns();
    
    res.json({
      success: true,
      columns,
      count: columns.length
    });

  } catch (error) {
    console.error('Error getting export columns:', error);
    res.status(500).json({
      error: 'Failed to get export columns',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/analysis/refresh
 * Refresh analysis using stored property data
 */
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    // Load property service to get stored properties
    const propertyService = new PropertyService({
      apiKey: process.env['RAPIDAPI_KEY'] || '',
      apiHost: process.env['RAPIDAPI_HOST'] || '',
      rateLimit: parseInt(process.env['API_RATE_LIMIT'] || '100'),
      rateWindow: parseInt(process.env['API_RATE_WINDOW'] || '86400'),
      dataPath: join(dataPath)
    });

    // Get all available zip codes
    const zipCodes = propertyService.getAvailableZipCodes();

    if (zipCodes.length === 0) {
      res.status(404).json({
        error: 'No property data found',
        message: 'Please fetch properties first before running analysis'
      });
      return;
    }

    // Load all properties from all zip codes
    const allProperties: any[] = [];
    for (const zipCode of zipCodes) {
      const dates = propertyService.getAvailableDates(zipCode);
      if (dates.length > 0) {
        const latestDate = dates[0]; // Dates are sorted, most recent first
        const properties = propertyService.loadProperties(zipCode, latestDate);
        if (properties && properties.length > 0) {
          allProperties.push(...properties);
        }
      }
    }

    if (allProperties.length === 0) {
      res.status(404).json({
        error: 'No properties found',
        message: 'No property data available to analyze'
      });
      return;
    }

    // Run batch analysis
    const financialConfig = getFinancialConfig();
    const batchResult = await analysisService.analyzeBatch(allProperties, financialConfig);

    // Save results
    if (batchResult.results.length > 0) {
      try {
        analysisStorage.saveBatchAnalysisResult(batchResult, config.getBuyboxConfig().name, allProperties);
      } catch (saveError) {
        console.error('Failed to save analysis results:', saveError);
        // Continue without failing the request
      }
    }

    res.json({
      success: true,
      result: batchResult,
      message: `Successfully analyzed ${batchResult.results.length} properties`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Analysis refresh error:', error);
    res.status(500).json({
      error: 'Analysis refresh failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analysis/test
 * Test the analysis engine
 */
router.get('/test', async (req: Request, res: Response) => {
  try {
    const rentalService = analysisService.getRentalEstimationService();
    const testResult = await rentalService.testRentalEstimation();
    
    res.json({
      success: true,
      testResult,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Analysis test error:', error);
    res.status(500).json({
      error: 'Analysis test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;