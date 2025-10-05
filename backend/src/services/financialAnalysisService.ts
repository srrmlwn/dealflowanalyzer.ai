import { Property, FinancialConfig, AnalysisResult, ErrorRecord } from '/Users/sriram/projects/dealflowanalyzer.ai/shared/dist/types';
import { FinancialCalculatorService, MortgageCalculation, OperatingExpenses, CashFlowMetrics, ROIMetrics, AppreciationMetrics } from './financialCalculator';
import { RentalEstimationService, RentalEstimate } from './rentalEstimationService';

export interface DetailedAnalysisResult extends Omit<AnalysisResult, 'financialMetrics' | 'rentalEstimate'> {
  financialMetrics: {
    // Basic metrics
    monthlyRent: number;
    monthlyMortgagePayment: number;
    monthlyOperatingExpenses: number;
    monthlyCashFlow: number;
    annualCashFlow: number;
    
    // Enhanced breakdown
    operatingExpensesBreakdown: OperatingExpenses;
    mortgageDetails: MortgageCalculation;
    
    // ROI metrics
    cashOnCashReturn: number;
    capRate: number;
    totalReturn: number;
    appreciationValue: number;
    totalCashInvested: number;
    grossRentMultiplier: number;
    debtServiceCoverageRatio: number;
    
    // Additional metrics
    netOperatingIncome: number;
    monthlyPrincipalPayment: number;
    monthlyInterestPayment: number;
    
    // Long-term projections
    projectedValue: number;
    totalCashFlowProjected: number;
    totalReturnProjected: number;
    annualizedReturn: number;
  };
  
  rentalEstimate: RentalEstimate;
}

export interface BatchAnalysisResult {
  timestamp: string;
  zipCodes: string[];
  totalProperties: number;
  successfulAnalyses: number;
  failedAnalyses: number;
  results: DetailedAnalysisResult[];
  errors: ErrorRecord[];
  summary: {
    averageCashFlow: number;
    averageROI: number;
    averageCapRate: number;
    topPerformers: string[]; // Property IDs
    dataQualityScore: number;
  };
}

export class FinancialAnalysisService {
  private financialCalculator: FinancialCalculatorService;
  private rentalEstimationService: RentalEstimationService;

  constructor(hudDataPath?: string) {
    this.financialCalculator = new FinancialCalculatorService();
    this.rentalEstimationService = new RentalEstimationService(hudDataPath);
  }

