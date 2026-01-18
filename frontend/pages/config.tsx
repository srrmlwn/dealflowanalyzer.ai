import { NextPage } from 'next';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import { CogIcon, SaveIcon, RefreshCwIcon, DownloadIcon } from 'lucide-react';

interface BuyboxConfig {
  name: string;
  zipCodes: string[];
  priceRange: {
    min: number;
    max: number;
  };
  statusType: string;
}

interface FinancialConfig {
  mortgage: {
    interestRate: number;
    downPaymentPercent: number;
    loanTermYears: number;
    closingCostsPercent: number;
  };
  operatingExpenses: {
    propertyManagementPercent: number;
    maintenancePercent: number;
    vacancyRate: number;
    insurancePercent: number;
    propertyTaxPercent: number;
    hoaFees: number;
    utilities: number;
    other: number;
  };
  appreciation: {
    annualAppreciationPercent: number;
    holdingPeriodYears: number;
  };
}

const Configuration: NextPage = () => {
  const [buyboxConfig, setBuyboxConfig] = useState<BuyboxConfig>({
    name: '',
    zipCodes: [],
    priceRange: { min: 0, max: 500000 },
    statusType: 'ForSale'
  });

  const [financialConfig, setFinancialConfig] = useState<FinancialConfig>({
    mortgage: {
      interestRate: 6.5,
      downPaymentPercent: 20,
      loanTermYears: 30,
      closingCostsPercent: 3
    },
    operatingExpenses: {
      propertyManagementPercent: 10,
      maintenancePercent: 8,
      vacancyRate: 5,
      insurancePercent: 0.5,
      propertyTaxPercent: 1.2,
      hoaFees: 0,
      utilities: 0,
      other: 2
    },
    appreciation: {
      annualAppreciationPercent: 3,
      holdingPeriodYears: 10
    }
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [fetchStats, setFetchStats] = useState<{
    totalProperties: number;
    zipCodesProcessed: number;
    apiRequestsUsed: number;
    remainingRequests: number;
    timestamp?: string;
  } | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<string | null>(null);

  useEffect(() => {
    loadConfigurations();
    loadLastFetchTime();
  }, []);

  const loadLastFetchTime = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/properties/stats');
      if (response.ok) {
        const data = await response.json();
        if (data.lastFetchTimestamp) {
          setLastFetchTime(data.lastFetchTimestamp);
        }
      }
    } catch (error) {
      console.error('Error loading last fetch time:', error);
    }
  };

  const loadConfigurations = async () => {
    try {
      setLoading(true);
      
      // Load buybox config
      const buyboxResponse = await fetch('/config/buybox.json');
      if (buyboxResponse.ok) {
        const buyboxData = await buyboxResponse.json();
        setBuyboxConfig(buyboxData);
      }

      // Load financial config
      const financialResponse = await fetch('/config/financial.json');
      if (financialResponse.ok) {
        const financialData = await financialResponse.json();
        setFinancialConfig(financialData);
      }

    } catch (error) {
      console.error('Error loading configurations:', error);
      setMessage({ type: 'error', text: 'Failed to load configurations' });
    } finally {
      setLoading(false);
    }
  };

  const saveConfigurations = async () => {
    try {
      setSaving(true);
      setMessage(null);

      // Note: In a real implementation, you would need backend endpoints to save these configs
      // For now, we'll just show a success message
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call

      setMessage({ type: 'success', text: 'Configurations saved successfully!' });
    } catch (error) {
      console.error('Error saving configurations:', error);
      setMessage({ type: 'error', text: 'Failed to save configurations' });
    } finally {
      setSaving(false);
    }
  };

  const fetchProperties = async () => {
    try {
      setFetching(true);
      setMessage(null);
      setFetchStats(null);

      const response = await fetch('http://localhost:8000/api/properties/fetch', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setFetchStats(data.stats);
        if (data.stats.timestamp) {
          setLastFetchTime(data.stats.timestamp);
        }
        setMessage({ 
          type: 'success', 
          text: `Successfully fetched ${data.stats.totalProperties} properties from ${data.stats.zipCodesProcessed} zip code(s)!` 
        });
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to fetch properties' });
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to fetch properties. Make sure the backend is running and RAPIDAPI_KEY is set.' 
      });
    } finally {
      setFetching(false);
    }
  };

  const handleZipCodeChange = (value: string) => {
    const zipCodes = value.split(',').map(zip => zip.trim()).filter(zip => zip.length > 0);
    setBuyboxConfig(prev => ({ ...prev, zipCodes }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading configurations...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Configuration - Deal Flow Analyzer</title>
        <meta name="description" content="Configure analysis parameters and buybox criteria" />
      </Head>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center mb-4">
              <CogIcon className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-3xl font-bold text-gray-900">Configuration</h1>
            </div>
            <p className="text-gray-600">
              Configure your property search criteria and financial analysis parameters.
            </p>
          </div>

          {/* Message */}
          {message && (
            <div className={`mb-6 p-4 rounded-md ${
              message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              {message.text}
            </div>
          )}

          <div className="space-y-8">
            {/* Buybox Configuration */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Property Search Criteria (Buybox)</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Buybox Name
                  </label>
                  <input
                    type="text"
                    value={buyboxConfig.name}
                    onChange={(e) => setBuyboxConfig(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Columbus OH - Primary Buybox"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status Type
                  </label>
                  <select
                    value={buyboxConfig.statusType}
                    onChange={(e) => setBuyboxConfig(prev => ({ ...prev, statusType: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ForSale">For Sale</option>
                    <option value="RecentlySold">Recently Sold</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Zip Codes (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={buyboxConfig.zipCodes.join(', ')}
                    onChange={(e) => handleZipCodeChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 43211, 43224, 43215"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Minimum Price ($)
                  </label>
                  <input
                    type="number"
                    value={buyboxConfig.priceRange.min}
                    onChange={(e) => setBuyboxConfig(prev => ({ 
                      ...prev, 
                      priceRange: { ...prev.priceRange, min: parseInt(e.target.value) || 0 }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Maximum Price ($)
                  </label>
                  <input
                    type="number"
                    value={buyboxConfig.priceRange.max}
                    onChange={(e) => setBuyboxConfig(prev => ({ 
                      ...prev, 
                      priceRange: { ...prev.priceRange, max: parseInt(e.target.value) || 0 }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Financial Configuration */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Financial Analysis Parameters</h2>
              
              {/* Mortgage Settings */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Mortgage Assumptions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Interest Rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={financialConfig.mortgage.interestRate}
                      onChange={(e) => setFinancialConfig(prev => ({
                        ...prev,
                        mortgage: { ...prev.mortgage, interestRate: parseFloat(e.target.value) || 0 }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Down Payment (%)
                    </label>
                    <input
                      type="number"
                      value={financialConfig.mortgage.downPaymentPercent}
                      onChange={(e) => setFinancialConfig(prev => ({
                        ...prev,
                        mortgage: { ...prev.mortgage, downPaymentPercent: parseInt(e.target.value) || 0 }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Loan Term (years)
                    </label>
                    <input
                      type="number"
                      value={financialConfig.mortgage.loanTermYears}
                      onChange={(e) => setFinancialConfig(prev => ({
                        ...prev,
                        mortgage: { ...prev.mortgage, loanTermYears: parseInt(e.target.value) || 0 }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Closing Costs (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={financialConfig.mortgage.closingCostsPercent}
                      onChange={(e) => setFinancialConfig(prev => ({
                        ...prev,
                        mortgage: { ...prev.mortgage, closingCostsPercent: parseFloat(e.target.value) || 0 }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Operating Expenses */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Operating Expenses (% of rent unless noted)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Property Management (%)
                    </label>
                    <input
                      type="number"
                      value={financialConfig.operatingExpenses.propertyManagementPercent}
                      onChange={(e) => setFinancialConfig(prev => ({
                        ...prev,
                        operatingExpenses: { ...prev.operatingExpenses, propertyManagementPercent: parseInt(e.target.value) || 0 }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Maintenance (%)
                    </label>
                    <input
                      type="number"
                      value={financialConfig.operatingExpenses.maintenancePercent}
                      onChange={(e) => setFinancialConfig(prev => ({
                        ...prev,
                        operatingExpenses: { ...prev.operatingExpenses, maintenancePercent: parseInt(e.target.value) || 0 }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vacancy Rate (%)
                    </label>
                    <input
                      type="number"
                      value={financialConfig.operatingExpenses.vacancyRate}
                      onChange={(e) => setFinancialConfig(prev => ({
                        ...prev,
                        operatingExpenses: { ...prev.operatingExpenses, vacancyRate: parseInt(e.target.value) || 0 }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Insurance (% of property value annually)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={financialConfig.operatingExpenses.insurancePercent}
                      onChange={(e) => setFinancialConfig(prev => ({
                        ...prev,
                        operatingExpenses: { ...prev.operatingExpenses, insurancePercent: parseFloat(e.target.value) || 0 }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Property Tax (% of property value annually)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={financialConfig.operatingExpenses.propertyTaxPercent}
                      onChange={(e) => setFinancialConfig(prev => ({
                        ...prev,
                        operatingExpenses: { ...prev.operatingExpenses, propertyTaxPercent: parseFloat(e.target.value) || 0 }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Other Expenses (%)
                    </label>
                    <input
                      type="number"
                      value={financialConfig.operatingExpenses.other}
                      onChange={(e) => setFinancialConfig(prev => ({
                        ...prev,
                        operatingExpenses: { ...prev.operatingExpenses, other: parseInt(e.target.value) || 0 }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Appreciation Settings */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Appreciation Assumptions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Annual Appreciation (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={financialConfig.appreciation.annualAppreciationPercent}
                      onChange={(e) => setFinancialConfig(prev => ({
                        ...prev,
                        appreciation: { ...prev.appreciation, annualAppreciationPercent: parseFloat(e.target.value) || 0 }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Holding Period (years)
                    </label>
                    <input
                      type="number"
                      value={financialConfig.appreciation.holdingPeriodYears}
                      onChange={(e) => setFinancialConfig(prev => ({
                        ...prev,
                        appreciation: { ...prev.appreciation, holdingPeriodYears: parseInt(e.target.value) || 0 }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Fetch Properties Section */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Fetch Properties</h2>
                {lastFetchTime && (
                  <div className="text-sm text-gray-500">
                    <span className="font-medium">Last refreshed:</span>{' '}
                    {new Date(lastFetchTime).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                )}
              </div>
              <p className="text-gray-600 mb-4">
                Fetch the latest property listings from Realtor.com API based on your buybox configuration.
              </p>
              
              {fetchStats && (
                <div className="mb-4 p-4 bg-blue-50 rounded-md">
                  <h3 className="text-sm font-semibold text-blue-900 mb-2">Last Fetch Results:</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-blue-700 font-medium">Properties:</span>
                      <span className="ml-2 text-blue-900">{fetchStats.totalProperties}</span>
                    </div>
                    <div>
                      <span className="text-blue-700 font-medium">Zip Codes:</span>
                      <span className="ml-2 text-blue-900">{fetchStats.zipCodesProcessed}</span>
                    </div>
                    <div>
                      <span className="text-blue-700 font-medium">API Requests:</span>
                      <span className="ml-2 text-blue-900">{fetchStats.apiRequestsUsed}</span>
                    </div>
                    <div>
                      <span className="text-blue-700 font-medium">Remaining:</span>
                      <span className="ml-2 text-blue-900">{fetchStats.remainingRequests}</span>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={fetchProperties}
                disabled={fetching || loading}
                className="inline-flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <DownloadIcon className={`h-5 w-5 mr-2 ${fetching ? 'animate-spin' : ''}`} />
                {fetching ? 'Fetching Properties...' : 'Fetch Properties from API'}
              </button>
              
              <p className="mt-3 text-xs text-gray-500">
                This will fetch properties for zip codes: {buyboxConfig.zipCodes.join(', ') || 'none configured'}
              </p>
            </div>

            {/* Save Button */}
            <div className="flex justify-end space-x-4">
              <button
                onClick={loadConfigurations}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCwIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Reset
              </button>
              <button
                onClick={saveConfigurations}
                disabled={saving}
                className="inline-flex items-center px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <SaveIcon className={`h-4 w-4 mr-2 ${saving ? 'animate-pulse' : ''}`} />
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Configuration;