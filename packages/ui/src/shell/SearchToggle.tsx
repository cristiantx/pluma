import type { ReactNode } from "react";

type SearchToggleProps = {
  children: ReactNode;
  className: string;
  isPressed: boolean;
  label: string;
  onClick: () => void;
};

export function SearchToggle({
  children,
  className,
  isPressed,
  label,
  onClick
}: SearchToggleProps) {
  return (
    <button
      aria-label={label}
      aria-pressed={isPressed}
      className={className}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}
