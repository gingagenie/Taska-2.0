import { Router } from "express";
import { db } from "../db/client";
import { sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireOrg } from "../middleware/tenancy";
import { xeroService } from "../services/xero";
import { sumLines } from "../lib/totals";

const isUuid = (v?: string) => !!v && /^[0-9a-f-]{36}$/i.test(v);
const router = Router();

/** List */
router.get("/", requireAuth, requireOrg, async (req, res) => {
  const orgId = (req as any).orgId;
  const r: any = await db.execute(sql`
    select i.id, i.title, i.status, i.created_at, i.customer_id, c.name as customer_name
    from invoices i join customers c on c.id = i.customer_id
    where i.org_id=${orgId}::uuid
    order by i.created_at desc
  `);
  res.json(r.rows);
});

/** Create */
router.post("/", requireAuth, requireOrg, async (req, res) => {
  const orgId = (req as any).orgId;
  const userId = (req as any).user?.id || null;
  const { title, customerId, jobId, notes, lines = [] } = req.body || {};
  if (!title || !customerId) return res.status(400).json({ error: "title & customerId required" });

  const ins: any = await db.execute(sql`
    insert into invoices (org_id, customer_id, job_id, title, notes, created_by)
    values (${orgId}::uuid, ${customerId}::uuid, ${jobId||null}, ${title}, ${notes||null}, ${userId})
    returning id
  `);
  
  const invoiceId = ins.rows[0].id;
  
  // Insert line items if provided
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    await db.execute(sql`
      insert into invoice_lines (org_id, invoice_id, position, description, quantity, unit_amount, tax_rate)
      values (${orgId}::uuid, ${invoiceId}::uuid, ${i}, ${l.description||""}, ${l.quantity||0}, ${l.unit_amount||0}, ${l.tax_rate||0})
    `);
  }
  
  // Compute and store totals if there are lines
  if (lines.length > 0) {
    const sums = sumLines(lines);
    await db.execute(sql`
      update invoices set
        sub_total=${sums.sub_total},
        tax_total=${sums.tax_total},
        grand_total=${sums.grand_total}
      where id=${invoiceId}::uuid and org_id=${orgId}::uuid
    `);
  }
  
  res.json({ ok: true, id: invoiceId });
});

/** Get (with items + totals) */
router.get("/:id", requireAuth, requireOrg, async (req, res) => {
  const { id } = req.params; const orgId = (req as any).orgId;
  if (!isUuid(id)) return res.status(400).json({ error: "invalid id" });

  const r: any = await db.execute(sql`
    select i.*, c.name as customer_name
    from invoices i join customers c on c.id=i.customer_id
    where i.id=${id}::uuid and i.org_id=${orgId}::uuid
  `);
  const inv = r.rows?.[0];
  if (!inv) return res.status(404).json({ error: "not found" });

  const lr: any = await db.execute(sql`
    select * from invoice_lines 
    where invoice_id=${id}::uuid and org_id=${orgId}::uuid 
    order by position asc, created_at asc
  `);
  
  res.json({ ...inv, lines: lr.rows });
});

/** Update header and lines with totals */
router.put("/:id", requireAuth, requireOrg, async (req, res) => {
  const { id } = req.params; const orgId = (req as any).orgId;
  if (!isUuid(id)) return res.status(400).json({ error: "invalid id" });
  const { title, customer_id, notes, lines = [] } = req.body || {};
  
  // Update header
  await db.execute(sql`
    update invoices set
      title=coalesce(${title}, title),
      customer_id=coalesce(${customer_id}::uuid, customer_id),
      notes=coalesce(${notes}, notes),
      updated_at=now()
    where id=${id}::uuid and org_id=${orgId}::uuid
  `);
  
  // Replace lines (simple path)
  await db.execute(sql`delete from invoice_lines where invoice_id=${id}::uuid and org_id=${orgId}::uuid`);
  
  // Insert new lines
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    await db.execute(sql`
      insert into invoice_lines (org_id, invoice_id, position, description, quantity, unit_amount, tax_rate)
      values (${orgId}::uuid, ${id}::uuid, ${i}, ${l.description||""}, ${l.quantity||0}, ${l.unit_amount||0}, ${l.tax_rate||0})
    `);
  }
  
  // Recompute and store totals
  const sums = sumLines(lines);
  await db.execute(sql`
    update invoices set
      sub_total=${sums.sub_total},
      tax_total=${sums.tax_total},
      grand_total=${sums.grand_total}
    where id=${id}::uuid and org_id=${orgId}::uuid
  `);
  
  res.json({ ok: true, totals: sums });
});

