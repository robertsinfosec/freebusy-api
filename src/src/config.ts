import {
  allowedOriginsFromEnv,
  cacheTtlSecondsFromEnv,
  calendarTimezoneFromEnv,
  Env,
  rateLimitConfigFromEnv,
  upstreamMaxBytesFromEnv,
  weekStartDayFromEnv,
  windowWeeksFromEnv,
  WorkingHours,
  workingHoursFromEnv,
} from "./env";

export interface WorkerConfig {
  allowedOrigins: Set<string>;
  rateLimitConfig: ReturnType<typeof rateLimitConfigFromEnv>;
  windowWeeks: number;
  weekStartDay: number;
  calendarTimeZone: string;
  workingHours: WorkingHours;
  cacheTtlSeconds: number;
  upstreamMaxBytes: number;
}

export function parseWorkerConfig(env: Env): WorkerConfig {
  return {
    allowedOrigins: allowedOriginsFromEnv(env),
    rateLimitConfig: rateLimitConfigFromEnv(env),
    windowWeeks: windowWeeksFromEnv(env),
    weekStartDay: weekStartDayFromEnv(env),
    calendarTimeZone: calendarTimezoneFromEnv(env),
    workingHours: workingHoursFromEnv(env),
    cacheTtlSeconds: cacheTtlSecondsFromEnv(env),
    upstreamMaxBytes: upstreamMaxBytesFromEnv(env),
  };
}
