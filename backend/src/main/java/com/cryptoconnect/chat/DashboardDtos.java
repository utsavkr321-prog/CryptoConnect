package com.cryptoconnect.chat;

import java.time.LocalDate;

public final class DashboardDtos {
  private DashboardDtos() {}

  public record Stats(long totalConversations, long messagesSent, long messagesStored, long unreadMessages) {}

  public record ActivityPoint(LocalDate date, long total, long sent) {}
}
