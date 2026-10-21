package com.cryptoconnect.chat;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(DashboardController.class)
@Import(SecurityConfig.class)
@TestPropertySource(properties = "app.cors-origin=http://localhost:5173")
class DashboardControllerTest {
  @MockitoBean com.cryptoconnect.security.TokenRevocationService revocations;
  @Autowired MockMvc mvc;
  @MockitoBean DashboardService dashboard;
  @MockitoBean JwtService jwt;

  @Test void dashboardEndpointsRequireAuthentication() throws Exception {
    mvc.perform(get("/api/dashboard/stats")).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/dashboard/activity")).andExpect(status().isUnauthorized());
  }

  @Test void dashboardEndpointsUseTheAuthenticatedUser() throws Exception {
    UUID userId = UUID.randomUUID();
    var auth = authentication(new UsernamePasswordAuthenticationToken(userId, null, AuthorityUtils.NO_AUTHORITIES));
    when(dashboard.stats(userId)).thenReturn(new DashboardDtos.Stats(2, 3, 5, 4));
    when(dashboard.activity(userId, 7)).thenReturn(List.of());

    mvc.perform(get("/api/dashboard/stats").with(auth)).andExpect(status().isOk())
        .andExpect(jsonPath("$.totalConversations").value(2))
        .andExpect(jsonPath("$.messagesStored").value(5))
        .andExpect(jsonPath("$.unreadMessages").value(4));
    mvc.perform(get("/api/dashboard/activity").with(auth)).andExpect(status().isOk());

    verify(dashboard).stats(userId);
    verify(dashboard).activity(userId, 7);
  }

  @Test void activityWindowIsBounded() throws Exception {
    UUID userId = UUID.randomUUID();
    var auth = authentication(new UsernamePasswordAuthenticationToken(userId, null, AuthorityUtils.NO_AUTHORITIES));
    mvc.perform(get("/api/dashboard/activity?days=90").with(auth)).andExpect(status().isBadRequest());
  }
}
