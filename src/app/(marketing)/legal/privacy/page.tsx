import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal-page";
import { getI18n } from "@/i18n/server";
import { businessDetails } from "@/lib/env.server";
import { site } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  const page = t.legal.pages.privacy;
  return { title: page.title, description: page.description, alternates: { canonical: "/legal/privacy" } };
}

export default async function PrivacyPage() {
  const { locale } = await getI18n();
  const b = businessDetails();
  const company = b.legalName ?? site.name;
  return locale === "ka" ? <Ka company={company} email={b.email} /> : <En company={company} email={b.email} />;
}

type Props = { company: string; email?: string };

function En({ company, email }: Props) {
  return (
    <LegalPage
      page="privacy"
      intro={`This policy explains how ${company} ("we") handles personal data when barbershops ("shops") use BarberFlow and when their clients call or text a BarberFlow number.`}
    >
      <h2>1. Our role</h2>
      <p>
        For shop staff accounts, we are the data controller. For a shop&apos;s client records, the shop is the controller
        and we process that data on the shop&apos;s behalf, only to provide the service.
      </p>

      <h2>2. Data we collect</h2>
      <ul>
        <li>
          <strong>Staff accounts:</strong> name, email, optional phone number, role, and a password stored only as a
          salted hash by our authentication provider.
        </li>
        <li>
          <strong>Shop details:</strong> shop name, opening hours, timezone, language and the shop&apos;s virtual phone
          number.
        </li>
        <li>
          <strong>Clients of a shop:</strong> phone number (from caller ID), first and last name if given, preferred
          language, and appointment history.
        </li>
        <li>
          <strong>Call records:</strong> the caller&apos;s number, time of call and whether a booking was made. We do
          not record call audio.
        </li>
      </ul>
      <p>We do not collect payment card numbers, dates of birth, or any data that is not needed to book appointments.</p>

      <h2>3. Why we use it</h2>
      <ul>
        <li>To book, confirm, remind and cancel appointments (performance of a contract).</li>
        <li>To secure accounts and prevent abuse, including rate limiting (legitimate interests).</li>
        <li>To meet legal and tax obligations (legal obligation).</li>
      </ul>
      <p>We do not sell personal data and we do not use it for advertising.</p>

      <h2>4. Processors</h2>
      <ul>
        <li>Supabase: database hosting and authentication.</li>
        <li>Twilio: phone calls, speech recognition during calls, and SMS.</li>
        <li>
          Microsoft Azure: turning the agent&apos;s replies into speech. The text it receives can include the shop name,
          service and barber names, and the caller&apos;s first name.
        </li>
        <li>Our hosting provider: serving the website and application.</li>
      </ul>

      <h2>5. Retention</h2>
      <p>
        Completed and cancelled appointments move to an archive one month after they take place and are deleted after
        13 months. Call records are deleted after 3 months. When a shop&apos;s account is deleted, its staff, client and
        appointment records are deleted with it.
      </p>

      <h2>6. Security</h2>
      <p>
        Data is encrypted in transit. Each shop&apos;s data is isolated by row-level security in the database, staff
        access is role-based, and sensitive endpoints are rate limited.
      </p>

      <h2>7. Your rights</h2>
      <p>
        Depending on where you live you may have the right to access, correct, delete, restrict or export your data,
        and to object to processing. Clients of a shop should contact that shop first; we will help the shop respond.
        You may also complain to your local data protection authority.
      </p>

      <h2>8. Contact</h2>
      <p>
        {email ? (
          <>
            Email <a href={`mailto:${email}`}>{email}</a> with any privacy request.
          </>
        ) : (
          <>
            See our <Link href="/contact">contact page</Link> for how to reach us.
          </>
        )}
      </p>
    </LegalPage>
  );
}

