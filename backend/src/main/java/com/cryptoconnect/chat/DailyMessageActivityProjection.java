package com.cryptoconnect.chat;

public interface DailyMessageActivityProjection {
  String getDay();
  long getTotal();
  long getSent();
}
