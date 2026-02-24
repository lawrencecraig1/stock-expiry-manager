import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Package, AlertTriangle, DollarSign, Clock, RefreshCw } from "lucide-react";
import type { RiskAnalysis } from "@shared/schema";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

interface DashboardStats {
  totalCodes: number;
  totalValue: number;
  uniqueSuppliers: number;
  highRisk: number;
  mediumRisk: number;
  totalOrders: number;
  hasInventory: boolean;
  hasOrders: boolean;
  hasAnalysis: boolean;
}

interface RestockItem {
  id: number;
  supplierName: string;
  codeCount: number;
  totalValue: number;
  expirationDate: string;
  stockoutDate: string | null;
  actionDate: string;
  actionDays: number;
  reason: "stockout" | "expiry";
  urgency: "critical" | "warning" | "ok";
  monthlyDemand: number;
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard-stats"],
  });

  const { data: analyses } = useQuery<RiskAnalysis[]>({
    queryKey: ["/api/risk-analyses"],
  });

  const { data: timeline } = useQuery<RestockItem[]>({
    queryKey: ["/api/restock-timeline"],
  });

  const hasData = stats?.hasInventory || stats?.hasOrders;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-dashboard-title">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Overview of your stock expiry status and risk analysis
        </p>
      </div>

      {!hasData && !statsLoading && (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <Package className="w-12 h-12 mx-auto text-muted-foreground" />
            <div>
              <h3 className="font-semibold text-lg">Get started</h3>
              <p className="text-muted-foreground text-sm mt-1 max-w-md mx-auto">
                Upload your inventory codes and order history to see risk analysis and forecasts
              </p>
            </div>
            <div className="flex gap-3 justify-center flex-wrap">
              <Link href="/inventory">
                <Button data-testid="button-upload-inventory">Upload Inventory</Button>
              </Link>
              <Link href="/orders">
                <Button variant="outline" data-testid="button-upload-orders">Upload Orders</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card data-testid="card-total-codes">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Codes</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalCodes?.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground">{stats?.uniqueSuppliers || 0} suppliers</p>
              </CardContent>
            </Card>

            <Card data-testid="card-total-value">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Stock Value</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats?.totalValue ? `£${stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "£0.00"}
                </div>
                <p className="text-xs text-muted-foreground">Total inventory value</p>
              </CardContent>
            </Card>

            <Card data-testid="card-high-risk">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">High Risk</CardTitle>
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{stats?.highRisk || 0}</div>
                <p className="text-xs text-muted-foreground">Items at high expiry risk</p>
              </CardContent>
            </Card>

            <Card data-testid="card-medium-risk">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Medium Risk</CardTitle>
                <Clock className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{stats?.mediumRisk || 0}</div>
                <p className="text-xs text-muted-foreground">Items to monitor</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {timeline && timeline.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-semibold" data-testid="text-restock-timeline">Restock / Renewal Timeline</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                When each supplier needs attention -- either stock runs out or codes expire
              </p>
            </div>
            <Link href="/inventory">
              <Button variant="outline" size="sm" data-testid="button-view-inventory">
                View Inventory
              </Button>
            </Link>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Action Needed</TableHead>
                      <TableHead className="text-right">Days Left</TableHead>
                      <TableHead className="text-right">Codes Left</TableHead>
                      <TableHead className="text-right">Monthly Demand</TableHead>
                      <TableHead>Stockout Date</TableHead>
                      <TableHead>Expiry Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timeline.map((item) => (
                      <TableRow key={item.id} data-testid={`row-restock-${item.id}`}>
                        <TableCell className="font-medium">{item.supplierName}</TableCell>
                        <TableCell>
                          <UrgencyBadge urgency={item.urgency} reason={item.reason} />
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={
                            item.urgency === "critical" ? "font-semibold text-destructive" :
                            item.urgency === "warning" ? "font-semibold text-yellow-600 dark:text-yellow-400" :
                            "text-muted-foreground"
                          }>
                            {item.actionDays}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{item.codeCount}</TableCell>
                        <TableCell className="text-right">
                          {item.monthlyDemand > 0 ? `~${item.monthlyDemand}` : "--"}
                        </TableCell>
                        <TableCell>
                          {item.stockoutDate ? (
                            <span className={item.reason === "stockout" ? "font-medium" : "text-muted-foreground"}>
                              {item.stockoutDate}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">--</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={item.reason === "expiry" ? "font-medium" : "text-muted-foreground"}>
                            {item.expirationDate}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {analyses && analyses.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-semibold" data-testid="text-risk-overview">Risk Overview</h2>
            <Link href="/analysis">
              <Button variant="outline" size="sm" data-testid="button-view-analysis">
                View Full Analysis
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {analyses.slice(0, 6).map((analysis) => (
              <Card key={analysis.id} data-testid={`card-risk-${analysis.id}`}>
                <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                  <div className="space-y-1 min-w-0">
                    <CardTitle className="text-sm font-medium truncate">{analysis.supplierName}</CardTitle>
                    <p className="text-xs text-muted-foreground">Expires: {analysis.expiryDate}</p>
                  </div>
                  <RiskBadge level={analysis.riskLevel} />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{analysis.summary}</p>
                  <div className="mt-3 flex items-center gap-4 flex-wrap text-xs">
                    <span className="text-muted-foreground">
                      <strong className="text-foreground">{analysis.codesAtRisk}</strong> codes at risk
                    </span>
                    <span className="text-muted-foreground">
                      <strong className="text-foreground">£{analysis.valueAtRisk?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> value
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UrgencyBadge({ urgency, reason }: { urgency: string; reason: string }) {
  const label = reason === "stockout" ? "Restock" : "Renew";
  if (urgency === "critical") {
    return (
      <Badge variant="destructive" data-testid="badge-urgency-critical">
        <RefreshCw className="w-3 h-3 mr-1" />
        {label} Soon
      </Badge>
    );
  }
  if (urgency === "warning") {
    return (
      <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" data-testid="badge-urgency-warning">
        <Clock className="w-3 h-3 mr-1" />
        {label} Upcoming
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" data-testid="badge-urgency-ok">
      {label} Later
    </Badge>
  );
}

function RiskBadge({ level }: { level: string }) {
  if (level === "high") {
    return <Badge variant="destructive" data-testid="badge-risk-high">High Risk</Badge>;
  }
  if (level === "medium") {
    return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" data-testid="badge-risk-medium">Medium</Badge>;
  }
  return <Badge variant="secondary" data-testid="badge-risk-low">Low Risk</Badge>;
}
