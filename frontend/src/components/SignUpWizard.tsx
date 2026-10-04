/**
 * SignUpWizard — the door for a person who is not yet a user.
 *
 * ── WHERE THIS CAME FROM, AND WHAT WAS ACTUALLY BORROWED ─────────────────────────────────────
 * The Development room's tool (development/OpenHands-main) ships a genuinely good multi-step
 * modal — a backdrop, a card, a step index and a progress bar — and the plan was to reuse it.
 * When the source was read, it turned out there was no account flow in it to reuse: its own
 * "is authenticated" check is `queryFn: async () => true`, its sign-up strings are defined in
 * the translations and rendered by nothing, and its wizard is an AGENT-SETUP flow, not a sign-up.
 *
 * So what is borrowed is the SHAPE — the step index, the progress bar, the step framing — not
 * its files. Its components import its own app's internals (`#/contexts/…`, `#/i18n/…`,
 * `#/api/backend-registry/…`) and would not compile here; pasting them would drag half of that
 * application across. The visual language below is THIS app's own: the gate's ground, the gate's
 * card and the gate's palette, so the two doors a person meets look like one product.
 *
 * ── THE THREE STEPS, AND WHICH OF THEM ARE REAL ──────────────────────────────────────────────
 * The flow is three steps because the commercial flow is three steps. Only the first one works
 * today, and the other two say so on screen rather than pretending:
 *
 *   account  — REAL. It collects email, password and name and posts them through
 *              `authService.signup`, which already existed and already reaches
 *              `POST /api/auth/signup` (bcrypt at the same cost as the rows already in the
 *              table). Nothing new was written on the server for this.
 *   verify   — REAL. The code is entered here and checked by the server (`POST /api/auth/verify`),
 *              which compares it against the row and the database's own clock. This screen also
 *              reports whether the mail actually LEFT — the server tells it, and when there are no
 *              mail credentials the screen says so instead of claiming to have sent something.
 *   plan     — REAL. It asks the server for the plans, offers the billing cycle, and starts the
 *              free trial (`POST /api/billing/start-trial`). NO CARD AND NO PAYMENT PROVIDER,
 *              which is the whole reason this step could be built before one was chosen: a trial
 *              is a date on a row. The screen says so rather than staying quiet — "nothing will be
 *              charged when it ends" — because a trial that does not mention payment reads as one
 *              that will spring it later.
 *
 * ── WHY A MODAL AND NOT A PAGE ───────────────────────────────────────────────────────────────
 * The gate that already exists (index.html, the pin card) is the entry point, and a person
 * arriving is already looking at a card on the ground this one uses. A second full-screen page
 * would be a second door; this is the same door with a different question behind it.
 */
import { useEffect, useState } from "react";
import { resendVerificationCode, signup, verifyEmail } from "@/services/authService";
import { fetchPlans, startTrial, type Plan } from "@/services/billingService";

type Step = "account" | "verify" | "plan";

const STEPS: { id: Step; label: string }[] = [
  { id: "account", label: "Account" },
  { id: "verify", label: "Verify" },
  { id: "plan", label: "Plan" },
];

/** The gate's own card, so the two doors read as one surface. */
const card: React.CSSProperties = {
  width: "380px",
  boxSizing: "border-box",
  background: "#231f2e",
  borderRadius: "16px",
  padding: "40px 40px 36px",
  boxShadow: "0 32px 80px rgba(0,0,0,0.5)",
  border: "1px solid rgba(255,255,255,0.06)",
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "rgba(245,240,232,0.45)",
  marginBottom: "6px",
};

const input: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 13px",
  fontSize: "14px",
  color: "#f5f0e8",
  background: "#1a1726",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: "9px",
  outline: "none",
  fontFamily: "inherit",
};

const field: React.CSSProperties = { marginBottom: "16px" };

