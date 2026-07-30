const normalizeOrigin = (value) => value?.trim().replace(/\/+$/, "");

function buildConfiguredClientUrls(env = process.env) {
  return [
    normalizeOrigin(env.CLIENT_URL),
    env.NETLIFY_URL ? normalizeOrigin(`https://${env.NETLIFY_URL}`) : null,
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
  ].filter(Boolean);
}

function isAllowedOrigin(origin, { isProd, env = process.env } = {}) {
  if (!origin) return true;

  const normalizedOrigin = normalizeOrigin(origin);
  const configuredClientUrls = buildConfiguredClientUrls(env);

  if (configuredClientUrls.includes(normalizedOrigin)) return true;
  if (isProd) return false;

  return (
    normalizedOrigin.includes(".netlify.app") ||
    normalizedOrigin.includes("localhost") ||
    normalizedOrigin.includes("127.0.0.1") ||
    normalizedOrigin.includes(".railway.app")
  );
}

module.exports = { normalizeOrigin, buildConfiguredClientUrls, isAllowedOrigin };