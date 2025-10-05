# Requirements Document

## Introduction

The Financial Analysis Engine is a core component of the Deal Flow Analyzer that calculates comprehensive investment metrics for real estate properties. This engine takes property data collected from the Zillow API and applies user-configurable financial assumptions to compute cash flow, return on investment, and long-term profitability metrics. The engine must handle missing data gracefully, provide detailed analysis results, and support batch processing for multiple properties.

## Requirements

### Requirement 1

**User Story:** As a real estate investor, I want to calculate monthly cash flow for each property, so that I can quickly identify profitable investment opportunities.

#### Acceptance Criteria

1. WHEN a property has valid price and rental data THEN the system SHALL calculate monthly mortgage payment using configured interest rate, down payment percentage, and loan term
2. WHEN calculating monthly expenses THEN the system SHALL apply configured percentages for property management, maintenance, vacancy rate, insurance, and property taxes
3. WHEN all monthly income and expenses are calculated THEN the system SHALL compute net monthly cash flow as (monthly rent - monthly mortgage payment - monthly operating expenses)
4. IF rental data is missing THEN the system SHALL use fallback rental estimation based on configured percentage of purchase price
5. WHEN cash flow is negative THEN the system SHALL still record the result and flag it appropriately

### Requirement 2

**User Story:** As a real estate investor, I want to calculate annual return metrics, so that I can compare investment opportunities across different properties and markets.

#### Acceptance Criteria

1. WHEN monthly cash flow is calculated THEN the system SHALL compute annual cash flow by multiplying by 12
2. WHEN calculating cash-on-cash return THEN the system SHALL divide annual cash flow by total cash invested (down payment + closing costs)
3. WHEN calculating cap rate THEN the system SHALL divide annual net operating income by purchase price
4. WHEN calculating gross rent multiplier THEN the system SHALL divide purchase price by annual rental income
5. WHEN calculating debt service coverage ratio THEN the system SHALL divide net operating income by annual debt service

### Requirement 3

**User Story:** As a real estate investor, I want to estimate long-term appreciation and total return, so that I can evaluate the complete investment potential over my planned holding period.

#### Acceptance Criteria

1. WHEN calculating appreciation THEN the system SHALL use configured annual appreciation percentage over configured holding period
2. WHEN calculating total return THEN the system SHALL combine cumulative cash flow and appreciation value over holding period
3. WHEN appreciation is calculated THEN the system SHALL compound annually using the configured appreciation rate
4. WHEN total return is computed THEN the system SHALL express it as both absolute dollar amount and percentage return on investment
5. IF holding period is modified THEN the system SHALL recalculate all time-dependent metrics accordingly

### Requirement 4

**User Story:** As a real estate investor, I want the system to handle missing or incomplete property data, so that I can still get analysis results and understand data quality issues.

#### Acceptance Criteria

1. WHEN rental data is missing THEN the system SHALL use fallback rental percentage of purchase price and flag the data quality issue
2. WHEN property details are incomplete THEN the system SHALL record which fields are missing in the analysis result
3. WHEN analysis cannot be completed due to missing critical data THEN the system SHALL create an error record with details
4. WHEN data quality issues exist THEN the system SHALL include a data quality report in the analysis result
5. IF HUD rental data is available THEN the system SHALL prioritize it over Zillow rent estimates

### Requirement 5

**User Story:** As a real estate investor, I want to process multiple properties in batch, so that I can analyze entire markets efficiently without manual intervention.

#### Acceptance Criteria

1. WHEN batch processing is initiated THEN the system SHALL process all properties in the specified zip codes
2. WHEN processing each property THEN the system SHALL apply the same financial configuration consistently
3. WHEN a property analysis fails THEN the system SHALL continue processing remaining properties and log the error
4. WHEN batch processing completes THEN the system SHALL provide a summary of successful analyses, errors, and data quality issues
5. WHEN analysis results are generated THEN the system SHALL store them with timestamps and configuration snapshots

### Requirement 6

**User Story:** As a real estate investor, I want analysis results to include all assumptions used, so that I can understand and validate the calculations.

#### Acceptance Criteria

1. WHEN analysis is completed THEN the system SHALL record all financial assumptions used in the calculation
2. WHEN storing results THEN the system SHALL include mortgage rate, down payment percentage, all expense percentages, and appreciation assumptions
3. WHEN displaying results THEN the system SHALL make assumptions easily accessible for review
4. WHEN configuration changes THEN the system SHALL use updated assumptions for new analyses while preserving historical assumption records
5. IF assumptions are modified THEN the system SHALL clearly indicate which analyses used which assumption sets

### Requirement 7

**User Story:** As a real estate investor, I want to integrate HUD rental data for accurate rental estimates, so that my cash flow calculations are based on reliable market data.

#### Acceptance Criteria

1. WHEN HUD rental data is configured THEN the system SHALL load and parse the HUD data file
2. WHEN estimating rental income THEN the system SHALL match properties to HUD data by location and property characteristics
3. WHEN HUD data match is found THEN the system SHALL use HUD rental estimate over Zillow rent estimate
4. WHEN no HUD match is available THEN the system SHALL fall back to Zillow rent estimate or configured fallback percentage
5. IF HUD data file is missing or corrupted THEN the system SHALL log an error and use alternative rental estimation methods

### Requirement 8

**User Story:** As a real estate investor, I want analysis results to be stored persistently, so that I can track property performance over time and export data for further analysis.

#### Acceptance Criteria

1. WHEN analysis is completed THEN the system SHALL store results in JSON format organized by zip code and date
2. WHEN storing analysis results THEN the system SHALL include property ID, analysis date, all calculated metrics, assumptions used, and data quality indicators
3. WHEN multiple analyses exist for the same property THEN the system SHALL maintain historical records with timestamps
4. WHEN retrieving analysis results THEN the system SHALL support filtering by date range, zip code, and property characteristics
5. WHEN exporting data THEN the system SHALL provide analysis results in CSV format suitable for spreadsheet analysis