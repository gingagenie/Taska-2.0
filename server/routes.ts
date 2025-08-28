import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import cors from "cors";
import { health } from "./routes/health";
import customers from "./routes/customers";
import equipment from "./routes/equipment";
import { teams } from "./routes/teams";
import jobs from "./routes/jobs";
import quotes from "./routes/quotes";
import invoices from "./routes/invoices";
import { schedule } from "./routes/schedule";
import { members } from "./routes/members";
import { jobSms } from "./routes/job-sms";
import { twilioWebhooks } from "./routes/twilio-webhooks";
import xero from "./routes/xero";
import { itemPresets } from "./routes/item-presets";
import tzRouter from "./routes/_tz";
import objectsRouter from "./routes/objects";

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));
  
  app.use("/health", health);
  app.use("/api/customers", customers);
  console.log("[mount] /api/customers");
  app.use("/api/equipment", equipment);
  console.log("[mount] /api/equipment");
  app.use("/api/teams", teams);
  app.use("/api/jobs", jobs);
  app.use("/api/jobs", jobSms);
  app.use("/api/twilio", twilioWebhooks);
  console.log("[mount] /api/twilio");
  console.log("[mount] /api/jobs");
  app.use("/api/schedule", schedule);
  console.log("[mount] /api/schedule");
  app.use("/api/members", members);
  console.log("[mount] /api/members");
  app.use("/api/quotes", quotes);
  app.use("/api/invoices", invoices);
  app.use("/api/xero", xero);
  app.use("/api/item-presets", itemPresets);
  console.log("[mount] /api/xero");
  console.log("[mount] /api/item-presets");
  
  app.use("/api/_tz", tzRouter);
  console.log("[mount] /api/_tz");
  app.use("/api/objects", objectsRouter);
  console.log("[mount] /api/objects");
  
  // Data export tool
  app.get("/export-local-data.html", (_req, res) => {
    res.sendFile("export-local-data.html", { root: process.cwd() });
  });
  
  app.get("/api", (_req, res) => res.json({ ok: true, name: "Taska 2.0 API" }));

  const httpServer = createServer(app);
  return httpServer;
}
