import type { NextPage } from 'next';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import { ArrowUpIcon, ArrowDownIcon, TrendingUpIcon, TrendingDownIcon, DollarSignIcon, HomeIcon, BarChart3Icon, DownloadIcon, ExternalLinkIcon, RefreshCwIcon } from 'lucide-react';

interface AnalysisProperty {
  id: string;
  analysisDate: string;
  address: string;
  zipCode: string;
  zillowUrl: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  livingArea: number;
  monthlyRent: number;
  monthlyMortgage: number;
  monthlyExpenses: number;
  monthlyCashFlow: number;
  annualCashFlow: number;
  cashOnCashReturn: number;
  capRate: number;
  totalCashInvested: number;
  projectedValue: number;
  rentSource: string;
  rentConfidence: string;
  hasRentalData: boolean;
  hasZestimate: boolean;
  missingFields: number;
  isPositiveCashFlow: boolean;
  isGoodROI: boolean;
  isGoodCapRate: boolean;
}

interface AnalysisData {
  timestamp: string;
  summary: {
    averageCashFlow: number;
    averageROI: number;
    averageCapRate: number;
    topPerformers: string[];
    dataQualityScore: number;
  };
  properties: AnalysisProperty[];
}

const Analysis: NextPage = () => {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<keyof AnalysisProperty>('cashOnCashReturn');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterROI, setFilterROI] = useState<number>(-100);
  const [filterCashFlow, setFilterCashFlow] = useState<number>(-10000);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadAnalysisData();
  }, []);

  const loadAnalysisData = async (forceRefresh = false) => {
    try {
      setLoading(true);
      
      if (forceRefresh) {
        // Run fresh analysis via backend API
        console.log('Running fresh analysis...');
        const analysisResponse = await fetch('http://localhost:8000/api/analysis/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            zipCode: '43211'
          })
        });
        
        if (!analysisResponse.ok) {
          throw new Error('Failed to run analysis');
        }
        
        const analysisResult = await analysisResponse.json();
        
        // Transform backend result to frontend format
        const transformedData = {
          timestamp: analysisResult.result.timestamp,
          summary: analysisResult.result.summary,
          properties: analysisResult.result.results.map((result: any) => ({
            id: result.propertyId,
            analysisDate: result.analysisDate,
            address: `Property ${result.propertyId}`, // We'd need to enhance this
            zipCode: '43211',
            zillowUrl: '',
            price: 0,
            bedrooms: 0,
            bathrooms: 0,
            livingArea: 0,
            monthlyRent: result.financialMetrics.monthlyRent,
            monthlyMortgage: result.financialMetrics.monthlyMortgagePayment,
            monthlyExpenses: result.financialMetrics.monthlyOperatingExpenses,
            monthlyCashFlow: result.financialMetrics.monthlyCashFlow,
            annualCashFlow: result.financialMetrics.annualCashFlow,
            cashOnCashReturn: result.financialMetrics.cashOnCashReturn,
            capRate: result.financialMetrics.capRate,
            totalCashInvested: result.financialMetrics.totalCashInvested,
            projectedValue: result.financialMetrics.projectedValue,
            rentSource: result.rentalEstimate.source,
            rentConfidence: result.rentalEstimate.confidence,
            hasRentalData: result.dataQuality.hasRentalData,
            hasZestimate: result.dataQuality.hasZestimate,
            missingFields: result.dataQuality.missingDataFields.length,
            isPositiveCashFlow: result.financialMetrics.monthlyCashFlow > 0,
            isGoodROI: result.financialMetrics.cashOnCashReturn > 8,
            isGoodCapRate: result.financialMetrics.capRate > 6
          }))
        };
        
        setData(transformedData);
      } else {
        // Try to load cached results first
        try {
          const response = await fetch('/data/analysis-results.json');
          if (response.ok) {
            const analysisData = await response.json();
            setData(analysisData);
          } else {
            // If no cached data, run fresh analysis
            await loadAnalysisData(true);
            return;
          }
        } catch {
          // If cached data fails, run fresh analysis
          await loadAnalysisData(true);
          return;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analysis data');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: keyof AnalysisProperty) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredAndSortedProperties = data?.properties
    .filter(property => 
      property.cashOnCashReturn >= filterROI && 
      property.monthlyCashFlow >= filterCashFlow
    )
    .sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      const multiplier = sortDirection === 'asc' ? 1 : -1;
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return (aValue - bValue) * multiplier;
      }
      return String(aValue).localeCompare(String(bValue)) * multiplier;
    }) || [];

  const handleRefreshAnalysis = async () => {
    setIsRefreshing(true);
    try {
      await loadAnalysisData(true);
    } finally {
      setIsRefreshing(false);
    }
  };

  const exportToCSV = () => {
    if (!data) return;
    
    const headers = [
      'Property ID', 'Address', 'Price', 'Bedrooms', 'Bathrooms', 'Living Area',
      'Monthly Rent', 'Monthly Mortgage', 'Monthly Expenses', 
      'Monthly Cash Flow', 'Annual Cash Flow', 'Cash-on-Cash Return %', 
      'Cap Rate %', 'Total Investment', 'Rent Source', 'Rent Confidence', 'Zillow URL'
    ];
    
    const csvContent = [
      headers.join(','),
      ...filteredAndSortedProperties.map(property => [
        property.id,
        `"${property.address}"`,
        property.price,
        property.bedrooms,
        property.bathrooms,
        property.livingArea,
        property.monthlyRent,
        property.monthlyMortgage,
        property.monthlyExpenses,
        property.monthlyCashFlow,
        property.annualCashFlow,
        property.cashOnCashReturn.toFixed(2),
        property.capRate.toFixed(2),
        property.totalCashInvested,
        property.rentSource,
        property.rentConfidence,
        property.zillowUrl.startsWith('http') ? property.zillowUrl : `https://www.zillow.com${property.zillowUrl}`
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analysis-results-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading analysis results...</div>
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

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">No analysis data available</div>
      </div>
    );
  }

  const positiveFlowCount = data.properties.filter(p => p.isPositiveCashFlow).length;
  const goodROICount = data.properties.filter(p => p.isGoodROI).length;

  return (
    <div>
      <Head>
        <title>Financial Analysis Results - Deal Flow Analyzer</title>
        <meta name="description" content="Real estate investment analysis results" />
      </Head>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Financial Analysis Results
            </h1>
            <div className="flex items-center justify-between">
              <p className="text-gray-600">
                Analysis completed on {new Date(data.timestamp).toLocaleDateString()} at {new Date(data.timestamp).toLocaleTimeString()} • {data.properties.length} properties analyzed
              </p>
              <div className="text-sm text-gray-500">
                {isRefreshing ? (
                  <span className="flex items-center">
                    <RefreshCwIcon className="h-4 w-4 mr-1 animate-spin" />
                    Running fresh analysis...
                  </span>
                ) : (
                  <span>Click "Refresh Analysis" for latest results</span>
                )}
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <HomeIcon className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Properties</p>
                  <p className="text-2xl font-bold text-gray-900">{data.properties.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <DollarSignIcon className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Avg Cash Flow</p>
                  <p className={`text-2xl font-bold ${data.summary.averageCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${data.summary.averageCashFlow.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <TrendingUpIcon className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Avg ROI</p>
                  <p className={`text-2xl font-bold ${data.summary.averageROI >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {data.summary.averageROI.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <BarChart3Icon className="h-8 w-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Positive Flow</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {positiveFlowCount}/{data.properties.length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Market Insights */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Market Insights</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-sm text-gray-600">Positive Cash Flow</p>
                <p className="text-2xl font-bold text-red-600">{((positiveFlowCount / data.properties.length) * 100).toFixed(1)}%</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <p className="text-sm text-gray-600">Good ROI (>8%)</p>
                <p className="text-2xl font-bold text-yellow-600">{((goodROICount / data.properties.length) * 100).toFixed(1)}%</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">Data Quality</p>
                <p className="text-2xl font-bold text-blue-600">{data.summary.dataQualityScore.toFixed(1)}%</p>
              </div>
            </div>
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700">
                <strong>Market Analysis:</strong> With current 7.5% interest rates, most properties show negative cash flow. 
                This reflects realistic market conditions where high borrowing costs impact investment returns.
              </p>
            </div>
          </div>

          {/* Filters and Controls */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min ROI (%)</label>
                  <input
                    type="number"
                    value={filterROI}
                    onChange={(e) => setFilterROI(Number(e.target.value))}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Cash Flow ($)</label>
                  <input
                    type="number"
                    value={filterCashFlow}
                    onChange={(e) => setFilterCashFlow(Number(e.target.value))}
                    className="w-32 px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div className="text-sm text-gray-600">
                  Showing {filteredAndSortedProperties.length} of {data.properties.length} properties
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleRefreshAnalysis}
                  disabled={isRefreshing}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 text-sm"
                >
                  <RefreshCwIcon className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                  {isRefreshing ? 'Analyzing...' : 'Refresh Analysis'}
                </button>
                <button
                  onClick={exportToCSV}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                >
                  <DownloadIcon className="h-4 w-4 mr-2" />
                  Export CSV
                </button>
              </div>
            </div>
          </div>

          {/* Properties Table */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('address')}
                    >
                      Property
                      {sortField === 'address' && (
                        sortDirection === 'asc' ? <ArrowUpIcon className="inline h-4 w-4 ml-1" /> : <ArrowDownIcon className="inline h-4 w-4 ml-1" />
                      )}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('monthlyRent')}
                    >
                      Monthly Rent
                      {sortField === 'monthlyRent' && (
                        sortDirection === 'asc' ? <ArrowUpIcon className="inline h-4 w-4 ml-1" /> : <ArrowDownIcon className="inline h-4 w-4 ml-1" />
                      )}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('monthlyCashFlow')}
                    >
                      Cash Flow
                      {sortField === 'monthlyCashFlow' && (
                        sortDirection === 'asc' ? <ArrowUpIcon className="inline h-4 w-4 ml-1" /> : <ArrowDownIcon className="inline h-4 w-4 ml-1" />
                      )}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('cashOnCashReturn')}
                    >
                      ROI %
                      {sortField === 'cashOnCashReturn' && (
                        sortDirection === 'asc' ? <ArrowUpIcon className="inline h-4 w-4 ml-1" /> : <ArrowDownIcon className="inline h-4 w-4 ml-1" />
                      )}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('capRate')}
                    >
                      Cap Rate %
                      {sortField === 'capRate' && (
                        sortDirection === 'asc' ? <ArrowUpIcon className="inline h-4 w-4 ml-1" /> : <ArrowDownIcon className="inline h-4 w-4 ml-1" />
                      )}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('totalCashInvested')}
                    >
                      Investment
                      {sortField === 'totalCashInvested' && (
                        sortDirection === 'asc' ? <ArrowUpIcon className="inline h-4 w-4 ml-1" /> : <ArrowDownIcon className="inline h-4 w-4 ml-1" />
                      )}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data Quality
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAndSortedProperties.map((property) => (
                    <tr key={property.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="font-medium text-gray-900">
                          {property.zillowUrl ? (
                            <a 
                              href={property.zillowUrl.startsWith('http') ? property.zillowUrl : `https://www.zillow.com${property.zillowUrl}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 hover:underline flex items-center"
                              title="View on Zillow"
                            >
                              {property.address}
                              <ExternalLinkIcon className="h-3 w-3 ml-1" />
                            </a>
                          ) : (
                            property.address
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          ${property.price?.toLocaleString()} • {property.bedrooms}bd/{property.bathrooms}ba • {property.livingArea?.toLocaleString()} sqft
                        </div>
                        <div className="text-xs text-gray-400">
                          ID: {property.id}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${property.monthlyRent.toLocaleString()}
                        <div className="text-xs text-gray-500">
                          {property.rentSource} ({property.rentConfidence})
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`font-medium ${property.monthlyCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ${property.monthlyCashFlow.toLocaleString()}
                        </span>
                        <div className="text-xs text-gray-500">
                          ${property.annualCashFlow.toLocaleString()}/year
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`font-medium ${property.cashOnCashReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {property.cashOnCashReturn.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`font-medium ${property.capRate >= 6 ? 'text-green-600' : property.capRate >= 4 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {property.capRate.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${property.totalCashInvested.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center">
                          <div className={`h-2 w-2 rounded-full mr-2 ${property.hasRentalData ? 'bg-green-400' : 'bg-red-400'}`}></div>
                          <span className="text-xs text-gray-500">
                            {property.missingFields === 0 ? 'Complete' : `${property.missingFields} missing`}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {filteredAndSortedProperties.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No properties match the current filters.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Analysis;