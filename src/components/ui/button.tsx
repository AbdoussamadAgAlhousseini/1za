import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export const buttonVariants = cva(
  [
    "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold",
    "rounded-md transition-[background-color,border-color,color,box-shadow,transform] duration-150",
    "focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-y-px",
    "disabled:pointer-events-none disabled:opacity-55 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-pitch-800 text-white shadow-xs hover:bg-pitch-700 focus-visible:outline-pitch-600 [&_svg]:text-pitch-200",
        secondary:
          "border border-line-strong bg-surface text-ink shadow-xs hover:border-ink-faint hover:bg-surface-muted",
        ghost: "text-ink-soft hover:bg-surface-sunken hover:text-ink",
        danger: "bg-danger-600 text-white shadow-xs hover:bg-danger-700 focus-visible:outline-danger-600",
        success: "bg-success-600 text-white shadow-xs hover:bg-success-700 focus-visible:outline-success-600",
        gold: "bg-gold-400 text-pitch-950 shadow-xs hover:bg-gold-300",
        link: "h-auto px-0 text-pitch-700 underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-[13px] [&_svg]:size-3.5",
        md: "h-10 px-4 text-sm [&_svg]:size-4",
        lg: "h-12 px-5 text-[15px] [&_svg]:size-5",
        xl: "h-16 rounded-lg px-7 text-lg [&_svg]:size-6",
        icon: "size-10 [&_svg]:size-[18px]",
        "icon-sm": "size-8 [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, loading = false, disabled, children, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
});
