package com.cryptoconnect.chat;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {
  private final ChatRealtimeHandler handler;
  private final String allowedOrigin;

  public WebSocketConfig(ChatRealtimeHandler handler, @Value("${app.cors-origin}") String allowedOrigin) {
    this.handler = handler;
    this.allowedOrigin = allowedOrigin;
  }

  @Override
  public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
    registry.addHandler(handler, "/ws").setAllowedOrigins(allowedOrigin);
  }

  @org.springframework.context.annotation.Bean
  public ServletServerContainerFactoryBean webSocketContainer() {
    ServletServerContainerFactoryBean container = new ServletServerContainerFactoryBean();
    container.setMaxTextMessageBufferSize(70 * 1024);
    container.setMaxSessionIdleTimeout(300_000L);
    return container;
  }
}
