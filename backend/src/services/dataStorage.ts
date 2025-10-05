import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { Property, ErrorRecord } from '/Users/sriram/projects/dealflowanalyzer.ai/shared/dist/types';

export interface StorageConfig {
  dataPath: string;
  propertiesPath: string;
  analysisPath: string;
  errorsPath: string;
}

export class DataStorageService {
  private config: StorageConfig;

  constructor(dataPath: string = './data') {
    this.config = {
      dataPath,
      propertiesPath: join(dataPath, 'properties'),
      analysisPath: join(dataPath, 'analysis'),
      errorsPath: join(dataPath, 'errors')
    };
    
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    const directories = [
      this.config.dataPath,
      this.config.propertiesPath,
      this.config.analysisPath,
      this.config.errorsPath
    ];

    directories.forEach(dir => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
      }
    });
  }

  private getDateString(): string {
    return new Date().toISOString().split('T')[0]!; // YYYY-MM-DD format
  }

  private getTimestampString(): string {
    return new Date().toISOString(); // Full ISO timestamp
  }

  /**
   * Save properties data for a specific zip code
   */
  saveProperties(zipCode: string, properties: Property[], buyboxName?: string): void {
    try {
      const dateString = this.getDateString();
      const zipDir = join(this.config.propertiesPath, zipCode);
      const dateDir = join(zipDir, dateString);
      
      // Ensure directories exist
      if (!existsSync(zipDir)) {
        mkdirSync(zipDir, { recursive: true });
      }
      if (!existsSync(dateDir)) {
        mkdirSync(dateDir, { recursive: true });
      }

      const filename = buyboxName ? `${buyboxName}.json` : 'properties.json';
      const filePath = join(dateDir, filename);
      
      const data = {
        timestamp: this.getTimestampString(),
        zipCode,
        buyboxName,
        propertyCount: properties.length,
        properties
      };

      writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`Saved ${properties.length} properties for zip code ${zipCode} to ${filePath}`);
    } catch (error) {
      console.error(`Error saving properties for zip code ${zipCode}:`, error);
      throw error;
    }
  }

  /**
   * Load properties data for a specific zip code and date
   */
  loadProperties(zipCode: string, date?: string, buyboxName?: string): Property[] | null {
    try {
      const dateString = date || this.getDateString();
      const zipDir = join(this.config.propertiesPath, zipCode);
      const dateDir = join(zipDir, dateString);
      
      if (!existsSync(dateDir)) {
        return null;
      }

      const filename = buyboxName ? `${buyboxName}.json` : 'properties.json';
      const filePath = join(dateDir, filename);
      
      if (!existsSync(filePath)) {
        return null;
      }

      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      return data.properties || [];
    } catch (error) {
      console.error(`Error loading properties for zip code ${zipCode}:`, error);
      return null;
    }
  }

  /**
   * Get all available dates for a zip code
   */
  getAvailableDates(zipCode: string): string[] {
    try {
      const zipDir = join(this.config.propertiesPath, zipCode);
      
      if (!existsSync(zipDir)) {
        return [];
      }

      const dates = readdirSync(zipDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .sort()
        .reverse(); // Most recent first

      return dates;
    } catch (error) {
      console.error(`Error getting available dates for zip code ${zipCode}:`, error);
      return [];
    }
  }

  /**
   * Save analysis results
   */
  saveAnalysis(zipCode: string, analysisData: any, buyboxName?: string): void {
    try {
      const dateString = this.getDateString();
      const zipDir = join(this.config.analysisPath, zipCode);
      const dateDir = join(zipDir, dateString);
      
      // Ensure directories exist
      if (!existsSync(zipDir)) {
        mkdirSync(zipDir, { recursive: true });
      }
      if (!existsSync(dateDir)) {
        mkdirSync(dateDir, { recursive: true });
      }

      const filename = buyboxName ? `${buyboxName}-analysis.json` : 'analysis.json';
      const filePath = join(dateDir, filename);
      
      const data = {
        timestamp: this.getTimestampString(),
        zipCode,
        buyboxName,
        ...analysisData
      };

      writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`Saved analysis data for zip code ${zipCode} to ${filePath}`);
    } catch (error) {
      console.error(`Error saving analysis for zip code ${zipCode}:`, error);
      throw error;
    }
  }

  /**
   * Save error records
   */
  saveError(error: ErrorRecord): void {
    try {
      const dateString = this.getDateString();
      const errorDir = join(this.config.errorsPath, dateString);
      
      if (!existsSync(errorDir)) {
        mkdirSync(errorDir, { recursive: true });
      }

      const filename = `errors-${this.getTimestampString().replace(/[:.]/g, '-')}.json`;
      const filePath = join(errorDir, filename);
      
      writeFileSync(filePath, JSON.stringify(error, null, 2));
      console.log(`Saved error record to ${filePath}`);
    } catch (err) {
      console.error('Error saving error record:', err);
    }
  }

  /**
   * Get all zip codes with data
   */
  getAvailableZipCodes(): string[] {
    try {
      if (!existsSync(this.config.propertiesPath)) {
        return [];
      }

      const zipCodes = readdirSync(this.config.propertiesPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .sort();

      return zipCodes;
    } catch (error) {
      console.error('Error getting available zip codes:', error);
      return [];
    }
  }

  /**
   * Clean up old data (keep only last N days)
   */
  cleanupOldData(daysToKeep: number = 30): void {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffDateString = cutoffDate.toISOString().split('T')[0];

      const directories = [
        this.config.propertiesPath,
        this.config.analysisPath,
        this.config.errorsPath
      ];

      directories.forEach(baseDir => {
        if (!existsSync(baseDir)) return;

        const zipDirs = readdirSync(baseDir, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => dirent.name);

        zipDirs.forEach(zipCode => {
          const zipDir = join(baseDir, zipCode);
          const dateDirs = readdirSync(zipDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

          dateDirs.forEach(dateDir => {
            if (dateDir < cutoffDateString!) {
              const fullPath = join(zipDir, dateDir);
              // Note: In a real implementation, you'd use fs.rmSync for recursive deletion
              console.log(`Would delete old data: ${fullPath}`);
            }
          });
        });
      });

      console.log(`Cleanup completed. Keeping data from ${cutoffDateString} onwards.`);
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}
