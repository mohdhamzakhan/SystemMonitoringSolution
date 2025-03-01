import React, { useState, useEffect } from "react";
import { Search, RefreshCw } from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Alert, AlertDescription } from "../components/ui/alert";
import { TabsContent, TabsList, TabsTrigger } from "@radix-ui/react-tabs";
import useAuth from "./useAuth";
import { APP_CONSTANTS } from "../store";
const API_BASE_URL = APP_CONSTANTS.API_BASE_URL + "/api/UpdateTracking";

type Update = {
  updateID: string;
  updateName: string;
  fileName: string;
  systemCount: number;
  successCount: number;
  pendingCount: number;
  failedCount: number;
  createdDate?: string;
};

type SelectedUpdate = {
  updateID: string;
  updateName: string;
  createdDate: string;
};

const UpdateTrackingDashboard = () => {
  useAuth(); // Ensures the user is authenticated before loading the page
  const [selectedTab, setSelectedTab] = useState<string>("overview");
  const [updates, setUpdates] = useState<Update[]>([]);
  const [selectedUpdate, setSelectedUpdate] = useState<SelectedUpdate | null>(
    null
  );
  const [systems, setSystems] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Fetch updates from the API
  const fetchUpdates = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/updates-with-status`);
      if (!response.ok) throw new Error("Failed to fetch updates");
      const data = await response.json();
      setUpdates(data.updates);
    } catch (err) {
      setError("Failed to load updates. Please try again later.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch systems for the selected update
  const fetchSystemsForUpdate = async (updateId: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `${API_BASE_URL}/systems-by-update/${updateId}`
      );
      if (!response.ok) throw new Error("Failed to fetch systems");
      const data = await response.json();
      setSystems(data.systems);
    } catch (err) {
      setError("Failed to load systems. Please try again later.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUpdates();
  }, []);

  const UpdateOverview = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.isArray(updates) ? (
        updates.map((update) => (
          <Card
            key={update.updateID}
            className="hover:shadow-lg transition-shadow"
          >
            <CardHeader>
              <CardTitle>{update.updateName}</CardTitle>
              <p className="text-sm text-gray-500">{update.fileName}</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total Systems</span>
                  <span className="text-lg">{update.systemCount}</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500"
                    style={{
                      width: `${
                        (update.successCount / update.systemCount) * 100
                      }%`,
                    }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-center">
                    <p className="text-green-600 font-medium">
                      {update.successCount}
                    </p>
                    <p className="text-gray-500">Success</p>
                  </div>
                  <div className="text-center">
                    <p className="text-yellow-600 font-medium">
                      {update.pendingCount}
                    </p>
                    <p className="text-gray-500">Pending</p>
                  </div>
                  <div className="text-center">
                    <p className="text-red-600 font-medium">
                      {update.failedCount}
                    </p>
                    <p className="text-gray-500">Failed</p>
                  </div>
                </div>
                <button
                  className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  onClick={() => {
                    setSelectedUpdate({
                      updateID: update.updateID,
                      updateName: update.updateName,
                      createdDate: update.createdDate || "",
                    });
                    fetchSystemsForUpdate(update.updateID);
                    setSelectedTab("details");
                  }}
                >
                  View Details
                </button>
              </div>
            </CardContent>
          </Card>
        ))
      ) : (
        <p>No updates available</p>
      )}
    </div>
  );

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Update Tracking Dashboard</h1>
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
          onClick={fetchUpdates}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {error && (
        <Alert variant="error" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* <Tabs value={selectedTab} onValueChange={setSelectedTab}> */}
      <TabsList className="flex border-b border-gray-200">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="details" disabled={!selectedUpdate}>
          Details
        </TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <UpdateOverview />
      </TabsContent>
      <TabsContent value="details">
        {selectedUpdate ? (
          <Card className="p-4">
            <CardHeader>
              <CardTitle>{selectedUpdate.updateName}</CardTitle>
              <p className="text-sm text-gray-500">
                Created:{" "}
                {new Date(selectedUpdate.createdDate).toLocaleDateString()}
              </p>
            </CardHeader>
          </Card>
        ) : (
          <p>Select an update to view details.</p>
        )}
      </TabsContent>
      {/* </Tabs> */}
    </div>
  );
};

export default UpdateTrackingDashboard;
