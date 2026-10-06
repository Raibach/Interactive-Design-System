import { API_BASE } from "@/shared/apiHelper";
/**
 * Authentication Service
 * Manages API key authentication for Grace AI
 */

// Sentry is disabled (owner, 2026-10-02): setUser below is a no-op; see lib/sentry.ts.
import * as Sentry from "@/lib/sentry";

const API_KEY_STORAGE_KEY = "grace_api_key";
const USER_ID_STORAGE_KEY = "grace_user_id";
const USER_ROLE_STORAGE_KEY = "grace_user_role";

export interface AuthState {
  apiKey: string | null;
  userId: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  role?: string;
  isTeacher?: boolean;
  isStudent?: boolean;
}

/**
 * Get stored API key from sessionStorage
 * NOTE: API key authentication removed - Railway handles authentication
 * This function returns null to indicate no API key is needed
 */
export const getStoredApiKey = (): string | null => {
  // API key authentication removed - Railway handles authentication
  return null;
};

/**
 * Store API key in sessionStorage
 */
export const storeApiKey = (apiKey: string): void => {
  try {
    sessionStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
  } catch (error) {
    console.error("Failed to store API key:", error);
  }
};

/**
 * Remove API key from sessionStorage (logout)
 */
export const clearApiKey = (): void => {
  try {
    sessionStorage.removeItem(API_KEY_STORAGE_KEY);
    sessionStorage.removeItem(USER_ID_STORAGE_KEY);
    sessionStorage.removeItem("grace_is_admin");
    sessionStorage.removeItem(USER_ROLE_STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear API key:", error);
  }
};

/**
 * Default user ID — matches backend DEFAULT_USER_ID and seeded database user.
 * When real auth is implemented, replace with dynamic session-bound ID.
 */
export const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Get the identity used for every request.
 *
 * The gate is a doorman, not multi-tenant auth: there is ONE user — the owner
 * (DEFAULT_USER_ID), the identity every package actually belongs to. A stored
 * credential-row id must never leak in as the identity; it did once (the row
 * the login credentials live on, 04d61ea2…), and the console assembled zero
 * packages because every package belongs to the owner, not that row.
 */
export const getStoredUserId = (): string => {
  try {
    Sentry.setUser({ id: DEFAULT_USER_ID });
    return DEFAULT_USER_ID;
  } catch {
    console.error("[auth] sessionStorage unavailable — cannot persist user session.");
    return DEFAULT_USER_ID;
  }
};

/**
 * Store user ID
 */
export const storeUserId = (_userId: string): void => {
  try {
    // The identity is a constant — see getStoredUserId(). A credential-row id must never
    // land under this key: the old chat panel read it first and posted it as X-User-ID,
    // which is how the owner's own conversations started answering "not writable by user".
    sessionStorage.setItem(USER_ID_STORAGE_KEY, DEFAULT_USER_ID);
  } catch (error) {
    console.error("Failed to store user ID:", error);
  }
};

/**
 * Get current authentication state
 * Note: API key authentication removed - Railway handles authentication
 * Uses single default user ID for now
 */
export const getAuthState = (): AuthState => {
  const userId = getStoredUserId(); // Always returns a user ID (default if none stored)
  const isAdmin = sessionStorage.getItem("grace_is_admin") === "true";
  const role = sessionStorage.getItem(USER_ROLE_STORAGE_KEY) || "student";
  const isTeacher = role === "teacher";
  const isStudent = role === "student";

  // THE FLAG IS REPORTED AS IT IS (owner, 2026-10-04): this used to FORCE `true` — "bypass
  // login screen" — which is the shortcut the owner caught while testing (*"I'm just seeing
  // shortcuts … it's like it's cached"*). What the gate's session wrote is what this reports;
  // the gate itself, not this function, is what verifies a pin.
  return {
    apiKey: null, // No longer used
    userId,
    isAuthenticated: sessionStorage.getItem("grace_is_authenticated") === "true",
    isAdmin,
    role,
    isTeacher,
    isStudent,
  };
};

/**
 * Validate API key with backend
 */
export const validateApiKey = async (
  apiKey: string,
): Promise<{
  valid: boolean;
  userId?: string;
  isAdmin?: boolean;
  role?: string;
  isTeacher?: boolean;
  isStudent?: boolean;
  error?: string;
}> => {
  // Use relative URL for local dev (vite proxy handles /api routes)
  // In production, use VITE_API_URL env var
  const API_BASE_URL = import.meta.env.VITE_API_URL || "";

  try {
    const url = `${API_BASE_URL}/api/auth/validate`;
    console.log("🔍 Validating API key at:", url);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({ api_key: apiKey }),
    });

    console.log("📡 Response status:", response.status, response.statusText);

    if (response.status === 401 || response.status === 403) {
      const errorData = await response.json().catch(() => ({}));
      console.error("❌ Authentication failed:", errorData);
      return { valid: false, error: errorData.error || "Invalid API key" };
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("❌ Server error:", response.status, errorText);
      return { valid: false, error: `Server error: ${response.status}` };
    }

    const data = await response.json();
    console.log("✅ API Response:", JSON.stringify(data, null, 2));

    if (data.valid) {
      // DON'T store user ID here - let login() function handle it after validation
      // Just return the data for login() to process
      // Handle both snake_case (user_id) and camelCase (userId) formats
      const userId = data.user_id || data.userId;
      console.log("🔍 Extracted userId:", userId, "from data:", {
        user_id: data.user_id,
        userId: data.userId,
      });

      if (!userId) {
        console.error("❌ API returned valid=true but no user_id:", data);
        console.error("❌ Full response data:", JSON.stringify(data, null, 2));
        return {
          valid: false,
          error: "Server did not return a user ID. Please try again.",
        };
      }

      console.log("✅ Validation successful, userId:", userId);
      const role = data.role || "student";
      return {
        valid: true,
        userId,
        isAdmin: data.is_admin || data.isAdmin || false,
        role,
        isTeacher: data.is_teacher || data.isTeacher || false,
        isStudent: data.is_student || data.isStudent || false,
      };
    }

    console.error("❌ API returned valid=false:", data);
    return { valid: false, error: data.error || "Invalid API key" };
  } catch (error) {
    console.error("❌ API key validation error:", error);
    if (error instanceof Error) {
      console.error("❌ Error details:", error.message, error.stack);
    }
    return {
      valid: false,
      error: `Failed to connect to server: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
};

/**
 * Clear any old/invalid user IDs from storage
 */
export const clearInvalidUserIds = (): void => {
  try {
    const userId = sessionStorage.getItem(USER_ID_STORAGE_KEY);
    if (userId) {
      // Check if it's a valid UUID format
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(userId)) {
        // Invalid format - clear it
        console.warn(
          "⚠️ Clearing invalid user ID format from storage:",
          userId,
        );
        sessionStorage.removeItem(USER_ID_STORAGE_KEY);
        sessionStorage.removeItem("grace_is_admin");
      }

      // NOTE: The admin user ID '994cf308-b467-4a48-ab6a-dbbcdb81e4e4' is now VALID
      // It exists in the database for admin@grace.coop, so we should NOT clear it
      // Only clear invalid formats, not valid UUIDs that exist in the database

      // Also clear any user_1, default_user, etc.
      if (userId.startsWith("user_") || userId === "default_user") {
        console.warn("⚠️ Clearing old invalid user ID:", userId);
        sessionStorage.removeItem(USER_ID_STORAGE_KEY);
        sessionStorage.removeItem("grace_is_admin");
      }
    }
  } catch (error) {
    console.error("Error checking user ID:", error);
  }
};

/**
 * Login with email/username and password
 */
export const login = async (
  email: string,
  password: string,
): Promise<{
  success: boolean;
  userId?: string;
  email?: string;
  name?: string;
  role?: string;
  isTeacher?: boolean;
  isAdmin?: boolean;
  error?: string;
}> => {
  if (!email || !password) {
    return { success: false, error: "Email and password are required" };
  }

  // CRITICAL: Clear ALL old user IDs before validating
  // This prevents using cached invalid IDs that cause foreign key violations
  clearInvalidUserIds();
  // Also force clear any cached user ID to ensure fresh login
  sessionStorage.removeItem(USER_ID_STORAGE_KEY);
  sessionStorage.removeItem("grace_is_admin");
  sessionStorage.removeItem(USER_ROLE_STORAGE_KEY);

  try {
    const API_BASE_URL = import.meta.env.VITE_API_URL || "";
    const url = `${API_BASE_URL}/api/auth/login`;

    console.log("🔍 Logging in at:", url);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    console.log(
      "📡 Login response status:",
      response.status,
      response.statusText,
    );

    if (!response.ok) {
      // `detail` first — FastAPI's key. Same defect as the signup block above had: reading only
      // `error` erased the server's sentence and left "Login failed" in its place.
      const errorData = await response.json().catch(() => ({} as Record<string, unknown>));
      console.error("❌ Login failed:", errorData);
      const detail =
        typeof errorData.detail === "string"
          ? errorData.detail
          : typeof errorData.error === "string"
            ? errorData.error
            : "";
      return { success: false, error: detail || `Sign-in failed (HTTP ${response.status}).` };
    }

    const data = await response.json();
    console.log("✅ Login response:", JSON.stringify(data, null, 2));

    if (data.success) {
      const userId = data.user_id || data.userId;

      if (!userId) {
        console.error("❌ Login returned success but no user_id:", data);
        return {
          success: false,
          error: "Server did not return a user ID. Please try again.",
        };
      }

      // Validate it's a UUID before storing
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(userId)) {
        storeUserId(userId);
        console.log("✅ Stored valid user ID from database:", userId);

        // Store admin status if applicable
        if (data.is_admin || data.isAdmin) {
          sessionStorage.setItem("grace_is_admin", "true");
        } else {
          sessionStorage.removeItem("grace_is_admin");
        }

        // Store user role
        if (data.role) {
          sessionStorage.setItem(USER_ROLE_STORAGE_KEY, data.role);
          console.log("✅ Stored user role:", data.role);
        } else {
          sessionStorage.setItem(USER_ROLE_STORAGE_KEY, "student");
        }

        return {
          success: true,
          userId,
          email: data.email,
          name: data.name,
          role: data.role || "student",
          isTeacher: data.is_teacher || data.isTeacher || false,
          isAdmin: data.is_admin || data.isAdmin || false,
        };
      } else {
        console.error(
          "❌ Invalid user ID format received from server:",
          userId,
        );
        return {
          success: false,
          error:
            "Invalid user ID received from server. Please contact support.",
        };
      }
    }

    return { success: false, error: data.error || "Login failed" };
  } catch (error: any) {
    console.error("❌ Login error:", error);
    return {
      success: false,
      error:
        error.message ||
        "Failed to connect to server. Please check your connection and try again.",
    };
  }
};

/**
 * Logout
 */
export const logout = (): void => {
  // Clear everything on logout
  clearApiKey();
  clearInvalidUserIds(); // Clear any invalid user IDs
  // Also clear any cached user ID to force fresh login
  sessionStorage.removeItem(USER_ID_STORAGE_KEY);
  sessionStorage.removeItem("grace_is_admin");
  sessionStorage.removeItem(USER_ROLE_STORAGE_KEY);
  // Redirect to login will be handled by App.tsx
};

/**
 * Sign up a new user
 */
export const signup = async (
  email: string,
  password: string,
  fullName: string,
  role: "teacher" | "student" = "student",
): Promise<{
  success: boolean;
  userId?: string;
  email?: string;
  name?: string;
  role?: string;
  /**
   * Whether the verification mail actually left the server. The account is created either way —
   * `routes/auth.py` commits the row before it tries to send, so a mail failure is reported
   * rather than dressed up as a signup failure. The screen shows this, because "check your
   * email" is a lie when nothing was sent.
   */
  verificationEmailSent?: boolean;
  /**
   * True when the server refused because that address already has an account (HTTP 409).
   * The wizard reads this to offer the way forward — the code step — rather than leaving the
   * person at a red sentence with nothing to do about it.
   */
  alreadyExists?: boolean;
  error?: string;
}> => {
  if (!email || !password) {
    return { success: false, error: "Email and password are required" };
  }

  if (password.length < 6) {
    return { success: false, error: "Password must be at least 6 characters" };
  }

  try {
    const API_BASE_URL = import.meta.env.VITE_API_URL || "";
    const url = `${API_BASE_URL}/api/auth/signup`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, full_name: fullName, role }),
    });

    if (!response.ok) {
      // FastAPI puts a refusal's sentence in `detail`. Reading only `error` here is what turned
      // every specific reason the server gave — "An account with that email already exists",
      // the password rule, a database that is down — into the same three words, "Signup failed".
      const errorData = await response.json().catch(() => ({} as Record<string, unknown>));
      const detail =
        typeof errorData.detail === "string"
          ? errorData.detail
          : typeof errorData.error === "string"
            ? errorData.error
            : "";
      return {
        success: false,
        error: detail || `The server refused the signup (HTTP ${response.status}).`,
        alreadyExists: response.status === 409,
      };
    }

    const data = await response.json();

    if (data.success) {
      // Store user ID and role
      if (data.user_id) {
        storeUserId(data.user_id);
        if (data.role) {
          sessionStorage.setItem(USER_ROLE_STORAGE_KEY, data.role);
        }
      }

      return {
        success: true,
        userId: data.user_id,
        email: data.email,
        name: data.name,
        role: data.role,
        // Straight from the server: whether the verification mail actually LEFT. The account
        // exists either way — `routes/auth.py` commits the row before it tries to send — so the
        // screen can either say "check your email" or admit that nothing went, and only this
        // value knows which is true.
        verificationEmailSent: Boolean(data.verification_email_sent),
      };
    }

    return { success: false, error: data.error || "Signup failed" };
  } catch (error: any) {
    console.error("❌ Signup error:", error);
    // A fetch that never reached the server throws `TypeError: Failed to fetch`, whose own
    // message names nothing a person can act on — so the connection case gets its own sentence
    // instead of that one being shown to them.
    return {
      success: false,
      error:
        error instanceof TypeError
          ? "The server could not be reached. Check the connection and try again."
          : error?.message || "The signup did not complete.",
    };
  }
};

/**
 * Get API key for use in API calls
 * Note: API key authentication removed - Railway handles authentication
 * This function returns null as API keys are no longer required
 */
export const getApiKey = (): string | null => {
  // API keys no longer required - Railway handles authentication
  return null;
};

/**
 * VERIFY THE EMAIL — the code from the mail, checked by the server.
 *
 * NOTHING IS COMPARED HERE. The code is posted and the server's answer is reported; the
 * comparison and the expiry check both live in `routes/auth.py`, because a check made in the
 * browser is a check the browser can lie about. This function's whole job is to carry two
 * strings and bring back a sentence.
 */
export const verifyEmail = async (
  email: string,
  code: string,
): Promise<{ success: boolean; alreadyVerified?: boolean; error?: string }> => {
  if (!email || !code) {
    return { success: false, error: "Email and code are required" };
  }
  try {
    const API_BASE_URL = import.meta.env.VITE_API_URL || "";
    const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      // The server's own words, not a re-wording: it already refuses a bad code in a sentence
      // written for the person reading it.
      return {
        success: false,
        error: data?.detail || `Verification failed (HTTP ${response.status})`,
      };
    }
    return { success: true, alreadyVerified: Boolean(data?.already_verified) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
};

/**
 * ASK FOR ANOTHER CODE.
 *
 * THE REPLY GIVES NOTHING AWAY, and this function does not try to. The server answers the same
 * way whether the address exists, does not, or is already verified — a deliberate choice made
 * so this endpoint cannot be used to ask "is this email registered here?" one address at a
 * time. A client that reported a difference would undo that on its own.
 */
export const resendVerificationCode = async (
  email: string,
): Promise<{ success: boolean; error?: string }> => {
  if (!email) return { success: false, error: "Email is required" };
  try {
    const API_BASE_URL = import.meta.env.VITE_API_URL || "";
    const response = await fetch(`${API_BASE_URL}/api/auth/resend-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return {
        success: false,
        error: data?.detail || `Could not resend the code (HTTP ${response.status})`,
      };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
};