export function SignUpWizard({
  open,
  onClose,
  onSignedUp,
  onEnterWorkspace,
}: {
  open: boolean;
  onClose: () => void;
  /** Called once the server has created the row, with the id it returned. */
  onSignedUp?: (userId: string) => void;
  /**
   * THE SUCCESS EXIT (2026-10-04). Cancel goes back to the gate; the trial's "Go to the
   * workspace" must not — a person who has just registered does not have the pin, and the gate
   * is the door for people who do (index.html's own words). Measured before this prop existed:
   * the button reused onClose, which is a bare URL cleanup, so the reload met the gate the new
   * person has no key for. What "entering" means is the door owner's to decide — App.tsx opens
   * the same session the pin opens — and this prop is how the wizard asks for it instead of
   * assuming onClose is it.
   */
  onEnterWorkspace?: () => void;
}) {
  const [step, setStep] = useState<Step>("account");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // The server refused because that address already has an account (409). The refusal alone is
  // a dead end, so this flag is what turns it into a question with an answer: continue with the
  // account that exists, by the code step. It dies the moment the address in the field changes.
  const [existingAccount, setExistingAccount] = useState(false);

  // The verify step's own state. `mailSent` comes back from the SERVER with the signup, and it
  // is what decides whether this screen says "check your email" or says plainly that none was
  // sent. The difference between a screen that is honest and one that is guessing.
  const [mailSent, setMailSent] = useState(false);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [notice, setNotice] = useState("");

  // ── THE LAST STEP: the plans, read from the server, and the trial ─────────────
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansError, setPlansError] = useState("");
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [chosenPlan, setChosenPlan] = useState("");
  const [starting, setStarting] = useState(false);
  const [trialError, setTrialError] = useState("");
  const [trial, setTrial] = useState<
    { planName?: string; daysLeft?: number; endsAt?: string; already?: boolean } | null
  >(null);

  /*
   * THE PLANS COME FROM THE SERVER WHEN THIS SCREEN IS REACHED, not at mount and not from a list
   * written here. A price in a component is a price that disagrees with the database the moment
   * somebody changes one, and the schema has held these rows all along — this is the first screen
   * that has ever asked for them.
   *
   * THE FIRST PAID PLAN IS PRE-CHOSEN: the point of this screen is the trial, and a trial on the
   * free plan is a contradiction. If every plan is free the first one is chosen anyway, so the
   * button is never dead for a reason nobody can see.
   */
  useEffect(() => {
    if (step !== "plan" || plans.length) return;
    let alive = true;
    void fetchPlans().then((result) => {
      if (!alive) return;
      setPlans(result.plans);
      setPlansError(result.error || "");
      const paid = result.plans.find((p) => p.price_monthly > 0);
      setChosenPlan(paid?.slug || result.plans[0]?.slug || "");
    });
    return () => {
      alive = false;
    };
  }, [step, plans.length]);

  const beginTrial = async () => {
    if (starting || !chosenPlan) return;
    setTrialError("");
    setStarting(true);
    try {
      const result = await startTrial(chosenPlan, cycle);
      if (!result.success) {
        setTrialError(result.error || "The trial could not be started.");
        return;
      }
      setTrial({
        planName: result.planName || result.planSlug,
        daysLeft: result.trialDaysLeft,
        endsAt: result.trialEnd,
        already: result.alreadyStarted,
      });
    } finally {
      setStarting(false);
    }
  };

  if (!open) return null;

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const submitAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      // The client already existed and already reaches the endpoint; nothing was reimplemented.
      const result = await signup(email.trim(), password, fullName.trim());
      if (!result.success) {
        setError(result.error || "The account could not be created.");
        setExistingAccount(Boolean(result.alreadyExists));
        return;
      }
      setExistingAccount(false);
      setMailSent(Boolean(result.verificationEmailSent));
      onSignedUp?.(result.userId ?? "");
      setStep("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (verifying || code.length !== 6) return;
    setVerifyError("");
    setNotice("");
    setVerifying(true);
    try {
      // The comparison happens on the server (routes/auth.py) — this carries the six digits and
      // brings back its sentence. A check made here is a check this page can lie about.
      const result = await verifyEmail(email.trim(), code);
      if (!result.success) {
        setVerifyError(result.error || "That code was not accepted.");
        return;
      }
      setStep("plan");
    } finally {
      setVerifying(false);
    }
  };

  const askForAnother = async () => {
    setVerifyError("");
    setNotice("");
    setVerifying(true);
    try {
      await resendVerificationCode(email.trim());
      // The server answers the same way whether or not the address has an account, so the
      // wording here repeats that rather than inventing a certainty the server withheld.
      setNotice("If that address has an unverified account, a new code is on its way.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483645,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#110E1F",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Create an account"
    >
      <div style={card}>
        {/* THE STEP INDEX — the progress bar the tool's wizard taught, drawn in this app's ink. */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "28px" }}>
          {STEPS.map((s, i) => (
            <div key={s.id} style={{ flex: 1 }}>
              <div
                style={{
                  height: "3px",
                  borderRadius: "2px",
                  background: i <= stepIndex ? "#9162C2" : "rgba(255,255,255,0.10)",
                  transition: "background 200ms ease",
                }}
              />
              <div
                style={{
                  marginTop: "8px",
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.03em",
                  color: i <= stepIndex ? "#D4A0EE" : "rgba(245,240,232,0.35)",
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {step === "account" && (
          <form onSubmit={submitAccount}>
            <div style={{ fontSize: "20px", fontWeight: 800, color: "#f5f0e8", marginBottom: "4px" }}>
              Create your account
            </div>
            <div style={{ fontSize: "13px", color: "rgba(245,240,232,0.45)", marginBottom: "24px" }}>
              Start with a free trial.
            </div>

            <div style={field}>
              <label style={label} htmlFor="su-name">Name</label>
              <input
                id="su-name"
                style={input}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={busy}
                autoComplete="name"
              />
            </div>

            <div style={field}>
              <label style={label} htmlFor="su-email">Email</label>
              <input
                id="su-email"
                type="email"
                style={input}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  // The refusal named the address that was here when it was submitted; once the
                  // address changes, "continue with this account" would point at the wrong one.
                  setExistingAccount(false);
                }}
                disabled={busy}
                autoComplete="email"
                required
              />
            </div>

            <div style={field}>
              <label style={label} htmlFor="su-password">Password</label>
              <input
                id="su-password"
                type="password"
                style={input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                autoComplete="new-password"
                required
              />
            </div>

            {error && (
              <div
                role="alert"
                style={{ fontSize: "13px", color: "#E4A0A0", marginBottom: "14px", lineHeight: 1.45 }}
              >
                {error}
              </div>
            )}

            {/* THE WAY FORWARD, NOT ONLY THE REFUSAL. When the server refused because the
                address already has an account, the person's real question is "so what do I do?"
                — and there is an answer this flow already owns: the code step. It completes an
                account that was never verified, and it is the only door this prototype has to
                an account that was. A refusal with no next step is how a working product reads
                as a broken one. */}
            {existingAccount && (
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setStep("verify");
                }}
                style={{
                  width: "100%",
                  marginBottom: "10px",
                  padding: "11px",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#D4A0EE",
                  background: "transparent",
                  border: "1px solid #9162C2",
                  borderRadius: "9px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Continue with this account
              </button>
            )}

            <button
              type="submit"
              disabled={busy}
              style={{
                width: "100%",
                padding: "12px",
                fontSize: "14px",
                fontWeight: 700,
                color: "#110E1F",
                background: busy ? "rgba(145,98,194,0.5)" : "#9162C2",
                border: "none",
                borderRadius: "9px",
                cursor: busy ? "default" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {busy ? "Creating…" : "Create account"}
            </button>
          </form>
        )}

        {step === "verify" && (
          <div>
            <div style={{ fontSize: "20px", fontWeight: 800, color: "#f5f0e8", marginBottom: "10px" }}>
              {existingAccount
                ? "That email already has an account"
                : mailSent
                  ? "Check your email"
                  : "The account exists"}
            </div>
            <p
              style={{
                fontSize: "13px",
                color: "rgba(245,240,232,0.55)",
                lineHeight: 1.55,
                marginBottom: "20px",
              }}
            >
              {existingAccount ? (
                <>
                  There is already an account for{" "}
                  <strong style={{ color: "rgba(245,240,232,0.85)" }}>{email}</strong>, so a
                  second one was not created. <strong>Ask for a new code below</strong> and enter
                  it here: if that account was never verified, the code finishes it. Should no
                  mail arrive — this server may have no mail credentials — the code was still
                  minted, and can be read from the row.
                </>
              ) : mailSent ? (
                <>
                  A six-digit code is on its way to{" "}
                  <strong style={{ color: "rgba(245,240,232,0.85)" }}>{email}</strong>. It is good
                  for fifteen minutes.
                </>
              ) : (
                <>
                  The account for{" "}
                  <strong style={{ color: "rgba(245,240,232,0.85)" }}>{email}</strong> was created,
                  but <strong style={{ color: "#E4A0A0" }}>no email was sent</strong> — this server
                  has no mail credentials set yet. The code was still minted, so the flow can be
                  walked and the code read from the row.
                </>
              )}
            </p>

            <form onSubmit={submitCode}>
              <div style={field}>
                <label style={label} htmlFor="su-code">
                  Six-digit code
                </label>
                <input
                  id="su-code"
                  style={{ ...input, letterSpacing: "0.4em", fontSize: "18px", textAlign: "center" }}
                  value={code}
                  // Digits only, capped at six: the server compares what it stored, and a stray
                  // space or a pasted letter would be a refusal the person cannot see the cause of.
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  disabled={verifying}
                />
              </div>

              {verifyError && (
                <div
                  role="alert"
                  style={{ fontSize: "13px", color: "#E4A0A0", marginBottom: "14px", lineHeight: 1.45 }}
                >
                  {verifyError}
                </div>
              )}
              {notice && (
                <div
                  role="status"
                  style={{ fontSize: "12px", color: "rgba(245,240,232,0.55)", marginBottom: "14px", lineHeight: 1.45 }}
                >
                  {notice}
                </div>
              )}

              <button
                type="submit"
                disabled={verifying || code.length !== 6}
                style={{
                  width: "100%",
                  padding: "12px",
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#110E1F",
                  background: verifying || code.length !== 6 ? "rgba(145,98,194,0.5)" : "#9162C2",
                  border: "none",
                  borderRadius: "9px",
                  cursor: verifying || code.length !== 6 ? "default" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                {verifying ? "Checking…" : "Verify"}
              </button>
            </form>

            <button
              type="button"
              onClick={askForAnother}
              disabled={verifying}
              style={{
                marginTop: "12px",
                width: "100%",
                padding: "8px",
                fontSize: "12px",
                color: "rgba(212,160,238,0.85)",
                background: "transparent",
                border: "none",
                cursor: verifying ? "default" : "pointer",
                fontFamily: "inherit",
              }}
            >
              Send a new code
            </button>
          </div>
        )}

        {step === "plan" && (
          <div>
            {trial ? (
              /* THE TRIAL IS RUNNING. The screen changes rather than leaving the person on a
                 chooser they have already answered — and it says plainly that no card was taken,
                 because a trial that stays silent about payment reads as one that will surprise
                 them later. */
              <>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "#f5f0e8", marginBottom: "10px" }}>
                  {trial.already ? "Your trial is already running" : "Your trial has started"}
                </div>
                <p style={{ fontSize: "13px", color: "rgba(245,240,232,0.55)", lineHeight: 1.55 }}>
                  <strong style={{ color: "rgba(245,240,232,0.85)" }}>{trial.planName}</strong>, free
                  for <strong style={{ color: "rgba(245,240,232,0.85)" }}>{trial.daysLeft} days</strong>
                  {trial.endsAt ? <> — it ends on {String(trial.endsAt).slice(0, 10)}.</> : "."}
                  <br />
                  <br />
                  <span style={{ color: "rgba(245,240,232,0.40)" }}>
                    No card was taken and nothing will be charged when it ends: a payment provider
                    has not been connected yet.
                  </span>
                </p>
                <button
                  type="button"
                  onClick={onEnterWorkspace ?? onClose}
                  style={{
                    width: "100%", marginTop: "20px", padding: "12px", fontSize: "14px",
                    fontWeight: 700, color: "#110E1F", background: "#45D690", border: "none",
                    borderRadius: "9px", cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  Go to the workspace
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "#f5f0e8", marginBottom: "4px" }}>
                  Start your free trial
                </div>
                <div style={{ fontSize: "13px", color: "rgba(245,240,232,0.45)", marginBottom: "20px" }}>
                  No card required. Billing is disabled during beta testing — nothing here can
                  charge anyone.
                </div>

                {/* THE BILLING CYCLE — the yearly price comes from the same row as the monthly
                    one, and the saving is shown rather than claimed. */}
                <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
                  {(["monthly", "yearly"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCycle(c)}
                      style={{
                        flex: 1, padding: "8px", fontSize: "12px", fontWeight: 700,
                        color: cycle === c ? "#110E1F" : "rgba(245,240,232,0.6)",
                        background: cycle === c ? "#D4A0EE" : "transparent",
                        border: `1px solid ${cycle === c ? "#D4A0EE" : "rgba(255,255,255,0.12)"}`,
                        borderRadius: "8px", cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      {c === "monthly" ? "Monthly" : "Yearly"}
                    </button>
                  ))}
                </div>

                {plansError && (
                  <div role="alert" style={{ fontSize: "13px", color: "#E4A0A0", marginBottom: "14px", lineHeight: 1.45 }}>
                    {plansError}
                  </div>
                )}

                {!plans.length && !plansError && (
                  <div style={{ fontSize: "13px", color: "rgba(245,240,232,0.45)", marginBottom: "14px" }}>
                    Reading the plans…
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "18px" }}>
                  {plans.map((p) => {
                    const price =
                      cycle === "yearly" ? (p.price_yearly ?? p.price_monthly * 12) : p.price_monthly;
                    const chosen = p.slug === chosenPlan;
                    return (
                      <button
                        key={p.slug}
                        type="button"
                        onClick={() => setChosenPlan(p.slug)}
                        aria-pressed={chosen}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          width: "100%",
                          padding: "12px 14px",
                          textAlign: "left",
                          background: chosen ? "rgba(145,98,194,0.16)" : "#1a1726",
                          border: `1px solid ${chosen ? "#9162C2" : "rgba(255,255,255,0.08)"}`,
                          borderRadius: "9px",
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        <span>
                          <span style={{ display: "block", fontSize: "14px", fontWeight: 700, color: "#f5f0e8" }}>
                            {p.name}
                          </span>
                          <span style={{ display: "block", fontSize: "11px", color: "rgba(245,240,232,0.45)", marginTop: "2px" }}>
                            {p.queries_per_month === null
                              ? "Unlimited queries"
                              : `${p.queries_per_month} queries a month`}
                          </span>
                        </span>
                        <span style={{ fontSize: "14px", fontWeight: 700, color: chosen ? "#D4A0EE" : "rgba(245,240,232,0.7)" }}>
                          {price === 0 ? "Free" : `$${price}`}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {trialError && (
                  <div role="alert" style={{ fontSize: "13px", color: "#E4A0A0", marginBottom: "14px", lineHeight: 1.45 }}>
                    {trialError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={beginTrial}
                  disabled={starting || !chosenPlan}
                  style={{
                    width: "100%",
                    padding: "12px",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#110E1F",
                    background: starting || !chosenPlan ? "rgba(145,98,194,0.5)" : "#9162C2",
                    border: "none",
                    borderRadius: "9px",
                    cursor: starting || !chosenPlan ? "default" : "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {starting ? "Starting…" : "Start free trial"}
                </button>
              </>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: "18px", width: "100%", padding: "6px", fontSize: "12px",
            color: "rgba(245,240,232,0.40)", background: "transparent",
            border: "none", cursor: "pointer", fontFamily: "inherit",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
