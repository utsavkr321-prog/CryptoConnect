package com.cryptoconnect.events;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.mockito.ArgumentMatchers.any;

class SecurityEventServiceTest {
  private final SecurityEventRepository repository = org.mockito.Mockito.mock(SecurityEventRepository.class);
  private final SecurityEventService service = new SecurityEventService(repository);

  @Test void recordsOnlyCataloguedEventsForTheProvidedUserWithoutCallerSuppliedText() {
    UUID userId = UUID.randomUUID();
    when(repository.save(any(SecurityEventRecord.class))).thenAnswer(invocation -> invocation.getArgument(0));

    SecurityEventDtos.EventResponse response = service.record(userId, "message_sent");

    assertEquals("message_sent", response.type());
    assertEquals("Message sent", response.title());
    assertEquals("Ciphertext was stored for a conversation.", response.description());
    assertEquals("info", response.severity());
    org.mockito.ArgumentCaptor<SecurityEventRecord> event = org.mockito.ArgumentCaptor.forClass(SecurityEventRecord.class);
    verify(repository).save(event.capture());
    assertEquals(userId, event.getValue().getUserId());
  }

  @Test void rejectsUnsupportedEventTypes() {
    assertThrows(ResponseStatusException.class, () -> service.record(UUID.randomUUID(), "made_up"));
  }

  @Test void clientsCannotForgeServerRecordedAuthenticationEvents() {
    assertThrows(ResponseStatusException.class,
        () -> service.recordClientEvent(UUID.randomUUID(), "login_success"));
  }

  @Test void listsOnlyTheRequestedUsersRecentEvents() {
    UUID userId = UUID.randomUUID();
    when(repository.findTop100ByUserIdOrderByCreatedAtDesc(userId)).thenReturn(List.of());

    assertEquals(List.of(), service.listForUser(userId));
    verify(repository).findTop100ByUserIdOrderByCreatedAtDesc(userId);
  }
}
