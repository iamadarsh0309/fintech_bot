import { DataTypes } from "sequelize";

import { sequelize } from "../db/sequelize.js";
import {
  SESSION_INTENT_VALUES,
  SESSION_STATUS_VALUES,
  SessionStatus,
} from "../constants.js";

// DECIMAL columns come back from pg as strings; coerce to Number so the JSON
// API matches the original FastAPI contract (and the frontend number types).
function decimalColumn(field, { allowNull = false, defaultValue } = {}) {
  return {
    type: DataTypes.DECIMAL(12, 2),
    allowNull,
    defaultValue,
    get() {
      const raw = this.getDataValue(field);
      return raw === null || raw === undefined ? raw : Number(raw);
    },
  };
}

export const ChatSession = sequelize.define(
  "ChatSession",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    title: { type: DataTypes.STRING, allowNull: false },
    intent: {
      type: DataTypes.ENUM(...SESSION_INTENT_VALUES),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...SESSION_STATUS_VALUES),
      allowNull: false,
      defaultValue: SessionStatus.ACTIVE,
    },
    loan_amount: decimalColumn("loan_amount"),
    loan_purpose: { type: DataTypes.STRING, allowNull: false },
    monthly_income: decimalColumn("monthly_income"),
    employment_type: { type: DataTypes.STRING, allowNull: false },
    existing_monthly_emi: decimalColumn("existing_monthly_emi", {
      defaultValue: 0,
    }),
    preferred_tenure_months: { type: DataTypes.INTEGER, allowNull: false },
    risk_profile: { type: DataTypes.STRING, allowNull: false },
    summary: { type: DataTypes.TEXT, allowNull: true },
    state_snapshot: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "chat_sessions",
    timestamps: false,
    indexes: [{ fields: ["user_id"] }],
  },
);
