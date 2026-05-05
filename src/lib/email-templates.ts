// Email templates in Bahasa Malaysia (resident) and English (admin)

function baseTemplate(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="ms">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: #2563eb; color: #fff; padding: 20px; text-align: center; }
    .body { padding: 24px; color: #333; line-height: 1.6; }
    .footer { background: #f9fafb; padding: 16px; text-align: center; font-size: 12px; color: #6b7280; }
    .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; margin-top: 16px; }
    .amount { font-size: 24px; font-weight: bold; color: #dc2626; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1 style="margin:0;font-size:20px;">🏢 Bayu Condo</h1></div>
    <div class="body">${content}</div>
    <div class="footer">Sistem Maintenance Kondo Bayu | Jangan balas emel ini</div>
  </div>
</body>
</html>`;
}

export function billReadyEmail(data: {
  ownerName: string;
  monthYear: string;
  totalAmount: number;
  dueDate: string;
  unitName: string;
}): { subject: string; html: string; text: string } {
  const subject = `Bil Maintenance ${data.monthYear} — ${data.unitName}`;
  const html = baseTemplate(
    subject,
    `<p>Hai ${data.ownerName},</p>
     <p>Bil maintenance anda untuk <strong>${data.monthYear}</strong> telah dijana.</p>
     <p class="amount">RM ${Number(data.totalAmount).toFixed(2)}</p>
     <p>Tarikh akhir bayaran: <strong>${data.dueDate}</strong></p>
     <p>Sila log masuk ke portal untuk membuat pembayaran.</p>
     <a href="${process.env.NEXT_PUBLIC_APP_URL || ""}/dashboard" class="button">Log Masuk Portal</a>`
  );
  const text = `Hai ${data.ownerName},\n\nBil maintenance ${data.monthYear}: RM ${Number(data.totalAmount).toFixed(2)}\nTarikh akhir: ${data.dueDate}\n\nSila log masuk ke portal untuk membuat pembayaran.`;
  return { subject, html, text };
}

export function paymentSuccessEmail(data: {
  ownerName: string;
  monthYear: string;
  totalAmount: number;
  unitName: string;
}): { subject: string; html: string; text: string } {
  const subject = `Pembayaran Berjaya — ${data.unitName}`;
  const html = baseTemplate(
    subject,
    `<p>Hai ${data.ownerName},</p>
     <p>Pembayaran bil maintenance <strong>${data.monthYear}</strong> telah berjaya diterima.</p>
     <p class="amount" style="color:#16a34a;">RM ${Number(data.totalAmount).toFixed(2)}</p>
     <p>Terima kasih atas pembayaran anda.</p>`
  );
  const text = `Hai ${data.ownerName},\n\nPembayaran bil ${data.monthYear} berjaya diterima: RM ${Number(data.totalAmount).toFixed(2)}\n\nTerima kasih.`;
  return { subject, html, text };
}

export function penaltyAppliedEmail(data: {
  ownerName: string;
  monthYear: string;
  penaltyAmount: number;
  newTotal: number;
  unitName: string;
}): { subject: string; html: string; text: string } {
  const subject = `Penalti Dikenakan — ${data.unitName}`;
  const html = baseTemplate(
    subject,
    `<p>Hai ${data.ownerName},</p>
     <p>Penalti lewat bayaran telah dikenakan ke atas bil <strong>${data.monthYear}</strong>.</p>
     <p>Penalti: <strong>RM ${Number(data.penaltyAmount).toFixed(2)}</strong></p>
     <p>Jumlah baru: <strong>RM ${Number(data.newTotal).toFixed(2)}</strong></p>
     <p>Sila segera membuat pembayaran untuk mengelakkan penalti tambahan.</p>
     <a href="${process.env.NEXT_PUBLIC_APP_URL || ""}/dashboard" class="button">Bayar Sekarang</a>`
  );
  const text = `Hai ${data.ownerName},\n\nPenalti dikenakan untuk bil ${data.monthYear}.\nPenalti: RM ${Number(data.penaltyAmount).toFixed(2)}\nJumlah baru: RM ${Number(data.newTotal).toFixed(2)}\n\nSila segera bayar.`;
  return { subject, html, text };
}

export function retryExhaustedEmail(data: {
  ownerName: string;
  monthYear: string;
  totalAmount: number;
  unitName: string;
}): { subject: string; html: string; text: string } {
  const subject = `Pembayaran Auto-Debit Gagal — ${data.unitName}`;
  const html = baseTemplate(
    subject,
    `<p>Hai ${data.ownerName},</p>
     <p>Pembayaran auto-debit untuk bil <strong>${data.monthYear}</strong> telah gagal selepas beberapa cubaan.</p>
     <p class="amount">RM ${Number(data.totalAmount).toFixed(2)}</p>
     <p>Sila log masuk ke portal untuk membuat pembayaran manual.</p>
     <a href="${process.env.NEXT_PUBLIC_APP_URL || ""}/dashboard" class="button">Bayar Manual</a>`
  );
  const text = `Hai ${data.ownerName},\n\nAuto-debit gagal untuk bil ${data.monthYear}: RM ${Number(data.totalAmount).toFixed(2)}\n\nSila bayar manual melalui portal.`;
  return { subject, html, text };
}
