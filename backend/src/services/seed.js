import { LoanProduct } from "../models/loanProduct.js";

export const SEED_PRODUCTS = [
  {
    name: "Personal Loan",
    description: "Unsecured loan for planned expenses and emergencies.",
    interest_rate: 11.0,
    minimum_income: 50000,
    maximum_amount: 1500000,
    minimum_tenure: 12,
    maximum_tenure: 60,
    eligibility_rules: {
      max_foir: 45,
      employment_types: ["salaried", "self-employed"],
    },
  },
  {
    name: "Salary Advance",
    description: "Short-tenure liquidity support for salaried borrowers.",
    interest_rate: 8.0,
    minimum_income: 30000,
    maximum_amount: 300000,
    minimum_tenure: 3,
    maximum_tenure: 18,
    eligibility_rules: { max_foir: 35, employment_types: ["salaried"] },
  },
  {
    name: "BNPL",
    description: "Small-ticket deferred payment option for low-value purchases.",
    interest_rate: 10.5,
    minimum_income: 25000,
    maximum_amount: 100000,
    minimum_tenure: 3,
    maximum_tenure: 12,
    eligibility_rules: {
      max_foir: 30,
      employment_types: ["salaried", "self-employed"],
    },
  },
  {
    name: "SME Loan",
    description: "Business-focused financing for working capital and expansion.",
    interest_rate: 14.0,
    minimum_income: 80000,
    maximum_amount: 5000000,
    minimum_tenure: 12,
    maximum_tenure: 84,
    eligibility_rules: {
      max_foir: 50,
      employment_types: ["self-employed", "business-owner"],
    },
  },
  {
    name: "Secured Loan",
    description: "Collateral-backed loan with higher ticket size support.",
    interest_rate: 9.5,
    minimum_income: 40000,
    maximum_amount: 10000000,
    minimum_tenure: 12,
    maximum_tenure: 180,
    eligibility_rules: {
      max_foir: 55,
      employment_types: ["salaried", "self-employed", "business-owner"],
    },
  },
  {
    name: "Top Up Loan",
    description:
      "Additional borrowing for existing borrowers with repayment history.",
    interest_rate: 10.0,
    minimum_income: 45000,
    maximum_amount: 1000000,
    minimum_tenure: 12,
    maximum_tenure: 72,
    eligibility_rules: {
      max_foir: 45,
      employment_types: ["salaried", "self-employed"],
    },
  },
];

export async function seedLoanProducts() {
  const existingCount = await LoanProduct.count();
  if (existingCount > 0) {
    return;
  }
  await LoanProduct.bulkCreate(SEED_PRODUCTS);
}
