import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal-page";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  const page = t.legal.pages.refund;
  return { title: page.title, description: page.description, alternates: { canonical: "/legal/refund" } };
}

export default async function RefundPage() {
  const { locale } = await getI18n();
  return locale === "ka" ? <Ka /> : <En />;
}

function En() {
  return (
    <LegalPage
      page="refund"
      intro="This policy covers BarberFlow subscription fees. Telephony usage charged by the provider is not refundable by us."
    >
      <h2>1. Cancelling</h2>
      <p>
        You can cancel at any time. Your subscription stays active until the end of the period you have already paid
        for, and you will not be charged again.
      </p>

      <h2>2. When we refund</h2>
      <ul>
        <li>You were charged after cancelling, or charged twice for the same period.</li>
        <li>The service was unavailable for a significant part of a billing period because of a fault on our side.</li>
        <li>You request a refund within 14 days of your first paid charge.</li>
      </ul>

      <h2>3. When we do not refund</h2>
      <ul>
        <li>Partial periods after the first 14 days, except where the law requires it.</li>
        <li>Accounts suspended for breaching the <Link href="/legal/terms">Terms &amp; Conditions</Link>.</li>
      </ul>

      <h2>4. How to request one</h2>
      <p>
        Contact us through the <Link href="/contact">contact page</Link> with your shop name and the charge date.
        Approved refunds go back to the original payment method, usually within 5 to 10 business days.
      </p>

      <h2>5. Your statutory rights</h2>
      <p>Nothing in this policy limits any rights you have under consumer or business protection law.</p>
    </LegalPage>
  );
}

function Ka() {
  return (
    <LegalPage
      page="refund"
      intro="ეს პოლიტიკა ეხება BarberFlow-ის გამოწერის საფასურს. პროვაიდერის მიერ დარიცხულ სატელეფონო ხარჯს ჩვენ ვერ დავაბრუნებთ."
    >
      <h2>1. გაუქმება</h2>
      <p>
        გამოწერის გაუქმება ნებისმიერ დროს შეგიძლიათ. გამოწერა აქტიური რჩება უკვე გადახდილი პერიოდის ბოლომდე და თანხა
        აღარ ჩამოგეჭრებათ.
      </p>

      <h2>2. როდის ვაბრუნებთ თანხას</h2>
      <ul>
        <li>თანხა ჩამოგეჭრათ გაუქმების შემდეგ ან ერთსა და იმავე პერიოდზე ორჯერ.</li>
        <li>ჩვენი მხარის ხარვეზის გამო მომსახურება მიუწვდომელი იყო საანგარიშო პერიოდის მნიშვნელოვანი ნაწილის განმავლობაში.</li>
        <li>დაბრუნებას ითხოვთ პირველი გადახდიდან 14 დღის განმავლობაში.</li>
      </ul>

      <h2>3. როდის არ ვაბრუნებთ თანხას</h2>
      <ul>
        <li>პირველი 14 დღის შემდეგ პერიოდის ნაწილზე, გარდა კანონით გათვალისწინებული შემთხვევებისა.</li>
        <li>
          ანგარიშზე, რომელიც შეჩერდა <Link href="/legal/terms">წესებისა და პირობების</Link> დარღვევის გამო.
        </li>
      </ul>

      <h2>4. როგორ მოითხოვოთ</h2>
      <p>
        დაგვიკავშირდით <Link href="/contact">კონტაქტის გვერდიდან</Link> და მიუთითეთ სალონის დასახელება და გადახდის
        თარიღი. დამტკიცებული თანხა ბრუნდება გადახდის თავდაპირველ მეთოდზე, ჩვეულებრივ 5-10 სამუშაო დღეში.
      </p>

      <h2>5. კანონით მინიჭებული უფლებები</h2>
      <p>ეს პოლიტიკა არ ზღუდავს მომხმარებლის ან ბიზნესის დაცვის კანონმდებლობით მინიჭებულ არცერთ უფლებას.</p>
    </LegalPage>
  );
}
