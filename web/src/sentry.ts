import * as Sentry from "@sentry/browser";

// Error tracking (GlitchTip, self-hosted Sentry).
//
// The DSN is injected at BUILD time via VITE_GLITCHTIP_DSN (see
// .github/workflows/deploy.yml → repo secret GLITCHTIP_DSN). It is never
// committed and is absent in local dev, so this is a no-op without it.
//
// Note: the DSN points at the Netbird-mesh address (100.127.194.184:8010), so
// errors only reach GlitchTip from browsers on the mesh. Making it public-facing
// requires exposing GlitchTip via a public route and updating the DSN host.
const dsn = import.meta.env.VITE_GLITCHTIP_DSN as string | undefined;
if (dsn) {
  Sentry.init({ dsn });
}
