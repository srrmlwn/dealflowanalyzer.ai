import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

interface ConversionConfig {
  strategy: 'generic' | 'advanced';
  outputPath: string;
  includeStatistics: boolean;
}

interface HudRecord {
  zipCode: string;
  bedrooms: number;
  fairMarketRent: number;
  year: number;
  county: string;
  state: string;
  propertyType?: string;
}

interface ConversionStats {
  totalRecords: number;
  validRecords: number;
  uniqueZipCodes: number;
  bedroomRange: { min: number; max: number };
  rentRange: { min: number; max: number };
  averageRent: number;
}

export class HudDataConverter {
  private config: ConversionConfig;

  constructor(config: Partial<ConversionConfig> = {}) {
    this.config = {
      strategy: 'generic',
      outputPath: './data/hud-rental-data.json',
      includeStatistics: true,
      ...config
    };
  }

  /**
   * Convert HUD CSV data to JSON format
   */
  convertCsvToJson(csvFilePath: string): void {
    try {
      console.log(`📊 Converting HUD CSV data: ${csvFilePath}`);
      console.log(`📋 Strategy: ${this.config.strategy}`);
      
      if (!existsSync(csvFilePath)) {
        throw new Error(`CSV file not found: ${csvFilePath}`);
      }
      
      const csvContent = readFileSync(csvFilePath, 'utf-8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        throw new Error('CSV file is empty');
      }
      
      const records = this.config.strategy === 'advanced' 
        ? this.parseAdvancedFormat(lines)
        : this.parseGenericFormat(lines);
      
      // Save converted data
      writeFileSync(this.config.outputPath, JSON.stringify(records, null, 2));
      
      console.log(`✅ Converted ${records.length} records to ${this.config.outputPath}`);
      
      if (this.config.includeStatistics) {
        this.displayStatistics(records);
      }
      
    } catch (error) {
      console.error('❌ Conversion failed:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Parse generic CSV format with flexible column mapping
   */
  private parseGenericFormat(lines: string[]): HudRecord[] {
    const headers = this.parseHeaders(lines[0]);
    console.log('📋 CSV Headers:', headers);
    
    const columnMap = this.mapGenericColumns(headers);
    console.log('🗺️  Column mapping:', columnMap);
    
    const records: HudRecord[] = [];
    const errors: string[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = this.parseCsvLine(lines[i]);
        const record = this.createRecordFromGeneric(values, columnMap);
        
        if (this.validateRecord(record)) {
          records.push(record);
        }
      } catch (error) {
        errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Parse error'}`);
      }
    }
    
    if (errors.length > 0) {
      console.warn(`⚠️  ${errors.length} parsing errors (showing first 5):`);
      errors.slice(0, 5).forEach(error => console.warn(`   ${error}`));
    }
    
    return records;
  }

  /**
   * Parse advanced CSV format with separate bedroom columns (0BR, 1BR, 2BR, etc.)
   */
  private parseAdvancedFormat(lines: string[]): HudRecord[] {
    const headers = this.parseHeaders(lines[0]);
    console.log('📋 CSV Headers:', headers);
    
    const columnMap = this.mapAdvancedColumns(headers);
    console.log('🗺️  Column mapping:', columnMap);
    
    const records: HudRecord[] = [];
    const errors: string[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = this.parseCsvLine(lines[i]);
        const recordsFromRow = this.createRecordsFromAdvanced(values, columnMap);
        
        recordsFromRow.forEach(record => {
          if (this.validateRecord(record)) {
            records.push(record);
          }
        });
      } catch (error) {
        errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Parse error'}`);
      }
    }
    
    if (errors.length > 0) {
      console.warn(`⚠️  ${errors.length} parsing errors (showing first 5):`);
      errors.slice(0, 5).forEach(error => console.warn(`   ${error}`));
    }
    
    return records;
  }

  private parseHeaders(headerLine: string): string[] {
    return headerLine.split(',').map(h => h.trim().replace(/"/g, '').replace(/\n/g, ' '));
  }

  private parseCsvLine(line: string): string[] {
    return line.split(',').map(v => v.trim().replace(/"/g, ''));
  }

  private mapGenericColumns(headers: string[]): Record<string, number> {
    const getColumnIndex = (possibleNames: string[]): number => {
      for (const name of possibleNames) {
        const index = headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));
        if (index !== -1) return index;
      }
      return -1;
    };

    return {
      zipCode: getColumnIndex(['zip', 'zipcode', 'zip_code']),
      bedrooms: getColumnIndex(['bedroom', 'bed', 'br']),
      fairMarketRent: getColumnIndex(['rent', 'fmr', 'fair_market_rent', 'market_rent']),
      year: getColumnIndex(['year', 'fy', 'fiscal_year']),
      county: getColumnIndex(['county', 'county_name']),
      state: getColumnIndex(['state', 'state_name', 'st']),
      propertyType: getColumnIndex(['type', 'property_type', 'unit_type'])
    };
  }

  private mapAdvancedColumns(headers: string[]): Record<string, number> {
    const columnMap: Record<string, number> = {
      zipCode: -1,
      county: -1,
      state: -1,
      year: -1
    };

    // Find basic columns
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i].toLowerCase();
      if (header.includes('zip')) columnMap.zipCode = i;
      else if (header.includes('county')) columnMap.county = i;
      else if (header.includes('state')) columnMap.state = i;
      else if (header.includes('year') || header.includes('fy')) columnMap.year = i;
    }

    // Find bedroom columns (0BR, 1BR, 2BR, etc.)
    const bedroomColumns: Record<number, number> = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i].toLowerCase();
      for (let bedrooms = 0; bedrooms <= 4; bedrooms++) {
        if (header.includes(`${bedrooms}br`) && !header.includes('90%') && !header.includes('110%')) {
          bedroomColumns[bedrooms] = i;
          break;
        }
      }
    }

