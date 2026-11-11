"use client";

import { useEffect } from "react";

/**
 * Preview の <script> を React 化したもの。
 * - variant "top": スクロール進捗バー、ヘッダーの影、reveal、カードのポインタ演出
 * - variant "social": 対象要素へ reveal を付与してスクロール連動で出現
 * 出現アニメーションは transform のみ（opacity は常に 1）で、
 * JS 無効時でもコンテンツが見える。
 */
export function RedesignEffects({ variant }: { variant: "top" | "social" }) {
  useEffect(() => {
    const rootSelector = variant === "top" ? ".rd-root" : ".rs-root";
    const root = document.querySelector<HTMLElement>(rootSelector);
    if (!root) return;

    const cleanups: Array<() => void> = [];
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (variant === "top") {
      const progress = root.querySelector<HTMLElement>(".rd-progress");
      const header = root.querySelector<HTMLElement>(".rd-header");
      const onScroll = () => {
        const h = document.documentElement;
        const max = h.scrollHeight - h.clientHeight;
        const p = max > 0 ? h.scrollTop / max : 0;
        if (progress) progress.style.transform = `scaleX(${p})`;
        if (header) header.classList.toggle("rd-scrolled", h.scrollTop > 8);
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
      cleanups.push(() => window.removeEventListener("scroll", onScroll));

      const cards = root.querySelectorAll<HTMLElement>(".rd-cards .rd-card");
      cards.forEach((card) => {
        card.setAttribute("tabindex", "0");
        const move = (ev: PointerEvent) => {
          const r = card.getBoundingClientRect();
          const x = ((ev.clientX - r.left) / r.width) * 100;
          card.style.background =
            "linear-gradient(180deg,#fff 0%,#fafafa 100%)";
          card.style.setProperty("--x", `${x}%`);
        };
        const leave = () => {
          card.style.background = "";
        };
        card.addEventListener("pointermove", move);
        card.addEventListener("pointerleave", leave);
        cleanups.push(() => {
          card.removeEventListener("pointermove", move);
          card.removeEventListener("pointerleave", leave);
        });
      });
    }

    const inviewClass = variant === "top" ? "rd-inview" : "rs-inview";
    let revealEls: HTMLElement[];
    if (variant === "top") {
      revealEls = Array.from(
        root.querySelectorAll<HTMLElement>(".rd-reveal"),
      );
    } else {
      revealEls = Array.from(
        root.querySelectorAll<HTMLElement>(
          ".rs-card, .rs-step, .rs-dash, .rs-report, .rs-initfee, .rs-final-cta, details, .rs-operator",
        ),
      );
      revealEls.forEach((el, i) => {
        el.classList.add("rs-reveal");
        el.style.transitionDelay = `${(i % 3) * 70}ms`;
      });
      cleanups.push(() => {
        revealEls.forEach((el) => {
          el.classList.remove("rs-reveal");
          el.style.transitionDelay = "";
        });
      });
    }

    if (!("IntersectionObserver" in window) || reduced) {
      revealEls.forEach((el) => el.classList.add(inviewClass));
      return () => {
        cleanups.forEach((fn) => fn());
      };
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add(inviewClass);
            io.unobserve(e.target);
          }
        });
      },
      {
        threshold: variant === "top" ? 0.12 : 0.1,
        rootMargin:
          variant === "top" ? "0px 0px -40px 0px" : "0px 0px -30px 0px",
      },
    );
    revealEls.forEach((el) => io.observe(el));
    cleanups.push(() => io.disconnect());

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, [variant]);

  return null;
}