function Ka({ company, email }: Props) {
  return (
    <LegalPage
      page="privacy"
      intro={`ეს პოლიტიკა განმარტავს, როგორ ამუშავებს ${company} („ჩვენ“) პერსონალურ მონაცემებს, როდესაც ბარბერშოპები („სალონები“) იყენებენ BarberFlow-ს და როდესაც მათი კლიენტები რეკავენ ან SMS-ს უგზავნიან BarberFlow-ის ნომერს.`}
    >
      <h2>1. ჩვენი როლი</h2>
      <p>
        სალონის თანამშრომლების ანგარიშებისთვის ჩვენ ვართ მონაცემთა დამმუშავებელი. სალონის კლიენტების ჩანაწერებისთვის
        დამმუშავებელია სალონი, ჩვენ კი ამ მონაცემებს ვამუშავებთ სალონის სახელით, მხოლოდ მომსახურების გასაწევად.
      </p>

      <h2>2. რა მონაცემებს ვაგროვებთ</h2>
      <ul>
        <li>
          <strong>თანამშრომლების ანგარიშები:</strong> სახელი, ელფოსტა, არასავალდებულო ტელეფონის ნომერი, როლი და პაროლი,
          რომელსაც ავთენტიფიკაციის პროვაიდერი ინახავს მხოლოდ დაშიფრული (salted hash) სახით.
        </li>
        <li>
          <strong>სალონის მონაცემები:</strong> სალონის დასახელება, სამუშაო საათები, დროის სარტყელი, ენა და სალონის
          ვირტუალური ტელეფონის ნომერი.
        </li>
        <li>
          <strong>სალონის კლიენტები:</strong> ტელეფონის ნომერი (ნომრის ამომცნობიდან), სახელი და გვარი (თუ მოგვაწოდეს),
          სასურველი ენა და ვიზიტების ისტორია.
        </li>
        <li>
          <strong>ზარების ჩანაწერები:</strong> დამრეკის ნომერი, ზარის დრო და შედგა თუ არა ჯავშანი. ზარის აუდიოს არ
          ვიწერთ.
        </li>
      </ul>
      <p>
        არ ვაგროვებთ საბანკო ბარათის ნომრებს, დაბადების თარიღს ან სხვა მონაცემებს, რომლებიც ვიზიტის დასაჯავშნად
        საჭირო არ არის.
      </p>

      <h2>3. რისთვის ვიყენებთ</h2>
      <ul>
        <li>ვიზიტების დასაჯავშნად, დასადასტურებლად, შესახსენებლად და გასაუქმებლად (ხელშეკრულების შესრულება).</li>
        <li>ანგარიშების დასაცავად და ბოროტად გამოყენების თავიდან ასაცილებლად, მათ შორის მოთხოვნების შეზღუდვით (კანონიერი ინტერესი).</li>
        <li>სამართლებრივი და საგადასახადო ვალდებულებების შესასრულებლად (სამართლებრივი ვალდებულება).</li>
      </ul>
      <p>პერსონალურ მონაცემებს არ ვყიდით და სარეკლამო მიზნით არ ვიყენებთ.</p>

      <h2>4. უფლებამოსილი პირები</h2>
      <ul>
        <li>Supabase: მონაცემთა ბაზის ჰოსტინგი და ავთენტიფიკაცია.</li>
        <li>Twilio: სატელეფონო ზარები, მეტყველების ამოცნობა ზარის დროს და SMS.</li>
        <li>
          Microsoft Azure: აგენტის პასუხების ხმად გარდაქმნა. მიღებული ტექსტი შეიძლება შეიცავდეს სალონის, სერვისისა და
          ბარბერის სახელებს და დამრეკის სახელს.
        </li>
        <li>ჰოსტინგის პროვაიდერი: ვებსაიტისა და აპლიკაციის მომსახურება.</li>
      </ul>

      <h2>5. შენახვის ვადა</h2>
      <p>
        დასრულებული და გაუქმებული ვიზიტები ვიზიტიდან ერთი თვის შემდეგ გადადის არქივში და იშლება 13 თვის შემდეგ.
        ზარების ჩანაწერები იშლება 3 თვის შემდეგ. სალონის ანგარიშის წაშლისას მასთან ერთად იშლება თანამშრომლების,
        კლიენტებისა და ვიზიტების ჩანაწერები.
      </p>

      <h2>6. უსაფრთხოება</h2>
      <p>
        მონაცემები გადაცემისას დაშიფრულია. თითოეული სალონის მონაცემები იზოლირებულია მონაცემთა ბაზის row-level
        security-ით, თანამშრომლების წვდომა როლებზეა დამოკიდებული, ხოლო მგრძნობიარე endpoint-ებზე მოთხოვნები
        შეზღუდულია.
      </p>

      <h2>7. თქვენი უფლებები</h2>
      <p>
        საცხოვრებელი ადგილის მიხედვით შეიძლება გქონდეთ უფლება, გაეცნოთ, შეასწოროთ, წაშალოთ, შეზღუდოთ ან გადაიტანოთ
        თქვენი მონაცემები და გააპროტესტოთ მათი დამუშავება. სალონის კლიენტებმა ჯერ თავად სალონს უნდა მიმართონ; ჩვენ
        სალონს პასუხის გაცემაში დავეხმარებით. ასევე შეგიძლიათ მიმართოთ პერსონალურ მონაცემთა დაცვის სამსახურს.
      </p>

      <h2>8. კონტაქტი</h2>
      <p>
        {email ? (
          <>
            კონფიდენციალურობასთან დაკავშირებული ნებისმიერი მოთხოვნით მოგვწერეთ: <a href={`mailto:${email}`}>{email}</a>.
          </>
        ) : (
          <>
            ჩვენთან დასაკავშირებლად იხილეთ <Link href="/contact">კონტაქტის გვერდი</Link>.
          </>
        )}
      </p>
    </LegalPage>
  );
}
