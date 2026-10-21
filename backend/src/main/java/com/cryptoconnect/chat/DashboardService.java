package com.cryptoconnect.chat;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class DashboardService {
  private final ConversationRepository conversations;
  private final MessageRepository messages;

  public DashboardService(ConversationRepository conversations, MessageRepository messages) {
    this.conversations = conversations;
    this.messages = messages;
  }

  public DashboardDtos.Stats stats(UUID userId) {
    return new DashboardDtos.Stats(
        conversations.countOneToOneByUserId(userId),
        messages.countSentInOneToOneConversations(userId),
        messages.countStoredInOneToOneConversations(userId),
        messages.countUnreadInOneToOneConversations(userId));
  }

  public List<DashboardDtos.ActivityPoint> activity(UUID userId, int days) {
    LocalDate today = LocalDate.now(ZoneOffset.UTC);
    LocalDate firstDay = today.minusDays(days - 1L);
    var fromDate = firstDay.atStartOfDay().toInstant(ZoneOffset.UTC);
    var untilDate = today.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC);
    Map<LocalDate, DailyMessageActivityProjection> daily = new HashMap<>();
    messages.findDailyActivity(userId, fromDate, untilDate).forEach(point ->
        daily.put(LocalDate.parse(point.getDay()), point));

    return java.util.stream.LongStream.range(0, days)
        .mapToObj(offset -> firstDay.plusDays(offset))
        .map(date -> {
          DailyMessageActivityProjection point = daily.get(date);
          return new DashboardDtos.ActivityPoint(date,
              point == null ? 0 : point.getTotal(),
              point == null ? 0 : point.getSent());
        })
        .toList();
  }
}
