import { FinancialConfig } from '/Users/sriram/projects/dealflowanalyzer.ai/shared/dist/types';

export interface MortgageCalculation {
  monthlyPayment: number;
  monthlyPrincipal: number;
  monthlyInterest: number;
  totalLoanAmount: number;
  downPayment: number;
  closingCosts: number;
  totalCashRequired: number;
}

export interface OperatingExpenses {
  propertyManagement: number;
  maintenance: number;
  vacancy: number;
  insurance: number;
  propertyTax: number;
  hoaFees: number;
  utilities: number;
  other: number;
  total: number;
}

export interface CashFlowMetrics {
  monthlyRent: number;
  monthlyMortgagePayment: number;
  monthlyOperatingExpenses: number;
  monthlyNetOperatingIncome: number;
  monthlyCashFlow: number;
  annualCashFlow: number;
  annualNetOperatingIncome: number;
}

export interface ROIMetrics {
  cashOnCashReturn: number;
  capRate: number;
  grossRentMultiplier: number;
  debtServiceCoverageRatio: number;
  totalCashInvested: number;
}

export interface AppreciationMetrics {
  currentValue: number;
  projectedValue: number;
  appreciationValue: number;
  totalReturn: number;
  annualizedReturn: number;
}

export class FinancialCalculatorService {
  
  /**
   * Calculate monthly mortgage payment using PMT formula
   * PMT = P * [r(1+r)^n] / [(1+r)^n - 1]
   */
  calculateMortgagePayment(
    purchasePrice: number,
    config: FinancialConfig['mortgage']
  ): MortgageCalculation {
    const downPayment = purchasePrice * (config.downPaymentPercent / 100);
    const loanAmount = purchasePrice - downPayment;
    const closingCosts = purchasePrice * ((config.closingCostsPercent || 0) / 100);
    const totalCashRequired = downPayment + closingCosts;
    
    // Convert annual rate to monthly and years to months
    const monthlyRate = (config.interestRate / 100) / 12;
    const numberOfPayments = config.loanTermYears * 12;
    
    let monthlyPayment = 0;
    let monthlyPrincipal = 0;
    let monthlyInterest = 0;
    
    if (monthlyRate > 0) {
      // Standard mortgage payment calculation
      const rateCompounded = Math.pow(1 + monthlyRate, numberOfPayments);
      monthlyPayment = loanAmount * (monthlyRate * rateCompounded) / (rateCompounded - 1);
      
      // For first month approximation (actual would vary each month)
      monthlyInterest = loanAmount * monthlyRate;
      monthlyPrincipal = monthlyPayment - monthlyInterest;
    } else {
      // Handle zero interest rate case
      monthlyPayment = loanAmount / numberOfPayments;
      monthlyPrincipal = monthlyPayment;
      monthlyInterest = 0;
    }
    
    // Add loan points to total cash required if specified
    const pointsCost = config.points ? loanAmount * (config.points / 100) : 0;
    
    return {
      monthlyPayment: Math.round(monthlyPayment * 100) / 100,
      monthlyPrincipal: Math.round(monthlyPrincipal * 100) / 100,
      monthlyInterest: Math.round(monthlyInterest * 100) / 100,
      totalLoanAmount: loanAmount,
      downPayment,
      closingCosts,
      totalCashRequired: totalCashRequired + pointsCost
    };
  }
  
  /**
   * Calculate monthly operating expenses
   */
  calculateOperatingExpenses(
    monthlyRent: number,
    purchasePrice: number,
    config: FinancialConfig['operatingExpenses']
  ): OperatingExpenses {
    const annualRent = monthlyRent * 12;
    
    const propertyManagement = monthlyRent * (config.propertyManagementPercent / 100);
    const maintenance = monthlyRent * (config.maintenancePercent / 100);
    const vacancy = monthlyRent * (config.vacancyRate / 100);
    const utilities = monthlyRent * ((config.utilitiesPercent || 0) / 100);
    const other = monthlyRent * ((config.otherExpensesPercent || 0) / 100);
    
    // Annual expenses converted to monthly
    const insurance = (purchasePrice * (config.insurancePercent / 100)) / 12;
    const propertyTax = (purchasePrice * (config.propertyTaxPercent / 100)) / 12;
    const hoaFees = config.hoaFees || 0;
    
    const total = propertyManagement + maintenance + vacancy + insurance + 
                  propertyTax + hoaFees + utilities + other;
    
    return {
      propertyManagement: Math.round(propertyManagement * 100) / 100,
      maintenance: Math.round(maintenance * 100) / 100,
      vacancy: Math.round(vacancy * 100) / 100,
      insurance: Math.round(insurance * 100) / 100,
      propertyTax: Math.round(propertyTax * 100) / 100,
      hoaFees: Math.round(hoaFees * 100) / 100,
      utilities: Math.round(utilities * 100) / 100,
      other: Math.round(other * 100) / 100,
      total: Math.round(total * 100) / 100
    };
  }
  
