import { BrowserWindow } from 'electron';
import type { LocalOrderInvoice, PosConfig } from '../../shared/types';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildReceiptHtml(invoice: LocalOrderInvoice, config: PosConfig): string {
  const lines = invoice.items
    .map((item) => {
      const disc =
        item.discountAmount > 0
          ? `<div class="muted">Disc ${item.discountPercent}% −₹${item.discountAmount.toFixed(2)}</div>`
          : '';
      return `<tr>
        <td>${escapeHtml(item.productName)}<div class="muted">${escapeHtml(item.batchNumber || item.barcode)}</div>${disc}</td>
        <td class="num">${item.quantity}</td>
        <td class="num">₹${item.unitPrice.toFixed(2)}</td>
        <td class="num">₹${item.netAmount.toFixed(2)}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Receipt ${escapeHtml(invoice.invoiceNumber)}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  body { font-family: "Courier New", monospace; font-size: 12px; width: 72mm; margin: 0 auto; color: #111; }
  h1 { font-size: 16px; margin: 0 0 4px; text-align: center; }
  .meta, .muted { color: #444; font-size: 11px; }
  .center { text-align: center; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { padding: 3px 0; vertical-align: top; }
  th { border-bottom: 1px dashed #333; text-align: left; font-size: 11px; }
  .num { text-align: right; white-space: nowrap; }
  .totals { margin-top: 8px; border-top: 1px dashed #333; padding-top: 6px; }
  .totals div { display: flex; justify-content: space-between; margin: 2px 0; }
  .totals .pay { font-size: 14px; font-weight: bold; margin-top: 6px; }
</style>
</head>
<body>
  <h1>${escapeHtml(config.shopName)}</h1>
  <div class="center meta">${escapeHtml(config.facilityName)}</div>
  <div class="center meta">${escapeHtml(invoice.invoiceNumber)} · ${escapeHtml(invoice.createdAt.slice(0, 19).replace('T', ' '))}</div>
  <div class="meta">Cashier: ${escapeHtml(invoice.cashierName || '—')}</div>
  <div class="meta">Customer: ${escapeHtml(invoice.customerPayload?.name || 'Walk-in')}</div>
  <div class="meta">Type: ${escapeHtml(invoice.saleType)} · ${escapeHtml(invoice.paymentChannel)}</div>
  <table>
    <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amt</th></tr></thead>
    <tbody>${lines}</tbody>
  </table>
  <div class="totals">
    <div><span>Subtotal</span><span>₹${invoice.subtotal.toFixed(2)}</span></div>
    <div><span>Discount</span><span>−₹${invoice.discountTotal.toFixed(2)}</span></div>
    <div><span>Round off</span><span>₹${invoice.roundOff.toFixed(2)}</span></div>
    <div class="pay"><span>Payable</span><span>₹${invoice.finalPayable.toFixed(2)}</span></div>
    ${
      invoice.paymentChannel === 'CASH' && invoice.amountTendered > 0
        ? `<div><span>Tendered</span><span>₹${invoice.amountTendered.toFixed(2)}</span></div>
           <div><span>Change</span><span>₹${invoice.changeDue.toFixed(2)}</span></div>`
        : ''
    }
  </div>
  <p class="center meta" style="margin-top:12px">Thank you · Prices are final (tax-off)</p>
</body>
</html>`;
}

export async function printReceiptHtml(html: string): Promise<boolean> {
  const win = new BrowserWindow({
    show: false,
    width: 320,
    height: 640,
    webPreferences: { sandbox: true },
  });

  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const printed = await new Promise<boolean>((resolve) => {
      win.webContents.print(
        {
          silent: false,
          printBackground: true,
          deviceName: '',
        },
        (success) => resolve(success),
      );
    });
    return printed;
  } finally {
    if (!win.isDestroyed()) win.close();
  }
}
