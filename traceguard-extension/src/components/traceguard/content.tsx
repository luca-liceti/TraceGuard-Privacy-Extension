import React, { useEffect, useState } from 'react';
import { useAppState } from "@/lib/useStorage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Activity, Globe, Users, Eye, TrendingUp, TrendingDown } from "lucide-react";
import { storage } from "@/lib/storage";
import { CrossSiteExposure } from "@/lib/types";

// Get color based on score (higher = better)
function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-500";
  if (score >= 60) return "text-blue-500";
  if (score >= 40) return "text-yellow-500";
  if (score >= 20) return "text-orange-500";
  return "text-red-500";
}

export default function Content() {
  const state = useAppState();
  const [crossSiteExposure, setCrossSiteExposure] = useState<CrossSiteExposure>({});
  const [exposureCount, setExposureCount] = useState(0);

  // Load cross-site exposure data
  useEffect(() => {
    const loadExposure = async () => {
      const exposure = await storage.getAllExposure();
      setCrossSiteExposure(exposure);

      // Count total unique sites across all PII types
      const allSites = new Set<string>();
      Object.values(exposure).forEach(sites => {
        sites.forEach(site => allSites.add(site));
      });
      setExposureCount(allSites.size);
    };

    loadExposure();

    // Listen for storage changes
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.crossSiteExposure) {
        loadExposure();
      }
    };
    chrome.storage.local.onChanged.addListener(listener);
    return () => chrome.storage.local.onChanged.removeListener(listener);
  }, []);

  if (!state) return <div className="p-4">Loading...</div>;

  // Calculate PII types shared
  const piiTypesShared = Object.keys(crossSiteExposure).length;

  // Get UPS trend (mock for now, could be calculated from history)
  const upsTrend = state.ups >= 80 ? "stable" : state.ups >= 50 ? "declining" : "at-risk";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Overview of your privacy and security status.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Privacy Score Card */}
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Privacy Score</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getScoreColor(state.ups)}`}>
              {state.ups}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {upsTrend === "stable" && <TrendingUp className="h-3 w-3 text-green-500" />}
              {upsTrend === "declining" && <TrendingDown className="h-3 w-3 text-yellow-500" />}
              {upsTrend === "at-risk" && <TrendingDown className="h-3 w-3 text-red-500" />}
              User Privacy Score
            </p>
          </CardContent>
        </Card>

        {/* Sites Analyzed Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sites Analyzed</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{state.sitesAnalyzed}</div>
            <p className="text-xs text-muted-foreground">
              Total sites visited
            </p>
          </CardContent>
        </Card>

        {/* Trackers Detected Card - Fixed naming */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trackers Detected</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{state.trackersDetected}</div>
            <p className="text-xs text-muted-foreground">
              Total trackers found
            </p>
          </CardContent>
        </Card>

        {/* Cross-Site Exposure Card - Replaces Data Breaches */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Exposure</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{exposureCount}</div>
            <p className="text-xs text-muted-foreground">
              Sites with your data ({piiTypesShared} PII types)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cross-Site Exposure Details */}
      {piiTypesShared > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Cross-Site Exposure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(crossSiteExposure).map(([piiType, sites]) => (
                <div key={piiType} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="font-medium capitalize">{piiType}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {sites.length} {sites.length === 1 ? 'site' : 'sites'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
