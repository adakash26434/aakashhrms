"use client";

import React, { useState, useEffect } from "react";
import {
  Database,
  Eye,
  EyeOff,
  Copy,
  Check,
  Activity,
  Terminal,
  RefreshCw,
  HardDrive,
  Users2,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface Props {
  companyId: string;
  companySlug: string;
  companyCode: string;
  initialDbName?: string;
}

export function DatabaseCredentialsCard({
  companyId,
  companySlug,
  companyCode,
  initialDbName,
}: Props) {
  const [credentials, setCredentials] = useState<{
    dbName: string;
    dbHost: string;
    dbPort: number;
    dbUser: string;
    dbPasswordPlain: string;
    connectionUri: string;
    psqlCommand: string;
    drizzleStudioCommand: string;
  } | null>(null);

  const [health, setHealth] = useState<{
    status: string;
    isOnline: boolean;
    existsInPostgres: boolean;
    sizeFormatted: string;
    activeConnections: number;
    latencyMs: number;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const toast = useToast();

  // Fetch credentials & live health on mount
  const fetchDetails = async () => {
    try {
      setLoading(true);
      const [credRes, healthRes] = await Promise.all([
        fetch(`/api/platform/companies/${companyId}/credentials`),
        fetch(`/api/platform/companies/${companyId}/health`),
      ]);

      if (credRes.ok) {
        const credData = await credRes.json().catch(() => null);
        if (credData?.success) {
          setCredentials(credData.credentials);
        }
      }

      if (healthRes.ok) {
        const healthData = await healthRes.json().catch(() => null);
        if (healthData?.success) {
          setHealth(healthData.health);
        }
      } else {
        setHealth({
          status: "OFFLINE",
          isOnline: false,
          existsInPostgres: false,
          sizeFormatted: "—",
          activeConnections: 0,
          latencyMs: 0,
        });
      }
    } catch (err) {
      console.error("Error fetching database details:", err);
      toast.error("Failed to load database connection telemetry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [companyId]);

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedType(null), 2000);
  };

  const dbName = credentials?.dbName || initialDbName || `pay_t_${companySlug}`;

  return (
    <Card className="border-payroll-light/80 shadow-payroll-xs bg-white">
      <CardContent className="p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-payroll-light/60">
          <div className="flex items-center space-x-2">
            <Database className="w-4.5 h-4.5 text-payroll-primary" />
            <h3 className="text-xs font-bold text-payroll-navy uppercase tracking-wider">
              Isolated Database & Telemetry
            </h3>
          </div>

          <div className="flex items-center space-x-2">
            {health && (
              <Badge
                variant={health.isOnline ? "success" : "danger"}
                size="sm"
                className="gap-1.5 font-bold"
              >
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    health.isOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500",
                  )}
                />
                <span>{health.status}</span>
              </Badge>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={fetchDetails}
              disabled={loading}
              title="Refresh database connection telemetry"
              className="p-1.5 h-7 w-7 rounded-lg"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 text-payroll-primary", loading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Live Health Metric Strip */}
        {health && health.isOnline && (
          <div className="grid grid-cols-3 gap-3 p-3 bg-payroll-cream/70 rounded-xl border border-payroll-light text-center text-xs">
            <div>
              <span className="text-[10px] font-semibold text-gray-500 flex items-center justify-center gap-1">
                <HardDrive className="w-3 h-3 text-payroll-primary" />
                <span>Storage Size</span>
              </span>
              <strong className="text-xs font-bold text-payroll-navy mt-0.5 block">
                {health.sizeFormatted}
              </strong>
            </div>
            <div>
              <span className="text-[10px] font-semibold text-gray-500 flex items-center justify-center gap-1">
                <Users2 className="w-3 h-3 text-emerald-600" />
                <span>Active Sessions</span>
              </span>
              <strong className="text-xs font-bold text-payroll-navy mt-0.5 block">
                {health.activeConnections} Connection(s)
              </strong>
            </div>
            <div>
              <span className="text-[10px] font-semibold text-gray-500 flex items-center justify-center gap-1">
                <Activity className="w-3 h-3 text-blue-600" />
                <span>Ping Latency</span>
              </span>
              <strong className="text-xs font-bold text-payroll-navy mt-0.5 block">
                {health.latencyMs} ms
              </strong>
            </div>
          </div>
        )}

        {health && !health.isOnline && health.status === "MISSING" && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4.5 h-4.5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold">Physical Database Missing in PostgreSQL</strong>
              <p className="text-[11px] text-rose-700 mt-0.5">
                The database <code className="font-mono font-bold">{dbName}</code> was not found on the PostgreSQL server.
              </p>
            </div>
          </div>
        )}

        {/* Credentials Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
          <div className="bg-payroll-cream/50 p-3 rounded-xl border border-payroll-light">
            <span className="text-gray-500 block text-[10px] uppercase font-bold">
              Database Name
            </span>
            <span className="text-payroll-primary font-bold mt-1 block">
              {dbName}
            </span>
          </div>

          <div className="bg-payroll-cream/50 p-3 rounded-xl border border-payroll-light">
            <span className="text-gray-500 block text-[10px] uppercase font-bold">
              Host / Port
            </span>
            <span className="text-payroll-navy font-bold mt-1 block">
              {credentials ? `${credentials.dbHost}:${credentials.dbPort}` : "127.0.0.1:5432"}
            </span>
          </div>

          <div className="bg-payroll-cream/50 p-3 rounded-xl border border-payroll-light">
            <span className="text-gray-500 block text-[10px] uppercase font-bold">
              PostgreSQL User
            </span>
            <span className="text-payroll-navy font-bold mt-1 block">
              {credentials?.dbUser || "postgres"}
            </span>
          </div>

          <div className="bg-payroll-cream/50 p-3 rounded-xl border border-payroll-light">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 block text-[10px] uppercase font-bold">
                Database Password
              </span>
              {credentials && (
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[10px] text-payroll-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {showPassword ? (
                    <>
                      <EyeOff className="w-3 h-3" />
                      <span>Hide</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3 h-3" />
                      <span>Reveal</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <span className="text-payroll-navy font-bold mt-1 block">
              {credentials
                ? showPassword
                  ? credentials.dbPasswordPlain
                  : "••••••••••••"
                : "••••••••"}
            </span>
          </div>
        </div>

        {/* Connection URI & CLI Tooling */}
        {credentials && (
          <div className="space-y-3.5 pt-2 border-t border-payroll-light/60">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-payroll-navy">
                  PostgreSQL Connection URI (pgAdmin4 / DBeaver / psql)
                </label>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(credentials.connectionUri, "uri")
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-payroll-cream border border-payroll-light text-payroll-primary hover:bg-white transition-all shadow-2xs cursor-pointer"
                >
                  {copiedType === "uri" ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-700 font-bold">Copied URI!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy URI</span>
                    </>
                  )}
                </button>
              </div>
              <div className="p-3 bg-gray-900 text-emerald-400 font-mono text-[11px] rounded-xl overflow-x-auto border border-gray-800 select-all">
                {credentials.connectionUri}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-payroll-navy flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-purple-600" />
                  <span>Launch this Tenant in Drizzle Studio</span>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(credentials.drizzleStudioCommand, "drizzle")
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-purple-50 border border-purple-200 text-purple-700 hover:bg-white transition-all shadow-2xs cursor-pointer"
                >
                  {copiedType === "drizzle" ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-700 font-bold">Copied Command!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Command</span>
                    </>
                  )}
                </button>
              </div>
              <div className="p-3 bg-gray-900 text-purple-300 font-mono text-[11px] rounded-xl overflow-x-auto border border-gray-800 select-all">
                {credentials.drizzleStudioCommand}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
