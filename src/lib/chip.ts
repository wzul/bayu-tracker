// CHIP Collect API client wrapper
const CHIP_API_URL = process.env.CHIP_API_URL || "https://gate.chip-in.asia/api/v1/";
const CHIP_SECRET = process.env.CHIP_SECRET_KEY;
const CHIP_BRAND_ID = process.env.CHIP_BRAND_ID;

function authHeaders() {
  if (!CHIP_SECRET) throw new Error("CHIP_SECRET_KEY not configured");
  return {
    Authorization: `Bearer ${CHIP_SECRET}`,
    "Content-Type": "application/json",
  };
}

export async function chipCreatePurchase(payload: any) {
  const res = await fetch(`${CHIP_API_URL}purchases/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ brand_id: CHIP_BRAND_ID, ...payload }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("CHIP purchase error:", data);
    throw new Error(data.detail || "CHIP purchase failed");
  }
  return data;
}

export async function chipGetPurchase(id: string) {
  const res = await fetch(`${CHIP_API_URL}purchases/${id}/`, {
    headers: authHeaders(),
  });
  return res.json();
}

export async function chipCreateSubscription(payload: any) {
  const res = await fetch(`${CHIP_API_URL}subscriptions/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ brand_id: CHIP_BRAND_ID, ...payload }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("CHIP subscription error:", data);
    throw new Error(data.detail || "CHIP subscription failed");
  }
  return data;
}

export async function chipChargeSubscription(subscriptionId: string, amount: number) {
  const res = await fetch(`${CHIP_API_URL}subscriptions/${subscriptionId}/charge/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ amount: Math.round(amount * 100) }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("CHIP charge error:", data);
    throw new Error(data.detail || "CHIP charge failed");
  }
  return data;
}

export async function chipCancelSubscription(subscriptionId: string) {
  const res = await fetch(`${CHIP_API_URL}subscriptions/${subscriptionId}/cancel/`, {
    method: "POST",
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("CHIP cancel error:", data);
    throw new Error(data.detail || "CHIP cancel failed");
  }
  return data;
}

export async function chipGetPublicKey(): Promise<string> {
  const res = await fetch(`${CHIP_API_URL}public_key/`, {
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok || !data.public_key) {
    throw new Error("Failed to fetch CHIP public key");
  }
  return data.public_key as string;
}
