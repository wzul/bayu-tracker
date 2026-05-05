// LHDN MyInvois API client
// Disabled by default — only active when ENABLE_EINVOICE=true

const ENABLED = process.env.ENABLE_EINVOICE === "true";
const CLIENT_ID = process.env.LHDN_CLIENT_ID;
const CLIENT_SECRET = process.env.LHDN_CLIENT_SECRET;
const API_URL = process.env.LHDN_API_URL;

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (!ENABLED || !CLIENT_ID || !CLIENT_SECRET || !API_URL) {
    throw new Error("LHDN e-Invoice not configured");
  }

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const res = await fetch(`${API_URL}connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: "InvoicingAPI",
    }),
  });

  const data: TokenResponse = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`LHDN auth failed: ${JSON.stringify(data)}`);
  }

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function submitInvoice(payload: any) {
  const token = await getAccessToken();
  const res = await fetch(`${API_URL}api/v1.0/documents/submission`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function getInvoiceStatus(documentId: string) {
  const token = await getAccessToken();
  const res = await fetch(`${API_URL}api/v1.0/documents/${documentId}/status`, {
    headers: authHeaders(token),
  });
  return res.json();
}

export async function cancelInvoice(documentId: string, reason: string) {
  const token = await getAccessToken();
  const res = await fetch(`${API_URL}api/v1.0/documents/state/${documentId}/state`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ status: "cancelled", reason }),
  });
  return res.json();
}

export function isEInvoiceEnabled(): boolean {
  return ENABLED;
}
