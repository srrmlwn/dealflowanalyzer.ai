import { z } from 'zod';

// Property types from Zillow API
export const PropertyTypeSchema = z.enum([
  'SINGLE_FAMILY',
  'CONDO',
  'TOWNHOUSE',
  'MULTI_FAMILY',
  'APARTMENT',
  'MANUFACTURED',
  'LOT',
  'LAND'
]);

export const ListingStatusSchema = z.enum([
  'FOR_SALE',
  'FOR_RENT',
  'RECENTLY_SOLD',
  'COMING_SOON'
]);

// Base property interface from Zillow API
export const PropertySchema = z.object({
  zpid: z.string(),
  address: z.string(),
  price: z.number(),
  bedrooms: z.number(),
  bathrooms: z.number(),
  livingArea: z.number(),
  lotAreaValue: z.number(),
  lotAreaUnit: z.string(),
  propertyType: PropertyTypeSchema,
  listingStatus: ListingStatusSchema,
  latitude: z.number(),
  longitude: z.number(),
  imgSrc: z.string().optional(),
  rentZestimate: z.number().optional(),
  zestimate: z.number().optional(),
  priceChange: z.number().optional(),
  daysOnZillow: z.number(),
  datePriceChanged: z.number().optional(),
  detailUrl: z.string(),
  has3DModel: z.boolean(),
  hasVideo: z.boolean(),
  hasImage: z.boolean(),
  country: z.string(),
  currency: z.string(),
  listingSubType: z.object({
    is_FSBA: z.boolean().optional(),
    is_FSBO: z.boolean().optional(),
    is_openHouse: z.boolean().optional()
  }).optional(),
  contingentListingType: z.string().optional(),
  comingSoonOnMarketDate: z.number().optional(),
  variableData: z.any().optional(),
  carouselPhotos: z.any().optional()
});

// Buybox configuration schema
export const BuyboxConfigSchema = z.object({
  name: z.string(),
  zipCodes: z.array(z.string()),
  propertyTypes: z.array(PropertyTypeSchema).optional(),
  priceRange: z.object({
    min: z.number().optional(),
    max: z.number().optional()
  }).optional(),
  bedrooms: z.object({
    min: z.number().optional(),
    max: z.number().optional()
  }).optional(),
  bathrooms: z.object({
    min: z.number().optional(),
    max: z.number().optional()
  }).optional(),
  squareFeet: z.object({
    min: z.number().optional(),
    max: z.number().optional()
  }).optional(),
  lotSize: z.object({
    min: z.number().optional(),
    max: z.number().optional()
  }).optional(),
  yearBuilt: z.object({
    min: z.number().optional(),
    max: z.number().optional()
  }).optional(),
  daysOnMarket: z.string().optional(), // '1', '7', '14', '30', '90', '6m', '12m', '24m', '36m'
  features: z.object({
    hasBasement: z.boolean().optional(),
    hasGarage: z.boolean().optional(),
    hasPool: z.boolean().optional(),
    isWaterfront: z.boolean().optional(),
    isNewConstruction: z.boolean().optional()
  }).optional()
});

// Financial configuration schema
export const FinancialConfigSchema = z.object({
  mortgage: z.object({
    interestRate: z.number(), // Annual percentage rate
    downPaymentPercent: z.number(), // Percentage of purchase price
    loanTermYears: z.number(), // Loan term in years
    points: z.number().optional(), // Loan points
    closingCostsPercent: z.number().optional() // Closing costs as percentage of purchase price
  }),
  operatingExpenses: z.object({
    propertyManagementPercent: z.number(), // Percentage of gross rent
    maintenancePercent: z.number(), // Percentage of gross rent
    vacancyRate: z.number(), // Percentage of gross rent
    insurancePercent: z.number(), // Percentage of purchase price annually
    propertyTaxPercent: z.number(), // Percentage of purchase price annually
    hoaFees: z.number().optional(), // Monthly HOA fees
    utilitiesPercent: z.number().optional(), // Percentage of gross rent
    otherExpensesPercent: z.number().optional() // Percentage of gross rent
  }),
  appreciation: z.object({
    annualAppreciationPercent: z.number(), // Expected annual appreciation
    holdingPeriodYears: z.number() // Expected holding period
  }),
  rental: z.object({
    useHudData: z.boolean(), // Whether to use HUD rental data
    hudDataPath: z.string().optional(), // Path to HUD rental data file
    fallbackRentPercent: z.number().optional() // Fallback rent as percentage of purchase price
  })
});

// Analysis result schema
export const AnalysisResultSchema = z.object({
  propertyId: z.string(),
  analysisDate: z.string(),
  financialMetrics: z.object({
    monthlyRent: z.number(),
    monthlyMortgagePayment: z.number(),
    monthlyOperatingExpenses: z.number(),
    monthlyCashFlow: z.number(),
    annualCashFlow: z.number(),
    cashOnCashReturn: z.number(), // Annual cash flow / total cash invested
    capRate: z.number(), // Annual net operating income / purchase price
    totalReturn: z.number(), // Cash flow + appreciation over holding period
    appreciationValue: z.number(), // Expected appreciation over holding period
    totalCashInvested: z.number(), // Down payment + closing costs
    grossRentMultiplier: z.number(), // Purchase price / annual rent
    debtServiceCoverageRatio: z.number() // Net operating income / annual debt service
  }),
  assumptions: z.object({
    mortgageRate: z.number(),
    downPaymentPercent: z.number(),
    propertyManagementPercent: z.number(),
    maintenancePercent: z.number(),
    vacancyRate: z.number(),
    insurancePercent: z.number(),
    propertyTaxPercent: z.number(),
    annualAppreciationPercent: z.number()
  }),
  dataQuality: z.object({
    hasRentalData: z.boolean(),
    hasZestimate: z.boolean(),
    hasPriceHistory: z.boolean(),
    missingDataFields: z.array(z.string())
  })
});

// Error tracking schema
export const ErrorRecordSchema = z.object({
  timestamp: z.string(),
  propertyId: z.string().optional(),
  errorType: z.string(),
  errorMessage: z.string(),
  errorDetails: z.any().optional(),
  context: z.object({
    zipCode: z.string().optional(),
    buyboxName: z.string().optional(),
    operation: z.string().optional()
  }).optional()
});

// API response schemas
export const ZillowApiResponseSchema = z.object({
  props: z.array(PropertySchema),
  resultsPerPage: z.number(),
  totalPages: z.number(),
  totalResultCount: z.number(),
  currentPage: z.number(),
  schools: z.any().optional()
});

// Type exports
export type Property = z.infer<typeof PropertySchema>;
export type PropertyType = z.infer<typeof PropertyTypeSchema>;
export type ListingStatus = z.infer<typeof ListingStatusSchema>;
export type BuyboxConfig = z.infer<typeof BuyboxConfigSchema>;
export type FinancialConfig = z.infer<typeof FinancialConfigSchema>;
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
export type ErrorRecord = z.infer<typeof ErrorRecordSchema>;
export type ZillowApiResponse = z.infer<typeof ZillowApiResponseSchema>;

// Configuration file schemas
export const ConfigFileSchema = z.object({
  buybox: BuyboxConfigSchema,
  financial: FinancialConfigSchema
});

export type ConfigFile = z.infer<typeof ConfigFileSchema>;
