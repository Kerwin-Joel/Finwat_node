// Mapa en memoria: phone -> { count, resetAt }
const rateLimitMap = new Map();

const MAX_MESSAGES = 10;      // máximo de mensajes
const WINDOW_MS = 60 * 1000; // por minuto

export const checkRateLimit = (phone) => {
  const now = Date.now();
  const entry = rateLimitMap.get(phone);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(phone, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= MAX_MESSAGES) {
    return { allowed: false, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true };
};