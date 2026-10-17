import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = (props: ToasterProps) => (
  <Sonner
    position="bottom-right"
    richColors
    closeButton
    toastOptions={{ classNames: { toast: "font-sans" } }}
    {...props}
  />
);
export { Toaster };
