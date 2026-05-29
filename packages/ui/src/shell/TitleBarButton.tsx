import * as Tooltip from "@radix-ui/react-tooltip";
import type { ComponentType, MouseEventHandler, SVGProps } from "react";

type TitleBarButtonProps = {
  "aria-label": string;
  className?: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  isActive?: boolean;
  isPressed?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
};

export function TitleBarButton({
  "aria-label": ariaLabel,
  className,
  icon: Icon,
  isActive = false,
  isPressed,
  onClick
}: TitleBarButtonProps) {
  const classes = [
    "titlebar-button",
    isActive ? "is-active" : "",
    className ?? ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Tooltip.Provider delayDuration={350}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            aria-label={ariaLabel}
            {...(isPressed !== undefined ? { "aria-pressed": isPressed } : {})}
            className={classes}
            onClick={onClick}
            type="button"
          >
            <Icon aria-hidden="true" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="titlebar-button-tooltip"
            side="bottom"
            sideOffset={2}
          >
            {ariaLabel}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
