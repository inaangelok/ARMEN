import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/presentation/providers/auth";
import type { Role } from "@/domain/model";
import { Login, homeFor } from "@/presentation/pages/Login";
import { OwnerLayout } from "@/presentation/components/layout/OwnerLayout";
import { OpsLayout } from "@/presentation/components/layout/OpsLayout";
import { OwnerHome } from "@/presentation/pages/owner/OwnerHome";
import { OwnerHealth } from "@/presentation/pages/owner/OwnerHealth";
import { OwnerSafety } from "@/presentation/pages/owner/OwnerSafety";
import { OwnerAlerts } from "@/presentation/pages/owner/OwnerAlerts";
import { OwnerMaintenance } from "@/presentation/pages/owner/OwnerMaintenance";
import { OwnerReports } from "@/presentation/pages/owner/OwnerReports";
import { OwnerSettings } from "@/presentation/pages/owner/OwnerSettings";
const Fleet = lazy(() => import("@/presentation/pages/ops/Fleet").then((m) => ({ default: m.Fleet })));
const StationDetail = lazy(() => import("@/presentation/pages/ops/StationDetail").then((m) => ({ default: m.StationDetail })));
const WorkOrders = lazy(() => import("@/presentation/pages/ops/WorkOrders").then((m) => ({ default: m.WorkOrders })));
const Modules = lazy(() => import("@/presentation/pages/ops/Modules").then((m) => ({ default: m.Modules })));
const OpsAlerts = lazy(() => import("@/presentation/pages/ops/OpsAlerts").then((m) => ({ default: m.OpsAlerts })));
const Rules = lazy(() => import("@/presentation/pages/ops/Rules").then((m) => ({ default: m.Rules })));
const Analytics = lazy(() => import("@/presentation/pages/ops/Analytics").then((m) => ({ default: m.Analytics })));
const Users = lazy(() => import("@/presentation/pages/ops/Users").then((m) => ({ default: m.Users })));
const OpsSettings = lazy(() => import("@/presentation/pages/ops/OpsSettings").then((m) => ({ default: m.OpsSettings })));

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
    </div>
  );
}

function Guard({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <>{children}</>;
}

function Root() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user ? homeFor(user.role) : "/login"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/app"
        element={
          <Guard roles={["owner"]}>
            <OwnerLayout />
          </Guard>
        }
      >
        <Route index element={<OwnerHome />} />
        <Route path="health" element={<OwnerHealth />} />
        <Route path="safety" element={<OwnerSafety />} />
        <Route path="alerts" element={<OwnerAlerts />} />
        <Route path="maintenance" element={<OwnerMaintenance />} />
        <Route path="reports" element={<OwnerReports />} />
        <Route path="settings" element={<OwnerSettings />} />
      </Route>
      <Route
        path="/ops"
        element={
          <Guard roles={["technician", "admin"]}>
            <Suspense fallback={<Spinner />}>
              <OpsLayout />
            </Suspense>
          </Guard>
        }
      >
        <Route index element={<Fleet />} />
        <Route path="stations/:id" element={<StationDetail />} />
        <Route path="work-orders" element={<WorkOrders />} />
        <Route path="modules" element={<Modules />} />
        <Route path="alerts" element={<OpsAlerts />} />
        <Route path="rules" element={<Rules />} />
        <Route path="analytics" element={<Analytics />} />
        <Route
          path="users"
          element={
            <Guard roles={["admin"]}>
              <Users />
            </Guard>
          }
        />
        <Route path="settings" element={<OpsSettings />} />
      </Route>
      <Route path="*" element={<Root />} />
    </Routes>
  );
}
