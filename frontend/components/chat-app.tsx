"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

import {
  ApiError,
  apiFetch,
  AuthMode,
  ChatReplyResponse,
  ConversationMessage,
  LoginPayload,
  SessionFormPayload,
  SessionRecord,
  SignupPayload,
  SummaryResponse,
  UploadResponse,
} from "../lib/api";

const sessionIntents = [
  { value: "FIND_BEST_LOAN", label: "Find best loan" },
  { value: "COMPARE_LOANS", label: "Compare loans" },
  { value: "EMI_CALCULATION", label: "Calculate EMI" },
  { value: "EXPLAIN_LOAN_TERMS", label: "Explain loan terms" },
  { value: "UPLOAD_DOCUMENT", label: "Upload document" },
];

const defaultForm: SessionFormPayload = {
  title: "",
  intent: "FIND_BEST_LOAN",
  loan_amount: 500000,
  loan_purpose: "Personal loan",
  monthly_income: 90000,
  employment_type: "salaried",
  existing_monthly_emi: 15000,
  preferred_tenure_months: 24,
  risk_profile: "balanced",
};

const defaultAuth = {
  username: "",
  password: "",
};

type AdvisorInsight = {
  disclaimer: string;
  eligibleProducts: ChatReplyResponse["eligible_products"];
  toolOutputs: ChatReplyResponse["tool_outputs"];
};

