import { Env } from "./env";
import { createWorker } from "./worker";

const worker = createWorker();

export default {
  fetch(request: Request, env: Env) {
    return worker.fetch(request, env);
  },
};

export { RateLimitDurable } from "./rateLimit";
