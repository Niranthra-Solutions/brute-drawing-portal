import type { ReactNode } from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Base<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label?: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
}
const Req = ({ show }: { show?: boolean }) =>
  show ? <span className="text-destructive"> *</span> : null;

export function FInput<T extends FieldValues>({
  control,
  name,
  label,
  hint,
  required,
  className,
  mono,
  numeric,
  maxLength,
  transform,
  ...rest
}: Base<T> &
  Omit<
    React.ComponentProps<"input">,
    "name" | "value" | "onChange" | "className"
  > & {
    mono?: boolean;
    numeric?: boolean;
    transform?: (v: string, prev: string) => string;
  }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          {label && (
            <FormLabel>
              {label}
              <Req show={required} />
            </FormLabel>
          )}
          <FormControl>
            <Input
              {...rest}
              {...field}
              value={field.value ?? ""}
              maxLength={maxLength}
              inputMode={numeric ? "numeric" : rest.inputMode}
              className={cn("h-9", mono && "font-mono")}
              onChange={(e) =>
                field.onChange(
                  transform
                    ? transform(e.target.value, field.value ?? "")
                    : numeric
                      ? e.target.value.replace(/\D/g, "")
                      : e.target.value,
                )
              }
            />
          </FormControl>
          {hint && <FormDescription>{hint}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function FTextarea<T extends FieldValues>({
  control,
  name,
  label,
  hint,
  required,
  className,
  ...rest
}: Base<T> &
  Omit<
    React.ComponentProps<"textarea">,
    "name" | "value" | "onChange" | "className"
  >) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          {label && (
            <FormLabel>
              {label}
              <Req show={required} />
            </FormLabel>
          )}
          <FormControl>
            <Textarea
              {...rest}
              {...field}
              value={field.value ?? ""}
              className="min-h-24"
            />
          </FormControl>
          {hint && <FormDescription>{hint}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export interface Option {
  value: string;
  label: string;
  group?: string;
}
/** Keeps first-seen group order; options without a group stay as a plain list. */
function groupOptions(options: Option[]) {
  const out: { title: string; items: Option[] }[] = [];
  for (const o of options) {
    const title = o.group ?? "";
    let g = out.find((x) => x.title === title);
    if (!g) {
      g = { title, items: [] };
      out.push(g);
    }
    g.items.push(o);
  }
  return out;
}
export function FSelect<T extends FieldValues>({
  control,
  name,
  label,
  hint,
  required,
  className,
  options,
  placeholder = "Select…",
  disabled,
  clearable,
  onValueChange,
}: Base<T> & {
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  onValueChange?: (v: string) => void;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          {label && (
            <FormLabel>
              {label}
              <Req show={required} />
            </FormLabel>
          )}
          <Select
            value={field.value ?? ""}
            disabled={disabled}
            onValueChange={(v) => {
              const nv = v === "__clear" ? "" : v;
              field.onChange(nv);
              onValueChange?.(nv);
            }}
          >
            <FormControl>
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {clearable && field.value && (
                <SelectItem value="__clear" className="text-muted-foreground">
                  {placeholder}
                </SelectItem>
              )}
              {groupOptions(options).map((g) =>
                g.title ? (
                  <SelectGroup key={g.title}>
                    <SelectLabel>{g.title}</SelectLabel>
                    {g.items.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : (
                  g.items.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))
                ),
              )}
            </SelectContent>
          </Select>
          {hint && <FormDescription>{hint}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function FCheckbox<T extends FieldValues>({
  control,
  name,
  label,
  hint,
  className,
}: Omit<Base<T>, "required">) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn("flex-row items-start gap-2.5", className)}>
          <FormControl>
            <Checkbox
              checked={!!field.value}
              onCheckedChange={(v) => field.onChange(v === true)}
              className="mt-0.5"
            />
          </FormControl>
          <div className="grid gap-0.5">
            <FormLabel className="text-[13px] font-semibold">{label}</FormLabel>
            {hint && <FormDescription>{hint}</FormDescription>}
          </div>
        </FormItem>
      )}
    />
  );
}

/** Plain (non-form) select for toolbar filters. "" means "all". */
export function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
  className,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: Option[];
  className?: string;
  label?: string;
}) {
  return (
    <Select
      value={value || "__all"}
      onValueChange={(v) => onChange(v === "__all" ? "" : v)}
    >
      <SelectTrigger
        size="sm"
        className={cn("h-9 w-36", className)}
        aria-label={label ?? placeholder}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all">{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
