package com.cryptoconnect.chat;

import com.cryptoconnect.security.AbuseProtectionInterceptor;
import com.cryptoconnect.security.JwtService;
import com.cryptoconnect.security.SecurityConfig;
import com.cryptoconnect.user.UserRepository;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ChatController.class)
@Import({SecurityConfig.class, AbuseProtectionInterceptor.class})
@TestPropertySource(properties = {
    "app.cors-origin=http://localhost:5173",
    "app.rate-limit.writes-per-minute=1"
})
class ChatMessageRateLimitTest {
  @Autowired MockMvc mvc;
  @MockitoBean com.cryptoconnect.security.TokenRevocationService revocations;
  @MockitoBean ConversationRepository conversations;
  @MockitoBean ConversationService conversationService;
  @MockitoBean MemberRepository members;
  @MockitoBean MessageRepository messages;
  @MockitoBean UserRepository users;
  @MockitoBean ChatMessageService chatMessages;
  @MockitoBean JwtService jwt;

  @Test
  void authenticatedUserCanSendMessageWithinLimit() throws Exception {
    UUID user = UUID.randomUUID();
    UUID conversation = UUID.randomUUID();
    stubSuccessfulSend();

    send(user, conversation, "client-1")
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.content").value("hello"));

    verify(chatMessages).send(eq(conversation), eq(user), any(ChatDtos.SendMessageRequest.class));
  }

  @Test
  void exceedingLimitReturnsEstablished429ResponseAcrossConversations() throws Exception {
    UUID user = UUID.randomUUID();
    stubSuccessfulSend();

    send(user, UUID.randomUUID(), "client-1").andExpect(status().isCreated());
    send(user, UUID.randomUUID(), "client-2")
        .andExpect(status().isTooManyRequests())
        .andExpect(header().string("Retry-After", "60"))
        .andExpect(jsonPath("$.error").value("Too many requests"));

    verify(chatMessages, times(1)).send(any(UUID.class), eq(user), any(ChatDtos.SendMessageRequest.class));
  }

  @Test
  void authenticatedUsersHaveSeparateMessageQuotas() throws Exception {
    UUID firstUser = UUID.randomUUID();
    UUID secondUser = UUID.randomUUID();
    UUID conversation = UUID.randomUUID();
    stubSuccessfulSend();

    send(firstUser, conversation, "first-user").andExpect(status().isCreated());
    send(secondUser, conversation, "second-user").andExpect(status().isCreated());

    verify(chatMessages).send(eq(conversation), eq(firstUser), any(ChatDtos.SendMessageRequest.class));
    verify(chatMessages).send(eq(conversation), eq(secondUser), any(ChatDtos.SendMessageRequest.class));
  }

  @Test
  void unauthenticatedSendIsRejectedBeforeTheRateLimitCanAuthorizeIt() throws Exception {
    mvc.perform(post("/api/conversations/{id}/messages", UUID.randomUUID())
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"clientMessageId\":\"client-1\",\"content\":\"hello\"}"))
        .andExpect(status().isUnauthorized());

    verifyNoInteractions(chatMessages);
  }

  private org.springframework.test.web.servlet.ResultActions send(UUID user, UUID conversation, String clientMessageId)
      throws Exception {
    return mvc.perform(post("/api/conversations/{id}/messages", conversation)
        .with(authentication(new UsernamePasswordAuthenticationToken(user, null, AuthorityUtils.NO_AUTHORITIES)))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"clientMessageId\":\"" + clientMessageId + "\",\"content\":\"hello\"}"));
  }

  private void stubSuccessfulSend() {
    when(chatMessages.send(any(UUID.class), any(UUID.class), any(ChatDtos.SendMessageRequest.class)))
        .thenAnswer(invocation -> {
          UUID conversationId = invocation.getArgument(0);
          UUID senderId = invocation.getArgument(1);
          ChatDtos.SendMessageRequest request = invocation.getArgument(2);
          ChatDtos.MessageResponse response = new ChatDtos.MessageResponse(
              UUID.randomUUID(), conversationId, senderId, request.clientMessageId(),
              ChatDtos.MessageFormat.TEXT, request.content(), Instant.now(), null, null);
          return new ChatMessageService.SendResult(response, true);
        });
  }
}
