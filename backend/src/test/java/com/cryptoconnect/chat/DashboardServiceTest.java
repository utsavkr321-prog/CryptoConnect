package com.cryptoconnect.chat;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DashboardServiceTest {
  private final ConversationRepository conversations = org.mockito.Mockito.mock(ConversationRepository.class);
  private final MessageRepository messages = org.mockito.Mockito.mock(MessageRepository.class);
  private final DashboardService service = new DashboardService(conversations, messages);

  @Test void statsAreScopedToTheAuthenticatedUsersConversationsAndMessages() {
    UUID userId = UUID.randomUUID();
    when(conversations.countOneToOneByUserId(userId)).thenReturn(3L);
    when(messages.countSentInOneToOneConversations(userId)).thenReturn(4L);
    when(messages.countStoredInOneToOneConversations(userId)).thenReturn(7L);
    when(messages.countUnreadInOneToOneConversations(userId)).thenReturn(2L);

    assertEquals(new DashboardDtos.Stats(3, 4, 7, 2), service.stats(userId));
    verify(conversations).countOneToOneByUserId(userId);
    verify(messages).countSentInOneToOneConversations(userId);
    verify(messages).countStoredInOneToOneConversations(userId);
    verify(messages).countUnreadInOneToOneConversations(userId);
  }

  @Test void activityIncludesZeroDaysAndReturnsActualConversationAndSentCounts() {
    UUID userId = UUID.randomUUID();
    LocalDate today = LocalDate.now(ZoneOffset.UTC);
    var point = org.mockito.Mockito.mock(DailyMessageActivityProjection.class);
    when(point.getDay()).thenReturn(today.toString());
    when(point.getTotal()).thenReturn(5L);
    when(point.getSent()).thenReturn(2L);
    when(messages.findDailyActivity(org.mockito.ArgumentMatchers.eq(userId), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
        .thenReturn(List.of(point));

    List<DashboardDtos.ActivityPoint> activity = service.activity(userId, 7);

    assertEquals(7, activity.size());
    assertEquals(new DashboardDtos.ActivityPoint(today, 5, 2), activity.get(6));
    assertEquals(0, activity.get(0).total());
  }
}
