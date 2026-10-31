import { Fragment } from "react";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { PhoneIcon } from "./call-card";

export type SceneText = Dictionary["home"]["scenes"];

function Check({ size }: { size: number }) {
  return (
    <svg className="check" aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17 4 12" />
    </svg>
  );
}

function Wave({ className = "" }: { className?: string }) {
  return (
    <div className={`wave ${className}`} aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <i key={i} />
      ))}
    </div>
  );
}

function CallScene({ t }: { t: SceneText }) {
  return (
    <div className="scene sc-call">
      <div className="sc-phone">
        <span className="bf-ring" />
        <span className="bf-ring two" />
        <span className="bf-ring three" />
        <span className="sc-phone-core">
          <PhoneIcon size={30} stroke={1.6} />
        </span>
      </div>
      <Wave className="r s2" />
      <div className="sc-bubble r s3">
        <div className="sc-who">{t.agent}</div>
        <span className="tx">{t.greeting}</span>
        <span className="caret" />
      </div>
      <div className="chips r s5">
        {t.languages.map((l, i) => (
          <span key={l} className={`chip ${i === 0 ? "on" : ""}`}>
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

function CalendarScene({ t }: { t: SceneText }) {
  const busy = (label: string, extra?: React.ReactNode) => (
    <span className="c busy">
      {label}
      {extra}
    </span>
  );
  const free = <span className="c" />;
  // Rows: time, then Giorgi / Luka / Nika.
  const rows: [string, React.ReactNode, React.ReactNode, React.ReactNode][] = [
    ["14:00", busy(t.cut), free, busy(t.beard)],
    ["14:30", busy(t.cut), busy(t.fade), free],
    ["15:00", free, busy(t.fade, <span className="ghost">{t.taken}</span>), busy(t.cut)],
    ["15:30", <span key="new" className="c new">{t.newBooking}</span>, free, busy(t.beard)],
    ["16:00", busy(t.cut), free, free],
    ["16:30", free, busy(t.cut), busy(t.fade)],
  ];
  return (
    <div className="scene">
      <div className="cal">
        <span />
        {t.barbers.map((name) => (
          <span key={name} className="h">
            <span className="av">{name[0]}</span>
            {name}
          </span>
        ))}
        {rows.map(([time, ...cells]) => (
          <Fragment key={time}>
            <span className="t">{time}</span>
            {cells.map((cell, i) => (
              <Fragment key={i}>{cell}</Fragment>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function SmsScene({ t }: { t: SceneText }) {
  return (
    <div className="scene">
      <div className="phone">
        <div className="notch" />
        <div className="phone-top r s1">
          <span className="av fill">B</span>
          <b>BarberFlow</b>
          <span>{t.smsTime}</span>
        </div>
        <div className="sms b-in r s2">{t.reminder}</div>
        <div className="sms b-out sms-reply r s5">C</div>
        <div className="st-row r s7">
          <span>{t.status}</span>
          <span className="row" style={{ gap: 5 }}>
            <Check size={14} />
            {t.confirmed}
          </span>
        </div>
      </div>
    </div>
  );
}

function RolesScene({ t }: { t: SceneText }) {
  const managerDelays = [0.5, 0.7, 0.9, 1.1];
  return (
    <div className="scene sc-roles">
      <div className="pc r s1">
        <div className="row pc-head">
          <span className="av fill">{t.manager[0]}</span>
          <div>
            <b>{t.manager}</b>
            <span>{t.managerNote}</span>
          </div>
        </div>
        {t.permissions.map((p, i) => (
          <div key={p} className="pr">
            <span>{p}</span>
            <span className="tg on" style={{ "--d": `${managerDelays[i]}s` } as React.CSSProperties} />
          </div>
        ))}
      </div>
      <div className="pc r s3">
        <div className="row pc-head">
          <span className="av">{t.barber[0]}</span>
          <div>
            <b>{t.barber}</b>
            <span>{t.barberNote}</span>
          </div>
        </div>
        {t.permissions.map((p, i) => {
          // Barbers only get the calendar (the last permission).
          const on = i === t.permissions.length - 1;
          return (
            <div key={p} className="pr">
              <span>{p}</span>
              <span className={`tg ${on ? "on" : ""}`} style={on ? ({ "--d": "1.4s" } as React.CSSProperties) : undefined} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IsolationScene({ t }: { t: SceneText }) {
  const db = (name: string, widths: number[], cls: string, scanDelay?: string) => (
    <div className={`db r ${cls}`}>
      <span className="scan" style={scanDelay ? { animationDelay: scanDelay } : undefined} />
      <b>{name}</b>
      {widths.map((w, i) => (
        <div key={i} className="bar" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
  return (
    <div className="scene">
      <div className="sc-dbs">
        {db(t.salonA, [90, 66, 82, 58, 74], "s1")}
        <div className="shield-col r s3">
          <span className="shield">
            <span className="bf-ring" />
            <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
          </span>
          <span>RLS</span>
        </div>
        {db(t.salonB, [72, 88, 60, 80, 68], "s2", "1.4s")}
      </div>
      <div className="blocked r s5">
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
        {t.blocked}
      </div>
    </div>
  );
}

function ArchiveScene({ t }: { t: SceneText }) {
  // The two oldest rows sink into the archive; the rest rise in.
  const cls = ["go", "go", "r s1", "r s2"];
  const delays = ["0.9s", "1.5s"];
  return (
    <div className="scene">
      {t.archived.map((a, i) => (
        <div key={a.title + a.date} className={`arch ${cls[i]}`} style={delays[i] ? { animationDelay: delays[i] } : undefined}>
          <span>{a.title}</span>
          <span className="dt">{a.date}</span>
        </div>
      ))}
      <div className="tray r s3">
        <span className="row">
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="21 8 21 21 3 21 3 8" />
            <rect x="1" y="3" width="22" height="5" />
            <line x1="10" y1="12" x2="14" y2="12" />
          </svg>
          <span>{t.archive}</span>
        </span>
        <span className="cnt">+2</span>
      </div>
    </div>
  );
}

/** Same order as the feature list. */
export const SCENES = [CallScene, CalendarScene, SmsScene, RolesScene, IsolationScene, ArchiveScene];