export function ChatApp() {
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authForm, setAuthForm] = useState(defaultAuth);
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [activeSession, setActiveSession] = useState<SessionRecord | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [sessionForm, setSessionForm] = useState<SessionFormPayload>(defaultForm);
  const [chatInput, setChatInput] = useState("Can you suggest the safest option for me?");
  const [advisorInsight, setAdvisorInsight] = useState<AdvisorInsight | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [uploadName, setUploadName] = useState("");
  const [busyKey, setBusyKey] = useState("");

  useEffect(() => {
    const storedToken = window.localStorage.getItem("loan_advisor_token");
    const storedUsername = window.localStorage.getItem("loan_advisor_username");
    if (storedToken) {
      setToken(storedToken);
      setUsername(storedUsername ?? "");
    }
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }
    void hydrateSessions(token);
  }, [token]);

  const summaryText = useMemo(() => activeSession?.summary ?? "", [activeSession]);

  async function hydrateSessions(activeToken: string) {
    try {
      setBusyKey("load-sessions");
      const sessionData = await apiFetch<SessionRecord[]>("/sessions", {
        token: activeToken,
      });
      setSessions(sessionData);
      if (sessionData.length > 0) {
        const nextActive =
          sessionData.find((item) => item.id === activeSession?.id) ?? sessionData[0];
        setActiveSession(nextActive);
        await hydrateMessages(nextActive.id, activeToken);
      }
    } catch (caught) {
      handleError(caught, "Could not load sessions.");
    } finally {
      setBusyKey("");
    }
  }

  async function hydrateMessages(sessionId: string, activeToken = token) {
    try {
      setBusyKey("load-messages");
      const messageData = await apiFetch<ConversationMessage[]>(`/sessions/${sessionId}/messages`, {
        token: activeToken,
      });
      setMessages(messageData);
    } catch (caught) {
      handleError(caught, "Could not load messages.");
    } finally {
      setBusyKey("");
    }
  }

  function handleError(caught: unknown, fallback: string) {
    if (caught instanceof ApiError) {
      setError(caught.message);
      return;
    }
    setError(fallback);
  }

  function persistAuth(nextToken: string, nextUsername: string) {
    window.localStorage.setItem("loan_advisor_token", nextToken);
    window.localStorage.setItem("loan_advisor_username", nextUsername);
    setToken(nextToken);
    setUsername(nextUsername);
  }

  function clearFeedback() {
    setError("");
    setStatus("");
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();
    setBusyKey("auth");
    try {
      if (authMode === "signup") {
        const signupPayload: SignupPayload = { ...authForm };
        await apiFetch("/auth/signup", {
          method: "POST",
          body: signupPayload,
        });
        setStatus("Account created. You can sign in now.");
        setAuthMode("login");
      } else {
        const loginPayload: LoginPayload = { ...authForm };
        const response = await apiFetch<{ access_token: string }>("/auth/login", {
          method: "POST",
          body: loginPayload,
        });
        persistAuth(response.access_token, authForm.username);
        setStatus("Signed in.");
      }
      setAuthForm(defaultAuth);
    } catch (caught) {
      handleError(caught, "Could not complete authentication.");
    } finally {
      setBusyKey("");
    }
  }

  async function handleCreateSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setError("Sign in before creating a session.");
      return;
    }
    clearFeedback();
    setBusyKey("create-session");
    try {
      const created = await apiFetch<SessionRecord>("/sessions", {
        method: "POST",
        token,
        body: sessionForm,
      });
      setSessions((current) => [created, ...current]);
      setActiveSession(created);
      setMessages([]);
      setAdvisorInsight(null);
      setStatus("Session created.");
    } catch (caught) {
      handleError(caught, "Could not create the session.");
    } finally {
      setBusyKey("");
    }
  }

  async function handleSelectSession(sessionRecord: SessionRecord) {
    clearFeedback();
    setActiveSession(sessionRecord);
    setAdvisorInsight(null);
    await hydrateMessages(sessionRecord.id);
  }

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeSession || !token || !chatInput.trim()) {
      return;
    }
    clearFeedback();
    setBusyKey("send-message");
    try {
      const response = await apiFetch<ChatReplyResponse>(`/sessions/${activeSession.id}/messages`, {
        method: "POST",
        token,
        body: { message: chatInput },
      });
      const nextMessages = [...messages, response.user_message, response.assistant_message];
      setMessages(nextMessages);
      setAdvisorInsight({
        disclaimer: response.disclaimer,
        eligibleProducts: response.eligible_products,
        toolOutputs: response.tool_outputs,
      });
      setActiveSession(response.session);
      setSessions((current) =>
        current.map((item) => (item.id === response.session.id ? response.session : item)),
      );
      setChatInput("");
    } catch (caught) {
      handleError(caught, "Could not send the message.");
    } finally {
      setBusyKey("");
    }
  }

  async function handleGenerateSummary() {
    if (!activeSession || !token) {
      return;
    }
    clearFeedback();
    setBusyKey("summary");
    try {
      const response = await apiFetch<SummaryResponse>(`/sessions/${activeSession.id}/summary`, {
        method: "POST",
        token,
      });
      setActiveSession((current) =>
        current ? { ...current, summary: response.summary } : current,
      );
      setSessions((current) =>
        current.map((item) =>
          item.id === activeSession.id ? { ...item, summary: response.summary } : item,
        ),
      );
      setStatus("Summary updated.");
    } catch (caught) {
      handleError(caught, "Could not generate the summary.");
    } finally {
      setBusyKey("");
    }
  }

  async function handleUploadDocument(event: ChangeEvent<HTMLInputElement>) {
    if (!activeSession || !token) {
      setError("Create a session before uploading documents.");
      return;
    }

    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    clearFeedback();
    setBusyKey("upload");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await apiFetch<UploadResponse>(`/sessions/${activeSession.id}/upload`, {
        method: "POST",
        token,
        formData,
      });
      setMessages((current) => [...current, response.message]);
      setUploadName(file.name);
      setStatus("Document summarized and added to the conversation.");
      setActiveSession((current) =>
        current ? { ...current, summary: current.summary || response.summary } : current,
      );
      setSessions((current) =>
        current.map((item) =>
          item.id === activeSession.id
            ? { ...item, summary: item.summary || response.summary }
            : item,
        ),
      );
    } catch (caught) {
      handleError(caught, "Could not upload the PDF.");
    } finally {
      setBusyKey("");
      event.target.value = "";
    }
  }

  function logout() {
    window.localStorage.removeItem("loan_advisor_token");
    window.localStorage.removeItem("loan_advisor_username");
    setToken("");
    setUsername("");
    setSessions([]);
    setActiveSession(null);
    setMessages([]);
    setAdvisorInsight(null);
    setStatus("Signed out.");
    setError("");
  }

  // Auth gate: until the user signs in, show ONLY the login/signup card.
  if (!token) {
    return (
      <main className="shell">
        <section className="hero">
          <h1>AI Loan Advisor</h1>
          <p>Sign in to start a grounded loan advisory session.</p>
        </section>

        <section className="dashboard" style={{ justifyContent: "center" }}>
          <div className="panel" style={{ width: "100%", maxWidth: 420 }}>
            <div className="panel-inner stack">
              <h2 className="section-title">Authentication</h2>
              <div className="tab-row">
                <button
                  className={`tab ${authMode === "login" ? "active" : ""}`}
                  onClick={() => setAuthMode("login")}
                  type="button"
                >
                  Login
                </button>
                <button
                  className={`tab ${authMode === "signup" ? "active" : ""}`}
                  onClick={() => setAuthMode("signup")}
                  type="button"
                >
                  Signup
                </button>
              </div>
              <form className="stack" onSubmit={handleAuthSubmit}>
                <div className="field">
                  <label htmlFor="username">Username</label>
                  <input
                    id="username"
                    onChange={(event) =>
                      setAuthForm((current) => ({ ...current, username: event.target.value }))
                    }
                    value={authForm.username}
                  />
                </div>
                <div className="field">
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    onChange={(event) =>
                      setAuthForm((current) => ({ ...current, password: event.target.value }))
                    }
                    type="password"
                    value={authForm.password}
                  />
                </div>
                <button className="button button-primary" disabled={busyKey === "auth"} type="submit">
                  {authMode === "signup" ? "Create account" : "Sign in"}
                </button>
                {error ? <div className="notice">{error}</div> : null}
                {status ? <div className="success">{status}</div> : null}
              </form>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="hero">
        <div className="button-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ margin: 0 }}>AI Loan Advisor</h1>
          <div className="button-row" style={{ alignItems: "center" }}>
            <span className="badge">Signed in as {username}</span>
            <button className="button button-secondary" onClick={logout} type="button">
              Sign out
            </button>
          </div>
        </div>
      </section>

      <section className="dashboard">
        <aside className="stack">
          <div className="panel">
            <div className="panel-inner stack">
              <h2 className="section-title">New Loan Advice</h2>
              <form className="stack" onSubmit={handleCreateSession}>
                <div className="field-grid">
                  <div className="field">
                    <label htmlFor="title">Session title</label>
                    <input
                      id="title"
                      onChange={(event) =>
                        setSessionForm((current) => ({ ...current, title: event.target.value }))
                      }
                      placeholder="Optional custom title"
                      value={sessionForm.title}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="intent">Intent</label>
                    <select
                      id="intent"
                      onChange={(event) =>
                        setSessionForm((current) => ({
                          ...current,
                          intent: event.target.value as SessionFormPayload["intent"],
                        }))
                      }
                      value={sessionForm.intent}
                    >
                      {sessionIntents.map((intent) => (
                        <option key={intent.value} value={intent.value}>
                          {intent.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="field-grid two">
                  <NumericField
                    label="Amount needed"
                    onChange={(value) =>
                      setSessionForm((current) => ({ ...current, loan_amount: value }))
                    }
                    value={sessionForm.loan_amount}
                  />
                  <NumericField
                    label="Monthly income"
                    onChange={(value) =>
                      setSessionForm((current) => ({ ...current, monthly_income: value }))
                    }
                    value={sessionForm.monthly_income}
                  />
                  <NumericField
                    label="Existing EMI"
                    onChange={(value) =>
                      setSessionForm((current) => ({
                        ...current,
                        existing_monthly_emi: value,
                      }))
                    }
                    value={sessionForm.existing_monthly_emi}
                  />
                  <NumericField
                    label="Tenure (months)"
                    onChange={(value) =>
                      setSessionForm((current) => ({
                        ...current,
                        preferred_tenure_months: value,
                      }))
                    }
                    value={sessionForm.preferred_tenure_months}
                  />
                </div>

                <div className="field-grid two">
                  <div className="field">
                    <label htmlFor="purpose">Purpose</label>
                    <input
                      id="purpose"
                      onChange={(event) =>
                        setSessionForm((current) => ({
                          ...current,
                          loan_purpose: event.target.value,
                        }))
                      }
                      value={sessionForm.loan_purpose}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="employment">Employment type</label>
                    <select
                      id="employment"
                      onChange={(event) =>
                        setSessionForm((current) => ({
                          ...current,
                          employment_type: event.target.value,
                        }))
                      }
                      value={sessionForm.employment_type}
                    >
                      <option value="salaried">Salaried</option>
                      <option value="self-employed">Self-employed</option>
                      <option value="business-owner">Business owner</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="risk">Risk profile</label>
                    <select
                      id="risk"
                      onChange={(event) =>
                        setSessionForm((current) => ({
                          ...current,
                          risk_profile: event.target.value,
                        }))
                      }
                      value={sessionForm.risk_profile}
                    >
                      <option value="conservative">Conservative</option>
                      <option value="balanced">Balanced</option>
                      <option value="growth">Growth</option>
                    </select>
                  </div>
                </div>

                <button className="button button-primary" disabled={busyKey === "create-session"} type="submit">
                  Create session
                </button>
              </form>
            </div>
          </div>

          <div className="panel">
            <div className="panel-inner stack">
              <h2 className="section-title">Your Sessions</h2>
              <div className="session-list">
                {sessions.length === 0 ? (
                  <div className="empty">Create your first loan advice session to begin.</div>
                ) : (
                  sessions.map((sessionRecord) => (
                    <button
                      className={`session-card ${activeSession?.id === sessionRecord.id ? "active" : ""}`}
                      key={sessionRecord.id}
                      onClick={() => void handleSelectSession(sessionRecord)}
                      type="button"
                    >
                      <h3>{sessionRecord.title}</h3>
                      <p>
                        {sessionRecord.loan_purpose} · {sessionRecord.intent.replaceAll("_", " ")}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </aside>

        <section className="stack">
          <div className="panel">
            <div className="panel-inner stack">
              <div className="button-row" style={{ justifyContent: "space-between" }}>
                <h2 className="section-title">Conversation</h2>
                <div className="button-row">
                  <button
                    className="button button-secondary"
                    disabled={!activeSession || busyKey === "summary"}
                    onClick={() => void handleGenerateSummary()}
                    type="button"
                  >
                    Generate summary
                  </button>
                  <label className="button button-ghost" style={{ display: "inline-flex", alignItems: "center" }}>
                    Upload PDF
                    <input hidden accept="application/pdf" onChange={handleUploadDocument} type="file" />
                  </label>
                </div>
              </div>

              {error ? <div className="notice">{error}</div> : null}
              {status ? <div className="success">{status}</div> : null}
              {uploadName ? <div className="success">Latest document: {uploadName}</div> : null}

              {!activeSession ? (
                <div className="empty">Pick or create a session to start the advisory flow.</div>
              ) : (
                <div className="conversation-layout">
                  <div className="stack">
                    <div className="message-list">
                      {messages.length === 0 ? (
                        <div className="empty">
                          No messages yet. Ask about EMI, trade-offs, or suitable products.
                        </div>
                      ) : (
                        messages.map((message) => (
                          <article
                            className={`message ${message.sender_type.toLowerCase()}`}
                            key={message.id}
                          >
                            <div className="message-meta">
                              <strong>{message.sender_type}</strong>
                              <span>{new Date(message.created_at).toLocaleString()}</span>
                            </div>
                            <p style={{ margin: 0, lineHeight: 1.7 }}>{message.message}</p>
                          </article>
                        ))
                      )}
                    </div>

                    <form className="stack" onSubmit={handleSendMessage}>
                      <div className="field">
                        <label htmlFor="chat-input">Ask a grounded lending question</label>
                        <textarea
                          id="chat-input"
                          onChange={(event) => setChatInput(event.target.value)}
                          value={chatInput}
                        />
                      </div>
                      <button className="button button-primary" disabled={busyKey === "send-message"} type="submit">
                        Send message
                      </button>
                    </form>
                  </div>

                  <div className="stack">
                    <div className="summary-card">
                      <h2 className="section-title">Session Summary</h2>
                      <p>{summaryText || "No summary yet. Generate one after a few turns."}</p>
                    </div>

                    <div className="insight-card">
                      <h2 className="section-title">Grounded Insights</h2>
                      {advisorInsight ? (
                        <>
                          <p>
                            <strong>Disclaimer:</strong> {advisorInsight.disclaimer}
                          </p>
                          <p>
                            <strong>Eligible products:</strong>{" "}
                            {advisorInsight.eligibleProducts.length > 0
                              ? advisorInsight.eligibleProducts.map((item) => item.name).join(", ")
                              : "None matched the current profile."}
                          </p>
                          <pre>{JSON.stringify(advisorInsight.toolOutputs, null, 2)}</pre>
                        </>
                      ) : (
                        <p>Send a message to inspect the latest deterministic tool outputs.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function NumericField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        min={0}
        onChange={(event) => onChange(Number(event.target.value))}
        type="number"
        value={value}
      />
    </div>
  );
}
