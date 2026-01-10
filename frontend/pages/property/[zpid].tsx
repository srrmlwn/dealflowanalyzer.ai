import { NextPage } from 'next';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeftIcon, DollarSignIcon, TrendingUpIcon, HomeIcon, CalendarIcon, MapPinIcon } from 'lucide-react';

interface PropertyDetails {
  // Property info
  id: string;
  address: string;
  zipCode: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  livingArea: number;
  zillowUrl: string;

  // Financial metrics
  monthlyRent: number;
  monthlyMortgage: number;
  monthlyExpenses: number;
  monthlyCashFlow: number;
  annualCashFlow: number;
  cashOnCashReturn: number;
  capRate: number;
  totalCashInvested: number;
  projectedValue: number;

  // Detailed breakdown
  operatingExpensesBreakdown?: {
    propertyManagement: number;
    maintenance: number;
    vacancy: number;
    insurance: number;
    propertyTax: number;
    hoa: number;
    utilities: number;
    other: number;
    total: number;
  };

  mortgageDetails?: {
    monthlyPayment: number;
    monthlyPrincipal: number;
    monthlyInterest: number;
    loanAmount: number;
    downPayment: number;
  };

  // Price comparison
  priceComparison?: {
    avgRecentlySoldPrice: number;
    percentAboveMarket: number;
    soldCompsCount: number;
    marketCondition: 'HOT' | 'BALANCED' | 'COLD';
    medianSoldPrice: number;
    pricePerSqFt: number;
    avgPricePerSqFt: number;
  };

  // Rental estimate
  rentSource: string;
  rentConfidence: string;

  // Data quality
  hasRentalData: boolean;
  hasZestimate: boolean;
  missingFields: number;
}