  /**
   * Calculate cash flow metrics
   */
  calculateCashFlow(
    monthlyRent: number,
    mortgageCalculation: MortgageCalculation,
    operatingExpenses: OperatingExpenses
  ): CashFlowMetrics {
    const monthlyMortgagePayment = mortgageCalculation.monthlyPayment;
    const monthlyOperatingExpenses = operatingExpenses.total;
    
    // NOI = Rent - Operating Expenses (excludes mortgage payment)
    const monthlyNetOperatingIncome = monthlyRent - monthlyOperatingExpenses;
    
    // Cash Flow = NOI - Debt Service (mortgage payment)
    const monthlyCashFlow = monthlyNetOperatingIncome - monthlyMortgagePayment;
    
    return {
      monthlyRent: Math.round(monthlyRent * 100) / 100,
      monthlyMortgagePayment: Math.round(monthlyMortgagePayment * 100) / 100,
      monthlyOperatingExpenses: Math.round(monthlyOperatingExpenses * 100) / 100,
      monthlyNetOperatingIncome: Math.round(monthlyNetOperatingIncome * 100) / 100,
      monthlyCashFlow: Math.round(monthlyCashFlow * 100) / 100,
      annualCashFlow: Math.round(monthlyCashFlow * 12 * 100) / 100,
      annualNetOperatingIncome: Math.round(monthlyNetOperatingIncome * 12 * 100) / 100
    };
  }
  
  /**
   * Calculate ROI and performance metrics
   */
  calculateROIMetrics(
    cashFlow: CashFlowMetrics,
    mortgageCalculation: MortgageCalculation,
    purchasePrice: number
  ): ROIMetrics {
    const totalCashInvested = mortgageCalculation.totalCashRequired;
    const annualRent = cashFlow.monthlyRent * 12;
    const annualDebtService = mortgageCalculation.monthlyPayment * 12;
    
    // Cash-on-Cash Return = Annual Cash Flow / Total Cash Invested
    const cashOnCashReturn = totalCashInvested > 0 
      ? (cashFlow.annualCashFlow / totalCashInvested) * 100 
      : 0;
    
    // Cap Rate = Annual NOI / Purchase Price
    const capRate = purchasePrice > 0 
      ? (cashFlow.annualNetOperatingIncome / purchasePrice) * 100 
      : 0;
    
    // Gross Rent Multiplier = Purchase Price / Annual Rent
    const grossRentMultiplier = annualRent > 0 
      ? purchasePrice / annualRent 
      : 0;
    
    // Debt Service Coverage Ratio = NOI / Annual Debt Service
    const debtServiceCoverageRatio = annualDebtService > 0 
      ? cashFlow.annualNetOperatingIncome / annualDebtService 
      : 0;
    
    return {
      cashOnCashReturn: Math.round(cashOnCashReturn * 100) / 100,
      capRate: Math.round(capRate * 100) / 100,
      grossRentMultiplier: Math.round(grossRentMultiplier * 100) / 100,
      debtServiceCoverageRatio: Math.round(debtServiceCoverageRatio * 100) / 100,
      totalCashInvested: Math.round(totalCashInvested * 100) / 100
    };
  }
  
  /**
   * Calculate appreciation and long-term projections
   */
  calculateAppreciation(
    currentValue: number,
    config: FinancialConfig['appreciation'],
    annualCashFlow: number
  ): AppreciationMetrics {
    const appreciationRate = config.annualAppreciationPercent / 100;
    const holdingPeriod = config.holdingPeriodYears;
    
    // Compound appreciation: FV = PV * (1 + r)^n
    const projectedValue = currentValue * Math.pow(1 + appreciationRate, holdingPeriod);
    const appreciationValue = projectedValue - currentValue;
    
    // Total return = cumulative cash flow + appreciation
    const totalCashFlow = annualCashFlow * holdingPeriod;
    const totalReturn = totalCashFlow + appreciationValue;
    
    // Annualized return on initial investment
    const annualizedReturn = holdingPeriod > 0 
      ? (Math.pow(projectedValue / currentValue, 1 / holdingPeriod) - 1) * 100 
      : 0;
    
    return {
      currentValue: Math.round(currentValue * 100) / 100,
      projectedValue: Math.round(projectedValue * 100) / 100,
      appreciationValue: Math.round(appreciationValue * 100) / 100,
      totalReturn: Math.round(totalReturn * 100) / 100,
      annualizedReturn: Math.round(annualizedReturn * 100) / 100
    };
  }
}