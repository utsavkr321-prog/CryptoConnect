package com.cryptoconnect.user;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.server.ResponseStatusException;

class PresenceControllerTest {
  @Test void rejectsPresenceLookupForNonFriends() {
    PresenceRegistry presence = mock(PresenceRegistry.class);
    FriendService friends = mock(FriendService.class);
    PresenceController controller = new PresenceController(presence, friends);
    UUID viewer = UUID.randomUUID();
    UUID stranger = UUID.randomUUID();
    Authentication auth = mock(Authentication.class);
    when(auth.getPrincipal()).thenReturn(viewer);
    when(friends.areFriends(viewer, stranger)).thenReturn(false);

    ResponseStatusException error = assertThrows(ResponseStatusException.class,
        () -> controller.status(List.of(stranger), auth));
    assertEquals(HttpStatus.FORBIDDEN, error.getStatusCode());
  }

  @Test void returnsOnlyAFriendAvailability() {
    PresenceRegistry presence = mock(PresenceRegistry.class);
    FriendService friends = mock(FriendService.class);
    PresenceController controller = new PresenceController(presence, friends);
    UUID viewer = UUID.randomUUID();
    UUID friend = UUID.randomUUID();
    Authentication auth = mock(Authentication.class);
    when(auth.getPrincipal()).thenReturn(viewer);
    when(friends.areFriends(viewer, friend)).thenReturn(true);
    when(presence.isOnline(friend)).thenReturn(true);

    assertEquals(List.of(new PresenceController.PresenceResponse(friend, true)), controller.status(List.of(friend), auth));
  }
}
