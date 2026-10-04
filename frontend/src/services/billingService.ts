/**
 * billingService — the plans, and the trial, as the browser asks for them.
 *
 * THE IDENTITY TRAVELS AS A HEADER, and that is this application's existing convention rather
 * than a decision made here: `getStoredUserId()` is what every other call uses to say who is
 * asking (see `authService.ts`), and `routes/auth.py` already pins that header in demo mode so a
 * visitor cannot claim somebody else. Signup stores the new id on the way through, which is why
 * a person who has just created an account starts a trial on THEIR row and not on the default
 * one.
 *
 * NOTHING HERE TOUCHES A CARD. A trial is a date on a row — the server writes it and this brings
 * back when it ends. The payment provider, when there is one, will arrive as a `checkout_url`
 * that this returns and a screen that follows it; the field is already in the response shape
 * below so that arrival is a screen change and not a rewrite.
 */
import { getStoredUserId } from "@/services/authService";

/** Where the API lives — the same resolution every other service uses. */
const API_BASE_URL = import.meta.env.VITE_API_URL || "";

export interface Plan {
  slug: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number | null;
  queries_per_month: number | null;
  memory_storage_mb: number | null;
  features: Record<string, unknown>;
}

export const fetchPlans = async (): Promise<{
  plans: Plan[];
  trialDays: number;
  providerConfigured: boolean;
  error?: string;
}> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/billing/plans`);
    if (!response.ok) {
      return { plans: [], trialDays: 0, providerConfigured: false, error: `Could not read the plans (HTTP ${response.status})` };
    }
    const data = await response.json();
    return {
      plans: Array.isArray(data?.plans) ? data.plans : [],
      trialDays: Number(data?.trial_days ?? 0),
      providerConfigured: Boolean(data?.provider_configured),
    };
  } catch (error) {
    return {
      plans: [],
      trialDays: 0,
      providerConfigured: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

export const startTrial = async (
  planSlug: string,
  billingCycle: "monthly" | "yearly" = "monthly",
): Promise<{
  success: boolean;
  alreadyStarted?: boolean;
  planSlug?: string;
  planName?: string;
  trialEnd?: string;
  trialDaysLeft?: number;
  /** The provider's checkout address, when a provider exists. Null on every install today. */
  checkoutUrl?: string | null;
  error?: string;
}> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/billing/start-trial`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-ID": getStoredUserId(),
      },
      body: JSON.stringify({ plan_slug: planSlug, billing_cycle: billingCycle }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      // The server's own words — it refuses an unknown plan by name.
      return { success: false, error: data?.detail || `Could not start the trial (HTTP ${response.status})` };
    }
    return {
      success: true,
      alreadyStarted: Boolean(data?.already_started),
      planSlug: data?.plan_slug,
      planName: data?.plan_name,
      trialEnd: data?.trial_end,
      trialDaysLeft: data?.trial_days_left,
      checkoutUrl: data?.checkout_url ?? null,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
};
