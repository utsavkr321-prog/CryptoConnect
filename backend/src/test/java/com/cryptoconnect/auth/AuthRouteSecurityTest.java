package com.cryptoconnect.auth;

import com.cryptoconnect.events.SecurityEventService;
import com.cryptoconnect.security.SecurityConfig;
import com.cryptoconnect.security.JwtService;
import com.cryptoconnect.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.TestPropertySource;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthController.class)
@Import(SecurityConfig.class)
@TestPropertySource(properties = "app.cors-origin=http://localhost:5173")
class AuthRouteSecurityTest {
  @MockitoBean com.cryptoconnect.security.TokenRevocationService revocations;
  @Autowired MockMvc mvc;
  @MockitoBean UserRepository users;
  @MockitoBean PasswordEncoder encoder;
  @MockitoBean JwtService jwt;
  @MockitoBean SecurityEventService securityEvents;

  @Test void meRequiresAuthentication() throws Exception {
    mvc.perform(get("/api/auth/me").accept(MediaType.APPLICATION_JSON)).andExpect(status().isUnauthorized());
  }

  @Test void malformedBearerTokenCannotAccessProtectedRoute() throws Exception {
    mvc.perform(get("/api/auth/me").header("Authorization", "Bearer").accept(MediaType.APPLICATION_JSON)).andExpect(status().isUnauthorized());
  }
}