/** Items CRUD */
router.post("/:id/items", requireAuth, requireOrg, async (req, res) => {
  const { id } = req.params; const { description, quantity, unit_price } = req.body || {};
  if (!description) return res.status(400).json({ error: "description required" });
  const ins: any = await db.execute(sql`
    insert into invoice_items (invoice_id, description, quantity, unit_price)
    values (${id}::uuid, ${description}, ${quantity||1}, ${unit_price||0})
    returning id
  `);
  res.json({ ok: true, id: ins.rows[0].id });
});

router.put("/:id/items/:itemId", requireAuth, requireOrg, async (req, res) => {
  const { id, itemId } = req.params;
  const { description, quantity, unit_price } = req.body || {};
  await db.execute(sql`
    update invoice_items
      set description=coalesce(${description}, description),
          quantity=coalesce(${quantity}, quantity),
          unit_price=coalesce(${unit_price}, unit_price)
    where id=${itemId}::uuid and invoice_id=${id}::uuid
  `);
  res.json({ ok: true });
});

router.delete("/:id/items/:itemId", requireAuth, requireOrg, async (req, res) => {
  const { id, itemId } = req.params;
  await db.execute(sql`delete from invoice_items where id=${itemId}::uuid and invoice_id=${id}::uuid`);
  res.json({ ok: true });
});

/** Mark paid */
router.post("/:id/pay", requireAuth, requireOrg, async (req, res) => {
  const { id } = req.params;
  await db.execute(sql`update invoices set status='paid', updated_at=now() where id=${id}::uuid`);
  res.json({ ok: true });
});

/** Push to Xero */
router.post("/:id/xero", requireAuth, requireOrg, async (req, res) => {
  const { id } = req.params; 
  const orgId = (req as any).orgId;
  
  try {
    // Get invoice with customer details and items
    const r: any = await db.execute(sql`
      select i.*, c.name as customer_name, c.email as customer_email
      from invoices i join customers c on c.id=i.customer_id
      where i.id=${id}::uuid and i.org_id=${orgId}::uuid
    `);
    const invoice = r.rows?.[0];
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    // Get invoice items
    const items: any = await db.execute(sql`
      select * from invoice_items where invoice_id=${id}::uuid order by created_at nulls last, id
    `);

    // Check if already pushed to Xero
    if (invoice.xero_id) {
      return res.status(400).json({ error: "Invoice already exists in Xero", xeroId: invoice.xero_id });
    }

    // Push to Xero
    const xeroInvoice = await xeroService.createInvoiceInXero(orgId, {
      customerName: invoice.customer_name,
      customerEmail: invoice.customer_email,
      currency: invoice.currency || 'AUD',
      dueAt: invoice.due_at,
      items: items.rows.map((item: any) => ({
        name: item.description,
        description: item.description,
        price: item.unit_price,
        quantity: item.quantity
      }))
    });

    // Update invoice with Xero ID
    await db.execute(sql`
      update invoices 
      set xero_id=${xeroInvoice.invoiceID}, updated_at=now() 
      where id=${id}::uuid and org_id=${orgId}::uuid
    `);

    res.json({ 
      ok: true, 
      xeroId: xeroInvoice.invoiceID,
      xeroNumber: xeroInvoice.invoiceNumber,
      message: "Invoice successfully created in Xero"
    });

  } catch (error) {
    console.error('Error pushing invoice to Xero:', error);
    if (error instanceof Error && error.message.includes('not found or tokens expired')) {
      return res.status(401).json({ error: "Xero integration not connected. Please connect Xero in Settings." });
    }
    res.status(500).json({ error: "Failed to create invoice in Xero" });
  }
});

export default router;