"use client";

import { useId, useRef } from "react";
import { Field } from "@/components/ui/field";
import { PhoneField } from "@/components/ui/phone-field";
import { splitE164 } from "@/lib/phone-countries";

export type KnownClient = { name: string; phone: string };

/**
 * Name and phone for a booking. Typing a known client's name suggests them;
 * picking one fills in their phone. The server matches or creates the client
 * by phone number, so there is no separate "pick or create" step.
 */
export function BookingClientFields({
  clients,
  defaultName,
  defaultPhone,
  nameLabel,
  phoneLabel,
  hint,
}: {
  clients: KnownClient[];
  defaultName?: string;
  defaultPhone?: string;
  nameLabel: string;
  phoneLabel: string;
  hint: string;
}) {
  const listId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const label = (c: KnownClient) => (c.phone ? `${c.name} · ${c.phone}` : c.name);

  function onInput(e: React.FormEvent<HTMLDivElement>) {
    const input = e.target as HTMLInputElement;
    if (input.name !== "clientName") return;
    const match = clients.find((c) => label(c) === input.value);
    const form = ref.current?.closest("form");
    if (!match || !form) return;
    input.value = match.name;
    const { iso, national } = splitE164(match.phone);
    const phone = form.elements.namedItem("phoneNumber") as HTMLInputElement | null;
    const country = form.elements.namedItem("phoneNumberCountry") as HTMLSelectElement | null;
    if (phone) phone.value = national;
    if (country) country.value = iso;
  }

  return (
    <div ref={ref} onInput={onInput} className="space-y-4">
      <Field label={nameLabel} name="clientName" list={listId} autoComplete="off" maxLength={120} defaultValue={defaultName} />
      <datalist id={listId}>
        {clients.map((c) => (
          <option key={`${c.phone}-${c.name}`} value={label(c)} />
        ))}
      </datalist>
      <PhoneField label={phoneLabel} name="phoneNumber" autoComplete="off" defaultValue={defaultPhone} hint={hint} />
    </div>
  );
}
