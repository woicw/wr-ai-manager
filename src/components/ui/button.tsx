import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_14px_28px_rgba(42,111,255,0.26)] hover:translate-y-[-1px] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_18px_34px_rgba(42,111,255,0.3)]",
        success:
          "bg-emerald-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_14px_28px_rgba(5,150,105,0.24)] hover:translate-y-[-1px] hover:bg-emerald-500 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_18px_34px_rgba(5,150,105,0.3)]",
        destructive:
          "bg-rose-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_14px_28px_rgba(225,29,72,0.24)] hover:translate-y-[-1px] hover:bg-rose-500 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_18px_34px_rgba(225,29,72,0.28)]",
        outline:
          "border border-border/90 bg-secondary/88 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_10px_24px_rgba(15,23,42,0.06)] hover:bg-card hover:border-border hover:translate-y-[-1px]",
        ghost: "text-muted-foreground hover:bg-secondary hover:text-foreground",
      },
      size: {
        default: "h-11 px-4 py-2.5",
        sm: "h-9 px-3.5",
        lg: "h-12 px-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({
  asChild = false,
  className,
  size,
  variant,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      className={cn(buttonVariants({ className, size, variant }))}
      {...props}
    />
  );
}
