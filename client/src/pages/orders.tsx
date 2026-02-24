import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Upload, ShoppingCart, FileSpreadsheet, TrendingUp, RefreshCw, Brain } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { OrderRecord, OrderForecast } from "@shared/schema";
import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Orders() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<string>("all");
  const [forecastSupplier, setForecastSupplier] = useState<string>("Overall");

  const { data: records, isLoading } = useQuery<OrderRecord[]>({
    queryKey: ["/api/orders"],
  });

  const { data: forecasts } = useQuery<OrderForecast[]>({
    queryKey: ["/api/forecasts"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload/orders", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      toast({
        title: "Orders uploaded",
        description: `${data.count} records from ${data.suppliers} suppliers imported`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const forecastMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/generate-forecast");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forecasts"] });
      toast({
        title: "Forecast generated",
        description: "12-month demand forecast has been created based on historical patterns",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Forecast failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (file: File) => {
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast({
        title: "Invalid file type",
        description: "Please upload an Excel (.xlsx, .xls) or CSV file",
        variant: "destructive",
      });
      return;
    }
    uploadMutation.mutate(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const suppliers = useMemo(() => {
    if (!records) return [];
    return [...new Set(records.map((r) => r.supplierName))].sort();
  }, [records]);

  const forecastSuppliers = useMemo(() => {
    if (!forecasts) return [];
    return [...new Set(forecasts.map((f) => f.supplierName))].sort((a, b) => {
      if (a === "Overall") return -1;
      if (b === "Overall") return 1;
      return a.localeCompare(b);
    });
  }, [forecasts]);

  const chartData = useMemo(() => {
    if (!records) return [];
    const filtered = selectedSupplier === "all"
      ? records
      : records.filter((r) => r.supplierName === selectedSupplier);

    const monthlyTotals: Record<string, number> = {};
    filtered.forEach((r) => {
      monthlyTotals[r.month] = (monthlyTotals[r.month] || 0) + r.orderCount;
    });

    return Object.entries(monthlyTotals)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-24)
      .map(([month, count]) => ({
        month: month.slice(2),
        orders: Math.round(count),
      }));
  }, [records, selectedSupplier]);

  const forecastChartData = useMemo(() => {
    if (!forecasts || !records) return [];

    const selectedForecasts = forecasts.filter((f) => f.supplierName === forecastSupplier);
    if (selectedForecasts.length === 0) return [];

    const historicalData: Record<string, number> = {};
    if (forecastSupplier === "Overall") {
      records.forEach((r) => {
        historicalData[r.month] = (historicalData[r.month] || 0) + r.orderCount;
      });
    } else {
      records
        .filter((r) => r.supplierName === forecastSupplier)
        .forEach((r) => {
          historicalData[r.month] = (historicalData[r.month] || 0) + r.orderCount;
        });
    }

    const historicalMonths = Object.keys(historicalData).sort();
    const trailingHistory = historicalMonths.slice(-12);

    const combined: { month: string; label: string; historical?: number; forecast?: number }[] = [];

    trailingHistory.forEach((month) => {
      combined.push({
        month,
        label: month.slice(2),
        historical: Math.round(historicalData[month]),
      });
    });

    const lastHistMonth = trailingHistory[trailingHistory.length - 1];
    const lastHistValue = lastHistMonth ? Math.round(historicalData[lastHistMonth]) : undefined;

    selectedForecasts
      .sort((a, b) => a.month.localeCompare(b.month))
      .forEach((f, i) => {
        combined.push({
          month: f.month,
          label: f.month.slice(2),
          forecast: Math.round(f.forecastedOrders),
          ...(i === 0 && lastHistValue !== undefined ? { historical: lastHistValue } : {}),
        });
      });

    return combined;
  }, [forecasts, records, forecastSupplier]);

  const forecastSummaryData = useMemo(() => {
    if (!forecasts) return [];
    const supplierTotals: Record<string, number> = {};
    forecasts.forEach((f) => {
      if (f.supplierName !== "Overall") {
        supplierTotals[f.supplierName] = (supplierTotals[f.supplierName] || 0) + f.forecastedOrders;
      }
    });
    return Object.entries(supplierTotals)
      .map(([supplier, total]) => ({ supplier, total: Math.round(total) }))
      .sort((a, b) => b.total - a.total);
  }, [forecasts]);

  const supplierSummary = useMemo(() => {
    if (!records) return [];
    const totals: Record<string, { total: number; months: Set<string> }> = {};
    records.forEach((r) => {
      if (!totals[r.supplierName]) totals[r.supplierName] = { total: 0, months: new Set() };
      totals[r.supplierName].total += r.orderCount;
      totals[r.supplierName].months.add(r.month);
    });

    return Object.entries(totals)
      .map(([supplier, data]) => ({
        supplier,
        totalOrders: Math.round(data.total),
        monthsCovered: data.months.size,
        avgMonthly: Math.round(data.total / data.months.size),
      }))
      .sort((a, b) => b.totalOrders - a.totalOrders);
  }, [records]);

  const hasOrders = records && records.length > 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-orders-title">Order History</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload order data to understand demand patterns and seasonality
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div
            className={`border-2 border-dashed rounded-md p-8 text-center transition-colors ${
              isDragging ? "border-primary bg-primary/5" : "border-border"
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            data-testid="dropzone-orders"
          >
            <FileSpreadsheet className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium text-sm">
              {uploadMutation.isPending ? "Processing..." : "Drop your orders spreadsheet here"}
            </p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Excel with supplier names, dates, and order counts
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
              data-testid="input-orders-file"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
              data-testid="button-browse-orders"
            >
              <Upload className="w-4 h-4 mr-2" />
              Browse Files
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      ) : hasOrders ? (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 flex-wrap">
              <CardTitle className="text-base">Order Trends</CardTitle>
              <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                <SelectTrigger className="w-48" data-testid="select-supplier-filter">
                  <SelectValue placeholder="All Suppliers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Suppliers</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "6px",
                        border: "1px solid hsl(var(--border))",
                        background: "hsl(var(--card))",
                        color: "hsl(var(--card-foreground))",
                      }}
                    />
                    <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No data for selected filter</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 flex-wrap space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  12-Month Demand Forecast
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  AI-generated forecast considering seasonality and historical trends
                </p>
              </div>
              <Button
                onClick={() => forecastMutation.mutate()}
                disabled={forecastMutation.isPending}
                data-testid="button-generate-forecast"
              >
                {forecastMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Brain className="w-4 h-4 mr-2" />
                )}
                {forecastMutation.isPending ? "Generating..." : "Generate Forecast"}
              </Button>
            </CardHeader>
            <CardContent>
              {forecastMutation.isPending && (
                <div className="space-y-4 py-4">
                  <div className="flex items-center gap-3">
                    <Brain className="w-5 h-5 text-primary animate-pulse" />
                    <span className="text-sm font-medium">Analyzing patterns and generating forecast...</span>
                  </div>
                  <Progress value={55} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    Examining seasonality, year-over-year trends, and demand patterns across all suppliers
                  </p>
                </div>
              )}

              {!forecastMutation.isPending && forecasts && forecasts.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Select value={forecastSupplier} onValueChange={setForecastSupplier}>
                      <SelectTrigger className="w-48" data-testid="select-forecast-supplier">
                        <SelectValue placeholder="Overall" />
                      </SelectTrigger>
                      <SelectContent>
                        {forecastSuppliers.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s === "Overall" ? "All Suppliers (Overall)" : s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {forecastChartData.length > 0 && (
                    <ResponsiveContainer width="100%" height={320}>
                      <ComposedChart data={forecastChartData}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "6px",
                            border: "1px solid hsl(var(--border))",
                            background: "hsl(var(--card))",
                            color: "hsl(var(--card-foreground))",
                          }}
                          formatter={(value: number, name: string) => [
                            value.toLocaleString(),
                            name === "historical" ? "Actual Orders" : "Forecasted Orders",
                          ]}
                        />
                        <Legend
                          formatter={(value: string) =>
                            value === "historical" ? "Actual Orders" : "Forecasted Orders"
                          }
                        />
                        <Bar dataKey="historical" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                        <Line
                          dataKey="forecast"
                          stroke="hsl(var(--chart-2))"
                          strokeWidth={2}
                          strokeDasharray="6 3"
                          dot={{ r: 4, fill: "hsl(var(--chart-2))" }}
                          connectNulls={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              ) : !forecastMutation.isPending ? (
                <div className="py-8 text-center">
                  <TrendingUp className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Click "Generate Forecast" to create a 12-month demand prediction based on your order history
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {forecasts && forecasts.length > 0 && forecastSummaryData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Forecast Summary by Supplier (Next 12 Months)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Supplier</TableHead>
                        <TableHead className="text-right">Forecasted Total</TableHead>
                        <TableHead className="text-right">Avg/Month</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {forecastSummaryData.map((row) => (
                        <TableRow key={row.supplier} data-testid={`row-forecast-${row.supplier}`}>
                          <TableCell className="font-medium">{row.supplier}</TableCell>
                          <TableCell className="text-right">{row.total.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{Math.round(row.total / 12).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Supplier Summary ({supplierSummary.length} suppliers)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead>
                      <TableHead className="text-right">Total Orders</TableHead>
                      <TableHead className="text-right">Months</TableHead>
                      <TableHead className="text-right">Avg/Month</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supplierSummary.slice(0, 30).map((row) => (
                      <TableRow key={row.supplier} data-testid={`row-supplier-${row.supplier}`}>
                        <TableCell className="font-medium">{row.supplier}</TableCell>
                        <TableCell className="text-right">{row.totalOrders.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{row.monthsCovered}</TableCell>
                        <TableCell className="text-right">{row.avgMonthly.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <ShoppingCart className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No order data yet. Upload your marketplace orders spreadsheet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
