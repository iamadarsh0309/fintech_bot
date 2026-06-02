import { sequelize } from "../models/index.js";
import { settings } from "../config.js";
import { seedLoanProducts } from "../services/seed.js";

export async function initializeDatabase() {
  await sequelize.authenticate();
  await sequelize.sync();
  if (settings.seedSampleData) {
    await seedLoanProducts();
  }
}
