import "server-only";
import { siteUrl } from "@/lib/env";
import { businessDetails } from "@/lib/env.server";
import { site } from "@/lib/site";

/** Organization data. Contact fields appear only when real values are configured. */
export function organizationSchema() {
  const b = businessDetails();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: b.legalName ?? site.name,
    url: siteUrl(),
    logo: `${siteUrl()}/icon.svg`,
    ...(b.email && { email: b.email }),
    ...(b.phone && { telephone: b.phone }),
  };
}

/**
 * LocalBusiness data built only from configured business details. Returns
 * null rather than publishing an incomplete or invented address.
 */
export function localBusinessSchema() {
  const b = businessDetails();
  if (!b.legalName || !b.street || !b.city || !b.country) return null;
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${siteUrl()}/#business`,
    name: b.legalName,
    url: siteUrl(),
    image: `${siteUrl()}/opengraph-image`,
    ...(b.email && { email: b.email }),
    ...(b.phone && { telephone: b.phone }),
    address: {
      "@type": "PostalAddress",
      streetAddress: b.street,
      addressLocality: b.city,
      ...(b.region && { addressRegion: b.region }),
      ...(b.postalCode && { postalCode: b.postalCode }),
      addressCountry: b.country,
    },
  };
}

export function softwareSchema(description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: site.name,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description,
    url: siteUrl(),
  };
}
