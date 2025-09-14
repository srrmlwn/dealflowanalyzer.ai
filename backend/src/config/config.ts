import { ConfigLoader } from '/Users/sriram/projects/dealflowanalyzer.ai/shared/dist/utils/configLoader';
import { ConfigFile } from '/Users/sriram/projects/dealflowanalyzer.ai/shared/dist/types';

export class Config {
  private configLoader: ConfigLoader;
  private config: ConfigFile | null = null;

  constructor() {
    this.configLoader = new ConfigLoader(process.env['CONFIG_PATH'] || '../config');
  }

  /**
   * Load configuration from files
   */
  loadConfig(): ConfigFile {
    if (!this.config) {
      this.config = this.configLoader.loadConfig();
    }
    return this.config;
  }

  /**
   * Get current configuration
   */
  getConfig(): ConfigFile {
    return this.loadConfig();
  }

  /**
   * Reload configuration from files
   */
  reloadConfig(): ConfigFile {
    this.config = null;
    return this.loadConfig();
  }

  /**
   * Get buybox configuration
   */
  getBuyboxConfig() {
    return this.getConfig().buybox;
  }

  /**
   * Get financial configuration
   */
  getFinancialConfig() {
    return this.getConfig().financial;
  }
}

export const config = new Config();
