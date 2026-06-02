import { DataTypes } from "sequelize";

import { sequelize } from "../db/sequelize.js";
import { SENDER_TYPE_VALUES } from "../constants.js";

export const Message = sequelize.define(
  "Message",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    session_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    sender_type: {
      type: DataTypes.ENUM(...SENDER_TYPE_VALUES),
      allowNull: false,
    },
    message: { type: DataTypes.TEXT, allowNull: false },
    metadata: {
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
    tableName: "messages",
    timestamps: false,
    indexes: [{ fields: ["session_id"] }],
  },
);
