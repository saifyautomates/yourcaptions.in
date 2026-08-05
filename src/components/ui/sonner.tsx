import { Toaster as Sonner, toast } from "sonner";
import React from "react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      position="bottom-center"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:bg-[var(--bg-3)] group-[.toaster]:text-[var(--text-1)] group-[.toaster]:border-[var(--border-3)] group-[.toaster]:shadow-xl group-[.toaster]:rounded-2xl",
          title: "text-sm font-semibold",
          description: "group-[.toast]:text-[var(--text-4)] text-xs",
          actionButton: "group-[.toast]:bg-[var(--red-3)] group-[.toast]:text-white group-[.toast]:hover:bg-[var(--red-4)]",
          cancelButton: "group-[.toast]:bg-[var(--bg-5)] group-[.toast]:text-[var(--text-3)] group-[.toast]:hover:bg-[var(--bg-6)]",
          error: "group-[.toaster]:border-[var(--error)] group-[.toaster]:bg-[var(--bg-3)] group-[.toaster]:text-[var(--error)]",
          success: "group-[.toaster]:border-[var(--success)] group-[.toaster]:bg-[var(--bg-3)] group-[.toaster]:text-[var(--success)]",
          warning: "group-[.toaster]:border-[var(--warning)] group-[.toaster]:bg-[var(--bg-3)] group-[.toaster]:text-[var(--warning)]",
          info: "group-[.toaster]:border-[var(--info)] group-[.toaster]:bg-[var(--bg-3)] group-[.toaster]:text-[var(--info)]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
