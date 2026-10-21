package com.cryptoconnect.user;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

class PresenceRegistryTest {
  @Test void firstAndFinalSessionPublishAvailabilityChanges() {
    ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);
    PresenceRegistry registry = new PresenceRegistry(events, 90);
    UUID user = UUID.randomUUID();

    registry.connect(user, "one");
    assertTrue(registry.isOnline(user));
    registry.disconnect("one");
    assertFalse(registry.isOnline(user));

    verify(events).publishEvent(new PresenceChangedEvent(user, true));
    verify(events).publishEvent(new PresenceChangedEvent(user, false));
  }

  @Test void oneDisconnectDoesNotMarkAUserOfflineWhileAnotherSessionIsActive() {
    ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);
    PresenceRegistry registry = new PresenceRegistry(events, 90);
    UUID user = UUID.randomUUID();

    registry.connect(user, "one");
    registry.connect(user, "two");
    registry.disconnect("one");

    assertTrue(registry.isOnline(user));
    verify(events, times(1)).publishEvent(new PresenceChangedEvent(user, true));
    registry.disconnect("two");
    assertFalse(registry.isOnline(user));
  }

  @Test void duplicateDisconnectAndStaleSessionsAreSafe() {
    ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);
    PresenceRegistry registry = new PresenceRegistry(events, 30);
    UUID user = UUID.randomUUID();

    registry.connect(user, "stale");
    registry.heartbeat("stale");
    registry.expireStaleSessions(Instant.now().plusSeconds(31));
    registry.disconnect("stale");

    assertFalse(registry.isOnline(user));
    verify(events, times(1)).publishEvent(new PresenceChangedEvent(user, false));
  }
}
