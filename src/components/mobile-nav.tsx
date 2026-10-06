"use client";

import { useEffect, useRef, useState } from "react";

type NavItem = { label: string; href: string };

export function MobileNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) return;
    firstLinkRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function onNavigate(href: string) {
    setOpen(false);
    if (!href.startsWith("#")) {
      buttonRef.current?.focus();
      return;
    }
    window.setTimeout(() => {
      const heading = document.querySelector<HTMLElement>(`${href} h2`);
      heading?.setAttribute("tabindex", "-1");
      heading?.focus({ preventScroll: true });
    }, 0);
  }

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-controls="mobile-site-nav"
        aria-expanded={open}
        aria-label={open ? "メニューを閉じる" : "メニューを開く"}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-line bg-white text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <span aria-hidden="true" className="text-xl leading-none">{open ? "×" : "☰"}</span>
      </button>
      <nav
        id="mobile-site-nav"
        aria-label="モバイルナビゲーション"
        className={`${open ? "block" : "hidden"} absolute inset-x-0 top-full border-b border-line bg-white px-4 py-3 shadow-lg sm:px-6`}
      >
        <ul className="mx-auto grid max-w-6xl gap-1">
          {items.map((item, index) => (
            <li key={item.href}>
              <a
                ref={index === 0 ? firstLinkRef : undefined}
                href={item.href}
                onClick={() => onNavigate(item.href)}
                className="flex min-h-11 items-center rounded-lg px-4 text-sm font-bold text-primary hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
