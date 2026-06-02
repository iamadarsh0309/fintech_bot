import { Sequelize } from "sequelize";

import { settings } from "../config.js";

export const sequelize = new Sequelize(settings.databaseUrl, {
  dialect: "postgres",
  logging: false,
  pool: { max: 10, min: 0, idle: 10000 },
});
