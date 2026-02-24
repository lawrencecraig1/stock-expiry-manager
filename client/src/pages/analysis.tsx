import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Brain, AlertTriangle, ShieldCheck, Clock, RefreshCw, TrendingDown, Package, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { RiskAnalysis, AnalysisReport } from "@shared/schema";

export default function Analysis() {
  const { toast } = useToast();

  const { data: analyses, isLoading } = useQuery<RiskAnalysis[]>({
    queryKey: ["/api/risk-analyses"],
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/dashboard-stats"],
  });

  const { data: report } = useQuery<AnalysisReport | null>({
    queryKey: ["/api/analysis-report"],
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/analyze-risk");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/risk-analyses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analysis-report"] });
      toast({
        title: "Analysis complete",
        description: "Risk assessment has been updated with AI insights",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Analysis failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const canAnalyze = stats?.hasInventory;

  const highRisk = analyses?.filter((a) => a.riskLevel === "high") || [];
  const mediumRisk = analyses?.filter((a) => a.riskLevel === "medium") || [];
  const lowRisk = analyses?.filter((a) => a.riskLevel === "low") || [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-analysis-title">AI Risk Analysis</h1>
          <p className="text-muted-foreground text-sm mt-1">
            AI-powered assessment of stock expiry risk based on order history and forecasted demand
          </p>
        </div>
        <Button
          onClick={() => analyzeMutation.mutate()}
          disabled={!canAnalyze || analyzeMutation.isPending}
          data-testid="button-run-analysis"
        >
          {analyzeMutation.isPending ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Brain className="w-4 h-4 mr-2" />
          )}
          {analyzeMutation.isPending ? "Analyzing..." : "Run Analysis"}
        </Button>
      </div>

      {!canAnalyze && (
        <Card>
          <CardContent className="py-8 text-center space-y-3">
            <Package className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Upload inventory data first before running the analysis
            </p>
          </CardContent>
        </Card>
      )}

      {analyzeMutation.isPending && (
        <Card>
          <CardContent className="py-8 space-y-4">
            <div className="flex items-center gap-3">
              <Brain className="w-5 h-5 text-primary animate-pulse" />
              <span className="text-sm font-medium">AI is analyzing your data...</span>
            </div>
            <Progress value={65} className="h-2" />
            <p className="text-xs text-muted-foreground">
              Examining order patterns, seasonality, and forecasting demand against expiry dates
            </p>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : analyses && analyses.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card data-testid="card-summary-high">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-destructive/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-destructive">{highRisk.length}</p>
                  <p className="text-xs text-muted-foreground">High risk items</p>
                </div>
              </CardContent>
            </Card>
            <Card data-testid="card-summary-medium">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-600">{mediumRisk.length}</p>
                  <p className="text-xs text-muted-foreground">Medium risk items</p>
                </div>
              </CardContent>
            </Card>
            <Card data-testid="card-summary-low">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{lowRisk.length}</p>
                  <p className="text-xs text-muted-foreground">Low risk items</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {report?.content && (
            <Card data-testid="card-analysis-report">
              <CardHeader className="flex flex-row items-center gap-2 space-y-0">
                <FileText className="w-5 h-5 text-primary shrink-0" />
                <CardTitle className="text-base">Stock Level Summary & Risk Report</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm leading-relaxed whitespace-pre-line text-foreground" data-testid="text-analysis-report">
                  {report.content}
                </div>
                {report.createdAt && (
                  <p className="text-xs text-muted-foreground mt-4 pt-3 border-t">
                    Generated {new Date(report.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {highRisk.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                High Risk - Immediate Attention Required
              </h2>
              {highRisk.map((a) => (
                <RiskCard key={a.id} analysis={a} />
              ))}
            </div>
          )}

          {mediumRisk.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-600" />
                Medium Risk - Monitor Closely
              </h2>
              {mediumRisk.map((a) => (
                <RiskCard key={a.id} analysis={a} />
              ))}
            </div>
          )}

          {lowRisk.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-green-600" />
                Low Risk - On Track
              </h2>
              {lowRisk.map((a) => (
                <RiskCard key={a.id} analysis={a} />
              ))}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detailed Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead className="text-right">Codes</TableHead>
                      <TableHead className="text-right">Value at Risk</TableHead>
                      <TableHead className="text-right">Avg Orders/Mo</TableHead>
                      <TableHead className="text-right">Months Left</TableHead>
                      <TableHead className="text-right">Forecast</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analyses.map((a) => (
                      <TableRow key={a.id} data-testid={`row-analysis-${a.id}`}>
                        <TableCell className="font-medium">{a.supplierName}</TableCell>
                        <TableCell>
                          <RiskBadge level={a.riskLevel} />
                        </TableCell>
                        <TableCell className="text-sm">{a.expiryDate}</TableCell>
                        <TableCell className="text-right">{a.codesAtRisk}</TableCell>
                        <TableCell className="text-right">
                          £{a.valueAtRisk?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </TableCell>
                        <TableCell className="text-right">
                          {a.monthlyAvgOrders?.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right">
                          {a.monthsUntilExpiry?.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right">
                          {a.forecastedDemand?.toFixed(0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : canAnalyze ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Brain className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="font-medium">Ready to analyze</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Click "Run Analysis" to have AI assess your inventory against order history and predict expiry risks
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function RiskCard({ analysis }: { analysis: RiskAnalysis }) {
  const stockVsDemand = analysis.forecastedDemand > 0
    ? Math.min((analysis.forecastedDemand / analysis.codesAtRisk) * 100, 100)
    : 0;

  return (
    <Card data-testid={`card-analysis-${analysis.id}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold">{analysis.supplierName}</span>
              <RiskBadge level={analysis.riskLevel} />
            </div>
            <p className="text-xs text-muted-foreground">
              Expires: {analysis.expiryDate} ({analysis.monthsUntilExpiry?.toFixed(0)} months)
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">
              £{analysis.valueAtRisk?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-muted-foreground">value at risk</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">{analysis.summary}</p>

        <div className="flex items-center gap-6 flex-wrap text-xs text-muted-foreground">
          <span>{analysis.codesAtRisk} codes in stock</span>
          <span>{analysis.monthlyAvgOrders?.toFixed(1)} avg orders/month</span>
          <span>{analysis.forecastedDemand?.toFixed(0)} forecasted demand</span>
        </div>

        {analysis.codesAtRisk > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Demand vs Stock</span>
              <span className={stockVsDemand >= 80 ? "text-green-600" : stockVsDemand >= 50 ? "text-yellow-600" : "text-destructive"}>
                {stockVsDemand.toFixed(0)}%
              </span>
            </div>
            <Progress
              value={stockVsDemand}
              className="h-2"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RiskBadge({ level }: { level: string }) {
  if (level === "high") {
    return <Badge variant="destructive">High Risk</Badge>;
  }
  if (level === "medium") {
    return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Medium</Badge>;
  }
  return <Badge variant="secondary">Low Risk</Badge>;
}
