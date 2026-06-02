import { Router } from "express";
import multer from "multer";

import { ChatSession, Message, LoanProduct } from "../models/index.js";
import { SenderType } from "../constants.js";
import { HttpError } from "../errors.js";
import {
  asyncHandler,
  authenticate,
  getUserSessionOr404,
  validateBody,
} from "../middleware.js";
import { sessionCreateSchema, messageCreateSchema } from "../schemas.js";
import { serializeMessage, serializeSession } from "../serializers.js";
import {
  generateAssistantReply,
  generateConsultationSummary,
} from "../services/chatService.js";
import { extractTextFromPdf } from "../services/pdfService.js";
import {
  advanceStateAfterDocument,
  advanceStateAfterMessage,
  advanceStateAfterSummary,
  initializeSessionState,
} from "../services/sessionStateService.js";

const upload = multer({ storage: multer.memoryStorage() });

export const sessionsRouter = Router();
sessionsRouter.use(authenticate);

sessionsRouter.post(
  "/",
  validateBody(sessionCreateSchema),
  asyncHandler(async (req, res) => {
    const payload = req.validated;
    const chatSession = ChatSession.build({
      user_id: req.user.id,
      title: payload.title || `${payload.loan_purpose} advice`,
      intent: payload.intent,
      loan_amount: payload.loan_amount,
      loan_purpose: payload.loan_purpose,
      monthly_income: payload.monthly_income,
      employment_type: payload.employment_type,
      existing_monthly_emi: payload.existing_monthly_emi,
      preferred_tenure_months: payload.preferred_tenure_months,
      risk_profile: payload.risk_profile,
      state_snapshot: {},
    });
    initializeSessionState(chatSession);
    await chatSession.save();
    res.status(201).json(serializeSession(chatSession));
  }),
);

sessionsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const sessions = await ChatSession.findAll({
      where: { user_id: req.user.id },
      order: [["updated_at", "DESC"]],
    });
    res.json(sessions.map(serializeSession));
  }),
);

sessionsRouter.get(
  "/:sessionId",
  asyncHandler(async (req, res) => {
    const chatSession = await getUserSessionOr404(
      req.params.sessionId,
      req.user.id,
    );
    res.json(serializeSession(chatSession));
  }),
);

sessionsRouter.get(
  "/:sessionId/messages",
  asyncHandler(async (req, res) => {
    await getUserSessionOr404(req.params.sessionId, req.user.id);
    const messages = await Message.findAll({
      where: { session_id: req.params.sessionId },
      order: [["created_at", "ASC"]],
    });
    res.json(messages.map(serializeMessage));
  }),
);

sessionsRouter.post(
  "/:sessionId/messages",
  validateBody(messageCreateSchema),
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const chatSession = await getUserSessionOr404(sessionId, req.user.id);

    const userMessage = await Message.create({
      session_id: sessionId,
      sender_type: SenderType.USER,
      message: req.validated.message,
      metadata: { source: "chat-ui" },
    });

    const products = await LoanProduct.findAll({
      order: [["interest_rate", "ASC"]],
    });
    const history = await Message.findAll({
      where: { session_id: sessionId },
      order: [["created_at", "ASC"]],
    });

    const assistantReply = await generateAssistantReply({
      chatSession,
      userMessage: req.validated.message,
      products,
      messageHistory: history,
    });

    const assistantMessage = await Message.create({
      session_id: sessionId,
      sender_type: SenderType.ASSISTANT,
      message: assistantReply.answer,
      metadata: {
        ...assistantReply.metadata,
        disclaimer: assistantReply.disclaimer,
      },
    });

    advanceStateAfterMessage({
      chatSession,
      userMessage: req.validated.message,
      assistantMessage: assistantReply.answer,
      toolOutputs: assistantReply.tool_outputs,
    });
    chatSession.updated_at = new Date();
    await chatSession.save();

    res.json({
      session: serializeSession(chatSession),
      user_message: serializeMessage(userMessage),
      assistant_message: serializeMessage(assistantMessage),
      eligible_products: assistantReply.eligible_products,
      tool_outputs: assistantReply.tool_outputs,
      disclaimer: assistantReply.disclaimer,
    });
  }),
);

sessionsRouter.post(
  "/:sessionId/upload",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const file = req.file;
    const allowedTypes = new Set([
      "application/pdf",
      "application/octet-stream",
    ]);
    if (!file || !allowedTypes.has(file.mimetype)) {
      throw new HttpError(400, "Only PDF uploads are supported");
    }

    const chatSession = await getUserSessionOr404(sessionId, req.user.id);
    const extractedText = await extractTextFromPdf(file.buffer);
    if (!extractedText.trim()) {
      throw new HttpError(400, "Could not extract text from the uploaded PDF");
    }

    const filename = file.originalname || "uploaded.pdf";
    const summary = await generateConsultationSummary(
      "Create a concise document summary for this borrower submission.\n\n" +
        `Document text:\n${extractedText.slice(0, 12000)}`,
      { stateSnapshot: chatSession.state_snapshot || {}, summaryKind: "document" },
    );

    const documentMessage = await Message.create({
      session_id: sessionId,
      sender_type: SenderType.SYSTEM,
      message: summary,
      metadata: {
        tool_called: "pdf_extractor",
        filename,
        extracted_characters: extractedText.length,
      },
    });

    advanceStateAfterDocument({ chatSession, filename });
    chatSession.updated_at = new Date();
    if (!chatSession.summary) {
      chatSession.summary = summary;
    }
    await chatSession.save();

    res.json({
      session_id: sessionId,
      filename,
      extracted_text_preview: extractedText.slice(0, 500),
      summary,
      message: serializeMessage(documentMessage),
    });
  }),
);

sessionsRouter.post(
  "/:sessionId/summary",
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const chatSession = await getUserSessionOr404(sessionId, req.user.id);
    const messages = await Message.findAll({
      where: { session_id: sessionId },
      order: [["created_at", "ASC"]],
    });
    if (messages.length === 0) {
      throw new HttpError(400, "Cannot summarize an empty conversation");
    }

    const conversationText = messages
      .map((message) => `${message.sender_type}: ${message.message}`)
      .join("\n");
    const summary = await generateConsultationSummary(conversationText, {
      stateSnapshot: chatSession.state_snapshot || {},
      summaryKind: "conversation",
    });

    advanceStateAfterSummary(chatSession);
    chatSession.summary = summary;
    chatSession.updated_at = new Date();
    await chatSession.save();

    res.json({ session_id: sessionId, summary });
  }),
);
