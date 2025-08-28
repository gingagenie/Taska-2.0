// client/src/lib/api.ts
const BASE = import.meta.env.VITE_API_BASE_URL || "";

function getAuthHeaders() {
  const uid = localStorage.getItem("x-user-id"); // no default
  const oid = localStorage.getItem("x-org-id");  // no default
  const h: Record<string,string> = {};
  if (uid) h["x-user-id"] = uid;
  if (oid) h["x-org-id"] = oid;
  return h;
}

/** Low-level fetcher with timeout + good errors */
export async function api(path: string, init: RequestInit = {}) {
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
    ...(init.headers as Record<string, string> || {}),
  };
  
  // Only set Content-Type for non-FormData requests
  if (!(init?.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  // ⏱️ 30s timeout so the UI never spins forever
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), 30000);
  
  const url = `${BASE}${path}`;
  console.log("[api] ->", url, init.method || "GET");

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers, signal: controller.signal, credentials: "include" });
  } catch (e: any) {
    clearTimeout(to);
    if (e?.name === "AbortError") throw new Error("Request timed out");
    throw new Error(e?.message || "Network error");
  }
  clearTimeout(to);

  const text = await res.text();

  if (!res.ok) {
    // Try to surface JSON error shape {error|message}
    try {
      const err = JSON.parse(text || "{}");
      throw new Error(err.error || err.message || `HTTP ${res.status}`);
    } catch {
      throw new Error(text || `HTTP ${res.status}`);
    }
  }

  return text ? JSON.parse(text) : null;
}

/** Allow UI to set real auth later (e.g., after login) */
export function setAuth(uid: string, oid: string) {
  localStorage.setItem("x-user-id", uid);
  localStorage.setItem("x-org-id", oid);
}

// Ensure we can clear any old dev overrides
export function clearDevAuth() {
  localStorage.removeItem("x-user-id");
  localStorage.removeItem("x-org-id");
}

/* ------------------------------------------------------------------ */
/* Convenience API wrappers so existing imports don't break            */
/* ------------------------------------------------------------------ */

export const jobsApi = {
  getAll: () => api("/api/jobs"),
  get: (id: string) => api(`/api/jobs/${id}`),
  sendConfirm: (id: string, body?: { phone?: string; messageOverride?: string }) =>
    api(`/api/jobs/${id}/sms/confirm`, {
      method: "POST",
      body: JSON.stringify(body || {}),
    }),
  create: (body: any) =>
    api("/api/jobs/create", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: any) =>
    api(`/api/jobs/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  customers: () => api("/api/jobs/customers"),
  equipment: () => api("/api/jobs/equipment"),
  delete: (id: string) => api(`/api/jobs/${id}`, { method: "DELETE" }),
  byRange: (startISO: string, endISO: string, techId?: string) =>
    api(`/api/jobs/range?start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}${techId ? `&techId=${encodeURIComponent(techId)}` : ""}`),
  technicians: () => api("/api/jobs/technicians"),
  reschedule: (id: string, scheduledAtISO: string) =>
    api(`/api/jobs/${id}/schedule`, { method: "PATCH", body: JSON.stringify({ scheduledAt: scheduledAtISO }) }),
};

export const customersApi = {
  getAll: () => api("/api/customers"),
  get: (id: string) => api(`/api/customers/${id}`),
  create: (body: any) => api("/api/customers", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: any) => api(`/api/customers/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: string) => api(`/api/customers/${id}`, { method: "DELETE" }),
};

export const notesApi = {
  list: (jobId: string) => api(`/api/jobs/${jobId}/notes`),
  add: (jobId: string, text: string) => api(`/api/jobs/${jobId}/notes`, { method: "POST", body: JSON.stringify({ text }) }),
};

export const chargesApi = {
  list: (jobId: string) => api(`/api/jobs/${jobId}/charges`),
  add: (jobId: string, body: any) => api(`/api/jobs/${jobId}/charges`, { method: "POST", body: JSON.stringify(body) }),
};

export const photosApi = {
  list: (jobId: string) => api(`/api/jobs/${jobId}/photos`),
  upload: (jobId: string, file: File) => {
    const form = new FormData();
    form.append("photo", file);
    return api(`/api/jobs/${jobId}/photos`, { method: "POST", body: form as any });
  },
  remove: (jobId: string, photoId: string) => api(`/api/jobs/${jobId}/photos/${photoId}`, { method: "DELETE" }),
};

export const teamsApi = {
  getAll: () => api("/api/teams"),
  addMember: (body: any) =>
    api("/api/teams/add-member", { method: "POST", body: JSON.stringify(body) }),
};