const PropertyDetail: NextPage = () => {
  const router = useRouter();
  const { zpid } = router.query;
  const [property, setProperty] = useState<PropertyDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!zpid) return;

    loadPropertyDetails(zpid as string);
  }, [zpid]);

  const loadPropertyDetails = async (propertyId: string) => {
    try {
      setLoading(true);
      setError(null);

      // Try to load from backend API
      const response = await fetch(`http://localhost:8000/api/analysis/results`);

      if (!response.ok) {
        throw new Error('Failed to load property details');
      }

      const data = await response.json();
      const propertyResult = data.results.find((r: any) => r.propertyId === propertyId);

      if (!propertyResult) {
        // Try static JSON as fallback
        const staticResponse = await fetch('/data/analysis-results.json');
        if (staticResponse.ok) {
          const staticData = await staticResponse.json();
          const staticProperty = staticData.properties.find((p: any) => p.id === propertyId);
          if (staticProperty) {
            setProperty(staticProperty);
            return;
          }
        }
        throw new Error('Property not found');
      }

      if (!propertyResult.financialMetrics) {
        throw new Error('Property analysis data is incomplete');
      }

      // Get available dates and use the latest one
      const datesResponse = await fetch('http://localhost:8000/api/properties/dates/43211');
      let latestDate = '';
      if (datesResponse.ok) {
        const datesData = await datesResponse.json();
        latestDate = datesData.dates[0]; // dates are sorted with most recent first
      }

      // Load property data for address
      const zip1Response = await fetch(`http://localhost:8000/api/properties?zipCode=43211&date=${latestDate}&buyboxName=Columbus%20OH%20-%20Simplified%20Buybox`);
      const zip2Response = await fetch(`http://localhost:8000/api/properties?zipCode=43224&date=${latestDate}&buyboxName=Columbus%20OH%20-%20Simplified%20Buybox`);

      let originalProp: any = null;
      if (zip1Response.ok && zip2Response.ok) {
        const zip1Data = await zip1Response.json();
        const zip2Data = await zip2Response.json();
        const allProperties = [...(zip1Data.properties || []), ...(zip2Data.properties || [])];
        originalProp = allProperties.find((p: any) => p.zpid === propertyId);
      }

      setProperty({
        id: propertyResult.propertyId,
        address: originalProp?.address || `Property ${propertyId}`,
        zipCode: originalProp?.zipcode || 'unknown',
        price: originalProp?.price || 0,
        bedrooms: originalProp?.bedrooms || 0,
        bathrooms: originalProp?.bathrooms || 0,
        livingArea: originalProp?.livingArea || 0,
        zillowUrl: originalProp?.detailUrl || '',
        monthlyRent: propertyResult.financialMetrics?.monthlyRent || 0,
        monthlyMortgage: propertyResult.financialMetrics?.monthlyMortgagePayment || 0,
        monthlyExpenses: propertyResult.financialMetrics?.monthlyOperatingExpenses || 0,
        monthlyCashFlow: propertyResult.financialMetrics?.monthlyCashFlow || 0,
        annualCashFlow: propertyResult.financialMetrics?.annualCashFlow || 0,
        cashOnCashReturn: propertyResult.financialMetrics?.cashOnCashReturn || 0,
        capRate: propertyResult.financialMetrics?.capRate || 0,
        totalCashInvested: propertyResult.financialMetrics?.totalCashInvested || 0,
        projectedValue: propertyResult.financialMetrics?.projectedValue || 0,
        operatingExpensesBreakdown: propertyResult.financialMetrics?.operatingExpensesBreakdown,
        mortgageDetails: propertyResult.financialMetrics?.mortgageDetails,
        priceComparison: propertyResult.priceComparison,
        rentSource: propertyResult.rentalEstimate?.source || 'Unknown',
        rentConfidence: propertyResult.rentalEstimate?.confidence || 'Unknown',
        hasRentalData: propertyResult.dataQuality?.hasRentalData || false,
        hasZestimate: propertyResult.dataQuality?.hasZestimate || false,
        missingFields: propertyResult.dataQuality?.missingDataFields?.length || 0
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load property details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading property details...</div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-red-600 mb-4">{error || 'Property not found'}</div>
          <Link href="/analysis" className="text-blue-600 hover:text-blue-800">
            Back to Analysis
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>{property.address} - Property Analysis | Deal Flow Analyzer</title>
        <meta name="description" content={`Detailed analysis for ${property.address}`} />
      </Head>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <Link href="/analysis" className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4">
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to Analysis
            </Link>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    {property.address}
                  </h1>
                  <div className="flex items-center space-x-4 text-gray-600">
                    <span className="flex items-center">
                      <MapPinIcon className="h-4 w-4 mr-1" />
                      {property.zipCode}
                    </span>
                    <span className="flex items-center">
                      <HomeIcon className="h-4 w-4 mr-1" />
                      {property.bedrooms} bd | {property.bathrooms} ba | {property.livingArea?.toLocaleString() || 'N/A'} sq ft
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-900">
                    ${property.price?.toLocaleString() || 'N/A'}
                  </div>
                  {property.zillowUrl && (
                    <a
                      href={property.zillowUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 mt-2 inline-block"
                    >
                      View on Zillow →
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="text-sm text-gray-600 mb-1">Monthly Cash Flow</div>
              <div className={`text-2xl font-bold ${property.monthlyCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${Math.abs(property.monthlyCashFlow || 0).toLocaleString()}
                {property.monthlyCashFlow >= 0 ? '' : ' loss'}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="text-sm text-gray-600 mb-1">Cash-on-Cash ROI</div>
              <div className={`text-2xl font-bold ${property.cashOnCashReturn >= 8 ? 'text-green-600' : property.cashOnCashReturn >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                {property.cashOnCashReturn.toFixed(2)}%
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="text-sm text-gray-600 mb-1">Cap Rate</div>
              <div className={`text-2xl font-bold ${property.capRate >= 6 ? 'text-green-600' : property.capRate >= 4 ? 'text-yellow-600' : 'text-red-600'}`}>
                {property.capRate.toFixed(2)}%
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="text-sm text-gray-600 mb-1">Total Investment</div>
              <div className="text-2xl font-bold text-gray-900">
                ${property.totalCashInvested?.toLocaleString() || 'N/A'}
              </div>
            </div>
          </div>

          {/* Price Comparison */}
          {property.priceComparison && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Price vs Market</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-gray-600 mb-1">vs. Recent Sales</div>
                  <div className={`text-2xl font-bold ${
                    property.priceComparison.percentAboveMarket < -5 ? 'text-green-600' :
                    property.priceComparison.percentAboveMarket > 5 ? 'text-red-600' :
                    'text-yellow-600'
                  }`}>
                    {property.priceComparison.percentAboveMarket > 0 ? '+' : ''}
                    {property.priceComparison.percentAboveMarket?.toFixed(1) || 'N/A'}%
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {property.priceComparison.marketCondition || 'Unknown'} market
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Avg Sold Price</div>
                  <div className="text-xl font-semibold text-gray-900">
                    ${property.priceComparison.avgRecentlySoldPrice?.toLocaleString() || 'N/A'}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Based on {property.priceComparison.soldCompsCount || 0} comparables
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Price per Sq Ft</div>
                  <div className="text-xl font-semibold text-gray-900">
                    ${property.priceComparison.pricePerSqFt || 'N/A'}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Market avg: ${property.priceComparison.avgPricePerSqFt || 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Monthly Cash Flow Breakdown */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Monthly Cash Flow Breakdown</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="text-gray-700">Monthly Rent</span>
                <span className="font-semibold text-green-600">+${property.monthlyRent?.toLocaleString() || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="text-gray-700">Mortgage Payment</span>
                <span className="font-semibold text-red-600">-${property.monthlyMortgage?.toLocaleString() || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="text-gray-700">Operating Expenses</span>
                <span className="font-semibold text-red-600">-${property.monthlyExpenses?.toLocaleString() || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-lg font-bold text-gray-900">Net Cash Flow</span>
                <span className={`text-lg font-bold ${property.monthlyCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {property.monthlyCashFlow >= 0 ? '+' : '-'}${Math.abs(property.monthlyCashFlow || 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Operating Expenses Breakdown */}
          {property.operatingExpensesBreakdown && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Operating Expenses Breakdown</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {property.operatingExpensesBreakdown?.propertyManagement > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Property Management</span>
                    <span className="font-semibold">${property.operatingExpensesBreakdown.propertyManagement?.toLocaleString() || 'N/A'}/mo</span>
                  </div>
                )}
                {property.operatingExpensesBreakdown?.maintenance > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Maintenance</span>
                    <span className="font-semibold">${property.operatingExpensesBreakdown.maintenance?.toLocaleString() || 'N/A'}/mo</span>
                  </div>
                )}
                {property.operatingExpensesBreakdown?.vacancy > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Vacancy Reserve</span>
                    <span className="font-semibold">${property.operatingExpensesBreakdown.vacancy?.toLocaleString() || 'N/A'}/mo</span>
                  </div>
                )}
                {property.operatingExpensesBreakdown?.insurance > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Insurance</span>
                    <span className="font-semibold">${property.operatingExpensesBreakdown.insurance?.toLocaleString() || 'N/A'}/mo</span>
                  </div>
                )}
                {property.operatingExpensesBreakdown?.propertyTax > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Property Tax</span>
                    <span className="font-semibold">${property.operatingExpensesBreakdown.propertyTax?.toLocaleString() || 'N/A'}/mo</span>
                  </div>
                )}
                {property.operatingExpensesBreakdown?.hoa > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">HOA Fees</span>
                    <span className="font-semibold">${property.operatingExpensesBreakdown.hoa?.toLocaleString() || 'N/A'}/mo</span>
                  </div>
                )}
                {property.operatingExpensesBreakdown?.utilities > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Utilities</span>
                    <span className="font-semibold">${property.operatingExpensesBreakdown.utilities?.toLocaleString() || 'N/A'}/mo</span>
                  </div>
                )}
                {property.operatingExpensesBreakdown?.other > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Other</span>
                    <span className="font-semibold">${property.operatingExpensesBreakdown.other?.toLocaleString() || 'N/A'}/mo</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center pt-4 mt-4 border-t">
                <span className="font-bold text-gray-900">Total Monthly Expenses</span>
                <span className="font-bold text-red-600">${property.operatingExpensesBreakdown?.total?.toLocaleString() || 'N/A'}</span>
              </div>
            </div>
          )}

          {/* Mortgage Details */}
          {property.mortgageDetails && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Mortgage Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600 mb-1">Loan Amount</div>
                  <div className="text-xl font-semibold text-gray-900">
                    ${property.mortgageDetails.loanAmount?.toLocaleString() || 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Down Payment</div>
                  <div className="text-xl font-semibold text-gray-900">
                    ${property.mortgageDetails.downPayment?.toLocaleString() || 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Monthly Principal</div>
                  <div className="text-xl font-semibold text-gray-900">
                    ${property.mortgageDetails.monthlyPrincipal?.toLocaleString() || 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Monthly Interest</div>
                  <div className="text-xl font-semibold text-gray-900">
                    ${property.mortgageDetails.monthlyInterest?.toLocaleString() || 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Rental Estimate Info */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Rental Estimate</h2>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Source</span>
                <span className="font-semibold">{property.rentSource}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Confidence</span>
                <span className={`font-semibold ${
                  property.rentConfidence === 'HIGH' ? 'text-green-600' :
                  property.rentConfidence === 'MEDIUM' ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {property.rentConfidence}
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PropertyDetail;
