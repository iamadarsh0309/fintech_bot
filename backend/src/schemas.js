import { z } from "zod";

import { SESSION_INTENT_VALUES } from "./constants.js";

export const signupSchema = z.object({
  username: z.string().min(3).max(64),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export const sessionCreateSchema = z.object({
  title: z.string().max(120).optional().nullable(),
  intent: z.enum(SESSION_INTENT_VALUES),
  loan_amount: z.number().gt(0),
  loan_purpose: z.string().min(2).max(120),
  monthly_income: z.number().gt(0),
  employment_type: z.string().min(2).max(60),
  existing_monthly_emi: z.number().gte(0),
  preferred_tenure_months: z.number().int().gt(0).lte(360),
  risk_profile: z.string().min(2).max(60),
});

export const messageCreateSchema = z.object({
  message: z.string().min(1).max(4000),
});
