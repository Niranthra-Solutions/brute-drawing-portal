import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import { Empty, Loading } from "./common";

/** Any valid path works after sign-in: anonymous visitors go to /login and come back to the exact URL they asked for. */
export function RequireAuth({
  role,
  children,
}: {
  role?: "Admin";
  children: ReactNode;
}) {
  const user = useAuth((s) => s.user);
  const status = useAuth((s) => s.status);
  const loc = useLocation();
  if (status === "loading")
    return (
      <div className="min-h-screen">
        <Loading />
      </div>
    );
  if (!user)
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`}
        replace
      />
    );
  if (role && user.role !== role)
    return (
      <Empty
        icon={ShieldAlert}
        title="You don't have access to this page"
        action={
          <Button asChild variant="outline">
            <Link to="/">Go to dashboard</Link>
          </Button>
        }
      >
        This area is only available to Application Engineering admins.
      </Empty>
    );
  return <>{children}</>;
}
