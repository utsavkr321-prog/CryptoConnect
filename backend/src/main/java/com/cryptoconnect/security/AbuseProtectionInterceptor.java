package com.cryptoconnect.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class AbuseProtectionInterceptor implements WebMvcConfigurer {
  private final AbuseProtection limits;
  private final int authenticationPerMinute;
  private final int registrationPerHour;
  private final int searchPerMinute;
  private final int writesPerMinute;

  public AbuseProtectionInterceptor(AbuseProtection limits,
      @Value("${app.rate-limit.authentication-per-minute:20}") int authenticationPerMinute,
      @Value("${app.rate-limit.registration-per-hour:10}") int registrationPerHour,
      @Value("${app.rate-limit.search-per-minute:60}") int searchPerMinute,
      @Value("${app.rate-limit.writes-per-minute:30}") int writesPerMinute) {
    this.limits = limits;
    this.authenticationPerMinute = authenticationPerMinute;
    this.registrationPerHour = registrationPerHour;
    this.searchPerMinute = searchPerMinute;
    this.writesPerMinute = writesPerMinute;
  }

  @Override
  public void addInterceptors(InterceptorRegistry registry) {
    registry.addInterceptor(new Limiter());
  }

  private final class Limiter implements HandlerInterceptor {
    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws IOException {
      Rule rule = ruleFor(request);
      if (rule == null) return true;
      Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
      String identity = rule.byAddress || authentication == null || !authentication.isAuthenticated()
          ? request.getRemoteAddr()
          : authentication.getName();
      if (limits.allow(rule.scope, identity, rule.limit, rule.period)) return true;
      response.setStatus(429);
      response.setHeader("Retry-After", Long.toString(Math.max(1, rule.period.toSeconds())));
      response.setContentType("application/json");
      response.getWriter().write("{\"error\":\"Too many requests\"}");
      return false;
    }
  }

  private Rule ruleFor(HttpServletRequest request) {
    String method = request.getMethod();
    String path = request.getRequestURI();
    if ("POST".equals(method) && "/api/auth/login".equals(path))
      return new Rule("login", authenticationPerMinute, Duration.ofMinutes(1), true);
    if ("POST".equals(method) && "/api/auth/register".equals(path))
      return new Rule("registration", registrationPerHour, Duration.ofHours(1), true);
    if ("GET".equals(method) && "/api/users".equals(path))
      return new Rule("user-search", searchPerMinute, Duration.ofMinutes(1), false);
    if ("POST".equals(method) && path.matches("/api/conversations/[^/]+/messages"))
      return new Rule("message-send", writesPerMinute, Duration.ofMinutes(1), false);
    if (("POST".equals(method) || "DELETE".equals(method)) && path.startsWith("/api/contacts"))
      return new Rule("contact-write", writesPerMinute, Duration.ofMinutes(1), false);
    if ("POST".equals(method) && "/api/security-events".equals(path))
      return new Rule("security-event-write", writesPerMinute, Duration.ofMinutes(1), false);
    return null;
  }

  private record Rule(String scope, int limit, Duration period, boolean byAddress) {}
}