export const equipmentApi = {
  getAll: () => api("/api/equipment"),
  get: (id: string) => api(`/api/equipment/${id}`),
  create: (body: any) =>
    api("/api/equipment", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: any) =>
    api(`/api/equipment/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: string) => api(`/api/equipment/${id}`, { method: "DELETE" }),
};

export const meApi = {
  get: () => api("/api/me"),
  updateProfile: (body: any) => api("/api/me/profile", { method: "PUT", body: JSON.stringify(body) }),
  changePassword: (body: any) => api("/api/me/change-password", { method: "POST", body: JSON.stringify(body) }),
  updateOrg: (body: any) => api("/api/me/org", { method: "PUT", body: JSON.stringify(body) }),
  uploadAvatar: async (file: File) => {
    const BASE = import.meta.env.VITE_API_BASE_URL || "";
    const uid = localStorage.getItem("x-user-id") || "315e3119-1b17-4dee-807f-bbc1e4d5c5b6";
    const oid = localStorage.getItem("x-org-id") || "4500ba4e-e575-4f82-b196-27dd4c7d0eaf";

    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch(`${BASE}/api/me/avatar`, {
      method: "POST",
      headers: { "x-user-id": uid, "x-org-id": oid }, // NOTE: no Content-Type here
      body: fd,
    });
    const text = await res.text();
    if (!res.ok) {
      try { throw new Error(JSON.parse(text).error || JSON.parse(text).message || text); }
      catch { throw new Error(text || `HTTP ${res.status}`); }
    }
    return JSON.parse(text);
  },
};

export const membersApi = {
  getAll: () => api("/api/members"),
  create: (body: any) => api("/api/members", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: any) => api(`/api/members/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (userId: string) => api(`/api/members/${userId}`, { method: "DELETE" }),

  // legacy compatibility so existing flows keep working
  addToTeamCompat: (body: { email: string; name?: string; teamId: string; role?: string; phone?: string; }) =>
    api("/api/members/_compat/teams-add-member", { method: "POST", body: JSON.stringify(body) }),
};

/** PRO features (routes assumed as /api/quotes and /api/invoices) */
export const quotesApi = {
  getAll: () => api("/api/quotes"),
  get: (id: string) => api(`/api/quotes/${id}`),
  create: (body: any) =>
    api("/api/quotes", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: any) =>
    api(`/api/quotes/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  // Legacy item methods - deprecated, use update() with lines array instead
  addItem: (id: string, item: any) => 
    api(`/api/quotes/${id}/items`, { method: "POST", body: JSON.stringify(item) }),
  updateItem: (id: string, itemId: string, body: any) => 
    api(`/api/quotes/${id}/items/${itemId}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteItem: (id: string, itemId: string) => 
    api(`/api/quotes/${id}/items/${itemId}`, { method: "DELETE" }),
  accept: (id: string) => api(`/api/quotes/${id}/accept`, { method: "POST" }),
  convertToJob: (id: string) => api(`/api/quotes/${id}/convert`, { method: "POST" }),
};

export const invoicesApi = {
  getAll: () => api("/api/invoices"),
  get: (id: string) => api(`/api/invoices/${id}`),
  create: (body: any) =>
    api("/api/invoices", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: any) =>
    api(`/api/invoices/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  // Legacy item methods - deprecated, use update() with lines array instead
  addItem: (id: string, item: any) => 
    api(`/api/invoices/${id}/items`, { method: "POST", body: JSON.stringify(item) }),
  updateItem: (id: string, itemId: string, body: any) => 
    api(`/api/invoices/${id}/items/${itemId}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteItem: (id: string, itemId: string) => 
    api(`/api/invoices/${id}/items/${itemId}`, { method: "DELETE" }),
  markPaid: (id: string) => api(`/api/invoices/${id}/pay`, { method: "POST" }),
};

export const scheduleApi = {
  range: (p: { start: string; end: string; techId?: string; tz?: string }) => {
    const q = new URLSearchParams(p as any).toString();
    return api(`/api/schedule/range?${q}`);
  },
};

export const itemPresetsApi = {
  search: (q: string) => api(`/api/item-presets?search=${encodeURIComponent(q)}`),
  create: (body: any) => api(`/api/item-presets`, { method: "POST", body: JSON.stringify(body) }),
  ensure: (body: any) => api(`/api/item-presets/ensure`, { method: "POST", body: JSON.stringify(body) }),
  delete: (id: string) => api(`/api/item-presets/${id}`, { method: "DELETE" }),
};

// Photos API helper functions already defined above in photosApi
