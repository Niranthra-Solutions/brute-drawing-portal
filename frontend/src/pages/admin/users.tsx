import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { Pencil, Plus, Search, Users } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { api } from "@/lib/api";
import type { Paged, User } from "@/lib/types";
import { userSchema } from "@/lib/schemas";
import { useDebounced } from "@/lib/hooks";
import { ago } from "@/lib/util";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form } from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card2,
  Empty,
  ErrorState,
  FormError,
  PageHeader,
  Pill,
  Spinner,
  applyServerErrors,
  notify,
} from "@/components/app/common";
import { DataTable } from "@/components/app/data-table";
import { FCheckbox, FInput, FSelect } from "@/components/app/fields";

export default function UsersPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const dq = useDebounced(q);
  const [edit, setEdit] = useState<User | "new" | null>(null);
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["users", dq, page, pageSize],
    queryFn: () =>
      api.get<Paged<User>>("/api/users", { q: dq, page, pageSize }),
    placeholderData: keepPreviousData,
  });
  const columns: ColumnDef<User>[] = [
    {
      header: "User",
      cell: ({ row: { original: u } }) => (
        <>
          <div className="font-bold">{u.fullName}</div>
          <div className="text-xs text-muted-foreground">{u.email}</div>
        </>
      ),
    },
    {
      header: "Role",
      cell: ({ row }) => (
        <Pill tone={row.original.role === "Admin" ? "orange" : "green"}>
          {row.original.role === "Admin" ? "Admin" : "User"}
        </Pill>
      ),
    },
    { header: "Department", cell: ({ row }) => row.original.department ?? "—" },
    {
      header: "Last sign-in",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.lastLoginAtUtc
            ? ago(row.original.lastLoginAtUtc)
            : "Never"}
        </span>
      ),
    },
    {
      header: "Status",
      cell: ({ row }) => (
        <Pill tone={row.original.isActive ? "green" : "grey"}>
          {row.original.isActive ? "Active" : "Deactivated"}
        </Pill>
      ),
    },
    {
      id: "a",
      header: "",
      meta: { className: "text-right" },
      cell: ({ row: { original: u } }) => (
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => setEdit(u)}
          aria-label={`Edit ${u.fullName}`}
        >
          <Pencil />
        </Button>
      ),
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow="Admin"
        admin
        title="Users & access"
        sub="Sign-in is by e-mail one-time code. Add a user to give them access; deactivate to remove it instantly."
        actions={
          <Button onClick={() => setEdit("new")}>
            <Plus />
            Add user
          </Button>
        }
      />
      <Card2 className="overflow-hidden">
        <div className="border-b px-5 py-4">
          <div className="relative w-full max-w-xs">
            <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Name, e-mail or department"
              aria-label="Search users"
              className="h-9 pl-9"
            />
          </div>
        </div>
        {list.error ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : (
          <DataTable
            columns={columns}
            data={list.data?.items ?? []}
            loading={list.isLoading}
            rowKey={(u) => u.id}
            page={page}
            pageSize={pageSize}
            total={list.data?.total ?? 0}
            onPage={setPage}
            onPageSize={(n) => {
              setPageSize(n);
              setPage(1);
            }}
            empty={<Empty icon={Users} title="No users found" />}
          />
        )}
      </Card2>
      {edit && (
        <UserDialog
          user={edit === "new" ? null : edit}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            qc.invalidateQueries({ queryKey: ["users"] });
            notify.ok("User saved");
          }}
        />
      )}
    </>
  );
}

function UserDialog({
  user,
  onClose,
  onSaved,
}: {
  user: User | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const form = useForm({
    resolver: zodResolver(userSchema),
    defaultValues: {
      fullName: user?.fullName ?? "",
      email: user?.email ?? "",
      department: user?.department ?? "",
      role: (user?.role ?? "User") as "User" | "Admin",
      isActive: user?.isActive ?? true,
    },
  });
  const [err, setErr] = useState("");
  const save = form.handleSubmit(async (v) => {
    setErr("");
    try {
      if (user) await api.put(`/api/users/${user.id}`, v);
      else await api.post("/api/users", v);
      onSaved();
    } catch (e) {
      setErr(applyServerErrors(form, e) ?? "");
    }
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{user ? "Edit user" : "Add user"}</DialogTitle>
          <DialogDescription className="sr-only">
            User details and role
          </DialogDescription>
        </DialogHeader>
        <FormError>{err}</FormError>
        <Form {...form}>
          <form onSubmit={save} className="grid gap-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <FInput
                control={form.control}
                name="fullName"
                label="Full name"
                required
              />
              <FInput
                control={form.control}
                name="email"
                label="Work e-mail"
                required
                type="email"
              />
              <FInput
                control={form.control}
                name="department"
                label="Department"
              />
              <FSelect
                control={form.control}
                name="role"
                label="Role"
                options={[
                  { value: "User", label: "User" },
                  { value: "Admin", label: "Admin" },
                ]}
              />
            </div>
            <FCheckbox
              control={form.control}
              name="isActive"
              label="Active — can sign in"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Spinner />}Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
