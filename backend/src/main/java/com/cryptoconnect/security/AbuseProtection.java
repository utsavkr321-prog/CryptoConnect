package com.cryptoconnect.security;

import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/** Process-local fixed-window limits. Use a shared limiter before scaling to multiple instances. */
public class AbuseProtection {
  private static final int MAX_BUCKETS = 20_000;
  private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
  private final AtomicLong requests = new AtomicLong();

  public boolean allow(String scope, String identity, int limit, Duration period) {
    long now = System.currentTimeMillis();
    if ((requests.incrementAndGet() & 255) == 0) {
      windows.entrySet().removeIf(entry -> entry.getValue().expired(now));
    }
    String key = scope + ':' + identity;
    Window window = windows.get(key);
    if (window == null) {
      if (windows.size() >= MAX_BUCKETS) return false;
      Window candidate = new Window(now, period.toMillis());
      Window existing = windows.putIfAbsent(key, candidate);
      window = existing == null ? candidate : existing;
    }
    return window.take(now, limit, period.toMillis());
  }

  private static final class Window {
    private long startedAt;
    private long periodMillis;
    private int count;

    private Window(long now, long periodMillis) {
      this.startedAt = now;
      this.periodMillis = periodMillis;
    }

    private synchronized boolean take(long now, int limit, long requestedPeriodMillis) {
      if (now - startedAt >= periodMillis || now < startedAt) {
        startedAt = now;
        periodMillis = requestedPeriodMillis;
        count = 0;
      }
      if (count >= limit) return false;
      count++;
      return true;
    }

    private synchronized boolean expired(long now) {
      return now - startedAt >= periodMillis || now < startedAt;
    }
  }
}
