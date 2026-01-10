import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Property, FinancialConfig } from '../shared/dist/types';
import { FinancialAnalysisService } from '../backend/dist/services/financialAnalysisService';

async function generateAnalysisData() {
  console.log('🔄 Generating Analysis Data for Dashboard...\n');

  try {
    // Load existing property data
    const propertyFile = join(__dirname, '../data/properties/43211/2025-09-15/Columbus OH - Simplified Buybox.json');
    const propertyData = JSON.parse(readFileSync(propertyFile, 'utf-8'));
    
    console.log(`📊 Loaded ${propertyData.propertyCount} properties from ${propertyData.zipCode}`);

    // Load financial configuration
    const configFile = join(__dirname, '../config/financial.json');
    const financialConfig: FinancialConfig = JSON.parse(readFileSync(configFile, 'utf-8'));
    
    // Initialize analysis service
    const analysisService = new FinancialAnalysisService('./data/hud-rental-data.json');
    
    // Filter to valid properties
    const validProperties: Property[] = propertyData.properties.filter((p: Property) => 
      p.price > 1000 && p.bedrooms > 0 && p.livingArea > 0
    );
    
    console.log(`🔍 Analyzing ${validProperties.length} valid properties...\n`);

    // Run batch analysis
    const batchResult = await analysisService.analyzeBatch(validProperties, financialConfig);
    
    console.log(`✅ Analysis Complete:`);
    console.log(`   - Successful: ${batchResult.successfulAnalyses}/${batchResult.totalProperties}`);
    console.log(`   - Average Cash Flow: $${batchResult.summary.averageCashFlow.toLocaleString()}`);
    console.log(`   - Average ROI: ${batchResult.summary.averageROI.toFixed(2)}%`);
    
    // Save results for frontend consumption
    const frontendDataDir = join(__dirname, '../frontend/public/data');
    if (!existsSync(frontendDataDir)) {
      mkdirSync(frontendDataDir, { recursive: true });
    }
    
    // Create simplified data structure for frontend
    const frontendData = {
      timestamp: batchResult.timestamp,
      summary: batchResult.summary,
      properties: batchResult.results.map(result => ({
        id: result.propertyId,
        analysisDate: result.analysisDate,
        
        // Find the original property data to get address and URL
        address: validProperties.find(p => p.zpid === result.propertyId)?.address || `Property ${result.propertyId}`,
        zipCode: '43211',
        zillowUrl: validProperties.find(p => p.zpid === result.propertyId)?.detailUrl || '',
        price: validProperties.find(p => p.zpid === result.propertyId)?.price || 0,
        bedrooms: validProperties.find(p => p.zpid === result.propertyId)?.bedrooms || 0,
        bathrooms: validProperties.find(p => p.zpid === result.propertyId)?.bathrooms || 0,
        livingArea: validProperties.find(p => p.zpid === result.propertyId)?.livingArea || 0,
        
        // Financial metrics
        monthlyRent: result.financialMetrics.monthlyRent,
        monthlyMortgage: result.financialMetrics.monthlyMortgagePayment,
        monthlyExpenses: result.financialMetrics.monthlyOperatingExpenses,
        monthlyCashFlow: result.financialMetrics.monthlyCashFlow,
        annualCashFlow: result.financialMetrics.annualCashFlow,
        cashOnCashReturn: result.financialMetrics.cashOnCashReturn,
        capRate: result.financialMetrics.capRate,
        totalCashInvested: result.financialMetrics.totalCashInvested,
        projectedValue: result.financialMetrics.projectedValue,
        
        // Rental info
        rentSource: result.rentalEstimate.source,
        rentConfidence: result.rentalEstimate.confidence,
        
        // Data quality
        hasRentalData: result.dataQuality.hasRentalData,
        hasZestimate: result.dataQuality.hasZestimate,
        missingFields: result.dataQuality.missingDataFields.length,
        
        // Investment assessment
        isPositiveCashFlow: result.financialMetrics.monthlyCashFlow > 0,
        isGoodROI: result.financialMetrics.cashOnCashReturn > 8,
        isGoodCapRate: result.financialMetrics.capRate > 6
      }))
    };
    
    // Save to frontend public directory
    const outputFile = join(frontendDataDir, 'analysis-results.json');
    writeFileSync(outputFile, JSON.stringify(frontendData, null, 2));
    
    console.log(`\n💾 Saved analysis data to: ${outputFile}`);
    console.log(`📊 Generated data for ${frontendData.properties.length} properties`);
    
    // Generate summary stats
    const positiveFlowCount = frontendData.properties.filter(p => p.isPositiveCashFlow).length;
    const goodROICount = frontendData.properties.filter(p => p.isGoodROI).length;
    const goodCapRateCount = frontendData.properties.filter(p => p.isGoodCapRate).length;
    
    console.log(`\n📈 Summary Statistics:`);
    console.log(`   - Positive Cash Flow: ${positiveFlowCount}/${frontendData.properties.length} (${(positiveFlowCount/frontendData.properties.length*100).toFixed(1)}%)`);
    console.log(`   - Good ROI (>8%): ${goodROICount}/${frontendData.properties.length} (${(goodROICount/frontendData.properties.length*100).toFixed(1)}%)`);
    console.log(`   - Good Cap Rate (>6%): ${goodCapRateCount}/${frontendData.properties.length} (${(goodCapRateCount/frontendData.properties.length*100).toFixed(1)}%)`);
    
    if (positiveFlowCount > 0) {
      const bestProperty = frontendData.properties.reduce((best, current) => 
        current.cashOnCashReturn > best.cashOnCashReturn ? current : best
      );
      console.log(`\n🏆 Best Investment:`);
      console.log(`   - Property: ${bestProperty.address}`);
      console.log(`   - Monthly Cash Flow: $${bestProperty.monthlyCashFlow.toLocaleString()}`);
      console.log(`   - ROI: ${bestProperty.cashOnCashReturn.toFixed(2)}%`);
    }
    
    console.log(`\n✅ Analysis data ready for frontend dashboard!`);
    
  } catch (error) {
    console.error('❌ Error generating analysis data:', error);
  }
}

generateAnalysisData().catch(console.error);