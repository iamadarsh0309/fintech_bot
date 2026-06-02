import { Router } from "express";

import { asyncHandler, validateBody } from "../middleware.js";
import { emiCalculationSchema } from "../schemas.js";
import { calculateEmi } from "../services/recommendationService.js";

export const toolsRouter = Router();

toolsRouter.post(
  "/debug/calculate-emi",
  validateBody(emiCalculationSchema),
  asyncHandler(async (req, res) => {
    const { amount, interest_rate, months } = req.validated;
    res.json(calculateEmi(amount, interest_rate, months));
  }),
);
