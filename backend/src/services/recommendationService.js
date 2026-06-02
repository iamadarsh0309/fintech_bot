// Deterministic financial tools. Ported 1:1 from the Python implementation.

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateEmi(amount, annualInterestRate, months) {
  const monthlyRate = annualInterestRate / 12 / 100;
  let emi;
  if (monthlyRate === 0) {
    emi = amount / months;
  } else {
    emi =
      (amount * monthlyRate * Math.pow(1 + monthlyRate, months)) /
      (Math.pow(1 + monthlyRate, months) - 1);
  }
  const totalRepayment = emi * months;
  const totalInterest = totalRepayment - amount;
  return {
    emi: round2(emi),
    total_interest: round2(totalInterest),
    total_repayment: round2(totalRepayment),
  };
}

export function calculateFoir(monthlyIncome, existingMonthlyEmi) {
  if (monthlyIncome <= 0) {
    return 100.0;
  }
  return round2((existingMonthlyEmi / monthlyIncome) * 100);
}

export function findEligibleProducts({
  products,
  monthlyIncome,
  existingMonthlyEmi,
  loanAmount,
  employmentType,
  preferredTenureMonths,
}) {
  const foir = calculateFoir(monthlyIncome, existingMonthlyEmi);
  const eligibleProducts = [];

  for (const product of products) {
    const rules = product.eligibility_rules || {};
    const maxFoir = Number(rules.max_foir ?? 45);
    const allowedEmploymentTypes = rules.employment_types || [];

    if (monthlyIncome < Number(product.minimum_income)) continue;
    if (loanAmount > Number(product.maximum_amount)) continue;
    if (
      preferredTenureMonths < Number(product.minimum_tenure) ||
      preferredTenureMonths > Number(product.maximum_tenure)
    ) {
      continue;
    }
    if (foir > maxFoir) continue;
    if (
      allowedEmploymentTypes.length > 0 &&
      !allowedEmploymentTypes
        .map((item) => item.toLowerCase())
        .includes(employmentType.toLowerCase())
    ) {
      continue;
    }

    eligibleProducts.push({
      name: product.name,
      description: product.description,
      interest_rate: Number(product.interest_rate),
      minimum_income: Number(product.minimum_income),
      maximum_amount: Number(product.maximum_amount),
      minimum_tenure: Number(product.minimum_tenure),
      maximum_tenure: Number(product.maximum_tenure),
      foir,
      max_foir: maxFoir,
      employment_types: allowedEmploymentTypes,
    });
  }

  return eligibleProducts;
}

export function compareTenureOutlook(months, riskProfile) {
  let outlook;
  if (months <= 12) {
    outlook = "Short tenure reduces total interest but keeps EMI higher.";
  } else if (months <= 36) {
    outlook = "Mid-range tenure balances EMI affordability with total interest.";
  } else {
    outlook = "Long tenure lowers EMI but increases total repayment over time.";
  }

  const riskNote = ["conservative", "low"].includes(riskProfile.toLowerCase())
    ? "Conservative borrowers may prefer lower EMI stress and stronger repayment buffers."
    : "Growth-oriented borrowers may accept higher EMI to reduce total interest faster.";

  return { tenure_note: outlook, risk_note: riskNote };
}
