package com.cryptoconnect.security;

import java.time.Duration;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class AbuseProtectionTest {
  @Test void fixedWindowLimitsEachIdentityAndScopeIndependently() {
    AbuseProtection limits = new AbuseProtection();
    assertTrue(limits.allow("login", "client-a", 2, Duration.ofMinutes(1)));
    assertTrue(limits.allow("login", "client-a", 2, Duration.ofMinutes(1)));
    assertFalse(limits.allow("login", "client-a", 2, Duration.ofMinutes(1)));
    assertTrue(limits.allow("login", "client-b", 2, Duration.ofMinutes(1)));
    assertTrue(limits.allow("registration", "client-a", 2, Duration.ofMinutes(1)));
  }
}
