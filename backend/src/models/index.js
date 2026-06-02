import { sequelize } from "../db/sequelize.js";
import { User } from "./user.js";
import { ChatSession } from "./chatSession.js";
import { Message } from "./message.js";
import { LoanProduct } from "./loanProduct.js";

User.hasMany(ChatSession, { foreignKey: "user_id", as: "chat_sessions" });
ChatSession.belongsTo(User, { foreignKey: "user_id", as: "user" });

ChatSession.hasMany(Message, {
  foreignKey: "session_id",
  as: "messages",
  onDelete: "CASCADE",
});
Message.belongsTo(ChatSession, { foreignKey: "session_id", as: "session" });

export { sequelize, User, ChatSession, Message, LoanProduct };
