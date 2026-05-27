import type { ReactNode } from "react";
import Link from "next/link";
import { CONTACT_EMAIL, SITE_LABEL, SITE_NAME, createContactHref } from "@/lib/site";

export function LegalPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-primary">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <Link
            href="/"
            className="focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
          >
            <p className="text-base font-black">{SITE_NAME}</p>
            <p className="mt-1 text-xs text-secondary">{SITE_LABEL}</p>
          </Link>
          <Link
            href="/"
            className="text-sm font-bold text-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
          >
            トップへ戻る
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-20">
        <p className="font-number text-xs font-bold uppercase tracking-[0.16em] text-muted-text">
          ICHI Social
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-normal sm:text-4xl">
          {title}
        </h1>
        <div className="mt-10 space-y-8">{children}</div>
      </main>
      <footer className="border-t border-line bg-muted">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-8 text-sm text-secondary sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© 2026 {SITE_NAME}. All rights reserved.</p>
          <a
            href={createContactHref()}
            className="font-bold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
          >
            {CONTACT_EMAIL}
          </a>
        </div>
      </footer>
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-card-border bg-card p-5 sm:p-6">
      <h2 className="text-lg font-black">{title}</h2>
      <div className="mt-4 text-sm leading-8 text-secondary">{children}</div>
    </section>
  );
}
