import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import { BuyboxConfigSchema, FinancialConfigSchema, ConfigFileSchema } from '../types';

export class ConfigLoader {
  private configPath: string;

  constructor(configPath: string = './config') {
    this.configPath = configPath;
  }

  /**
   * Load buybox configuration from file
   */
  loadBuyboxConfig(filename: string = 'buybox.json'): z.infer<typeof BuyboxConfigSchema> {
    const filePath = join(this.configPath, filename);
    
    if (!existsSync(filePath)) {
      throw new Error(`Buybox config file not found: ${filePath}`);
    }

    try {
      const fileContent = readFileSync(filePath, 'utf-8');
      const configData = JSON.parse(fileContent);
      
      return BuyboxConfigSchema.parse(configData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid buybox config: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(`Failed to load buybox config: ${error}`);
    }
  }

  /**
   * Load financial configuration from file
   */
  loadFinancialConfig(filename: string = 'financial.json'): z.infer<typeof FinancialConfigSchema> {
    const filePath = join(this.configPath, filename);
    
    if (!existsSync(filePath)) {
      throw new Error(`Financial config file not found: ${filePath}`);
    }

    try {
      const fileContent = readFileSync(filePath, 'utf-8');
      const configData = JSON.parse(fileContent);
      
      return FinancialConfigSchema.parse(configData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid financial config: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(`Failed to load financial config: ${error}`);
    }
  }

  /**
   * Load complete configuration from files
   */
  loadConfig(): z.infer<typeof ConfigFileSchema> {
    const buybox = this.loadBuyboxConfig();
    const financial = this.loadFinancialConfig();
    
    return ConfigFileSchema.parse({ buybox, financial });
  }

  /**
   * Validate configuration without loading from file
   */
  validateConfig(config: unknown): z.infer<typeof ConfigFileSchema> {
    return ConfigFileSchema.parse(config);
  }
}
