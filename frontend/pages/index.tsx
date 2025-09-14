import type { NextPage } from 'next';
import Head from 'next/head';
import { useState, useEffect } from 'react';

interface Config {
  buybox: {
    name: string;
    zipCodes: string[];
    propertyTypes?: string[];
    priceRange?: {
      min?: number;
      max?: number;
    };
  };
  financial: {
    mortgage: {
      interestRate: number;
      downPaymentPercent: number;
      loanTermYears: number;
    };
    operatingExpenses: {
      propertyManagementPercent: number;
      maintenancePercent: number;
      vacancyRate: number;
      insurancePercent: number;
      propertyTaxPercent: number;
    };
    appreciation: {
      annualAppreciationPercent: number;
      holdingPeriodYears: number;
    };
  };
}

const Home: NextPage = () => {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/config');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setConfig(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading configuration...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600">
          <h2 className="text-xl font-bold mb-2">Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Deal Flow Analyzer</title>
        <meta name="description" content="Real estate investment analysis tool" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            Deal Flow Analyzer
          </h1>

          {config && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Configuration</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium mb-2">Buybox</h3>
                  <div className="space-y-2">
                    <p><span className="font-medium">Name:</span> {config.buybox.name}</p>
                    <p><span className="font-medium">Zip Codes:</span> {config.buybox.zipCodes.join(', ')}</p>
                    {config.buybox.propertyTypes && (
                      <p><span className="font-medium">Property Types:</span> {config.buybox.propertyTypes.join(', ')}</p>
                    )}
                    {config.buybox.priceRange && (
                      <p>
                        <span className="font-medium">Price Range:</span> 
                        ${config.buybox.priceRange.min?.toLocaleString()} - ${config.buybox.priceRange.max?.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-2">Financial Assumptions</h3>
                  <div className="space-y-2">
                    <p><span className="font-medium">Interest Rate:</span> {config.financial.mortgage.interestRate}%</p>
                    <p><span className="font-medium">Down Payment:</span> {config.financial.mortgage.downPaymentPercent}%</p>
                    <p><span className="font-medium">Loan Term:</span> {config.financial.mortgage.loanTermYears} years</p>
                    <p><span className="font-medium">Property Management:</span> {config.financial.operatingExpenses.propertyManagementPercent}%</p>
                    <p><span className="font-medium">Maintenance:</span> {config.financial.operatingExpenses.maintenancePercent}%</p>
                    <p><span className="font-medium">Vacancy Rate:</span> {config.financial.operatingExpenses.vacancyRate}%</p>
                    <p><span className="font-medium">Annual Appreciation:</span> {config.financial.appreciation.annualAppreciationPercent}%</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 text-center">
            <p className="text-gray-600">
              Phase 1 setup complete! Backend and frontend are connected.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;
