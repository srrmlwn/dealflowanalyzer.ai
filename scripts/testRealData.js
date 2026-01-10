const { readFileSync } = require('fs');
const { join } = require('path');

async function testWithRealData() {
  console.log('🏠 Testing with Real Property Data');
  console.log('==================================\n');

  try {
    // Load real property data
    const propertyFile = join(__dirname, '../data/properties/43211/2025-09-15/Columbus OH - Simplified Buybox.json');
    const propertyData = JSON.parse(readFileSync(propertyFile, 'utf-8'));
    
    console.log(`📊 Loaded ${propertyData.propertyCount} properties from ${propertyData.zipCode}`);
    console.log(`📅 Data timestamp: ${propertyData.timestamp}\n`);

    // Test single property analysis via API
    const testProperty = propertyData.properties.find(p => p.price > 0 && p.bedrooms > 0);
    
    if (!testProperty) {
      console.log('❌ No valid test property found');
      return;
    }

    console.log('🧪 Testing Single Property Analysis');
    console.log('-----------------------------------');
    console.log(`Property: ${testProperty.address || 'Unknown Address'}`);
    console.log(`Price: $${testProperty.price?.toLocaleString() || 'N/A'}`);
    console.log(`Bedrooms: ${testProperty.bedrooms}, Bathrooms: ${testProperty.bathrooms}`);
    console.log(`Rent Estimate: $${testProperty.rentZestimate?.toLocaleString() || 'N/A'}/month\n`);

    // Make API call to analyze property
    const response = await fetch('http://localhost:8000/api/analysis/property', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        property: testProperty
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ API Analysis Result:');
      console.log(`   Monthly Rent: $${result.result.rentalEstimate.monthlyRent} (${result.result.rentalEstimate.source})`);
      console.log(`   Monthly Cash Flow: $${result.result.financialMetrics.monthlyCashFlow}`);
      console.log(`   Cash-on-Cash Return: ${result.result.financialMetrics.cashOnCashReturn.toFixed(2)}%`);
      console.log(`   Cap Rate: ${result.result.financialMetrics.capRate.toFixed(2)}%`);
      console.log(`   Total Investment: $${result.result.financialMetrics.totalCashInvested.toLocaleString()}`);
      
      // Investment assessment
      const cashFlow = result.result.financialMetrics.monthlyCashFlow;
      const roi = result.result.financialMetrics.cashOnCashReturn;
      
      console.log('\n📈 Investment Assessment:');
      if (cashFlow > 0) {
        console.log('✅ Positive monthly cash flow');
      } else {
        console.log('❌ Negative monthly cash flow');
      }
      
      if (roi > 8) {
        console.log('✅ Excellent ROI (>8%)');
      } else if (roi > 4) {
        console.log('⚠️  Moderate ROI (4-8%)');
      } else {
        console.log('❌ Low ROI (<4%)');
      }
      
    } else {
      console.log('❌ API call failed:', response.status, response.statusText);
    }

    // Test batch analysis with a few properties
    console.log('\n🔄 Testing Batch Analysis');
    console.log('-------------------------');
    
    const testProperties = propertyData.properties
      .filter(p => p.price > 0 && p.bedrooms > 0)
      .slice(0, 3);
    
    const batchResponse = await fetch('http://localhost:8000/api/analysis/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: testProperties,
        saveResults: false
      })
    });

    if (batchResponse.ok) {
      const batchResult = await batchResponse.json();
      console.log(`✅ Batch Analysis Complete:`);
      console.log(`   Analyzed: ${batchResult.result.successfulAnalyses}/${batchResult.result.totalProperties} properties`);
      console.log(`   Average Cash Flow: $${batchResult.result.summary.averageCashFlow.toLocaleString()}`);
      console.log(`   Average ROI: ${batchResult.result.summary.averageROI.toFixed(2)}%`);
      console.log(`   Data Quality: ${batchResult.result.summary.dataQualityScore.toFixed(1)}%`);
    } else {
      console.log('❌ Batch analysis failed:', batchResponse.status);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Add fetch polyfill for Node.js
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

testWithRealData().catch(console.error);