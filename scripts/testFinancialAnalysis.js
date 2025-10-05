"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs_1 = require("fs");
var path_1 = require("path");
var financialAnalysisService_1 = require("../backend/dist/services/financialAnalysisService");
function testFinancialAnalysisEngine() {
    return __awaiter(this, void 0, void 0, function () {
        var propertyFile, propertyData, configFile, financialConfig, analysisService, hudService, hudStats, testZipCodes, _i, testZipCodes_1, zipCode, hudData, error_1, validProperties, testProperty, startTime, result, duration, error_2, sampleProperties, startTime, batchResult, duration, error_3, error_4;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log('🚀 Financial Analysis Engine Test');
                    console.log('==================================\n');
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 14, , 15]);
                    propertyFile = (0, path_1.join)(__dirname, '../data/properties/43211/2025-09-15/Columbus OH - Simplified Buybox.json');
                    propertyData = JSON.parse((0, fs_1.readFileSync)(propertyFile, 'utf-8'));
                    console.log("\uD83D\uDCCA Loaded ".concat(propertyData.propertyCount, " properties from ").concat(propertyData.zipCode));
                    console.log("\uD83D\uDCC5 Data timestamp: ".concat(propertyData.timestamp, "\n"));
                    configFile = (0, path_1.join)(__dirname, '../config/financial.json');
                    financialConfig = JSON.parse((0, fs_1.readFileSync)(configFile, 'utf-8'));
                    console.log('⚙️  Financial Configuration:');
                    console.log("   Mortgage Rate: ".concat(financialConfig.mortgage.interestRate, "%"));
                    console.log("   Down Payment: ".concat(financialConfig.mortgage.downPaymentPercent, "%"));
                    console.log("   Property Management: ".concat(financialConfig.operatingExpenses.propertyManagementPercent, "%"));
                    console.log("   Maintenance: ".concat(financialConfig.operatingExpenses.maintenancePercent, "%"));
                    console.log("   Vacancy Rate: ".concat(financialConfig.operatingExpenses.vacancyRate, "%"));
                    console.log("   Appreciation: ".concat(financialConfig.appreciation.annualAppreciationPercent, "%/year"));
                    console.log("   HUD Data: ".concat(financialConfig.rental.useHudData ? 'Enabled' : 'Disabled', "\n"));
                    analysisService = new financialAnalysisService_1.FinancialAnalysisService('./data/hud-rental-data.json');
                    // Test HUD data loading
                    console.log('🏠 Testing HUD Data Service...');
                    hudService = analysisService.getRentalEstimationService().getHudDataService();
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, hudService.loadHudData()];
                case 3:
                    _b.sent();
                    hudStats = hudService.getHudDataStats();
                    console.log("   \u2705 HUD data loaded: ".concat(hudStats.totalRecords, " records"));
                    console.log("   \uD83D\uDCCD Zip codes: ".concat(hudStats.uniqueZipCodes));
                    console.log("   \uD83D\uDECF\uFE0F  Bedroom range: ".concat(hudStats.bedroomRange.min, "-").concat(hudStats.bedroomRange.max));
                    console.log("   \uD83D\uDCB0 Average rent: $".concat(hudStats.averageRent));
                    testZipCodes = ['43211', '43224'];
                    for (_i = 0, testZipCodes_1 = testZipCodes; _i < testZipCodes_1.length; _i++) {
                        zipCode = testZipCodes_1[_i];
                        hudData = hudService.searchHudData({ zipCode: zipCode });
                        console.log("   \uD83D\uDCCD ".concat(zipCode, ": ").concat(hudData.length, " HUD records"));
                    }
                    return [3 /*break*/, 5];
                case 4:
                    error_1 = _b.sent();
                    console.log("   \u26A0\uFE0F  HUD data error: ".concat(error_1 instanceof Error ? error_1.message : 'Unknown error'));
                    return [3 /*break*/, 5];
                case 5:
                    console.log('');
                    validProperties = propertyData.properties.filter(function (p) {
                        return p.price > 1000 && // Filter out the $1 anomaly
                            p.bedrooms > 0 &&
                            p.livingArea > 0;
                    });
                    console.log("\uD83D\uDD0D Filtered to ".concat(validProperties.length, " valid properties (price > $1000, bedrooms > 0)\n"));
                    // Test single property analysis
                    console.log('🏡 Testing Single Property Analysis...');
                    testProperty = validProperties[0];
                    if (!testProperty) return [3 /*break*/, 9];
                    console.log("   Property: ".concat(testProperty.address));
                    console.log("   Price: $".concat(testProperty.price.toLocaleString()));
                    console.log("   Bedrooms: ".concat(testProperty.bedrooms, ", Bathrooms: ").concat(testProperty.bathrooms));
                    console.log("   Living Area: ".concat(testProperty.livingArea.toLocaleString(), " sq ft"));
                    console.log("   Zillow Rent Estimate: $".concat(((_a = testProperty.rentZestimate) === null || _a === void 0 ? void 0 : _a.toLocaleString()) || 'N/A', "\n"));
                    _b.label = 6;
                case 6:
                    _b.trys.push([6, 8, , 9]);
                    startTime = Date.now();
                    return [4 /*yield*/, analysisService.analyzeProperty(testProperty, financialConfig)];
                case 7:
                    result = _b.sent();
                    duration = Date.now() - startTime;
                    console.log('   📈 Analysis Results:');
                    console.log("   \u23F1\uFE0F  Analysis time: ".concat(duration, "ms"));
                    console.log("   \uD83D\uDCB0 Monthly rent: $".concat(result.rentalEstimate.monthlyRent.toLocaleString(), " (").concat(result.rentalEstimate.source, ")"));
                    console.log("   \uD83C\uDFE6 Monthly mortgage: $".concat(result.financialMetrics.monthlyMortgagePayment.toLocaleString()));
                    console.log("   \uD83D\uDCB8 Monthly expenses: $".concat(result.financialMetrics.monthlyOperatingExpenses.toLocaleString()));
                    console.log("   \uD83D\uDCB5 Monthly cash flow: $".concat(result.financialMetrics.monthlyCashFlow.toLocaleString()));
                    console.log("   \uD83D\uDCCA Cash-on-cash return: ".concat(result.financialMetrics.cashOnCashReturn.toFixed(2), "%"));
                    console.log("   \uD83C\uDFAF Cap rate: ".concat(result.financialMetrics.capRate.toFixed(2), "%"));
                    console.log("   \uD83D\uDC8E Total cash invested: $".concat(result.financialMetrics.totalCashInvested.toLocaleString()));
                    console.log("   \uD83D\uDCC8 Projected value (".concat(financialConfig.appreciation.holdingPeriodYears, "yr): $").concat(result.financialMetrics.projectedValue.toLocaleString()));
                    // Investment assessment
                    console.log('\n   🎯 Investment Assessment:');
                    if (result.financialMetrics.monthlyCashFlow > 0) {
                        console.log('   ✅ Positive monthly cash flow');
                    }
                    else {
                        console.log('   ❌ Negative monthly cash flow');
                    }
                    if (result.financialMetrics.cashOnCashReturn > 8) {
                        console.log('   ✅ Excellent cash-on-cash return (>8%)');
                    }
                    else if (result.financialMetrics.cashOnCashReturn > 4) {
                        console.log('   ⚠️  Moderate cash-on-cash return (4-8%)');
                    }
                    else {
                        console.log('   ❌ Low cash-on-cash return (<4%)');
                    }
                    if (result.financialMetrics.capRate > 6) {
                        console.log('   ✅ Good cap rate (>6%)');
                    }
                    else if (result.financialMetrics.capRate > 4) {
                        console.log('   ⚠️  Moderate cap rate (4-6%)');
                    }
                    else {
                        console.log('   ❌ Low cap rate (<4%)');
                    }
                    console.log("\n   \uD83D\uDCCB Data Quality: ".concat(result.dataQuality.hasRentalData ? '✅' : '❌', " Rental, ").concat(result.dataQuality.hasZestimate ? '✅' : '❌', " Zestimate"));
                    if (result.dataQuality.missingDataFields.length > 0) {
                        console.log("   \u26A0\uFE0F  Missing fields: ".concat(result.dataQuality.missingDataFields.join(', ')));
                    }
                    return [3 /*break*/, 9];
                case 8:
                    error_2 = _b.sent();
                    console.error("   \u274C Analysis failed: ".concat(error_2 instanceof Error ? error_2.message : 'Unknown error'));
                    return [3 /*break*/, 9];
                case 9:
                    console.log('\n');
                    // Test batch analysis on a small sample
                    console.log('📊 Testing Batch Analysis...');
                    sampleProperties = validProperties.slice(0, 5);
                    console.log("   Analyzing ".concat(sampleProperties.length, " properties...\n"));
                    _b.label = 10;
                case 10:
                    _b.trys.push([10, 12, , 13]);
                    startTime = Date.now();
                    return [4 /*yield*/, analysisService.analyzeBatch(sampleProperties, financialConfig)];
                case 11:
                    batchResult = _b.sent();
                    duration = Date.now() - startTime;
                    console.log('   📈 Batch Analysis Results:');
                    console.log("   \u23F1\uFE0F  Total time: ".concat(duration, "ms (").concat(Math.round(duration / sampleProperties.length), "ms per property)"));
                    console.log("   \u2705 Successful: ".concat(batchResult.successfulAnalyses, "/").concat(batchResult.totalProperties));
                    console.log("   \u274C Failed: ".concat(batchResult.failedAnalyses));
                    console.log("   \uD83D\uDCB0 Average cash flow: $".concat(batchResult.summary.averageCashFlow.toLocaleString()));
                    console.log("   \uD83D\uDCCA Average ROI: ".concat(batchResult.summary.averageROI.toFixed(2), "%"));
                    console.log("   \uD83C\uDFAF Average cap rate: ".concat(batchResult.summary.averageCapRate.toFixed(2), "%"));
                    console.log("   \uD83D\uDCCB Data quality score: ".concat(batchResult.summary.dataQualityScore.toFixed(1), "%"));
                    if (batchResult.summary.topPerformers.length > 0) {
                        console.log("   \uD83C\uDFC6 Top performer: ".concat(batchResult.summary.topPerformers[0]));
                    }
                    if (batchResult.errors.length > 0) {
                        console.log("\n   \u26A0\uFE0F  Errors encountered:");
                        batchResult.errors.slice(0, 3).forEach(function (error, index) {
                            console.log("   ".concat(index + 1, ". ").concat(error.errorMessage));
                        });
                    }
                    return [3 /*break*/, 13];
                case 12:
                    error_3 = _b.sent();
                    console.error("   \u274C Batch analysis failed: ".concat(error_3 instanceof Error ? error_3.message : 'Unknown error'));
                    return [3 /*break*/, 13];
                case 13:
                    console.log('\n✅ Financial Analysis Engine test completed!');
                    return [3 /*break*/, 15];
                case 14:
                    error_4 = _b.sent();
                    console.error('❌ Test failed:', error_4 instanceof Error ? error_4.message : 'Unknown error');
                    console.error(error_4);
                    return [3 /*break*/, 15];
                case 15: return [2 /*return*/];
            }
        });
    });
}
// Run the test
testFinancialAnalysisEngine().catch(console.error);
