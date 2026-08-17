/**
 * Plausible Analytics — privacy-friendly, self-hosted analytics.
 *
 * The tracking script URL is injected at BUILD time via VITE_PLAUSIBLE_DOMAIN
 * (e.g. `analytics.devprocore.com`). It is never committed as a secret — the
 * domain and data-domain are public. It is absent in local dev, so this is a
 * no-op without it.
 */
const plausibleDomain = import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined;
if (plausibleDomain) {
  const script = document.createElement("script");
  script.defer = true;
  script.setAttribute("data-domain", "hydro.devprocore.com");
  script.src = `https://${plausibleDomain}/js/script.js`;
  document.head.appendChild(script);
}