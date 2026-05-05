import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

interface CsvRow {
  block: string;
  floor: string;
  unitNo: string;
  ownerName: string;
  ownerIc: string;
  email: string;
  phone?: string;
  monthlyFee: number;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].toLowerCase().split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const get = (name: string) => values[headers.indexOf(name)] || "";

    const block = get("block");
    const floor = get("floor");
    const unitNo = get("unitno");
    const ownerName = get("ownername");
    const ownerIc = get("owneric");
    const email = get("email");
    const phone = get("phone") || undefined;
    const monthlyFee = parseFloat(get("monthlyfee"));

    if (!block || !floor || !unitNo || !ownerName || !ownerIc || !email || isNaN(monthlyFee)) {
      continue;
    }

    rows.push({ block, floor, unitNo, ownerName, ownerIc, email, phone, monthlyFee });
  }

  return rows;
}

export async function POST(request: Request) {
  try {
    const user = await requireAdmin();
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const text = await file.text();
    const rows = parseCsv(text);

    if (rows.length === 0) {
      return NextResponse.json({ error: "No valid rows found in CSV" }, { status: 400 });
    }

    let created = 0;
    let skipped = 0;

    for (const row of rows) {
      const existing = await db.unit.findUnique({ where: { ownerIc: row.ownerIc } });
      if (existing) {
        skipped++;
        continue;
      }

      const unit = await db.unit.create({
        data: {
          block: row.block,
          floor: row.floor,
          unitNo: row.unitNo,
          ownerName: row.ownerName,
          ownerIc: row.ownerIc,
          phone: row.phone,
          monthlyFee: row.monthlyFee,
          status: "ACTIVE",
        },
      });

      const passwordHash = await bcrypt.hash("resident123", 12);
      await db.user.create({
        data: {
          email: row.email,
          passwordHash,
          role: "RESIDENT",
          unitId: unit.id,
        },
      });
      created++;
    }

    await logAudit({
      action: "UNITS_IMPORTED",
      actorId: user.user.id,
      actorType: "admin",
      details: { created, skipped, total: rows.length },
    });

    return NextResponse.json({ success: true, created, skipped, total: rows.length });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("Import error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
