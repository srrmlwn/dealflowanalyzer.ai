const fs = require('fs');
const path = require('path');

// Import the analysis services (we'll need to compile TypeScript first)
// For now, let's create a simple test with mock data

async function testFinancialAnalysis() {
  console.log('Financial Analysis Engine Test');
  console.log('==============================\n');

  // Load existing property data
  const propertyFile = path.join(__dirname, '../data/properties/43211/2025-09-15/Columbus OH - Simplified Buybox.json');
  
  if (!fs.existsSync(propertyFile)) {
    console.error('Property data file not found:', propertyFile);
    return;
  }

  const propertyData = JSON.parse(fs.readFileSync(propertyFile, 'utf-8'));
  console.log(`Loaded ${propertyData.propertyCount} properties from ${propertyData.zipCode}`);
  console.log(`Data timestamp: ${propertyData.timestamp}\n`);

  // Show sample properties
  console.log('Sample Properties:');
  console.log('==================');
  
  const sampleProperties = propertyData.properties.slice(0, 5);
  sampleProperties.forEach((property, index) => {
    console.log(`${index + 1}. ${property.address}`);
    console.log(`   Price: $${property.price?.toLocaleString() || 'N/A'}`);
    console.log(`   Bedrooms: ${property.bedrooms || 'N/A'}, Bathrooms: ${property.bathrooms || 'N/A'}`);
    console.log(`   Living Area: ${property.livingArea?.toLocaleString() || 'N/A'} sq ft`);
    console.log(`   Rent Estimate: $${property.rentZestimate?.toLocaleString() || 'N/A'}/month`);
    console.log(`   Zestimate: $${property.zestimate?.toLocaleString() || 'N/A'}`);
    console.log('');
  });

  // Load financial configuration
  const configFile = path.join(__dirname, '../config/financial.json');
  const financialConfig = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
  
  console.log('Financial Configuration:');
  console.log('========================');
  console.log(`Mortgage Rate: ${financialConfig.mortgage.interestRate}%`);
  console.log(`Down Payment: ${financialConfig.mortgage.downPaymentPercent}%`);
  console.log(`Property Management: ${financialConfig.operatingExpenses.propertyManagementPercent}%`);
  console.log(`Maintenance: ${financialConfig.operatingExpenses.maintenancePercent}%`);
  console.log(`Vacancy Rate: ${financialConfig.operatingExpenses.vacancyRate}%`);
  console.log(`Appreciation: ${financialConfig.appreciation.annualAppreciationPercent}%/year`);
  console.log('');

  // Manual calculation for first property to test our logic
  const testProperty = sampleProperties[0];
  if (testProperty && testProperty.price && testProperty.rentZestimate) {
    console.log('Manual Analysis Test:');
    console.log('=====================');
    console.log(`Property: ${testProperty.address}`);
    console.log(`Purchase Price: $${testProperty.price.toLocaleString()}`);
    console.log(`Monthly Rent: $${testProperty.rentZestimate.toLocaleString()}`);
    console.log('');

    // Calculate mortgage payment
    const price = testProperty.price;
    const downPayment = price * (financialConfig.mortgage.downPaymentPercent / 100);
    const loanAmount = price - downPayment;
    const monthlyRate = (financialConfig.mortgage.interestRate / 100) / 12;
    const numberOfPayments = financialConfig.mortgage.loanTermYears * 12;
    
    const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
    
    // Calculate operating expenses
    const monthlyRent = testProperty.rentZestimate;
    const propertyManagement = monthlyRent * (financialConfig.operatingExpenses.propertyManagementPercent / 100);
    const maintenance = monthlyRent * (financialConfig.operatingExpenses.maintenancePercent / 100);
    const vacancy = monthlyRent * (financialConfig.operatingExpenses.vacancyRate / 100);
    const insurance = (price * (financialConfig.operatingExpenses.insurancePercent / 100)) / 12;
    const propertyTax = (price * (financialConfig.operatingExpenses.propertyTaxPercent / 100)) / 12;
    
    const totalExpenses = propertyManagement + maintenance + vacancy + insurance + propertyTax;
    const monthlyCashFlow = monthlyRent - monthlyPayment - totalExpenses;
    const annualCashFlow = monthlyCashFlow * 12;
    
    // Calculate ROI
    const totalCashInvested = downPayment + (price * 0.03); // 3% closing costs
    const cashOnCashReturn = (annualCashFlow / totalCashInvested) * 100;
    
    console.log('Calculations:');
    console.log(`  Down Payment (${financialConfig.mortgage.downPaymentPercent}%): $${downPayment.toLocaleString()}`);
    console.log(`  Loan Amount: $${loanAmount.toLocaleString()}`);
    console.log(`  Monthly Mortgage Payment: $${monthlyPayment.toFixed(2)}`);
    console.log('');
    console.log('Monthly Operating Expenses:');
    console.log(`  Property Management: $${propertyManagement.toFixed(2)}`);
    console.log(`  Maintenance: $${maintenance.toFixed(2)}`);
    console.log(`  Vacancy: $${vacancy.toFixed(2)}`);
    console.log(`  Insurance: $${insurance.toFixed(2)}`);
    console.log(`  Property Tax: $${propertyTax.toFixed(2)}`);
    console.log(`  Total Expenses: $${totalExpenses.toFixed(2)}`);
    console.log('');
    console.log('Cash Flow Analysis:');
    console.log(`  Monthly Rent: $${monthlyRent.toLocaleString()}`);
    console.log(`  Monthly Mortgage: $${monthlyPayment.toFixed(2)}`);
    console.log(`  Monthly Expenses: $${totalExpenses.toFixed(2)}`);
    console.log(`  Monthly Cash Flow: $${monthlyCashFlow.toFixed(2)}`);
    console.log(`  Annual Cash Flow: $${annualCashFlow.toFixed(2)}`);
    console.log('');
    console.log('Return Metrics:');
    console.log(`  Total Cash Invested: $${totalCashInvested.toLocaleString()}`);
    console.log(`  Cash-on-Cash Return: ${cashOnCashReturn.toFixed(2)}%`);
    
    // Determine if it's a good deal
    console.log('');
    console.log('Investment Assessment:');
    if (monthlyCashFlow > 0) {
      console.log('✅ Positive monthly cash flow');
    } else {
      console.log('❌ Negative monthly cash flow');
    }
    
    if (cashOnCashReturn > 8) {
      console.log('✅ Good cash-on-cash return (>8%)');
    } else if (cashOnCashReturn > 4) {
      console.log('⚠️  Moderate cash-on-cash return (4-8%)');
    } else {
      console.log('❌ Low cash-on-cash return (<4%)');
    }
  }

  // Summary statistics
  console.log('\n\nProperty Data Summary:');
  console.log('======================');
  
  const validProperties = propertyData.properties.filter(p => p.price && p.rentZestimate);
  const prices = validProperties.map(p => p.price);
  const rents = validProperties.map(p => p.rentZestimate);
  
  console.log(`Total Properties: ${propertyData.properties.length}`);
  console.log(`Properties with Price & Rent Data: ${validProperties.length}`);
  console.log(`Price Range: $${Math.min(...prices).toLocaleString()} - $${Math.max(...prices).toLocaleString()}`);
  console.log(`Rent Range: $${Math.min(...rents).toLocaleString()} - $${Math.max(...rents).toLocaleString()}`);
  console.log(`Average Price: $${Math.round(prices.reduce((a, b) => a + b, 0) / prices.length).toLocaleString()}`);
  console.log(`Average Rent: $${Math.round(rents.reduce((a, b) => a + b, 0) / rents.length).toLocaleString()}`);
  
  const rentToPrice = rents.map((rent, i) => (rent * 12 / prices[i]) * 100);
  console.log(`Average Rent-to-Price Ratio: ${(rentToPrice.reduce((a, b) => a + b, 0) / rentToPrice.length).toFixed(2)}%`);
}

// Run the test
testFinancialAnalysis().catch(console.error);