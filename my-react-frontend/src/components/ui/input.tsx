import React from "react";

// Input.tsx
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", error = false, ...props }, ref) => {
    const baseStyles =
      "flex h-9 w-full rounded-md border border-gray-200 bg-transparent px-3 py-1 text-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:cursor-not-allowed disabled:opacity-50";

    const errorStyles = error
      ? "border-red-500 focus-visible:ring-red-500"
      : "";

    const classes = `${baseStyles} ${errorStyles} ${className}`;

    return <input className={classes} ref={ref} {...props} />;
  }
);

Input.displayName = "Input";
