export interface Env {
  FREEBUSY_ICAL_URL: string;
  RL_SALT: string;
  RATE_LIMITER: DurableObjectNamespace;
}

function isDurableObjectNamespace(value: unknown): value is DurableObjectNamespace {
  return typeof value === "object" && value !== null && "idFromName" in (value as Record<string, unknown>);
}

export function validateEnv(env: Partial<Env>): Env {
  if (!env.FREEBUSY_ICAL_URL || typeof env.FREEBUSY_ICAL_URL !== "string") {
    throw new Error("missing FREEBUSY_ICAL_URL");
  }
  if (!env.RL_SALT || typeof env.RL_SALT !== "string") {
    throw new Error("missing RL_SALT");
  }
  if (!isDurableObjectNamespace(env.RATE_LIMITER)) {
    throw new Error("missing RATE_LIMITER binding");
  }

  // Basic URL validation without exposing the secret value.
  try {
    // eslint-disable-next-line no-new
    new URL(env.FREEBUSY_ICAL_URL);
  } catch {
    throw new Error("invalid FREEBUSY_ICAL_URL");
  }

  return env as Env;
}
