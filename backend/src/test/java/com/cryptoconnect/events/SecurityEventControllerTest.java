package com.cryptoconnect.events;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cryptoconnect.security.JwtService;
import com.cryptoconnect.security.SecurityConfig;
import java.util.List;
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

@WebMvcTest(SecurityEventController.class)
@Import(SecurityConfig.class)
@TestPropertySource(properties = "app.cors-origin=http://localhost:5173")
class SecurityEventControllerTest {
  @MockitoBean com.cryptoconnect.security.TokenRevocationService revocations;
  @Autowired MockMvc mvc;
  @MockitoBean SecurityEventService events;
  @MockitoBean JwtService jwt;

  @Test void listingRequiresAuthentication() throws Exception {
    mvc.perform(get("/api/security-events")).andExpect(status().isUnauthorized());
  }

  @Test void listAndCreateUseTheAuthenticatedUserId() throws Exception {
    UUID userId = UUID.randomUUID();
    var auth = authentication(new UsernamePasswordAuthenticationToken(userId, null, AuthorityUtils.NO_AUTHORITIES));
    when(events.listForUser(userId)).thenReturn(List.of());
    when(events.recordClientEvent(userId, "tamper_detected")).thenReturn(new SecurityEventDtos.EventResponse(
        UUID.randomUUID(), "tamper_detected", "warning", "Tampering detected", "A test event.",
        java.time.Instant.now(), false));

    mvc.perform(get("/api/security-events").with(auth)).andExpect(status().isOk()).andExpect(jsonPath("$").isArray());
    mvc.perform(post("/api/security-events").with(auth).contentType(MediaType.APPLICATION_JSON)
        .content("{\"type\":\"tamper_detected\"}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.isSimulated").value(false));

    verify(events).listForUser(userId);
    verify(events).recordClientEvent(userId, "tamper_detected");
  }
}
