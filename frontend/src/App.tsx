import { lazy, Suspense } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { SearchX } from "lucide-react";
import { RequireAuth } from "@/components/app/require-auth";
import { Shell } from "@/components/app/shell";
import { Empty, Loading } from "@/components/app/common";
import { Button } from "@/components/ui/button";

const Login = lazy(() => import("@/pages/login"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const DrawingSearch = lazy(() => import("@/pages/search"));
const NumberSearch = lazy(() => import("@/pages/number-search"));
const DrawingDetail = lazy(() => import("@/pages/drawing-detail"));
const Requests = lazy(() => import("@/pages/requests"));
const RequestForm = lazy(() => import("@/pages/request-form"));
const RequestDetail = lazy(() => import("@/pages/request-detail"));
const Documents = lazy(() => import("@/pages/documents"));
const DrawingsAdmin = lazy(() => import("@/pages/admin/drawings"));
const DrawingForm = lazy(() => import("@/pages/admin/drawing-form"));
const BulkImport = lazy(() => import("@/pages/admin/bulk-import"));
const MasterData = lazy(() => import("@/pages/admin/master-data"));
const Users = lazy(() => import("@/pages/admin/users"));
const Settings = lazy(() => import("@/pages/admin/settings"));
const Audit = lazy(() => import("@/pages/admin/audit"));

const A = ({ children }: { children: React.ReactNode }) => (
  <RequireAuth role="Admin">{children}</RequireAuth>
);

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <RequireAuth>
              <Shell />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="search" element={<DrawingSearch />} />
          <Route path="search-by-number" element={<NumberSearch />} />
          <Route path="drawings/:id" element={<DrawingDetail />} />
          <Route path="requests" element={<Requests />} />
          <Route path="requests/new" element={<RequestForm mode="New" />} />
          <Route
            path="requests/modify"
            element={<RequestForm mode="Modification" />}
          />
          <Route path="requests/:id" element={<RequestDetail />} />
          <Route path="documents" element={<Documents />} />
          <Route
            path="admin/drawings"
            element={
              <A>
                <DrawingsAdmin />
              </A>
            }
          />
          <Route
            path="admin/drawings/new"
            element={
              <A>
                <DrawingForm mode="new" />
              </A>
            }
          />
          <Route
            path="admin/drawings/:id/edit"
            element={
              <A>
                <DrawingForm mode="edit" />
              </A>
            }
          />
          <Route
            path="admin/drawings/:id/revision"
            element={
              <A>
                <DrawingForm mode="revision" />
              </A>
            }
          />
          <Route
            path="admin/bulk-import"
            element={
              <A>
                <BulkImport />
              </A>
            }
          />
          <Route
            path="admin/master-data"
            element={
              <A>
                <MasterData />
              </A>
            }
          />
          <Route
            path="admin/users"
            element={
              <A>
                <Users />
              </A>
            }
          />
          <Route
            path="admin/settings"
            element={
              <A>
                <Settings />
              </A>
            }
          />
          <Route
            path="admin/audit"
            element={
              <A>
                <Audit />
              </A>
            }
          />
          <Route
            path="*"
            element={
              <Empty
                icon={SearchX}
                title="Page not found"
                action={
                  <Button asChild variant="outline">
                    <Link to="/">Back to dashboard</Link>
                  </Button>
                }
              >
                The page you opened doesn't exist.
              </Empty>
            }
          />
        </Route>
      </Routes>
    </Suspense>
  );
}
