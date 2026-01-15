import { config } from '../backend/src/config/config';
import { PropertyService } from '../backend/src/services/propertyService';
import { FinancialAnalysisService } from '../backend/src/services/financialAnalysisService';
import { AnalysisStorageService } from '../backend/src/services/analysisStorageService';

/**
 * Test the analysis pipeline with existing property data
 */
async function testPipeline() {
  console.log('\n=== Testing Analysis Pipeline ===\n');

  try {
    // Load configs
    const buyboxConfig = config.getBuyboxConfig();
    const financialConfig = config.getFinancialConfig();

    console.log(`Testing with buybox: ${buyboxConfig.name}`);
    console.log(`Zip codes: ${buyboxConfig.zipCodes.join(', ')}\n`);

    // Initialize services
    const propertyService = new PropertyService({
      apiKey: 'test',
      apiHost: 'test',
      rateLimit: 100,
      rateWindow: 86400,
      dataPath: './data'
    });

    const hudDataPath = './data/hud-rental-data.json';
    const financialAnalysisService = new FinancialAnalysisService(hudDataPath, './data');
    const analysisStorageService = new AnalysisStorageService('./data');

    let totalAnalyzed = 0;
    let totalSuccessful = 0;

    // Process each zip code
    for (const zipCode of buyboxConfig.zipCodes) {
      console.log(`\n--- Processing ${zipCode} ---`);

      // Load existing properties
      const properties = propertyService.loadPropertiesFromDisk(zipCode);

      if (properties.length === 0) {
        console.log(`No properties found for ${zipCode}`);
        continue;
      }

      console.log(`Loaded ${properties.length} properties from disk`);

      // Run analysis
      const analysisResult = await financialAnalysisService.analyzeBatch(
        properties,
        financialConfig
      );

      // Save results
      await analysisStorageService.saveAnalysisResults(
        zipCode,
        analysisResult.results,
        buyboxConfig.name
      );

      totalAnalyzed += analysisResult.totalProperties;
      totalSuccessful += analysisResult.successfulAnalyses;

      console.log(`✅ Analyzed ${analysisResult.successfulAnalyses}/${analysisResult.totalProperties} properties`);
      console.log(`   - Avg Cash Flow: $${analysisResult.summary.averageCashFlow.toFixed(2)}`);
      console.log(`   - Avg ROI: ${analysisResult.summary.averageROI.toFixed(2)}%`);
      console.log(`   - Avg Cap Rate: ${analysisResult.summary.averageCapRate.toFixed(2)}%`);
      console.log(`   - Top Performers: ${analysisResult.summary.topPerformers.slice(0, 3).join(', ')}`);
    }

    console.log(`\n=== Test Summary ===`);
    console.log(`Total Analyzed: ${totalSuccessful}/${totalAnalyzed}`);
    console.log(`Success Rate: ${((totalSuccessful / totalAnalyzed) * 100).toFixed(2)}%`);
    console.log(`\n✅ Pipeline test completed successfully!\n`);

  } catch (error) {
    console.error('\n❌ Pipeline test failed:', error);
    process.exit(1);
  }
}

// Run test
testPipeline()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
