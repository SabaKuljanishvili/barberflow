import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { LOCALE_COOKIE } from "@/i18n/config";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  const page = t.legal.pages.cookies;
  return { title: page.title, description: page.description, alternates: { canonical: "/legal/cookies" } };
}

const content = {
  en: {
    intro: "BarberFlow sets only strictly necessary cookies. We do not use analytics, advertising or third-party tracking cookies.",
    setHeading: "Cookies we set",
    caption: "Cookies used by BarberFlow",
    columns: ["Name", "Purpose", "Duration"],
    cookies: [
      { name: "sb-*-auth-token", purpose: "Keeps staff signed in to the dashboard.", duration: "Session, refreshed while active" },
      { name: "bf_cookie_consent", purpose: "Remembers your answer to the cookie notice.", duration: "180 days" },
      { name: LOCALE_COOKIE, purpose: "Remembers the language you chose (Georgian or English).", duration: "1 year" },
    ],
    choicesHeading: "Your choices",
    choices:
      "Because these cookies are needed for the service to work, they cannot be switched off in BarberFlow. You can delete cookies in your browser at any time; you will then be signed out. If we ever add optional cookies we will ask for consent first and update this page.",
  },
  ka: {
    intro: "BarberFlow იყენებს მხოლოდ მკაცრად აუცილებელ cookie-ებს. ანალიტიკის, სარეკლამო ან მესამე მხარის თვალთვალის cookie-ებს არ ვიყენებთ.",
    setHeading: "ჩვენი cookie-ები",
    caption: "BarberFlow-ის მიერ გამოყენებული cookie-ები",
    columns: ["დასახელება", "დანიშნულება", "ვადა"],
    cookies: [
      { name: "sb-*-auth-token", purpose: "თანამშრომლებს მართვის პანელში შესულს ტოვებს.", duration: "სესია, განახლდება აქტიურობისას" },
      { name: "bf_cookie_consent", purpose: "იმახსოვრებს თქვენს პასუხს cookie-ების შეტყობინებაზე.", duration: "180 დღე" },
      { name: LOCALE_COOKIE, purpose: "იმახსოვრებს არჩეულ ენას (ქართული ან ინგლისური).", duration: "1 წელი" },
    ],
    choicesHeading: "თქვენი არჩევანი",
    choices:
      "რადგან ეს cookie-ები მომსახურების მუშაობისთვის აუცილებელია, BarberFlow-ში მათი გამორთვა შეუძლებელია. cookie-ების წაშლა ბრაუზერში ნებისმიერ დროს შეგიძლიათ, რის შემდეგაც ანგარიშიდან გამოხვალთ. თუ ოდესმე დავამატებთ არასავალდებულო cookie-ებს, ჯერ თანხმობას მოგთხოვთ და ამ გვერდს განვაახლებთ.",
  },
};

export default async function CookiesPage() {
  const { locale } = await getI18n();
  const c = content[locale];
  return (
    <LegalPage page="cookies" intro={c.intro}>
      <h2>{c.setHeading}</h2>
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{c.caption}</caption>
          <thead className="bg-canvas text-ink">
            <tr>
              {c.columns.map((col) => (
                <th key={col} scope="col" className="px-4 py-3 font-semibold">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {c.cookies.map((row) => (
              <tr key={row.name} className="border-t border-line text-muted">
                <td className="px-4 py-3 font-mono text-xs text-ink">{row.name}</td>
                <td className="px-4 py-3">{row.purpose}</td>
                <td className="px-4 py-3">{row.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>{c.choicesHeading}</h2>
      <p>{c.choices}</p>
    </LegalPage>
  );
}
