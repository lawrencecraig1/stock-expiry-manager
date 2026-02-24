import { db } from "./db";
import { inventoryItems, orderRecords, riskAnalyses, analysisReports, orderForecasts } from "@shared/schema";
import type { InventoryItem, InsertInventoryItem, OrderRecord, InsertOrderRecord, RiskAnalysis, InsertRiskAnalysis, AnalysisReport, OrderForecast, InsertOrderForecast } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getInventoryItems(): Promise<InventoryItem[]>;
  insertInventoryItems(items: InsertInventoryItem[]): Promise<InventoryItem[]>;
  clearInventory(): Promise<void>;
  getOrderRecords(): Promise<OrderRecord[]>;
  insertOrderRecords(records: InsertOrderRecord[]): Promise<OrderRecord[]>;
  clearOrders(): Promise<void>;
  getRiskAnalyses(): Promise<RiskAnalysis[]>;
  insertRiskAnalyses(analyses: InsertRiskAnalysis[]): Promise<RiskAnalysis[]>;
  clearRiskAnalyses(): Promise<void>;
  getInventoryCount(): Promise<number>;
  getOrderCount(): Promise<number>;
  getLatestReport(): Promise<AnalysisReport | null>;
  saveReport(content: string): Promise<AnalysisReport>;
  clearReports(): Promise<void>;
  getForecasts(): Promise<OrderForecast[]>;
  insertForecasts(forecasts: InsertOrderForecast[]): Promise<OrderForecast[]>;
  clearForecasts(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getInventoryItems(): Promise<InventoryItem[]> {
    return db.select().from(inventoryItems);
  }

  async insertInventoryItems(items: InsertInventoryItem[]): Promise<InventoryItem[]> {
    if (items.length === 0) return [];
    return db.insert(inventoryItems).values(items).returning();
  }

  async clearInventory(): Promise<void> {
    await db.delete(inventoryItems);
  }

  async getOrderRecords(): Promise<OrderRecord[]> {
    return db.select().from(orderRecords);
  }

  async insertOrderRecords(records: InsertOrderRecord[]): Promise<OrderRecord[]> {
    if (records.length === 0) return [];
    return db.insert(orderRecords).values(records).returning();
  }

  async clearOrders(): Promise<void> {
    await db.delete(orderRecords);
  }

  async getRiskAnalyses(): Promise<RiskAnalysis[]> {
    return db.select().from(riskAnalyses).orderBy(desc(riskAnalyses.analysisDate));
  }

  async insertRiskAnalyses(analyses: InsertRiskAnalysis[]): Promise<RiskAnalysis[]> {
    if (analyses.length === 0) return [];
    return db.insert(riskAnalyses).values(analyses).returning();
  }

  async clearRiskAnalyses(): Promise<void> {
    await db.delete(riskAnalyses);
  }

  async getInventoryCount(): Promise<number> {
    const items = await db.select().from(inventoryItems);
    return items.length;
  }

  async getOrderCount(): Promise<number> {
    const records = await db.select().from(orderRecords);
    return records.length;
  }

  async getLatestReport(): Promise<AnalysisReport | null> {
    const results = await db.select().from(analysisReports).orderBy(desc(analysisReports.createdAt)).limit(1);
    return results[0] || null;
  }

  async saveReport(content: string): Promise<AnalysisReport> {
    const [report] = await db.insert(analysisReports).values({ content }).returning();
    return report;
  }

  async clearReports(): Promise<void> {
    await db.delete(analysisReports);
  }

  async getForecasts(): Promise<OrderForecast[]> {
    return db.select().from(orderForecasts);
  }

  async insertForecasts(forecasts: InsertOrderForecast[]): Promise<OrderForecast[]> {
    if (forecasts.length === 0) return [];
    return db.insert(orderForecasts).values(forecasts).returning();
  }

  async clearForecasts(): Promise<void> {
    await db.delete(orderForecasts);
  }
}

export const storage = new DatabaseStorage();
