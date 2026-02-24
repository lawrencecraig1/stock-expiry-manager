import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import * as XLSX from "xlsx";
import OpenAI from "openai";

const upload = multer({ storage: multer.memoryStorage() });

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/inventory", async (_req, res) => {
    const items = await storage.getInventoryItems();
    res.json(items);
  });

  app.get("/api/orders", async (_req, res) => {
    const records = await storage.getOrderRecords();
    res.json(records);
  });

  app.get("/api/risk-analyses", async (_req, res) => {
    const analyses = await storage.getRiskAnalyses();
    res.json(analyses);
  });

  app.get("/api/analysis-report", async (_req, res) => {
    const report = await storage.getLatestReport();
    res.json(report);
  });

  app.get("/api/dashboard-stats", async (_req, res) => {
    const inventory = await storage.getInventoryItems();
    const orders = await storage.getOrderRecords();
    const analyses = await storage.getRiskAnalyses();

    const totalCodes = inventory.reduce((sum, i) => sum + i.codeCount, 0);
    const totalValue = inventory.reduce((sum, i) => sum + i.totalValue, 0);
    const uniqueSuppliers = new Set(inventory.map(i => i.supplierName)).size;
    const highRisk = analyses.filter(a => a.riskLevel === "high").length;
    const mediumRisk = analyses.filter(a => a.riskLevel === "medium").length;

    res.json({
      totalCodes,
      totalValue,
      uniqueSuppliers,
      highRisk,
      mediumRisk,
      totalOrders: orders.length,
      hasInventory: inventory.length > 0,
      hasOrders: orders.length > 0,
      hasAnalysis: analyses.length > 0,
    });
  });

  app.post("/api/upload/inventory", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      const headerRow = rows.findIndex((row: any[]) =>
        row.some((cell: any) => typeof cell === "string" && cell.toLowerCase().includes("supplier"))
      );

      if (headerRow === -1) {
        return res.status(400).json({ error: "Could not find header row with 'Supplier' column" });
      }

      const headers = rows[headerRow].map((h: any) => String(h).toLowerCase().trim());
      const supplierIdx = headers.findIndex((h: string) => h.includes("supplier"));
      const expiryIdx = headers.findIndex((h: string) => h.includes("expir") || h.includes("date"));
      const codeIdx = headers.findIndex((h: string) => h.includes("code") || h.includes("quantity") || h.includes("count"));
      const valueIdx = headers.findIndex((h: string) => h.includes("value") || h.includes("price") || h.includes("amount"));

      if (supplierIdx === -1 || expiryIdx === -1) {
        return res.status(400).json({ error: "Could not find required columns (Supplier Name, Expiration Date)" });
      }

      await storage.clearInventory();

      const items = [];
      for (let i = headerRow + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[supplierIdx]) continue;

        let expiryDateStr = row[expiryIdx];
        if (typeof expiryDateStr === "number") {
          const date = XLSX.SSF.parse_date_code(expiryDateStr);
          expiryDateStr = `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
        } else {
          expiryDateStr = String(expiryDateStr);
        }

        items.push({
          supplierName: String(row[supplierIdx]).trim(),
          expirationDate: expiryDateStr,
          codeCount: codeIdx !== -1 ? Number(row[codeIdx]) || 0 : 0,
          totalValue: valueIdx !== -1 ? Number(row[valueIdx]) || 0 : 0,
        });
      }

      const inserted = await storage.insertInventoryItems(items);
      res.json({ count: inserted.length, items: inserted });
    } catch (error: any) {
      console.error("Error processing inventory upload:", error);
      res.status(500).json({ error: error.message || "Failed to process file" });
    }
  });

  app.post("/api/upload/orders", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      
      let sheet;
      const ordersSheet = workbook.SheetNames.find(n => n.toLowerCase().includes("order"));
      const quicksightSheet = workbook.SheetNames.find(n => n.toLowerCase().includes("quicksight"));
      const dataSheet = workbook.SheetNames.find(n => n.toLowerCase() === "data");
      
      if (quicksightSheet) {
        sheet = workbook.Sheets[quicksightSheet];
      } else if (ordersSheet) {
        sheet = workbook.Sheets[ordersSheet];
      } else if (dataSheet) {
        sheet = workbook.Sheets[dataSheet];
      } else {
        sheet = workbook.Sheets[workbook.SheetNames[0]];
      }

      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      const headerRow = rows.findIndex((row: any[]) =>
        row.some((cell: any) => typeof cell === "string" && (
          cell.toLowerCase().includes("supplier") ||
          cell.toLowerCase().includes("provider") ||
          cell.toLowerCase().includes("partner")
        ))
      );

      if (headerRow === -1) {
        return res.status(400).json({ error: "Could not find header row with supplier/provider column" });
      }

      const headers = rows[headerRow].map((h: any) => String(h || "").toLowerCase().trim());
      
      let supplierIdx = headers.findIndex((h: string) => h.includes("supplier - short") || h === "supplier short");
      if (supplierIdx === -1) {
        supplierIdx = headers.findIndex((h: string) => h.includes("supplier") || h.includes("provider") || h.includes("partner"));
      }

      const dateIdx = headers.findIndex((h: string) => h.includes("paid") || h.includes("date") || h.includes("month") || h.includes("period"));
      const ordersIdx = headers.findIndex((h: string) => h.includes("order") && !h.includes("actual"));
      
      if (supplierIdx === -1) {
        return res.status(400).json({ error: "Could not find supplier column" });
      }

      await storage.clearOrders();

      const monthlyData: Record<string, Record<string, number>> = {};

      for (let i = headerRow + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[supplierIdx]) continue;

        const supplier = String(row[supplierIdx]).trim();
        let month = "";

        if (dateIdx !== -1 && row[dateIdx]) {
          const dateVal = row[dateIdx];
          if (typeof dateVal === "number") {
            const d = XLSX.SSF.parse_date_code(dateVal);
            month = `${d.y}-${String(d.m).padStart(2, "0")}`;
          } else {
            const parsed = new Date(String(dateVal));
            if (!isNaN(parsed.getTime())) {
              month = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
            }
          }
        }

        if (!month) continue;

        const orderCount = ordersIdx !== -1 ? Number(row[ordersIdx]) || 0 : 1;

        if (!monthlyData[supplier]) monthlyData[supplier] = {};
        if (!monthlyData[supplier][month]) monthlyData[supplier][month] = 0;
        monthlyData[supplier][month] += orderCount;
      }

      const records = [];
      for (const [supplier, months] of Object.entries(monthlyData)) {
        for (const [month, count] of Object.entries(months)) {
          records.push({
            supplierName: supplier,
            month,
            orderCount: count,
          });
        }
      }

      const inserted = await storage.insertOrderRecords(records);
      res.json({ count: inserted.length, suppliers: Object.keys(monthlyData).length });
    } catch (error: any) {
      console.error("Error processing orders upload:", error);
      res.status(500).json({ error: error.message || "Failed to process file" });
    }
  });

  app.post("/api/analyze-risk", async (_req, res) => {
    try {
      const inventory = await storage.getInventoryItems();
      const orders = await storage.getOrderRecords();

      if (inventory.length === 0) {
        return res.status(400).json({ error: "No inventory data found. Please upload inventory first." });
      }

      const ordersBySupplier: Record<string, Record<string, number>> = {};
      for (const order of orders) {
        if (!ordersBySupplier[order.supplierName]) ordersBySupplier[order.supplierName] = {};
        ordersBySupplier[order.supplierName][order.month] = order.orderCount;
      }

      const inventoryBySupplier: Record<string, { codes: number; value: number; expiry: string }[]> = {};
      for (const item of inventory) {
        if (!inventoryBySupplier[item.supplierName]) inventoryBySupplier[item.supplierName] = [];
        inventoryBySupplier[item.supplierName].push({
          codes: item.codeCount,
          value: item.totalValue,
          expiry: item.expirationDate,
        });
      }

      const supplierSummaries = Object.entries(inventoryBySupplier).map(([supplier, batches]) => {
        const orderHistory = ordersBySupplier[supplier] || {};
        const months = Object.keys(orderHistory).sort();
        const orderValues = months.map(m => orderHistory[m]);
        const totalOrders = orderValues.reduce((s, v) => s + v, 0);
        const avgMonthly = months.length > 0 ? totalOrders / months.length : 0;

        const matchedHistory: Record<string, number> = {};
        for (const [sup, hist] of Object.entries(ordersBySupplier)) {
          if (sup.toLowerCase().includes(supplier.toLowerCase()) || supplier.toLowerCase().includes(sup.toLowerCase())) {
            for (const [m, c] of Object.entries(hist)) {
              matchedHistory[m] = (matchedHistory[m] || 0) + c;
            }
          }
        }
        const matchedMonths = Object.keys(matchedHistory).sort();
        const matchedValues = matchedMonths.map(m => matchedHistory[m]);
        const matchedTotal = matchedValues.reduce((s, v) => s + v, 0);
        const matchedAvg = matchedMonths.length > 0 ? matchedTotal / matchedMonths.length : 0;

        const effectiveAvg = avgMonthly > 0 ? avgMonthly : matchedAvg;

        return {
          supplier,
          batches,
          monthlyHistory: months.length > 0 ? orderHistory : matchedHistory,
          avgMonthlyOrders: effectiveAvg,
          totalHistoricalOrders: totalOrders > 0 ? totalOrders : matchedTotal,
          matchedSupplier: avgMonthly === 0 && matchedAvg > 0,
        };
      });

      const prompt = `You are a supply chain analyst for Learnerbly, an L&D marketplace that sells access codes for learning platforms. Analyze the following inventory and order history data to assess expiry risk.

For each supplier, determine:
1. The risk level (high, medium, or low)
2. Whether current stock will be sold before expiry based on historical order patterns
3. A clear summary explaining the risk assessment

Today's date is ${new Date().toISOString().split("T")[0]}.

INVENTORY AND ORDER DATA:
${JSON.stringify(supplierSummaries, null, 2)}

Respond with a JSON array of objects, one per supplier batch (a supplier may have multiple expiry dates). Each object must have these exact fields:
- supplierName (string)
- riskLevel ("high", "medium", or "low")
- summary (string, 2-3 sentences explaining the risk)
- expiryDate (string, the expiry date)
- codesAtRisk (number, codes that may expire unsold)
- valueAtRisk (number, monetary value at risk)
- monthlyAvgOrders (number, average monthly order rate)
- monthsUntilExpiry (number, months from today to expiry)
- forecastedDemand (number, projected total orders until expiry)

Consider seasonality patterns when relevant. Be specific about numbers and dates. If order history is limited, note that as additional uncertainty.

Respond ONLY with valid JSON array, no markdown formatting.`;

      const response = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: [{ role: "user", content: prompt }],
        max_completion_tokens: 4096,
      });

      const content = response.choices[0]?.message?.content || "[]";
      let analyses;
      try {
        const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        analyses = JSON.parse(cleaned);
      } catch {
        return res.status(500).json({ error: "Failed to parse AI response" });
      }

      await storage.clearRiskAnalyses();
      const inserted = await storage.insertRiskAnalyses(analyses);

      const reportPrompt = `You are a supply chain analyst for Learnerbly, an L&D marketplace. Based on the following risk analysis results, write a clear, concise stock level report.

Today's date is ${new Date().toISOString().split("T")[0]}.

ANALYSIS RESULTS:
${JSON.stringify(inserted, null, 2)}

ORIGINAL INVENTORY AND ORDER DATA:
${JSON.stringify(supplierSummaries, null, 2)}

Write a report in plain text (no markdown headers, no bullet points with #) that covers:

1. STOCK OVERVIEW: Start with a brief paragraph summarising total stock levels across all suppliers - how many codes are held, total value, and how many suppliers are tracked.

2. KEY RISKS: For each supplier flagged as high or medium risk, write a short paragraph explaining:
   - Their current stock level and expiry date
   - Why they are at risk (low demand vs stock, approaching expiry, etc.)
   - What the projected shortfall or surplus looks like
   - A recommended action (e.g. discount, bundle, promote, write off)

3. HEALTHY STOCK: Briefly mention suppliers at low risk and why they're on track.

4. OVERALL RECOMMENDATION: End with 2-3 sentences of strategic advice for the team.

Keep the tone professional but accessible. Use specific numbers and dates throughout. Write approximately 400-600 words. Do NOT use markdown formatting - use plain text with line breaks between sections.`;

      const reportResponse = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: [{ role: "user", content: reportPrompt }],
        max_completion_tokens: 2048,
      });

      const reportContent = reportResponse.choices[0]?.message?.content?.trim() || "";
      await storage.clearReports();
      if (reportContent.length > 0) {
        await storage.saveReport(reportContent);
      }

      res.json(inserted);
    } catch (error: any) {
      console.error("Error analyzing risk:", error);
      res.status(500).json({ error: error.message || "Failed to analyze risk" });
    }
  });

  app.get("/api/restock-timeline", async (_req, res) => {
    const inventory = await storage.getInventoryItems();
    const orders = await storage.getOrderRecords();

    const ordersBySupplier: Record<string, { total: number; months: number }> = {};
    for (const order of orders) {
      if (!ordersBySupplier[order.supplierName]) {
        ordersBySupplier[order.supplierName] = { total: 0, months: 0 };
      }
      ordersBySupplier[order.supplierName].total += order.orderCount;
    }
    for (const supplier of Object.keys(ordersBySupplier)) {
      const months = new Set(orders.filter(o => o.supplierName === supplier).map(o => o.month));
      ordersBySupplier[supplier].months = months.size;
    }

    const now = new Date();
    const timeline = inventory
      .filter(item => new Date(item.expirationDate) > now)
      .map(item => {
        const expiryDate = new Date(item.expirationDate);
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        const demandData = ordersBySupplier[item.supplierName];
        const monthlyAvg = demandData && demandData.months > 0 ? demandData.total / demandData.months : 0;
        const dailyAvg = monthlyAvg / 30;

        let stockoutDays: number | null = null;
        let stockoutDate: string | null = null;
        if (dailyAvg > 0) {
          stockoutDays = Math.ceil(item.codeCount / dailyAvg);
          const sDate = new Date(now.getTime() + stockoutDays * 24 * 60 * 60 * 1000);
          stockoutDate = sDate.toISOString().split("T")[0];
        }

        const actionDate = stockoutDays !== null && stockoutDays < daysUntilExpiry
          ? stockoutDate!
          : item.expirationDate;
        const actionDays = stockoutDays !== null && stockoutDays < daysUntilExpiry
          ? stockoutDays
          : daysUntilExpiry;
        const reason: "stockout" | "expiry" = stockoutDays !== null && stockoutDays < daysUntilExpiry
          ? "stockout"
          : "expiry";

        let urgency: "critical" | "warning" | "ok" = "ok";
        if (actionDays <= 30) urgency = "critical";
        else if (actionDays <= 90) urgency = "warning";

        return {
          id: item.id,
          supplierName: item.supplierName,
          codeCount: item.codeCount,
          totalValue: item.totalValue,
          expirationDate: item.expirationDate,
          stockoutDate,
          actionDate,
          actionDays,
          reason,
          urgency,
          monthlyDemand: Math.round(monthlyAvg),
        };
      })
      .sort((a, b) => a.actionDays - b.actionDays);

    res.json(timeline);
  });

  app.get("/api/forecasts", async (_req, res) => {
    const forecasts = await storage.getForecasts();
    res.json(forecasts);
  });

  app.post("/api/generate-forecast", async (_req, res) => {
    try {
      const orders = await storage.getOrderRecords();

      if (orders.length === 0) {
        return res.status(400).json({ error: "No order data found. Please upload order history first." });
      }

      const ordersBySupplier: Record<string, Record<string, number>> = {};
      for (const order of orders) {
        if (!ordersBySupplier[order.supplierName]) ordersBySupplier[order.supplierName] = {};
        ordersBySupplier[order.supplierName][order.month] = order.orderCount;
      }

      const supplierSummaries = Object.entries(ordersBySupplier).map(([supplier, months]) => {
        const sortedMonths = Object.entries(months).sort(([a], [b]) => a.localeCompare(b));
        const compactData = sortedMonths.map(([m, c]) => `${m}:${Math.round(c)}`).join(",");
        const total = sortedMonths.reduce((s, [, c]) => s + c, 0);
        const avg = Math.round(total / sortedMonths.length);
        return `${supplier} (${sortedMonths.length}mo, avg=${avg}): ${compactData}`;
      });

      const now = new Date();
      const forecastMonths: string[] = [];
      for (let i = 1; i <= 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        forecastMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      }

      const suppliers = Object.keys(ordersBySupplier);

      const prompt = `Forecast demand for the next 12 months per supplier for Learnerbly (L&D marketplace).

Date: ${now.toISOString().split("T")[0]}
Forecast months: ${forecastMonths.join(", ")}
Suppliers: ${suppliers.join(", ")}

Historical monthly orders (format month:count):
${supplierSummaries.join("\n")}

Rules:
- Apply seasonality (Nov/Dec spikes, summer dips)
- Consider year-over-year trends
- Return JSON array with objects: {"supplierName":"...","month":"YYYY-MM","forecastedOrders":N}
- 12 entries per supplier + 12 "Overall" entries (sum of all suppliers per month)
- Use exact supplier names from the data
- Return ONLY valid JSON, no markdown`;

      const response = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: [
          { role: "system", content: "You are a demand forecasting analyst. Respond only with valid JSON arrays." },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 8192,
      });

      const content = response.choices[0]?.message?.content || "";
      console.log("Forecast AI response length:", content.length, "chars");

      if (!content.trim()) {
        console.error("Forecast AI returned empty content. Finish reason:", response.choices[0]?.finish_reason);
        return res.status(500).json({ error: "AI returned no response. Please try again." });
      }

      let forecasts;
      try {
        const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        forecasts = JSON.parse(cleaned);
      } catch (parseErr) {
        console.error("Failed to parse forecast JSON:", content.slice(0, 500));
        return res.status(500).json({ error: "Failed to parse AI forecast response. Please try again." });
      }

      if (!Array.isArray(forecasts) || forecasts.length === 0) {
        return res.status(500).json({ error: "AI returned empty forecast data. Please try again." });
      }

      const validForecasts = forecasts
        .filter((f: any) => f.supplierName && f.month && typeof f.forecastedOrders === "number")
        .map((f: any) => ({
          supplierName: String(f.supplierName),
          month: String(f.month),
          forecastedOrders: Math.round(Number(f.forecastedOrders)),
        }));

      if (validForecasts.length === 0) {
        return res.status(500).json({ error: "AI forecast response contained no valid entries" });
      }

      await storage.clearForecasts();
      const inserted = await storage.insertForecasts(validForecasts);
      res.json(inserted);
    } catch (error: any) {
      console.error("Error generating forecast:", error);
      res.status(500).json({ error: error.message || "Failed to generate forecast" });
    }
  });

  return httpServer;
}
