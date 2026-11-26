export interface StorefrontProduct {
  id: string;
  sku: string;
  name: string;
  description: string;
  baseBarcode: string;
  mrp: number;
  inStock: boolean;
}

export interface CartItem {
  productId: string;
  lotId: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  mrp: number;
}

export interface TenantTheme {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl: string;
  fontFamily: string;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';
const TENANT_ID = import.meta.env.VITE_TENANT_ID ?? '';
const FACILITY_ID = import.meta.env.VITE_FACILITY_ID ?? '';

export function getTenantConfig() {
  return { apiBase: API_BASE, tenantId: TENANT_ID, facilityId: FACILITY_ID };
}

export async function resolveProductBarcode(barcode: string): Promise<{
  productId: string;
  productName: string;
  productSku: string;
  suggestedLot: { id: string; mrp: number; expiryDate: string } | null;
  candidateLots: Array<{ id: string; mrp: number; expiryDate: string; quantityOnHand: number }>;
}> {
  const config = getTenantConfig();
  const params = new URLSearchParams({
    tenantId: config.tenantId,
    facilityId: config.facilityId,
  });

  const response = await fetch(
    `${config.apiBase}/api/v1/barcode/resolve/${encodeURIComponent(barcode)}?${params.toString()}`,
    {
      headers: { 'X-Tenant-Id': config.tenantId },
    },
  );

  if (!response.ok) {
    throw new Error(`Product lookup failed: ${response.status}`);
  }

  return response.json();
}

export function calculateCartTotals(items: CartItem[], taxRate: number): {
  subtotal: number;
  taxTotal: number;
  finalPayable: number;
} {
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const taxTotal = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity * (taxRate / 100),
    0,
  );
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    taxTotal: Math.round(taxTotal * 100) / 100,
    finalPayable: Math.round((subtotal + taxTotal) * 100) / 100,
  };
}
