import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, serial, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const inventoryItems = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  supplierName: text("supplier_name").notNull(),
  expirationDate: text("expiration_date").notNull(),
  codeCount: integer("code_count").notNull(),
  totalValue: real("total_value").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const orderRecords = pgTable("order_records", {
  id: serial("id").primaryKey(),
  supplierName: text("supplier_name").notNull(),
  month: text("month").notNull(),
  orderCount: real("order_count").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const riskAnalyses = pgTable("risk_analyses", {
  id: serial("id").primaryKey(),
  supplierName: text("supplier_name").notNull(),
  riskLevel: text("risk_level").notNull(),
  summary: text("summary").notNull(),
  expiryDate: text("expiry_date").notNull(),
  codesAtRisk: integer("codes_at_risk").notNull(),
  valueAtRisk: real("value_at_risk").notNull(),
  monthlyAvgOrders: real("monthly_avg_orders").notNull(),
  monthsUntilExpiry: real("months_until_expiry").notNull(),
  forecastedDemand: real("forecasted_demand").notNull(),
  analysisDate: timestamp("analysis_date").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const analysisReports = pgTable("analysis_reports", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const orderForecasts = pgTable("order_forecasts", {
  id: serial("id").primaryKey(),
  supplierName: text("supplier_name").notNull(),
  month: text("month").notNull(),
  forecastedOrders: real("forecasted_orders").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertInventoryItemSchema = createInsertSchema(inventoryItems).omit({
  id: true,
  createdAt: true,
});

export const insertOrderRecordSchema = createInsertSchema(orderRecords).omit({
  id: true,
  createdAt: true,
});

export const insertRiskAnalysisSchema = createInsertSchema(riskAnalyses).omit({
  id: true,
  analysisDate: true,
});

export const insertAnalysisReportSchema = createInsertSchema(analysisReports).omit({
  id: true,
  createdAt: true,
});

export const insertOrderForecastSchema = createInsertSchema(orderForecasts).omit({
  id: true,
  createdAt: true,
});

export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type OrderRecord = typeof orderRecords.$inferSelect;
export type InsertOrderRecord = z.infer<typeof insertOrderRecordSchema>;
export type RiskAnalysis = typeof riskAnalyses.$inferSelect;
export type InsertRiskAnalysis = z.infer<typeof insertRiskAnalysisSchema>;
export type AnalysisReport = typeof analysisReports.$inferSelect;
export type InsertAnalysisReport = z.infer<typeof insertAnalysisReportSchema>;
export type OrderForecast = typeof orderForecasts.$inferSelect;
export type InsertOrderForecast = z.infer<typeof insertOrderForecastSchema>;