    return { ...columnMap, bedroomColumns };
  }

  private createRecordFromGeneric(values: string[], columnMap: Record<string, number>): HudRecord {
    const getValue = (key: string): string => {
      const index = columnMap[key];
      return index !== -1 && index < values.length ? values[index] : '';
    };

    return {
      zipCode: getValue('zipCode'),
      bedrooms: parseInt(getValue('bedrooms')) || 0,
      fairMarketRent: parseFloat(getValue('fairMarketRent').replace(/[$,]/g, '')) || 0,
      year: parseInt(getValue('year')) || new Date().getFullYear(),
      county: getValue('county'),
      state: getValue('state'),
      propertyType: getValue('propertyType') || undefined
    };
  }

  private createRecordsFromAdvanced(values: string[], columnMap: any): HudRecord[] {
    const records: HudRecord[] = [];
    const baseData = {
      zipCode: columnMap.zipCode !== -1 ? values[columnMap.zipCode] : '',
      county: columnMap.county !== -1 ? values[columnMap.county] : '',
      state: columnMap.state !== -1 ? values[columnMap.state] : '',
      year: columnMap.year !== -1 ? parseInt(values[columnMap.year]) || new Date().getFullYear() : new Date().getFullYear()
    };

    // Create a record for each bedroom count
    if (columnMap.bedroomColumns) {
      Object.entries(columnMap.bedroomColumns).forEach(([bedrooms, columnIndex]) => {
        const rent = parseFloat(values[columnIndex as number]?.replace(/[$,]/g, '') || '0');
        if (rent > 0) {
          records.push({
            ...baseData,
            bedrooms: parseInt(bedrooms),
            fairMarketRent: rent,
            propertyType: `${bedrooms}BR`
          });
        }
      });
    }

    return records;
  }

  private validateRecord(record: HudRecord): boolean {
    return !!(
      record.zipCode &&
      record.zipCode.length >= 5 &&
      record.bedrooms >= 0 &&
      record.fairMarketRent > 0 &&
      record.year > 1900 &&
      record.county &&
      record.state
    );
  }

  private displayStatistics(records: HudRecord[]): void {
    const stats = this.calculateStatistics(records);
    
    console.log('\n📊 Conversion Statistics:');
    console.log(`   📋 Total Records: ${stats.totalRecords}`);
    console.log(`   ✅ Valid Records: ${stats.validRecords}`);
    console.log(`   📍 Unique Zip Codes: ${stats.uniqueZipCodes}`);
    console.log(`   🛏️  Bedroom Range: ${stats.bedroomRange.min}-${stats.bedroomRange.max}`);
    console.log(`   💰 Rent Range: $${stats.rentRange.min}-$${stats.rentRange.max}`);
    console.log(`   📊 Average Rent: $${stats.averageRent}`);
  }

  private calculateStatistics(records: HudRecord[]): ConversionStats {
    const zipCodes = new Set(records.map(r => r.zipCode));
    const bedrooms = records.map(r => r.bedrooms);
    const rents = records.map(r => r.fairMarketRent);

    return {
      totalRecords: records.length,
      validRecords: records.length,
      uniqueZipCodes: zipCodes.size,
      bedroomRange: {
        min: Math.min(...bedrooms),
        max: Math.max(...bedrooms)
      },
      rentRange: {
        min: Math.min(...rents),
        max: Math.max(...rents)
      },
      averageRent: Math.round(rents.reduce((sum, rent) => sum + rent, 0) / rents.length)
    };
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const csvPath = args[0] || './data/hud-rents.csv';
  const strategy = (args[1] as 'generic' | 'advanced') || 'generic';
  const outputPath = args[2] || './data/hud-rental-data.json';

  const converter = new HudDataConverter({
    strategy,
    outputPath,
    includeStatistics: true
  });

  converter.convertCsvToJson(csvPath);
}