const fs = require('fs');
const path = require('path');

/**
 * Convert HUD CSV data with separate bedroom columns to JSON format
 * Expected format: ZipCode, 0BR, 1BR, 2BR, 3BR, 4BR columns
 */

function convertHudCsvToJson(csvFilePath, jsonOutputPath) {
  try {
    console.log(`Reading CSV file: ${csvFilePath}`);
    
    if (!fs.existsSync(csvFilePath)) {
      console.error(`CSV file not found: ${csvFilePath}`);
      return;
    }
    
    const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      console.error('CSV file is empty');
      return;
    }
    
    // Parse header row
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    console.log('CSV Headers:', headers);
    
    // Find column indices
    const zipCodeIndex = headers.findIndex(h => h.toLowerCase().includes('zip'));
    const bedroomColumns = {};
    
    // Look for bedroom columns (0BR, 1BR, 2BR, etc.)
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i].toLowerCase();
      if (header.includes('0br') && !header.includes('90%') && !header.includes('110%')) {
        bedroomColumns[0] = i;
      } else if (header.includes('1br') && !header.includes('90%') && !header.includes('110%')) {
        bedroomColumns[1] = i;
      } else if (header.includes('2br') && !header.includes('90%') && !header.includes('110%')) {
        bedroomColumns[2] = i;
      } else if (header.includes('3br') && !header.includes('90%') && !header.includes('110%')) {
        bedroomColumns[3] = i;
      } else if (header.includes('4br') && !header.includes('90%') && !header.includes('110%')) {
        bedroomColumns[4] = i;
      }
    }
    
    console.log('Column mapping:');
    console.log(`  zipCode: ${zipCodeIndex} (${headers[zipCodeIndex] || 'NOT FOUND'})`);
    console.log('  bedroom columns:', bedroomColumns);
    
    if (zipCodeIndex === -1) {
      console.error('ZipCode column not found');
      return;
    }
    
    if (Object.keys(bedroomColumns).length === 0) {
      console.error('No bedroom rent columns found');
      return;
    }
    
    // Parse data rows
    const hudData = [];
    const errors = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      try {
        const columns = line.split(',').map(c => c.trim().replace(/"/g, ''));
        const zipCode = columns[zipCodeIndex]?.trim();
        
        if (!zipCode || zipCode.length !== 5) {
          errors.push(`Row ${i + 1}: Invalid zip code: ${zipCode}`);
          continue;
        }
        
        // Create a record for each bedroom count
        for (const [bedrooms, columnIndex] of Object.entries(bedroomColumns)) {
          const rentValue = columns[columnIndex]?.trim();
          const rent = parseFloat(rentValue?.replace(/[$,]/g, '') || '0');
          
          if (rent > 0) {
            hudData.push({
              zipCode: zipCode,
              bedrooms: parseInt(bedrooms),
              fairMarketRent: rent,
              year: 2024, // Default to current year
              county: '', // Will be filled if available
              state: 'OH' // Default to Ohio for Columbus data
            });
          }
        }
        
      } catch (error) {
        errors.push(`Row ${i + 1}: Parse error - ${error.message}`);
      }
    }
    
    console.log(`\nProcessing complete:`);
    console.log(`  Total rows processed: ${lines.length - 1}`);
    console.log(`  Valid records: ${hudData.length}`);
    console.log(`  Errors: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\nFirst 5 errors:');
      errors.slice(0, 5).forEach(error => console.log(`  ${error}`));
    }
    
    if (hudData.length === 0) {
      console.error('No valid data found. Please check your CSV format.');
      return;
    }
    
    // Write JSON file
    fs.writeFileSync(jsonOutputPath, JSON.stringify(hudData, null, 2));
    console.log(`\nJSON file created: ${jsonOutputPath}`);
    
    // Show sample data
    console.log('\nSample records:');
    hudData.slice(0, 5).forEach((record, index) => {
      console.log(`  ${index + 1}:`, JSON.stringify(record));
    });
    
    // Show statistics
    const zipCodes = [...new Set(hudData.map(d => d.zipCode))];
    const bedroomCounts = [...new Set(hudData.map(d => d.bedrooms))];
    const rentRange = {
      min: Math.min(...hudData.map(d => d.fairMarketRent)),
      max: Math.max(...hudData.map(d => d.fairMarketRent))
    };
    
    console.log('\nData Statistics:');
    console.log(`  Unique zip codes: ${zipCodes.length}`);
    console.log(`  First 10 zip codes: ${zipCodes.slice(0, 10).join(', ')}`);
    console.log(`  Bedroom counts: ${bedroomCounts.sort((a, b) => a - b).join(', ')}`);
    console.log(`  Rent range: $${rentRange.min} - $${rentRange.max}`);
    
    // Show rent by bedroom for first zip code
    const firstZip = zipCodes[0];
    const firstZipData = hudData.filter(d => d.zipCode === firstZip);
    console.log(`\nRent data for ${firstZip}:`);
    firstZipData.forEach(d => {
      console.log(`  ${d.bedrooms} BR: $${d.fairMarketRent}`);
    });
    
  } catch (error) {
    console.error('Error converting CSV to JSON:', error);
  }
}

// Main execution
const csvPath = path.join(__dirname, '../data/hud-rents.csv');
const jsonPath = path.join(__dirname, '../data/hud-rental-data.json');

console.log('Advanced HUD Data Converter');
console.log('===========================');
console.log(`Input CSV: ${csvPath}`);
console.log(`Output JSON: ${jsonPath}`);
console.log('');

convertHudCsvToJson(csvPath, jsonPath);