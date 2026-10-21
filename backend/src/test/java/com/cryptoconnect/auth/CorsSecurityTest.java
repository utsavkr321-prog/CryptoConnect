package com.cryptoconnect.auth;

import com.cryptoconnect.events.SecurityEventService;
import com.cryptoconnect.security.JwtService;
import com.cryptoconnect.security.SecurityConfig;
import com.cryptoconnect.user.User;
import com.cryptoconnect.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import java.util.Optional;
import java.util.UUID;

@WebMvcTest(AuthController.class)
@Import(SecurityConfig.class)
@TestPropertySource(properties = "app.cors-origin=http://localhost:5173")
class CorsSecurityTest {
  @MockitoBean com.cryptoconnect.security.TokenRevocationService revocations;
  private static final String ALLOWED_ORIGIN = "http://localhost:5173";

  @Autowired MockMvc mvc;
  @MockitoBean UserRepository users;
  @MockitoBean PasswordEncoder encoder;
  @MockitoBean JwtService jwt;
  @MockitoBean SecurityEventService securityEvents;

  @Test void preflightAllowsRegistrationAndLoginFromConfiguredOrigin() throws Exception {
    for (String path : new String[] {"/api/auth/register", "/api/auth/login"}) {
      mvc.perform(options(path)
          .header("Origin", ALLOWED_ORIGIN)
          .header("Access-Control-Request-Method", "POST")
          .header("Access-Control-Request-Headers", "content-type"))
          .andExpect(status().isOk())
          .andExpect(header().string("Access-Control-Allow-Origin", ALLOWED_ORIGIN))
          .andExpect(header().string("Access-Control-Allow-Methods", org.hamcrest.Matchers.containsString("POST")))
          .andExpect(header().string("Access-Control-Allow-Headers", org.hamcrest.Matchers.containsString("content-type")));
    }
  }

  @Test void allowedOriginIsPresentOnRegistrationAndLoginErrorResponses() throws Exception {
    when(users.existsByEmailIgnoreCase("person@example.test")).thenReturn(true);
    mvc.perform(post("/api/auth/register")
        .header("Origin", ALLOWED_ORIGIN)
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"email\":\"person@example.test\",\"name\":\"Person\",\"password\":\"correctly-long-password\"}"))
        .andExpect(status().isConflict())
        .andExpect(header().string("Access-Control-Allow-Origin", ALLOWED_ORIGIN));

    mvc.perform(post("/api/auth/login")
        .header("Origin", ALLOWED_ORIGIN)
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"email\":\"person@example.test\",\"password\":\"correctly-long-password\"}"))
        .andExpect(status().isUnauthorized())
        .andExpect(header().string("Access-Control-Allow-Origin", ALLOWED_ORIGIN));
  }

  @Test void allowedOriginIsPresentOnSuccessfulRegistrationAndLoginResponses() throws Exception {
    String email = "person@example.test";
    String password = "correctly-long-password";
    when(users.existsByEmailIgnoreCase(email)).thenReturn(false);
    when(encoder.encode(password)).thenReturn("encoded-password");
    when(jwt.create(any(UUID.class), eq(email))).thenReturn("access-token");

    mvc.perform(post("/api/auth/register")
        .header("Origin", ALLOWED_ORIGIN)
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"email\":\"person@example.test\",\"name\":\"Person\",\"password\":\"correctly-long-password\"}"))
        .andExpect(status().isCreated())
        .andExpect(header().string("Access-Control-Allow-Origin", ALLOWED_ORIGIN))
        .andExpect(header().string("Content-Security-Policy", org.hamcrest.Matchers.containsString("default-src 'none'")))
        .andExpect(header().string("X-Frame-Options", "DENY"))
        .andExpect(header().string("Referrer-Policy", "strict-origin-when-cross-origin"));

    User user = new User(email, "Person", "encoded-password");
    when(users.findByEmailIgnoreCase(email)).thenReturn(Optional.of(user));
    when(encoder.matches(password, "encoded-password")).thenReturn(true);

    mvc.perform(post("/api/auth/login")
        .header("Origin", ALLOWED_ORIGIN)
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"email\":\"person@example.test\",\"password\":\"correctly-long-password\"}"))
        .andExpect(status().isOk())
        .andExpect(header().string("Access-Control-Allow-Origin", ALLOWED_ORIGIN));
  }

  @Test void preflightRejectsUnapprovedOrigin() throws Exception {
    mvc.perform(options("/api/auth/register")
        .header("Origin", "https://unapproved.example")
        .header("Access-Control-Request-Method", "POST")
        .header("Access-Control-Request-Headers", "content-type"))
        .andExpect(status().isForbidden())
        .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
  }
}
