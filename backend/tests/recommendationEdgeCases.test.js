import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateEmi,
  calculateFoir,
  compareTenureOutlook,
  findEligibleProducts,
} from "../src/services/recommendationService.js";

function product(overrides = {}) {
  return {
    name: "Personal Loan",
    description: "General purpose",
    interest_rate: 11.0,
    minimum_income: 50000,
    maximum_amount: 1000000,
    minimum_tenure: 12,
    maximum_tenure: 60,
    eligibility_rules: { max_foir: 45, employment_types: ["salaried"] },
    ...overrides,
  };
}

test("calculateEmi with zero interest is straight division", () => {
  const result = calculateEmi(120000, 0, 12);
  assert.equal(result.emi, 10000.0);
  assert.equal(result.total_interest, 0.0);
  assert.equal(result.total_repayment, 120000.0);
});

test("calculateEmi total repayment is principal plus interest", () => {
  const result = calculateEmi(500000, 11, 24);
  assert.ok(Math.abs(result.total_repayment - (500000 + result.total_interest)) < 0.01);
  assert.ok(Math.abs(result.total_repayment - result.emi * 24) < 0.5);
});

test("calculateFoir handles zero income", () => {
  assert.equal(calculateFoir(0, 10000), 100.0);
});

test("calculateFoir handles negative income", () => {
  assert.equal(calculateFoir(-5000, 10000), 100.0);
});

test("calculateFoir with zero existing EMI is zero", () => {
  assert.equal(calculateFoir(80000, 0), 0.0);
});

test("compareTenureOutlook short tenure", () => {
  const result = compareTenureOutlook(12, "growth");
  assert.ok(result.tenure_note.includes("Short tenure"));
  assert.ok(result.risk_note.includes("Growth-oriented"));
});

test("compareTenureOutlook mid tenure", () => {
  const result = compareTenureOutlook(30, "balanced");
  assert.ok(result.tenure_note.includes("Mid-range tenure"));
});

test("compareTenureOutlook treats 'low' risk like conservative", () => {
  const result = compareTenureOutlook(24, "low");
  assert.ok(result.risk_note.includes("Conservative borrowers"));
});

test("findEligibleProducts excludes loan above maximum amount", () => {
  const eligible = findEligibleProducts({
    products: [product({ maximum_amount: 300000 })],
    monthlyIncome: 90000,
    existingMonthlyEmi: 5000,
    loanAmount: 500000,
    employmentType: "salaried",
    preferredTenureMonths: 24,
  });
  assert.deepEqual(eligible, []);
});

test("findEligibleProducts excludes tenure out of range", () => {
  const eligible = findEligibleProducts({
    products: [product({ minimum_tenure: 12, maximum_tenure: 36 })],
    monthlyIncome: 90000,
    existingMonthlyEmi: 5000,
    loanAmount: 400000,
    employmentType: "salaried",
    preferredTenureMonths: 48,
  });
  assert.deepEqual(eligible, []);
});

test("findEligibleProducts excludes income below minimum", () => {
  const eligible = findEligibleProducts({
    products: [product({ minimum_income: 80000 })],
    monthlyIncome: 60000,
    existingMonthlyEmi: 2000,
    loanAmount: 400000,
    employmentType: "salaried",
    preferredTenureMonths: 24,
  });
  assert.deepEqual(eligible, []);
});

test("findEligibleProducts allows any employment when rule list is empty", () => {
  const eligible = findEligibleProducts({
    products: [product({ eligibility_rules: { max_foir: 45, employment_types: [] } })],
    monthlyIncome: 90000,
    existingMonthlyEmi: 5000,
    loanAmount: 400000,
    employmentType: "freelancer",
    preferredTenureMonths: 24,
  });
  assert.deepEqual(
    eligible.map((item) => item.name),
    ["Personal Loan"],
  );
});

test("findEligibleProducts matches employment case-insensitively", () => {
  const eligible = findEligibleProducts({
    products: [
      product({ eligibility_rules: { max_foir: 45, employment_types: ["Salaried"] } }),
    ],
    monthlyIncome: 90000,
    existingMonthlyEmi: 5000,
    loanAmount: 400000,
    employmentType: "SALARIED",
    preferredTenureMonths: 24,
  });
  assert.equal(eligible.length, 1);
});

test("findEligibleProducts defaults max FOIR to 45 when missing", () => {
  // existing EMI 40000 / income 80000 -> FOIR 50, above the default 45 cap
  const eligible = findEligibleProducts({
    products: [product({ eligibility_rules: { employment_types: ["salaried"] } })],
    monthlyIncome: 80000,
    existingMonthlyEmi: 40000,
    loanAmount: 400000,
    employmentType: "salaried",
    preferredTenureMonths: 24,
  });
  assert.deepEqual(eligible, []);
});
