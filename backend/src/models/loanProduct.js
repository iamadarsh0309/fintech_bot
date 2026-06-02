import { DataTypes } from "sequelize";

import { sequelize } from "../db/sequelize.js";

function numericGetter(field) {
  return function get() {
    const raw = this.getDataValue(field);
    return raw === null || raw === undefined ? raw : Number(raw);
  };
}

export const LoanProduct = sequelize.define(
  "LoanProduct",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    description: { type: DataTypes.TEXT, allowNull: false },
    interest_rate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      get: numericGetter("interest_rate"),
    },
    minimum_income: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      get: numericGetter("minimum_income"),
    },
    maximum_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      get: numericGetter("maximum_amount"),
    },
    minimum_tenure: {
      type: DataTypes.DECIMAL(5, 0),
      allowNull: false,
      get: numericGetter("minimum_tenure"),
    },
    maximum_tenure: {
      type: DataTypes.DECIMAL(5, 0),
      allowNull: false,
      get: numericGetter("maximum_tenure"),
    },
    eligibility_rules: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "loan_products",
    timestamps: false,
  },
);
