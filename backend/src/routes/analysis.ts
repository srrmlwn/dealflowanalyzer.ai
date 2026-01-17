import { Router, Request, Response } from 'express';
import { join } from 'path';
import { FinancialAnalysisService } from '../services/financialAnalysisService';
import { PropertyService } from '../services/propertyService';
import { config } from '../config/config';
import { Property, FinancialConfig } from '../../../shared/dist/types';

const router = Router();

// Initialize services with absolute paths
const dataPath = join(__dirname, '../../data');
const analysisService = new FinancialAnalysisService(
  join(dataPath, 'hud-rental-data.json'),
  dataPath
);

// Module-level PropertyService instance (reused across requests)
const propertyService = new PropertyService({
  apiKey: process.env['RAPIDAPI_KEY'] || '',
  apiHost: process.env['RAPIDAPI_HOST'] || '',
  rateLimit: parseInt(process.env['API_RATE_LIMIT'] || '100'),
  rateWindow: parseInt(process.env['API_RATE_WINDOW'] || '86400'),
  dataPath: dataPath
});

function getFinancialConfig(): FinancialConfig {
  return config.getConfig().financial;
}

/**
 * Load latest properties from specified or all available zip codes
 */
function loadLatestProperties(zipCodes?: string[], buyboxName?: string): Property[] {
  const targetZipCodes = zipCodes?.length ? zipCodes : propertyService.getAvailableZipCodes();
  const targetBuybox = buyboxName || config.getBuyboxConfig().name;
  const properties: Property[] = [];

  for (const zipCode of targetZipCodes) {
    const dates = propertyService.getAvailableDates(zipCode);
    if (dates.length === 0) continue;

    const latestDate = dates[0];
    const loaded = propertyService.loadProperties(zipCode, latestDate, targetBuybox);
    if (loaded && loaded.length > 0) {
      properties.push(...loaded);
    }
  }

  return properties;
}

/**
 * Parse zip codes from query parameter
 */
