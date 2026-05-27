"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";

type ContactEventPlan = "general" | "light" | "standard" | "premium";

type ContactLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  eventLocation: string;
  eventPlan?: ContactEventPlan;
  eventLabel?: string;
};

declare global {
  interface Window {
    gtag?: (
      command: "event",
      eventName: string,
      params?: Record<string, string>,
    ) => void;
  }
}

export function ContactLink({
  children,
  eventLocation,
  eventPlan = "general",
  eventLabel,
  onClick,
  ...props
}: ContactLinkProps) {
  return (
    <a
      {...props}
      onClick={(event) => {
        window.gtag?.("event", "contact_click", {
          location: eventLocation,
          plan: eventPlan,
          label:
            eventLabel ??
            (typeof children === "string" ? children : "contact"),
        });
        onClick?.(event);
      }}
    >
      {children}
    </a>
  );
}
