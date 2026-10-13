import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  authenticateWithMainAppCookie,
  MAIN_APP_AUTHENTICATE_PATH,
} from "#/api/main-app-auth";

vi.mock("axios", () => ({
  default: {
    post: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

const postMock = vi.mocked(axios.post);
const isAxiosErrorMock = vi.mocked(axios.isAxiosError);

describe("main app cookie authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("authenticates against the main app cookie endpoint", async () => {
    postMock.mockResolvedValue({});

    await expect(authenticateWithMainAppCookie()).resolves.toBe(true);

    expect(postMock).toHaveBeenCalledOnce();
    expect(postMock).toHaveBeenCalledWith(
      MAIN_APP_AUTHENTICATE_PATH,
      null,
      { withCredentials: true },
    );
  });

  it("does not report unauthenticated arrivals", async () => {
    const error = { response: { status: 401 } };
    postMock.mockRejectedValue(error);
    isAxiosErrorMock.mockReturnValue(true);

    await expect(authenticateWithMainAppCookie()).resolves.toBe(false);

    expect(postMock).toHaveBeenCalledOnce();
    expect(postMock).toHaveBeenCalledWith(
      MAIN_APP_AUTHENTICATE_PATH,
      null,
      { withCredentials: true },
    );
  });
});
