const fs = require('fs');
const path = require('path');

async function generateAnalysisViaAPI() {
  console.log('🔄 Generating Analysis Data via Backend API...\n');

  try {
    // Load properties from both zip codes
    const zip1File = path.join(__dirname, '../data/properties/43211/2025-09-15/Columbus OH - Simplified Buybox.json');
    const zip2File = path.join(__dirname, '../data/properties/43224/2025-09-15/Columbus OH - Simplified Buybox.json');

    const zip1Data = JSON.parse(fs.readFileSync(zip1File, 'utf-8'));
    const zip2Data = JSON.parse(fs.readFileSync(zip2File, 'utf-8'));

    const allProperties = [...zip1Data.properties, ...zip2Data.properties];

    console.log(`📊 Loaded ${allProperties.length} properties (${zip1Data.propertyCount} from 43211, ${zip2Data.propertyCount} from 43224)`);

    // Filter to valid properties
    const validProperties = allProperties.filter(p =>
      p.price > 1000 && p.bedrooms > 0 && p.livingArea > 0
    );

    console.log(`🔍 Analyzing ${validProperties.length} valid properties via backend API...\n`);

    // Call backend API
    const response = await fetch('http://localhost:8000/api/analysis/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        properties: validProperties,
        saveResults: true
      })
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    console.log(`✅ Analysis Complete:`);
    console.log(`   - Successful: ${result.result.successfulAnalyses}/${result.result.totalProperties}`);
    console.log(`   - Average Cash Flow: $${result.result.summary.averageCashFlow.toLocaleString()}`);
    console.log(`   - Average ROI: ${result.result.summary.averageROI.toFixed(2)}%`);
    console.log(`   - Average Cap Rate: ${result.result.summary.averageCapRate.toFixed(2)}%`);

    // Save results for frontend (for now, until we update frontend to call API)
    const frontendDataDir = path.join(__dirname, '../frontend/public/data');
    if (!fs.existsSync(frontendDataDir)) {
      fs.mkdirSync(frontendDataDir, { recursive: true });
    }

    // Create simplified data structure for frontend
    const frontendData = {
      timestamp: result.timestamp,
      summary: result.result.summary,
      properties: result.result.results.map(r => {
        const originalProp = validProperties.find(p => p.zpid === r.propertyId);
        return {
          id: r.propertyId,
          analysisDate: r.analysisDate,
          address: originalProp?.address || `Property ${r.propertyId}`,
          zipCode: originalProp?.zipcode || 'unknown',
          zillowUrl: originalProp?.detailUrl || '',
          price: originalProp?.price || 0,
          bedrooms: originalProp?.bedrooms || 0,
          bathrooms: originalProp?.bathrooms || 0,
          livingArea: originalProp?.livingArea || 0,
          monthlyRent: r.financialMetrics.monthlyRent,
          monthlyMortgage: r.financialMetrics.monthlyMortgagePayment,
          monthlyExpenses: r.financialMetrics.monthlyOperatingExpenses,
          monthlyCashFlow: r.financialMetrics.monthlyCashFlow,
          annualCashFlow: r.financialMetrics.annualCashFlow,
          cashOnCashReturn: r.financialMetrics.cashOnCashReturn,
          capRate: r.financialMetrics.capRate,
          totalCashInvested: r.financialMetrics.totalCashInvested,
          projectedValue: r.financialMetrics.projectedValue,
          rentSource: r.rentalEstimate.source,
          rentConfidence: r.rentalEstimate.confidence,
          hasRentalData: r.dataQuality.hasRentalData,
          hasZestimate: r.dataQuality.hasZestimate,
          missingFields: r.dataQuality.missingDataFields.length,
          isPositiveCashFlow: r.financialMetrics.monthlyCashFlow > 0,
          isGoodROI: r.financialMetrics.cashOnCashReturn > 8,
          isGoodCapRate: r.financialMetrics.capRate > 6
        };
      })
    };

    const outputFile = path.join(frontendDataDir, 'analysis-results.json');
    fs.writeFileSync(outputFile, JSON.stringify(frontendData, null, 2));

    console.log(`\n💾 Saved frontend data to: ${outputFile}`);
    console.log(`📊 Generated data for ${frontendData.properties.length} properties`);

    const positiveFlowCount = frontendData.properties.filter(p => p.isPositiveCashFlow).length;
    const goodROICount = frontendData.properties.filter(p => p.isGoodROI).length;

    console.log(`\n📈 Summary Statistics:`);
    console.log(`   - Positive Cash Flow: ${positiveFlowCount}/${frontendData.properties.length} (${(positiveFlowCount/frontendData.properties.length*100).toFixed(1)}%)`);
    console.log(`   - Good ROI (>8%): ${goodROICount}/${frontendData.properties.length} (${(goodROICount/frontendData.properties.length*100).toFixed(1)}%)`);

    console.log(`\n✅ Analysis data ready!`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

generateAnalysisViaAPI().catch(console.error);
