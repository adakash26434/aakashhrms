import { cn } from "@/lib/utils";

const variants = {
  default: "bg-[#2e7d32] text-white hover:bg-[#1b5e20]",
  outline: "border border-[#d7e8d0] bg-white text-[#1b3a1f] hover:bg-[#f6faf6]",
  ghost: "text-[#2e7d32] hover:bg-[#d7e8d0]/50",
  danger: "bg-red-600 text-white hover:bg-red-700",
} as const;

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: "sm" | "md" | "lg";
}

export function Button({
  className,
  variant = "default",
  size = "md",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium cursor-pointer transition-colors disabled:opacity-50",
        variants[variant],
        size === "sm" && "px-3 py-1.5 text-xs",
        size === "md" && "px-4 py-2 text-sm",
        size === "lg" && "px-5 py-2.5 text-sm",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
