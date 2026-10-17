import * as React from "react";
import { cn } from "@/lib/utils";

function Table({ className, ...props }: React.ComponentProps<"table">) {
  const main = React.useRef<HTMLDivElement>(null);
  const top = React.useRef<HTMLDivElement>(null);
  const [w, setW] = React.useState(0);
  const [over, setOver] = React.useState(false);
  React.useEffect(() => {
    const el = main.current;
    if (!el) return;
    const measure = () => {
      setW(el.scrollWidth);
      setOver(el.scrollWidth > el.clientWidth + 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, []);
  const lock = React.useRef(false);
  const sync = (from: HTMLDivElement | null, to: HTMLDivElement | null) => {
    if (!from || !to || lock.current) {
      lock.current = false;
      return;
    }
    lock.current = true;
    to.scrollLeft = from.scrollLeft;
  };
  return (
    <div data-slot="table-wrap">
      {/* mirror scrollbar on TOP of the table, kept in sync with the real one */}
      <div
        ref={top}
        onScroll={() => sync(top.current, main.current)}
        aria-hidden="true"
        className={
          over ? "overflow-x-auto overflow-y-hidden border-b" : "hidden"
        }
        style={{ height: 14 }}
      >
        <div style={{ width: w, height: 1 }} />
      </div>
      <div
        ref={main}
        data-slot="table-container"
        onScroll={() => sync(main.current, top.current)}
        className="relative w-full overflow-x-auto [&_tr>*:last-child]:sticky [&_tr>*:last-child]:right-0 [&_tr>*:last-child]:z-[1] [&_tbody_tr>*:last-child]:bg-card [&_thead_tr>*:last-child]:bg-panel [&_tr>*:last-child]:shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.12)]"
      >
        <table
          data-slot="table"
          className={cn("w-full caption-bottom text-sm", className)}
          {...props}
        />
      </div>
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
