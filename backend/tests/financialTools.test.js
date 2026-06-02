import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateEmi,
  calculateFoir,
  compareTenureOutlook,
  findEligibleProducts,
} from "../src/services/recommendationService.js";

test("calculateEmi returns positive values", () => {
  const result = calculateEmi(500000, 11, 24);
  assert.ok(result.emi > 0);
  assert.ok(result.total_interest > 0);
  assert.ok(result.total_repayment > 500000);
});

test("calculateEmi is exact for a known scenario (pure function, no endpoint)", () => {
  // EMI is a pure function only — it is intentionally not exposed as an API.
  const result = calculateEmi(500000, 11, 24);
  assert.deepEqual(result, {
    emi: 23303.92,
    total_interest: 59294.06,
    total_repayment: 559294.06,
  });
});

test("calculateFoir computes the ratio", () => {
  assert.equal(calculateFoir(100000, 20000), 20.0);
});

test("compareTenureOutlook changes with tenure and risk", () => {
  const result = compareTenureOutlook(48, "conservative");
  assert.ok(result.tenure_note.includes("Long tenure"));
  assert.ok(result.risk_note.includes("Conservative borrowers"));
});

test("findEligibleProducts filters by income, employment, and FOIR", () => {
  const products = [
    {
      name: "Personal Loan",
      description: "General purpose",
      interest_rate: 11.0,
      minimum_income: 50000,
      maximum_amount: 1000000,
      minimum_tenure: 12,
      maximum_tenure: 60,
      eligibility_rules: { max_foir: 45, employment_types: ["salaried"] },
    },
    {
      name: "SME Loan",
      description: "Business lending",
      interest_rate: 14.0,
      minimum_income: 80000,
      maximum_amount: 5000000,
      minimum_tenure: 12,
      maximum_tenure: 84,
      eligibility_rules: { max_foir: 50, employment_types: ["business-owner"] },
    },
  ];

  const eligible = findEligibleProducts({
    products,
    monthlyIncome: 90000,
    existingMonthlyEmi: 15000,
    loanAmount: 500000,
    employmentType: "salaried",
    preferredTenureMonths: 24,
  });

  assert.deepEqual(
    eligible.map((product) => product.name),
    ["Personal Loan"],
  );
  assert.equal(eligible[0].foir, 16.67);
});

test("findEligibleProducts returns empty when FOIR is too high", () => {
  const products = [
    {
      name: "Salary Advance",
      description: "Short term",
      interest_rate: 8.0,
      minimum_income: 30000,
      maximum_amount: 300000,
      minimum_tenure: 3,
      maximum_tenure: 18,
      eligibility_rules: { max_foir: 35, employment_types: ["salaried"] },
    },
  ];

  const eligible = findEligibleProducts({
    products,
    monthlyIncome: 50000,
    existingMonthlyEmi: 25000,
    loanAmount: 100000,
    employmentType: "salaried",
    preferredTenureMonths: 12,
  });

  assert.deepEqual(eligible, []);
});
