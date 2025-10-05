const fs = require('fs');
const path = require('path');

/**
 * Convert HUD CSV data to JSON format expected by the system
 * 
 * Expected CSV columns (adjust as needed based on your actual CSV):
 * - zipCode or zip_code
 * - bedrooms or bedroom_count
 * - fairMarketRent or fair_market_rent or rent
 * - year
 * - county
 * - state
 * - propertyType (optional)
 */

function convertCsvToJson(csvFilePath, jsonOutputPath) {
  try {
    console.log(`Reading CSV file: ${csvFilePath}`);
    
    if (!fs.existsSync(csvFilePath)) {
      console.error(`CSV file not found: ${csvFilePath}`);
      console.log('Please save your Excel file as CSV format first.');
      return;
    }
    
    const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      console.error('CSV file is empty');
      return;
    }
    
    // Handle multi-line headers by combining first few lines
    let headerLine = lines[0];
    for (let i = 1; i < Math.min(5, lines.length); i++) {
      if (lines[i].includes('BR') || lines[i].includes('Payment') || lines[i].includes('Standard')) {
        headerLine += ' ' + lines[i];
      } else {
        break;
      }
    }
    
    // Parse header row
    const headers = headerLine.split(',').map(h => h.trim().replace(/"/g, '').replace(/\n/g, ' '));
    console.log('CSV Headers:', headers);
    
    // Find column indices (case-insensitive)
    const getColumnIndex = (possibleNames) => {
      for (const name of possibleNames) {
        const index = headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));
        if (index !== -1) return index;
      }
      return -1;
    };
    
    const zipCodeIndex = getColumnIndex(['zipcode', 'zip_code', 'zip']);
    const bedroomsIndex = getColumnIndex(['bedrooms', 'bedroom_count', 'beds']);
    const rentIndex = getColumnIndex(['fairmarketrent', 'fair_market_rent', 'rent', 'fmr']);
    const yearIndex = getColumnIndex(['year']);
    const countyIndex = getColumnIndex(['county']);
    const stateIndex = getColumnIndex(['state']);
    const propertyTypeIndex = getColumnIndex(['propertytype', 'property_type', 'type']);
    
    console.log('Column mapping:');
    console.log(`  zipCode: ${zipCodeIndex} (${headers[zipCodeIndex] || 'NOT FOUND'})`);
    console.log(`  bedrooms: ${bedroomsIndex} (${headers[bedroomsIndex] || 'NOT FOUND'})`);
    console.log(`  rent: ${rentIndex} (${headers[rentIndex] || 'NOT FOUND'})`);
    console.log(`  year: ${yearIndex} (${headers[yearIndex] || 'NOT FOUND'})`);
    console.log(`  county: ${countyIndex} (${headers[countyIndex] || 'NOT FOUND'})`);
    console.log(`  state: ${stateIndex} (${headers[stateIndex] || 'NOT FOUND'})`);
    
    if (zipCodeIndex === -1 || bedroomsIndex === -1 || rentIndex === -1) {
      console.error('Required columns not found. Please ensure CSV has zipCode, bedrooms, and rent columns.');
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
        const bedrooms = parseInt(columns[bedroomsIndex]);
        const rent = parseFloat(columns[rentIndex]);
        const year = yearIndex !== -1 ? parseInt(columns[yearIndex]) : new Date().getFullYear();
        const county = countyIndex !== -1 ? columns[countyIndex]?.trim() : '';
        const state = stateIndex !== -1 ? columns[stateIndex]?.trim() : '';
        const propertyType = propertyTypeIndex !== -1 ? columns[propertyTypeIndex]?.trim() : '';
        
        // Validate required fields
        if (!zipCode || isNaN(bedrooms) || isNaN(rent)) {
          errors.push(`Row ${i + 1}: Invalid data - zipCode: ${zipCode}, bedrooms: ${bedrooms}, rent: ${rent}`);
          continue;
        }
        
        hudData.push({
          zipCode: zipCode,
          bedrooms: bedrooms,
          fairMarketRent: rent,
          year: year || new Date().getFullYear(),
          county: county || '',
          state: state || '',
          ...(propertyType && { propertyType })
        });
        
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
    hudData.slice(0, 3).forEach((record, index) => {
      console.log(`  ${index + 1}:`, JSON.stringify(record, null, 2));
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
    console.log(`  Bedroom counts: ${bedroomCounts.sort((a, b) => a - b).join(', ')}`);
    console.log(`  Rent range: $${rentRange.min} - $${rentRange.max}`);
    
  } catch (error) {
    console.error('Error converting CSV to JSON:', error);
  }
}

// Main execution
const csvPath = path.join(__dirname, '../data/hud-rents.csv');
const jsonPath = path.join(__dirname, '../data/hud-rental-data.json');

console.log('HUD Data Converter');
console.log('==================');
console.log(`Input CSV: ${csvPath}`);
console.log(`Output JSON: ${jsonPath}`);
console.log('');

convertCsvToJson(csvPath, jsonPath);