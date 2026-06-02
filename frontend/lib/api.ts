export type AuthMode = "login" | "signup";

export type SessionIntent =
  | "FIND_BEST_LOAN"
  | "COMPARE_LOANS"
  | "EMI_CALCULATION"
  | "EXPLAIN_LOAN_TERMS"
  | "UPLOAD_DOCUMENT";

export type SenderType = "USER" | "ASSISTANT" | "SYSTEM";

export type SignupPayload = {
  username: string;
  password: string;
};

export type LoginPayload = SignupPayload;

export type SessionFormPayload = {
  title: string;
  intent: SessionIntent;
  loan_amount: number;
  loan_purpose: string;
  monthly_income: number;
  employment_type: string;
  existing_monthly_emi: number;
  preferred_tenure_months: number;
  risk_profile: string;
};

export type SessionRecord = {
  id: string;
  user_id: string;
  title: string;
  intent: SessionIntent;
  status: string;
  loan_amount: number;
  loan_purpose: string;
  monthly_income: number;
  employment_type: string;
  existing_monthly_emi: number;
  preferred_tenure_months: number;
  risk_profile: string;
  summary: string | null;
  created_at: string;
  updated_at: string;
};

export type ConversationMessage = {
  id: string;
  session_id: string;
  sender_type: SenderType;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ChatReplyResponse = {
  session: SessionRecord;
  user_message: ConversationMessage;
  assistant_message: ConversationMessage;
  eligible_products: Array<Record<string, any>>;
  tool_outputs: Record<string, any>;
  disclaimer: string;
};

export type SummaryResponse = {
  session_id: string;
  summary: string;
};

export type UploadResponse = {
  session_id: string;
  filename: string;
  extracted_text_preview: string;
  summary: string;
  message: ConversationMessage;
};

type ApiFetchOptions = {
  method?: "GET" | "POST";
  token?: string;
  body?: unknown;
  formData?: FormData;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const headers = new Headers();
  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body,
  });

  if (!response.ok) {
    let detail = "Request failed.";
    try {
      const errorBody = await response.json();
      detail = errorBody.detail ?? detail;
    } catch {
      detail = await response.text();
    }
    throw new ApiError(detail || "Request failed.", response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
