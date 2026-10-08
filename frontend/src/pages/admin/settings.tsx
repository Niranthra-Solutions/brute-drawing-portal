import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Hash, Info, Layers } from "lucide-react";
import { api } from "@/lib/api";
import type { AppSettings } from "@/lib/types";
import { settingsSchema } from "@/lib/schemas";
import { useDebounced } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Advisory,
  ErrorState,
  FormError,
  Loading,
  PageHeader,
  SectionCard,
  Spinner,
  applyServerErrors,
  notify,
} from "@/components/app/common";
import { FInput } from "@/components/app/fields";

export default function SettingsPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<AppSettings>("/api/settings"),
  });
  const form = useForm({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      numberMask: "",
      toleranceLengthMm: "20",
      toleranceWidthMm: "10",
      toleranceHeightMm: "20",
    },
  });
  const [sample, setSample] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => {
    if (q.data)
      form.reset({
        numberMask: q.data.numberMask,
        toleranceLengthMm: String(q.data.toleranceLengthMm),
        toleranceWidthMm: String(q.data.toleranceWidthMm),
        toleranceHeightMm: String(q.data.toleranceHeightMm),
      });
  }, [q.data, form]);
  const mask = useDebounced(
    useWatch({ control: form.control, name: "numberMask" }),
  );
  const smp = useDebounced(sample);
  const prev = useQuery({
    queryKey: ["mask-preview", mask, smp],
    queryFn: () =>
      api.get<{
        valid: boolean;
        error?: string;
        example?: string;
        sampleMatches?: boolean | null;
      }>("/api/settings/mask-preview", { mask, sample: smp }),
    enabled: mask.length > 0,
  });
  const save = form.handleSubmit(async (v) => {
    setErr("");
    try {
      await api.put("/api/settings", {
        numberMask: v.numberMask,
        toleranceLengthMm: Number(v.toleranceLengthMm),
        toleranceWidthMm: Number(v.toleranceWidthMm),
        toleranceHeightMm: Number(v.toleranceHeightMm),
      });
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["bootstrap"] });
      notify.ok("Settings saved");
    } catch (e) {
      setErr(applyServerErrors(form, e) ?? "");
    }
  });
  if (q.isLoading) return <Loading />;
  if (q.error)
    return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return (
    <>
      <PageHeader
        eyebrow="Admin"
        admin
        title="Drawing settings"
        sub="Configure how drawing numbers are validated and how wide the closest-fit suggestion band is."
      />
      <FormError>{err}</FormError>
      <Form {...form}>
        <form onSubmit={save} noValidate>
          <SectionCard icon={Hash} title="Drawing number format">
            <div className="grid items-start gap-5 md:grid-cols-2">
              <div className="grid gap-4">
                <FInput
                  control={form.control}
                  name="numberMask"
                  label="Format mask"
                  required
                  mono
                  maxLength={40}
                  hint="# = digit · A = letter · X = letter or digit · space - / . _ are literal separators"
                  transform={(v) =>
                    v.toUpperCase().replace(/[^#AX \-/._]/g, "")
                  }
                />
                <div className="grid gap-1.5">
                  <Label htmlFor="sample" className="text-xs font-bold">
                    Try a sample number
                  </Label>
                  <Input
                    id="sample"
                    className="h-9 font-mono"
                    value={sample}
                    onChange={(e) => setSample(e.target.value)}
                    placeholder={prev.data?.example}
                  />
                </div>
              </div>
              {prev.data?.valid === false ? (
                <Advisory
                  icon={Info}
                  tone="blue"
                  className="mb-0"
                  title="Invalid mask"
                >
                  {prev.data.error}
                </Advisory>
              ) : (
                <Advisory
                  icon={Info}
                  tone="blue"
                  className="mb-0"
                  title={`Example: ${prev.data?.example ?? "…"}`}
                >
                  {sample
                    ? prev.data?.sampleMatches
                      ? "✓ Your sample matches this format."
                      : "✗ Your sample does not match this format."
                    : "The default is ## ### ### A, e.g. 25 600 001 A."}
                  <div className="mt-2">
                    Applies to new and edited drawings, the bulk import and
                    number search. Existing drawings are not changed.
                  </div>
                </Advisory>
              )}
            </div>
          </SectionCard>
          <SectionCard
            icon={Layers}
            title="Closest-fit tolerance (non-standard suggestions)"
          >
            <div className="grid gap-4 md:grid-cols-3">
              <FInput
                control={form.control}
                name="toleranceLengthMm"
                label="± Length"
                numeric
                mono
                maxLength={3}
                hint="mm, 0–500"
              />
              <FInput
                control={form.control}
                name="toleranceWidthMm"
                label="± Width"
                numeric
                mono
                maxLength={3}
                hint="mm, 0–500"
              />
              <FInput
                control={form.control}
                name="toleranceHeightMm"
                label="± Height"
                numeric
                mono
                maxLength={3}
                hint="mm, 0–500"
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              BRD default: ±20 mm length, ±10 mm width, ±20 mm height.
              Suggestions require the same voltage and every dimension within
              its tolerance.
            </p>
          </SectionCard>
          <div className="flex justify-end">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Spinner /> : <Check />}Save
              settings
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
}
