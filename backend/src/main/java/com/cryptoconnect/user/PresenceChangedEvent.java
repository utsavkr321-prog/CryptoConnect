package com.cryptoconnect.user;

import java.util.UUID;

/** Contains only a subject and availability; connection and token details never leave the server. */
public record PresenceChangedEvent(UUID userId, boolean online) {}
