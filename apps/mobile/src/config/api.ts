import AsyncStorage from "@react-native-async-storage/async-storage";

// Production backend API URL
export const DEFAULT_API_URL = "https://realtime-video-platform.onrender.com/api/v1";
export const DEFAULT_SOCKET_URL = "https://realtime-video-platform.onrender.com";

const STORAGE_KEYS = {
  ACCESS_TOKEN: "@supercall_access_token",
  REFRESH_TOKEN: "@supercall_refresh_token",
  USER_DATA: "@supercall_user_data",
  SERVER_URL: "@supercall_server_url",
};

// Resilient storage: in-memory cache fallback to prevent crashes if native AsyncStorage is unavailable
const memoryStorage: Record<string, string> = {};

export const safeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (AsyncStorage && typeof AsyncStorage.getItem === "function") {
        const val = await AsyncStorage.getItem(key);
        if (val !== null) return val;
      }
    } catch {
      // Ignore native module error and fallback to memory
    }
    return memoryStorage[key] ?? null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    memoryStorage[key] = value;
    try {
      if (AsyncStorage && typeof AsyncStorage.setItem === "function") {
        await AsyncStorage.setItem(key, value);
      }
    } catch {
      // Ignore native module error and keep in memory
    }
  },
  removeItem: async (key: string): Promise<void> => {
    delete memoryStorage[key];
    try {
      if (AsyncStorage && typeof AsyncStorage.removeItem === "function") {
        await AsyncStorage.removeItem(key);
      }
    } catch {
      // Ignore native module error
    }
  },
};

export const getStoredServerUrl = async (): Promise<string> => {
  try {
    const url = await safeStorage.getItem(STORAGE_KEYS.SERVER_URL);
    if (!url || url.includes("401y.onrender.com") || url.includes("172.") || url.includes("192.") || url.includes("localhost")) {
      return DEFAULT_API_URL;
    }
    return url;
  } catch {
    return DEFAULT_API_URL;
  }
};

export const setStoredServerUrl = async (url: string): Promise<void> => {
  const sanitized = url.trim().replace(/\/+$/, "");
  await safeStorage.setItem(STORAGE_KEYS.SERVER_URL, sanitized);
};

export const getSocketBaseUrl = async (): Promise<string> => {
  const apiUrl = await getStoredServerUrl();
  // Strip /api/v1 to get socket root
  return apiUrl.replace(/\/api\/v1\/?$/, "");
};

export const getStoredToken = async (): Promise<string | null> => {
  try {
    return await safeStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  } catch {
    return null;
  }
};

export const getStoredRefreshToken = async (): Promise<string | null> => {
  try {
    return await safeStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  } catch {
    return null;
  }
};

export const saveAuthTokens = async (accessToken: string, refreshToken: string): Promise<void> => {
  await safeStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
  await safeStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
};

export const clearAuthTokens = async (): Promise<void> => {
  await safeStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  await safeStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  await safeStorage.removeItem(STORAGE_KEYS.USER_DATA);
};

// Typed lightweight Fetch wrapper supporting auto-token injection and baseURL
export const apiClient = async <T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data: T; message?: string }> => {
  const baseUrl = await getStoredServerUrl();
  const token = await getStoredToken();

  const url = endpoint.startsWith("http") ? endpoint : `${baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const text = await response.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { message: text };
  }

  if (!response.ok) {
    // If 401 Unauthorized, attempt refresh
    if (response.status === 401) {
      const refreshed = await attemptTokenRefresh();
      if (refreshed) {
        // Retry request with new token
        const newToken = await getStoredToken();
        headers["Authorization"] = `Bearer ${newToken}`;
        const retryRes = await fetch(url, { ...options, headers });
        const retryText = await retryRes.text();
        return retryText ? JSON.parse(retryText) : ({ success: true, data: {} as T });
      }
    }
    const errorMsg = json?.message || `Request failed with status ${response.status}`;
    const err = new Error(errorMsg) as any;
    err.status = response.status;
    err.data = json;
    throw err;
  }

  return json;
};

const attemptTokenRefresh = async (): Promise<boolean> => {
  try {
    const refreshToken = await getStoredRefreshToken();
    if (!refreshToken) return false;

    const baseUrl = await getStoredServerUrl();
    const res = await fetch(`${baseUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (res.ok) {
      const data = await res.json();
      const newAccessToken = data?.data?.accessToken;
      if (newAccessToken) {
        await safeStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, newAccessToken);
        return true;
      }
    }
    await clearAuthTokens();
    return false;
  } catch {
    await clearAuthTokens();
    return false;
  }
};