function parseZipCodesParam(zipCodes: unknown): string[] | undefined {
  if (!zipCodes) return undefined;
  return Array.isArray(zipCodes) ? zipCodes as string[] : [zipCodes as string];
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
    const { properties } = req.body;

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
    const { zipCode, date, buyboxName } = req.body;

    if (!zipCode) {
      res.status(400).json({
        error: 'Zip code is required',
        message: 'Please provide a zip code to analyze'
      });
      return;
    }

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
 * Compute analysis on-demand from stored property data
 */
router.get('/results', async (req: Request, res: Response) => {
  try {
    const { zipCodes, minCashFlow, minROI, buyboxName } = req.query;

    const parsedZipCodes = parseZipCodesParam(zipCodes);
    const allProperties = loadLatestProperties(parsedZipCodes, buyboxName as string);

    if (allProperties.length === 0) {
      res.status(404).json({
        error: 'No properties found',
        message: 'No property data available. Please fetch properties first using the scheduler or data collection endpoint.'
      });
      return;
    }

    const financialConfig = getFinancialConfig();
    const batchResult = await analysisService.analyzeBatch(allProperties, financialConfig);

    let filteredResults = batchResult.results;

    if (minCashFlow !== undefined) {
      const minCashFlowVal = parseFloat(minCashFlow as string);
      filteredResults = filteredResults.filter(r => r.financialMetrics.annualCashFlow >= minCashFlowVal);
    }

    if (minROI !== undefined) {
      const minROIVal = parseFloat(minROI as string);
      filteredResults = filteredResults.filter(r => r.financialMetrics.cashOnCashReturn >= minROIVal);
    }

    res.json({
      success: true,
      results: filteredResults,
      count: filteredResults.length,
      timestamp: new Date().toISOString(),
      computedOnDemand: true,
      message: 'Analysis computed on-demand with current financial configuration'
    });

  } catch (error) {
    console.error('Error computing analysis results:', error);
    res.status(500).json({
      error: 'Failed to compute analysis results',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analysis/statistics
 * Get analysis statistics (computed on-demand)
 */
router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const { zipCodes } = req.query;

    const emptyStats = {
      success: true,
      statistics: {
        totalProperties: 0,
        averageCashFlow: 0,
        averageROI: 0,
        positiveFlowCount: 0
      },
      timestamp: new Date().toISOString()
    };

    const parsedZipCodes = parseZipCodesParam(zipCodes);
    const allProperties = loadLatestProperties(parsedZipCodes);

    if (allProperties.length === 0) {
      res.json(emptyStats);
      return;
    }

    const financialConfig = getFinancialConfig();
    const batchResult = await analysisService.analyzeBatch(allProperties, financialConfig);
    const results = batchResult.results;

    const statistics = {
      totalProperties: results.length,
      averageCashFlow: results.length > 0
        ? results.reduce((sum, r) => sum + r.financialMetrics.annualCashFlow, 0) / results.length
        : 0,
      averageROI: results.length > 0
        ? results.reduce((sum, r) => sum + r.financialMetrics.cashOnCashReturn, 0) / results.length
        : 0,
      positiveFlowCount: results.filter(r => r.financialMetrics.annualCashFlow > 0).length
    };

    res.json({
      success: true,
      statistics,
      timestamp: new Date().toISOString(),
      computedOnDemand: true
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
 * Export analysis results to CSV (computed on-demand)
 */
router.get('/export/csv', async (req: Request, res: Response) => {
  try {
    const { zipCodes, columns, filename = 'analysis-results.csv' } = req.query;

    const parsedZipCodes = parseZipCodesParam(zipCodes);
    const allProperties = loadLatestProperties(parsedZipCodes);

    if (allProperties.length === 0) {
      res.status(404).json({
        error: 'No properties found',
        message: 'No property data available for export. Please fetch properties first.'
      });
      return;
    }

    const financialConfig = getFinancialConfig();
    const batchResult = await analysisService.analyzeBatch(allProperties, financialConfig);

    const includeColumns = columns
      ? (Array.isArray(columns) ? columns as string[] : [columns as string])
      : undefined;

    const csvContent = buildCSVFromResults(batchResult.results, includeColumns);

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

// Helper function to build CSV from results
function buildCSVFromResults(results: any[], includeColumns?: string[]): string {
  if (results.length === 0) {
    return 'No data available for export';
  }

  const allColumns: Record<string, (r: any) => any> = {
    'Property ID': (r) => r.propertyId,
    'Analysis Date': (r) => r.analysisDate,
    'Monthly Rent': (r) => r.financialMetrics.monthlyRent,
    'Monthly Cash Flow': (r) => r.financialMetrics.monthlyCashFlow,
    'Annual Cash Flow': (r) => r.financialMetrics.annualCashFlow,
    'Cash-on-Cash Return %': (r) => r.financialMetrics.cashOnCashReturn,
    'Cap Rate %': (r) => r.financialMetrics.capRate,
    'Total Cash Invested': (r) => r.financialMetrics.totalCashInvested,
    'Rent Source': (r) => r.rentalEstimate.source,
    'Rent Confidence': (r) => r.rentalEstimate.confidence
  };

  const columnsToInclude = includeColumns || Object.keys(allColumns);
  const validColumns = columnsToInclude.filter(col => col in allColumns);

  const csvLines: string[] = [];
  csvLines.push(validColumns.join(','));

  for (const result of results) {
    const row = validColumns.map(column => {
      const value = allColumns[column]!(result);
      if (typeof value === 'number') {
        return value.toString();
      } else if (typeof value === 'string') {
        return `"${value.replace(/"/g, '""')}"`;
      } else {
        return String(value || '');
      }
    });
    csvLines.push(row.join(','));
  }

  return csvLines.join('\n');
}

/**
 * GET /api/analysis/columns
 * Get available export columns
 */
router.get('/columns', (req: Request, res: Response) => {
  try {
    const columns = [
      'Property ID',
      'Analysis Date',
      'Monthly Rent',
      'Monthly Cash Flow',
      'Annual Cash Flow',
      'Cash-on-Cash Return %',
      'Cap Rate %',
      'Total Cash Invested',
      'Rent Source',
      'Rent Confidence'
    ];

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
 * Validate that property data exists for analysis (legacy endpoint)
 * Note: Analysis is now computed on-demand, so this endpoint just validates data exists
 */
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const allProperties = loadLatestProperties();

    if (allProperties.length === 0) {
      res.status(404).json({
        error: 'No properties found',
        message: 'No property data available. Please fetch properties first before running analysis.'
      });
      return;
    }

    res.json({
      success: true,
      message: `Ready to analyze ${allProperties.length} properties. Analysis will be computed on-demand when requested.`,
      timestamp: new Date().toISOString(),
      note: 'Analysis is now computed on-demand with current configuration - no pre-computation needed'
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