  /**
   * Analyze a single property
   */
  async analyzeProperty(
    property: Property,
    config: FinancialConfig
  ): Promise<DetailedAnalysisResult> {
    try {
      // Step 1: Estimate rental income
      const rentalEstimate = await this.rentalEstimationService.estimateRental(property, config);
      
      // Step 2: Calculate mortgage details
      const mortgageCalculation = this.financialCalculator.calculateMortgagePayment(
        property.price,
        config.mortgage
      );
      
      // Step 3: Calculate operating expenses
      const operatingExpenses = this.financialCalculator.calculateOperatingExpenses(
        rentalEstimate.monthlyRent,
        property.price,
        config.operatingExpenses
      );
      
      // Step 4: Calculate cash flow
      const cashFlowMetrics = this.financialCalculator.calculateCashFlow(
        rentalEstimate.monthlyRent,
        mortgageCalculation,
        operatingExpenses
      );
      
      // Step 5: Calculate ROI metrics
      const roiMetrics = this.financialCalculator.calculateROIMetrics(
        cashFlowMetrics,
        mortgageCalculation,
        property.price
      );
      
      // Step 6: Calculate appreciation
      const appreciationMetrics = this.financialCalculator.calculateAppreciation(
        property.price,
        config.appreciation,
        cashFlowMetrics.annualCashFlow
      );
      
      // Step 7: Assess data quality
      const dataQuality = this.assessDataQuality(property, rentalEstimate);
      
      // Step 8: Create detailed analysis result
      const result: DetailedAnalysisResult = {
        propertyId: property.zpid,
        analysisDate: new Date().toISOString(),
        financialMetrics: {
          // Basic metrics
          monthlyRent: rentalEstimate.monthlyRent,
          monthlyMortgagePayment: mortgageCalculation.monthlyPayment,
          monthlyOperatingExpenses: operatingExpenses.total,
          monthlyCashFlow: cashFlowMetrics.monthlyCashFlow,
          annualCashFlow: cashFlowMetrics.annualCashFlow,
          
          // Enhanced breakdown
          operatingExpensesBreakdown: operatingExpenses,
          mortgageDetails: mortgageCalculation,
          
          // ROI metrics
          cashOnCashReturn: roiMetrics.cashOnCashReturn,
          capRate: roiMetrics.capRate,
          totalReturn: appreciationMetrics.totalReturn,
          appreciationValue: appreciationMetrics.appreciationValue,
          totalCashInvested: roiMetrics.totalCashInvested,
          grossRentMultiplier: roiMetrics.grossRentMultiplier,
          debtServiceCoverageRatio: roiMetrics.debtServiceCoverageRatio,
          
          // Additional metrics
          netOperatingIncome: cashFlowMetrics.annualNetOperatingIncome,
          monthlyPrincipalPayment: mortgageCalculation.monthlyPrincipal,
          monthlyInterestPayment: mortgageCalculation.monthlyInterest,
          
          // Long-term projections
          projectedValue: appreciationMetrics.projectedValue,
          totalCashFlowProjected: cashFlowMetrics.annualCashFlow * config.appreciation.holdingPeriodYears,
          totalReturnProjected: appreciationMetrics.totalReturn,
          annualizedReturn: appreciationMetrics.annualizedReturn
        },
        
        rentalEstimate,
        
        assumptions: {
          mortgageRate: config.mortgage.interestRate,
          downPaymentPercent: config.mortgage.downPaymentPercent,
          propertyManagementPercent: config.operatingExpenses.propertyManagementPercent,
          maintenancePercent: config.operatingExpenses.maintenancePercent,
          vacancyRate: config.operatingExpenses.vacancyRate,
          insurancePercent: config.operatingExpenses.insurancePercent,
          propertyTaxPercent: config.operatingExpenses.propertyTaxPercent,
          annualAppreciationPercent: config.appreciation.annualAppreciationPercent
        },
        
        dataQuality
      };
      
      return result;
      
    } catch (error) {
      console.error(`Error analyzing property ${property.zpid}:`, error);
      throw new Error(`Analysis failed for property ${property.zpid}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze multiple properties in batch
   */
  async analyzeProperties(
    properties: Property[],
    config: FinancialConfig
  ): Promise<DetailedAnalysisResult[]> {
    const results: DetailedAnalysisResult[] = [];
    
    console.log(`Starting batch analysis of ${properties.length} properties`);
    
    for (let i = 0; i < properties.length; i++) {
      const property = properties[i];
      if (!property) continue;
      
      try {
        console.log(`Analyzing property ${i + 1}/${properties.length}: ${property.address}`);
        const result = await this.analyzeProperty(property, config);
        results.push(result);
      } catch (error) {
        console.error(`Failed to analyze property ${property.zpid}:`, error);
        // Continue with other properties even if one fails
      }
    }
    
    console.log(`Batch analysis completed: ${results.length}/${properties.length} successful`);
    return results;
  }

  /**
   * Analyze properties by zip codes
   */
  async analyzeBatch(
    properties: Property[],
    config: FinancialConfig
  ): Promise<BatchAnalysisResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const errors: ErrorRecord[] = [];
    
    // Group properties by zip code for reporting
    const zipCodes = [...new Set(properties.map(p => this.extractZipCode(p.address)).filter((zip): zip is string => zip !== null))];
    
    console.log(`Starting batch analysis for ${zipCodes.length} zip codes, ${properties.length} properties`);
    
    // Analyze all properties
    const results: DetailedAnalysisResult[] = [];
    
    for (const property of properties) {
      try {
        const result = await this.analyzeProperty(property, config);
        results.push(result);
      } catch (error) {
        const errorRecord: ErrorRecord = {
          timestamp: new Date().toISOString(),
          propertyId: property.zpid,
          errorType: 'ANALYSIS_ERROR',
          errorMessage: `Failed to analyze property: ${error instanceof Error ? error.message : 'Unknown error'}`,
          errorDetails: error,
          context: {
            zipCode: this.extractZipCode(property.address) || undefined,
            operation: 'batch_analysis'
          }
        };
        errors.push(errorRecord);
      }
    }
    
    // Generate summary statistics
    const summary = this.generateAnalysisSummary(results);
    
    const duration = Date.now() - startTime;
    console.log(`Batch analysis completed in ${duration}ms: ${results.length} successful, ${errors.length} failed`);
    
    return {
      timestamp,
      zipCodes,
      totalProperties: properties.length,
      successfulAnalyses: results.length,
      failedAnalyses: errors.length,
      results,
      errors,
      summary
    };
  }

  /**
   * Assess data quality for a property and rental estimate
   */
  private assessDataQuality(property: Property, rentalEstimate: RentalEstimate): AnalysisResult['dataQuality'] {
    const missingDataFields: string[] = [];
    
    // Check for missing property data
    if (!property.rentZestimate) missingDataFields.push('rentZestimate');
    if (!property.zestimate) missingDataFields.push('zestimate');
    if (!property.imgSrc) missingDataFields.push('imgSrc');
    if (!property.priceChange) missingDataFields.push('priceChange');
    if (!property.datePriceChanged) missingDataFields.push('datePriceChanged');
    
    // Check required fields
    const hasRequiredData = property.price > 0 && property.livingArea > 0 && property.bedrooms > 0;
    
    return {
      hasRentalData: rentalEstimate.source !== 'FALLBACK',
      hasZestimate: !!property.zestimate,
      hasPriceHistory: !!property.priceChange,
      missingDataFields
    };
  }

  /**
   * Generate summary statistics for batch analysis
   */
  private generateAnalysisSummary(results: DetailedAnalysisResult[]): BatchAnalysisResult['summary'] {
    if (results.length === 0) {
      return {
        averageCashFlow: 0,
        averageROI: 0,
        averageCapRate: 0,
        topPerformers: [],
        dataQualityScore: 0
      };
    }
    
    const cashFlows = results.map(r => r.financialMetrics.annualCashFlow);
    const rois = results.map(r => r.financialMetrics.cashOnCashReturn);
    const capRates = results.map(r => r.financialMetrics.capRate);
    
    const averageCashFlow = cashFlows.reduce((sum, cf) => sum + cf, 0) / cashFlows.length;
    const averageROI = rois.reduce((sum, roi) => sum + roi, 0) / rois.length;
    const averageCapRate = capRates.reduce((sum, cap) => sum + cap, 0) / capRates.length;
    
    // Find top performers by cash-on-cash return
    const topPerformers = results
      .sort((a, b) => b.financialMetrics.cashOnCashReturn - a.financialMetrics.cashOnCashReturn)
      .slice(0, 5)
      .map(r => r.propertyId);
    
    // Calculate data quality score (percentage of properties with good data quality)
    const goodQualityCount = results.filter(r => 
      r.dataQuality.hasRentalData && 
      r.dataQuality.hasZestimate && 
      r.dataQuality.missingDataFields.length <= 2
    ).length;
    const dataQualityScore = (goodQualityCount / results.length) * 100;
    
    return {
      averageCashFlow: Math.round(averageCashFlow * 100) / 100,
      averageROI: Math.round(averageROI * 100) / 100,
      averageCapRate: Math.round(averageCapRate * 100) / 100,
      topPerformers,
      dataQualityScore: Math.round(dataQualityScore * 100) / 100
    };
  }

  /**
   * Extract zip code from address
   */
  private extractZipCode(address: string): string | null {
    const addressParts = address.split(',');
    if (addressParts.length < 2) return null;
    
    const lastPart = addressParts[addressParts.length - 1]?.trim();
    if (!lastPart) return null;
    
    const zipMatch = lastPart.match(/\b(\d{5})(?:-\d{4})?\b/);
    return zipMatch ? zipMatch[1]! : null;
  }

  /**
   * Get rental estimation service for direct access
   */
  getRentalEstimationService(): RentalEstimationService {
    return this.rentalEstimationService;
  }

  /**
   * Get financial calculator service for direct access
   */
  getFinancialCalculatorService(): FinancialCalculatorService {
    return this.financialCalculator;
  }
}