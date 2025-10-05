import { readFileSync } from 'fs';
import { join } from 'path';
import { Property, FinancialConfig } from '../shared/dist/types';
import { FinancialAnalysisService } from '../backend/dist/services/financialAnalysisService';

async function testFinancialAnalysisEngine() {
  console.log('🚀 Financial Analysis Engine Test');
  console.log('==================================\n');

  try {
    // Load existing property data
    const propertyFile = join(__dirname, '../data/properties/43211/2025-09-15/Columbus OH - Simplified Buybox.json');
    const propertyData = JSON.parse(readFileSync(propertyFile, 'utf-8'));
    
    console.log(`📊 Loaded ${propertyData.propertyCount} properties from ${propertyData.zipCode}`);
    console.log(`📅 Data timestamp: ${propertyData.timestamp}\n`);

    // Load financial configuration
    const configFile = join(__dirname, '../config/financial.json');
    const financialConfig: FinancialConfig = JSON.parse(readFileSync(configFile, 'utf-8'));
    
    console.log('⚙️  Financial Configuration:');
    console.log(`   Mortgage Rate: ${financialConfig.mortgage.interestRate}%`);
    console.log(`   Down Payment: ${financialConfig.mortgage.downPaymentPercent}%`);
    console.log(`   Property Management: ${financialConfig.operatingExpenses.propertyManagementPercent}%`);
    console.log(`   Maintenance: ${financialConfig.operatingExpenses.maintenancePercent}%`);
    console.log(`   Vacancy Rate: ${financialConfig.operatingExpenses.vacancyRate}%`);
    console.log(`   Appreciation: ${financialConfig.appreciation.annualAppreciationPercent}%/year`);
    console.log(`   HUD Data: ${financialConfig.rental.useHudData ? 'Enabled' : 'Disabled'}\n`);

    // Initialize the financial analysis service
    const analysisService = new FinancialAnalysisService('./data/hud-rental-data.json');
    
    // Test HUD data loading
    console.log('🏠 Testing HUD Data Service...');
    const hudService = analysisService.getRentalEstimationService().getHudDataService();
    
    try {
      await hudService.loadHudData();
      const hudStats = hudService.getHudDataStats();
      console.log(`   ✅ HUD data loaded: ${hudStats.totalRecords} records`);
      console.log(`   📍 Zip codes: ${hudStats.uniqueZipCodes}`);
      console.log(`   🛏️  Bedroom range: ${hudStats.bedroomRange.min}-${hudStats.bedroomRange.max}`);
      console.log(`   💰 Average rent: $${hudStats.averageRent}`);
      
      // Test HUD matching for our zip codes
      const testZipCodes = ['43211', '43224'];
      for (const zipCode of testZipCodes) {
        const hudData = hudService.searchHudData({ zipCode });
        console.log(`   📍 ${zipCode}: ${hudData.length} HUD records`);
      }
    } catch (error) {
      console.log(`   ⚠️  HUD data error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    console.log('');

    // Filter properties with valid data for testing
    const validProperties: Property[] = propertyData.properties.filter((p: Property) => 
      p.price > 1000 && // Filter out the $1 anomaly
      p.bedrooms > 0 && 
      p.livingArea > 0
    );
    
    console.log(`🔍 Filtered to ${validProperties.length} valid properties (price > $1000, bedrooms > 0)\n`);

    // Test single property analysis
    console.log('🏡 Testing Single Property Analysis...');
    const testProperty = validProperties[0];
    if (testProperty) {
      console.log(`   Property: ${testProperty.address}`);
      console.log(`   Price: $${testProperty.price.toLocaleString()}`);
      console.log(`   Bedrooms: ${testProperty.bedrooms}, Bathrooms: ${testProperty.bathrooms}`);
      console.log(`   Living Area: ${testProperty.livingArea.toLocaleString()} sq ft`);
      console.log(`   Zillow Rent Estimate: $${testProperty.rentZestimate?.toLocaleString() || 'N/A'}\n`);
      
      try {
        const startTime = Date.now();
        const result = await analysisService.analyzeProperty(testProperty, financialConfig);
        const duration = Date.now() - startTime;
        
        console.log('   📈 Analysis Results:');
        console.log(`   ⏱️  Analysis time: ${duration}ms`);
        console.log(`   💰 Monthly rent: $${result.rentalEstimate.monthlyRent.toLocaleString()} (${result.rentalEstimate.source})`);
        console.log(`   🏦 Monthly mortgage: $${result.financialMetrics.monthlyMortgagePayment.toLocaleString()}`);
        console.log(`   💸 Monthly expenses: $${result.financialMetrics.monthlyOperatingExpenses.toLocaleString()}`);
        console.log(`   💵 Monthly cash flow: $${result.financialMetrics.monthlyCashFlow.toLocaleString()}`);
        console.log(`   📊 Cash-on-cash return: ${result.financialMetrics.cashOnCashReturn.toFixed(2)}%`);
        console.log(`   🎯 Cap rate: ${result.financialMetrics.capRate.toFixed(2)}%`);
        console.log(`   💎 Total cash invested: $${result.financialMetrics.totalCashInvested.toLocaleString()}`);
        console.log(`   📈 Projected value (${financialConfig.appreciation.holdingPeriodYears}yr): $${result.financialMetrics.projectedValue.toLocaleString()}`);
        
        // Investment assessment
        console.log('\n   🎯 Investment Assessment:');
        if (result.financialMetrics.monthlyCashFlow > 0) {
          console.log('   ✅ Positive monthly cash flow');
        } else {
          console.log('   ❌ Negative monthly cash flow');
        }
        
        if (result.financialMetrics.cashOnCashReturn > 8) {
          console.log('   ✅ Excellent cash-on-cash return (>8%)');
        } else if (result.financialMetrics.cashOnCashReturn > 4) {
          console.log('   ⚠️  Moderate cash-on-cash return (4-8%)');
        } else {
          console.log('   ❌ Low cash-on-cash return (<4%)');
        }
        
        if (result.financialMetrics.capRate > 6) {
          console.log('   ✅ Good cap rate (>6%)');
        } else if (result.financialMetrics.capRate > 4) {
          console.log('   ⚠️  Moderate cap rate (4-6%)');
        } else {
          console.log('   ❌ Low cap rate (<4%)');
        }
        
        console.log(`\n   📋 Data Quality: ${result.dataQuality.hasRentalData ? '✅' : '❌'} Rental, ${result.dataQuality.hasZestimate ? '✅' : '❌'} Zestimate`);
        if (result.dataQuality.missingDataFields.length > 0) {
          console.log(`   ⚠️  Missing fields: ${result.dataQuality.missingDataFields.join(', ')}`);
        }
        
      } catch (error) {
        console.error(`   ❌ Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    console.log('\n');

    // Test batch analysis on a small sample
    console.log('📊 Testing Batch Analysis...');
    const sampleProperties = validProperties.slice(0, 5);
    console.log(`   Analyzing ${sampleProperties.length} properties...\n`);
    
    try {
      const startTime = Date.now();
      const batchResult = await analysisService.analyzeBatch(sampleProperties, financialConfig);
      const duration = Date.now() - startTime;
      
      console.log('   📈 Batch Analysis Results:');
      console.log(`   ⏱️  Total time: ${duration}ms (${Math.round(duration / sampleProperties.length)}ms per property)`);
      console.log(`   ✅ Successful: ${batchResult.successfulAnalyses}/${batchResult.totalProperties}`);
      console.log(`   ❌ Failed: ${batchResult.failedAnalyses}`);
      console.log(`   💰 Average cash flow: $${batchResult.summary.averageCashFlow.toLocaleString()}`);
      console.log(`   📊 Average ROI: ${batchResult.summary.averageROI.toFixed(2)}%`);
      console.log(`   🎯 Average cap rate: ${batchResult.summary.averageCapRate.toFixed(2)}%`);
      console.log(`   📋 Data quality score: ${batchResult.summary.dataQualityScore.toFixed(1)}%`);
      
      if (batchResult.summary.topPerformers.length > 0) {
        console.log(`   🏆 Top performer: ${batchResult.summary.topPerformers[0]}`);
      }
      
      if (batchResult.errors.length > 0) {
        console.log(`\n   ⚠️  Errors encountered:`);
        batchResult.errors.slice(0, 3).forEach((error, index) => {
          console.log(`   ${index + 1}. ${error.errorMessage}`);
        });
      }
      
    } catch (error) {
      console.error(`   ❌ Batch analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    console.log('\n✅ Financial Analysis Engine test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : 'Unknown error');
    console.error(error);
  }
}

// Run the test
testFinancialAnalysisEngine().catch(console.error);