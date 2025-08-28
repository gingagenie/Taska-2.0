import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireOrg } from "../middleware/tenancy";
import { db } from "../db/client";
import { sql } from "drizzle-orm";
import twilio from "twilio";

export const jobSms = Router();

// Helpers
const BIZ_TZ = process.env.BIZ_TZ || "Australia/Melbourne";
const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
const fromNumber = process.env.TWILIO_FROM_NUMBER;

if (!accountSid || !authToken || !(messagingServiceSid || fromNumber)) {
  // eslint-disable-next-line no-console
  console.warn("[job-sms] Twilio env missing; SMS route will 400 until configured.");
}
const client = (accountSid && authToken) ? twilio(accountSid, authToken) : null;

// Format date in business timezone (simple, no extra deps)
function formatAEST(iso: string | null): string {
  if (!iso) return "Not scheduled";
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-AU", {
      timeZone: BIZ_TZ,
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso!;
  }
}

/**
 * POST /api/jobs/:jobId/sms/confirm
 * body: { phone?: string, messageOverride?: string }
 * - phone: override customer phone (optional)
 * - messageOverride: override full text (optional)
 */
jobSms.post("/:jobId/sms/confirm", requireAuth, requireOrg, async (req, res) => {
  if (!client || !(messagingServiceSid || fromNumber)) {
    return res.status(400).json({ error: "Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and (TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER)" });
  }

  const { jobId } = req.params;
  const orgId = (req as any).orgId;
  const { phone: phoneOverride, messageOverride } = (req.body || {}) as { phone?: string; messageOverride?: string };

  // Pull job + customer info
  const qr: any = await db.execute(sql`
    select
      j.id, j.title, j.scheduled_at, j.description,
      c.id as customer_id, c.name as customer_name, c.phone as customer_phone
    from jobs j
    left join customers c on c.id = j.customer_id
    where j.id=${jobId}::uuid and j.org_id=${orgId}::uuid
    limit 1
  `);
  const row = qr.rows?.[0];
  if (!row) return res.status(404).json({ error: "Job not found" });

  // Normalize phone number for consistent formatting and matching
  function normPhone(s?: string | null) {
    if (!s) return "";
    const digits = s.replace(/[^\d]/g, "");
    if (digits.startsWith("04")) return "+61" + digits.slice(1);
    if (digits.startsWith("61")) return "+" + digits;
    if (digits.startsWith("0")) return "+61" + digits.slice(1);
    return s.startsWith("+") ? s : "+" + digits;
  }

  const rawPhone = (phoneOverride || row.customer_phone || "").trim();
  if (!rawPhone) return res.status(400).json({ error: "No customer phone on file. Provide { phone } in request body or set customer.phone." });
  
  const toPhone = normPhone(rawPhone);

  // Build default confirmation message
  const when = formatAEST(row.scheduled_at);
  const defaultMsg =
    `Hi from Taska! Job "${row.title}" is scheduled for ${when}. Reply YES to confirm or call if you need to reschedule.`;

  const body = (messageOverride && messageOverride.trim()) || defaultMsg;

  try {
    const msg = await client!.messages.create({
      to: toPhone,
      ...(messagingServiceSid ? { messagingServiceSid } : { from: fromNumber! }),
      body,
    });

    // Log outbound SMS for inbound matching
    await db.execute(sql`
      insert into job_notifications (org_id, job_id, channel, to_addr, body, provider_id, direction, status)
      values (${orgId}::uuid, ${row.id}::uuid, 'sms', ${toPhone}, ${body}, ${msg.sid}, 'out', ${msg.status})
    `);

    return res.json({ ok: true, sid: msg.sid, status: msg.status });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Twilio send failed" });
  }
});