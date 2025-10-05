import { DataStorageService } from './dataStorage';
import { DetailedAnalysisResult, BatchAnalysisResult } from './financialAnalysisService';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface AnalysisSummary {
  timestamp: string;
  zipCode: string;
  totalProperties: number;
  successfulAnalyses: number;
  failedAnalyses: number;
  averageCashFlow: number;
  averageROI: number;
  averageCapRate: number;
  dataQualityScore: number;
  topPerformers: string[];
  configurationSnapshot: any;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export class AnalysisStorageService extends DataStorageService {
  
  constructor(dataPath: string = './data') {
    super(dataPath);
  }

  /**
   * Save analysis results for a specific zip code
   */
  saveAnalysisResults(
    zipCode: string, 
    results: DetailedAnalysisResult[], 
    buyboxName?: string
  ): void {
    try {
      const dateString = this.getCurrentDateString();
      const analysisPath = join('./data', 'analysis');
      const zipDir = join(analysisPath, zipCode);
      const dateDir = join(zipDir, dateString);
      
      // Ensure directories exist
      this.ensureDirectoryExists(zipDir);
      this.ensureDirectoryExists(dateDir);

      const filename = buyboxName ? `${buyboxName}-analysis.json` : 'analysis-results.json';
      const filePath = join(dateDir, filename);
      
      const data = {
        timestamp: new Date().toISOString(),
        zipCode,
        buyboxName,
        totalResults: results.length,
        results
      };

      writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`Saved ${results.length} analysis results for zip code ${zipCode} to ${filePath}`);
    } catch (error) {
      console.error(`Error saving analysis results for zip code ${zipCode}:`, error);
      throw error;
    }
  }

  /**
   * Load analysis results for a specific zip code and date
   */
  loadAnalysisResults(
    zipCode: string, 
    date?: string, 
    buyboxName?: string
  ): DetailedAnalysisResult[] | null {
    try {
      const dateString = date || this.getCurrentDateString();
      const analysisPath = join('./data', 'analysis');
      const zipDir = join(analysisPath, zipCode);
      const dateDir = join(zipDir, dateString);
      
      if (!existsSync(dateDir)) {
        return null;
      }

      const filename = buyboxName ? `${buyboxName}-analysis.json` : 'analysis-results.json';
      const filePath = join(dateDir, filename);
      
      if (!existsSync(filePath)) {
        return null;
      }

      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      return data.results || [];
    } catch (error) {
      console.error(`Error loading analysis results for zip code ${zipCode}:`, error);
      return null;
    }
  }

  /**
   * Save batch analysis result
   */
  saveBatchAnalysisResult(batchResult: BatchAnalysisResult, buyboxName?: string): void {
    try {
      // Group results by zip code
      const resultsByZip = this.groupResultsByZipCode(batchResult.results);
      
      for (const [zipCode, results] of Object.entries(resultsByZip)) {
        this.saveAnalysisResults(zipCode, results, buyboxName);
      }
      
      console.log(`Saved batch analysis results for ${Object.keys(resultsByZip).length} zip codes`);
    } catch (error) {
      console.error('Error saving batch analysis result:', error);
      throw error;
    }
  }

  /**
   * Export analysis results to CSV format
   */
  exportAnalysisToCSV(
    zipCodes: string[], 
    dateRange?: DateRange,
    includeColumns?: string[]
  ): string {
    try {
      const filterCriteria: any = {};
      if (zipCodes) filterCriteria.zipCodes = zipCodes;
      if (dateRange) filterCriteria.dateRange = dateRange;
      
      const results = this.loadAnalysisResultsWithFilter(filterCriteria);
      
      if (results.length === 0) {
        return 'No data available for export';
      }

      // Define available columns
      const allColumns = {
        'Property ID': (r: DetailedAnalysisResult) => r.propertyId,
        'Analysis Date': (r: DetailedAnalysisResult) => r.analysisDate,
        'Monthly Rent': (r: DetailedAnalysisResult) => r.financialMetrics.monthlyRent,
        'Monthly Cash Flow': (r: DetailedAnalysisResult) => r.financialMetrics.monthlyCashFlow,
        'Annual Cash Flow': (r: DetailedAnalysisResult) => r.financialMetrics.annualCashFlow,
        'Cash-on-Cash Return %': (r: DetailedAnalysisResult) => r.financialMetrics.cashOnCashReturn,
        'Cap Rate %': (r: DetailedAnalysisResult) => r.financialMetrics.capRate,
        'Total Cash Invested': (r: DetailedAnalysisResult) => r.financialMetrics.totalCashInvested,
        'Rent Source': (r: DetailedAnalysisResult) => r.rentalEstimate.source,
        'Rent Confidence': (r: DetailedAnalysisResult) => r.rentalEstimate.confidence
      };

      // Use specified columns or all columns
      const columnsToInclude = includeColumns || Object.keys(allColumns);
      const validColumns = columnsToInclude.filter(col => col in allColumns);

      // Create CSV header
      const csvLines: string[] = [];
      csvLines.push(validColumns.join(','));

      // Add data rows
      for (const result of results) {
        const row = validColumns.map(column => {
          const value = allColumns[column as keyof typeof allColumns](result);
          
          // Handle different value types
          if (typeof value === 'number') {
            return value.toString();
          } else if (typeof value === 'string') {
            // Escape commas and quotes in strings
            return `"${value.replace(/"/g, '""')}"`;
          } else {
            return String(value || '');
          }
        });
        
        csvLines.push(row.join(','));
      }

      console.log(`Exported ${results.length} analysis results to CSV with ${validColumns.length} columns`);
      return csvLines.join('\n');

    } catch (error) {
      console.error('Error exporting analysis to CSV:', error);
      throw new Error(`CSV export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load analysis results with filtering
   */
  loadAnalysisResultsWithFilter(criteria: {
    zipCodes?: string[];
    dateRange?: DateRange;
    minCashFlow?: number;
    maxPrice?: number;
    minROI?: number;
    buyboxName?: string;
  }): DetailedAnalysisResult[] {
    const allResults: DetailedAnalysisResult[] = [];
    
    try {
      const zipCodesToSearch = criteria.zipCodes || this.getAvailableZipCodes();
      
      for (const zipCode of zipCodesToSearch) {
        const dates = this.getAvailableDates(zipCode);
        
        for (const date of dates) {
          // Check date range filter
          if (criteria.dateRange) {
            if (date < criteria.dateRange.startDate || date > criteria.dateRange.endDate) {
              continue;
            }
          }
          
          const results = this.loadAnalysisResults(zipCode, date, criteria.buyboxName);
          if (results) {
            // Apply filters
            const filteredResults = results.filter(result => {
              if (criteria.minCashFlow && result.financialMetrics.annualCashFlow < criteria.minCashFlow) {
                return false;
              }
              if (criteria.minROI && result.financialMetrics.cashOnCashReturn < criteria.minROI) {
                return false;
              }
              return true;
            });
            
            allResults.push(...filteredResults);
          }
        }
      }
      
      return allResults;
    } catch (error) {
      console.error('Error loading analysis results with filter:', error);
      return [];
    }
  }

  /**
   * Get available export columns
   */
  getAvailableExportColumns(): string[] {
    return [
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
  }

  /**
   * Helper method to ensure directory exists
   */
  private ensureDirectoryExists(dirPath: string): void {
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Helper method to get current date string
   */
  private getCurrentDateString(): string {
    return new Date().toISOString().split('T')[0]!; // YYYY-MM-DD format
  }

  /**
   * Group analysis results by zip code
   */
  private groupResultsByZipCode(results: DetailedAnalysisResult[]): Record<string, DetailedAnalysisResult[]> {
    const grouped: Record<string, DetailedAnalysisResult[]> = {};
    
    for (const result of results) {
      // For now, we'll extract zip code from property ID or use a default
      // In a real implementation, we'd store zip code in the result
      const zipCode = 'unknown';
      if (!grouped[zipCode]) {
        grouped[zipCode] = [];
      }
      grouped[zipCode].push(result);
    }
    
    return grouped;
  }
}