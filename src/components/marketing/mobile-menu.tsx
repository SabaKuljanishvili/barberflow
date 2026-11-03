"use client";

import { useEffect, useRef, useState } from "react";
import Link from "@/components/locale-link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

type Item = { href: string; label: string };

/**
 * Phone/tablet navigation. A modal <dialog> gives the focus trap, Esc to
 * close and an inert page behind it for free; focus returns to the button.
 */
export function MobileMenu({
  items,
  labels,
  children,
}: {
  items: Item[];
  labels: { open: string; close: string; title: string; signIn: string; start: string };
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close after navigating.
  useEffect(() => {
    ref.current?.close();
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        className="menu-btn"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={labels.open}
        onClick={() => ref.current?.showModal()}
      >
        <Menu aria-hidden="true" size={22} />
      </button>
      <dialog
        ref={ref}
        id="mobile-menu"
        className="menu-sheet"
        aria-label={labels.title}
        onClose={() => setOpen(false)}
        onToggle={(e) => setOpen((e.currentTarget as HTMLDialogElement).open)}
        onClick={(e) => {
          // A click on the backdrop (the dialog box itself, not its content) closes it.
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        <div className="menu-inner">
          <div className="menu-top">
            <span className="menu-title">{labels.title}</span>
            <button type="button" className="menu-btn" aria-label={labels.close} onClick={() => ref.current?.close()} autoFocus>
              <X aria-hidden="true" size={22} />
            </button>
          </div>
          <nav aria-label={labels.title}>
            <ul className="menu-links">
              {items.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} onClick={() => ref.current?.close()}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="menu-tools">{children}</div>
          <div className="menu-ctas">
            <Link className="bf-btn bf-btn-g" href="/login">
              {labels.signIn}
            </Link>
            <Link className="bf-btn bf-btn-p" href="/signup">
              {labels.start}
            </Link>
          </div>
        </div>
      </dialog>
    </>
  );
}
