import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal-page";
import { getI18n } from "@/i18n/server";
import { businessDetails } from "@/lib/env.server";
import { site } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  const page = t.legal.pages.terms;
  return { title: page.title, description: page.description, alternates: { canonical: "/legal/terms" } };
}

export default async function TermsPage() {
  const { locale } = await getI18n();
  const company = businessDetails().legalName ?? site.name;
  return locale === "ka" ? <Ka company={company} /> : <En company={company} />;
}

function En({ company }: { company: string }) {
  return (
    <LegalPage
      page="terms"
      intro={`These terms form an agreement between ${company} and the business that creates a BarberFlow account. By creating an account you confirm you can bind that business.`}
    >
      <h2>1. The service</h2>
      <p>
        BarberFlow provides appointment management, an automated phone booking agent and SMS reminders. Phone and SMS
        features require a phone number from our telephony provider, configured by you.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>Keep your credentials confidential. You are responsible for activity under your shop&apos;s accounts.</li>
        <li>Managers decide who joins the shop and what role they hold.</li>
        <li>Tell us promptly if you suspect unauthorised access.</li>
      </ul>

      <h2>3. Your clients&apos; data</h2>
      <p>
        You are responsible for having a lawful basis to contact your clients by phone and SMS, and for honouring opt
        out requests. Our <Link href="/legal/privacy">Privacy Policy</Link> describes how we process that data for you.
      </p>

      <h2>4. Acceptable use</h2>
      <ul>
        <li>No unsolicited marketing messages through BarberFlow numbers.</li>
        <li>No attempts to access other shops&apos; data, probe, or overload the service.</li>
        <li>No unlawful, misleading or abusive content.</li>
      </ul>

      <h2>5. Fees</h2>
      <p>
        Subscription fees are shown before you subscribe and billed in advance. Telephony usage may be billed separately
        by the provider. Refunds follow our <Link href="/legal/refund">Refund Policy</Link>.
      </p>

      <h2>6. Availability</h2>
      <p>
        We work to keep BarberFlow available but do not guarantee uninterrupted service. Automated phone booking depends
        on third-party networks and speech recognition, and may occasionally misunderstand a caller.
      </p>

      <h2>7. Liability</h2>
      <p>
        To the extent permitted by law, our total liability in any 12-month period is limited to the fees you paid in
        that period, and we are not liable for indirect or consequential losses, including lost bookings.
      </p>

      <h2>8. Ending the agreement</h2>
      <p>
        You may cancel at any time from your account or by contacting us. We may suspend accounts that breach these
        terms. After cancellation your data is deleted as described in the Privacy Policy.
      </p>

      <h2>9. Changes</h2>
      <p>We will give at least 30 days&apos; notice of material changes by email to shop managers.</p>
    </LegalPage>
  );
}

function Ka({ company }: { company: string }) {
  return (
    <LegalPage
      page="terms"
      intro={`ეს პირობები წარმოადგენს შეთანხმებას ${company}-სა და იმ ბიზნესს შორის, რომელიც BarberFlow-ის ანგარიშს ქმნის. ანგარიშის შექმნით ადასტურებთ, რომ უფლებამოსილი ხართ, ამ ბიზნესის სახელით იმოქმედოთ.`}
    >
      <h2>1. მომსახურება</h2>
      <p>
        BarberFlow გთავაზობთ ჯავშნების მართვას, ავტომატურ სატელეფონო აგენტს და SMS შეხსენებებს. ზარებისა და SMS-ის
        ფუნქციებისთვის საჭიროა ჩვენი სატელეკომუნიკაციო პროვაიდერის ნომერი, რომელსაც თქვენ აკონფიგურირებთ.
      </p>

      <h2>2. თქვენი ანგარიში</h2>
      <ul>
        <li>შეინახეთ მონაცემები კონფიდენციალურად. თქვენ პასუხისმგებელი ხართ სალონის ანგარიშებიდან განხორციელებულ ქმედებებზე.</li>
        <li>მენეჯერი წყვეტს, ვინ შემოუერთდება სალონს და რა როლი ექნება.</li>
        <li>დაუყოვნებლივ შეგვატყობინეთ, თუ არასანქცირებულ წვდომას ეჭვობთ.</li>
      </ul>

      <h2>3. თქვენი კლიენტების მონაცემები</h2>
      <p>
        თქვენ პასუხისმგებელი ხართ, გქონდეთ კანონიერი საფუძველი კლიენტებთან ტელეფონითა და SMS-ით დასაკავშირებლად და
        პატივი სცეთ გამოწერის გაუქმების მოთხოვნებს. ჩვენი <Link href="/legal/privacy">კონფიდენციალურობის პოლიტიკა</Link>{" "}
        აღწერს, როგორ ვამუშავებთ ამ მონაცემებს თქვენთვის.
      </p>

      <h2>4. დასაშვები გამოყენება</h2>
      <ul>
        <li>აკრძალულია BarberFlow-ის ნომრებით არასასურველი სარეკლამო შეტყობინებების გაგზავნა.</li>
        <li>აკრძალულია სხვა სალონების მონაცემებზე წვდომის მცდელობა, სისტემის გამოკვლევა ან გადატვირთვა.</li>
        <li>აკრძალულია უკანონო, შეცდომაში შემყვანი ან შეურაცხმყოფელი შინაარსი.</li>
      </ul>

      <h2>5. საფასური</h2>
      <p>
        გამოწერის საფასური ნაჩვენებია გამოწერამდე და გადაიხდება წინასწარ. სატელეფონო მომსახურების ხარჯი შეიძლება
        პროვაიდერმა ცალკე დაგირიცხოთ. თანხის დაბრუნება ხდება ჩვენი{" "}
        <Link href="/legal/refund">თანხის დაბრუნების პოლიტიკის</Link> მიხედვით.
      </p>

      <h2>6. ხელმისაწვდომობა</h2>
      <p>
        ვცდილობთ, BarberFlow მუდმივად ხელმისაწვდომი იყოს, თუმცა უწყვეტ მუშაობას ვერ გარანტირებთ. ავტომატური სატელეფონო
        ჯავშანი დამოკიდებულია მესამე მხარის ქსელებსა და მეტყველების ამოცნობაზე და ზოგჯერ შესაძლოა დამრეკი ვერ გაიგოს.
      </p>

      <h2>7. პასუხისმგებლობა</h2>
      <p>
        კანონით დაშვებულ ფარგლებში, ჩვენი ჯამური პასუხისმგებლობა ნებისმიერ 12-თვიან პერიოდში შემოიფარგლება ამ
        პერიოდში თქვენ მიერ გადახდილი საფასურით და არ ვართ პასუხისმგებელი არაპირდაპირ ან თანმდევ ზიანზე, მათ შორის
        დაკარგულ ჯავშნებზე.
      </p>

      <h2>8. შეთანხმების შეწყვეტა</h2>
      <p>
        შეგიძლიათ ნებისმიერ დროს გააუქმოთ გამოწერა ანგარიშიდან ან ჩვენთან დაკავშირებით. ამ პირობების დარღვევის
        შემთხვევაში შეიძლება ანგარიში შევაჩეროთ. გაუქმების შემდეგ თქვენი მონაცემები წაიშლება კონფიდენციალურობის
        პოლიტიკის შესაბამისად.
      </p>

      <h2>9. ცვლილებები</h2>
      <p>არსებითი ცვლილებების შესახებ სალონის მენეჯერებს ელფოსტით შევატყობინებთ მინიმუმ 30 დღით ადრე.</p>
    </LegalPage>
  );
}
