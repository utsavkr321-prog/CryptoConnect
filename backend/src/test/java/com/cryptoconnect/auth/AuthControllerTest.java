package com.cryptoconnect.auth;

import com.cryptoconnect.events.SecurityEventService;
import com.cryptoconnect.security.JwtService;
import com.cryptoconnect.security.SecurityConfig;
import com.cryptoconnect.user.User;
import com.cryptoconnect.user.UserRepository;
import java.util.Optional;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AuthController.class)
@Import(SecurityConfig.class)
@TestPropertySource(properties = {
    "app.cors-origin=http://localhost:5173",
    "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration"
})
class AuthControllerTest {
  @MockitoBean com.cryptoconnect.security.TokenRevocationService revocations;
  @Autowired MockMvc mvc;
  @MockitoBean UserRepository users;
  @MockitoBean PasswordEncoder encoder;
  @MockitoBean JwtService jwt;
  @MockitoBean SecurityEventService securityEvents;

  @Test void invalidCredentialsReturnGenericStructuredUnauthorizedResponse() throws Exception {
    when(users.findByEmailIgnoreCase("person@example.test")).thenReturn(Optional.empty());
    mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
        .content("{\"email\":\"person@example.test\",\"password\":\"correctly-long-password\"}"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.error").value("Invalid email or password"))
        .andExpect(jsonPath("$.timestamp").exists());
    verifyNoInteractions(encoder);
  }

  @Test void duplicateRegistrationReturnsStructuredConflict() throws Exception {
    when(users.existsByEmailIgnoreCase("person@example.test")).thenReturn(true);
    mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
        .content("{\"email\":\"Person@example.test\",\"name\":\"Person\",\"password\":\"correctly-long-password\"}"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.error").value("An account with this email already exists"));
    verify(users).existsByEmailIgnoreCase("person@example.test");
  }

  @Test void successfulRegistrationRecordsAnAccountCreatedEvent() throws Exception {
    when(users.existsByEmailIgnoreCase("person@example.test")).thenReturn(false);
    when(encoder.encode("correctly-long-password")).thenReturn("encoded-password");
    when(jwt.create(any(), eq("person@example.test"))).thenReturn("token");

    mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
        .content("{\"email\":\"person@example.test\",\"name\":\"Person\",\"password\":\"correctly-long-password\"}"))
        .andExpect(status().isCreated());

    verify(securityEvents).record(any(), eq("account_created"));
  }

  @Test void knownAccountSignInFailuresAreRecordedWithoutRequestCredentials() throws Exception {
    User account = new User("person@example.test", "Person", "encoded-password");
    when(users.findByEmailIgnoreCase("person@example.test")).thenReturn(Optional.of(account));
    when(encoder.matches("wrong-password", "encoded-password")).thenReturn(false);

    mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
        .content("{\"email\":\"person@example.test\",\"password\":\"wrong-password\"}"))
        .andExpect(status().isUnauthorized());

    verify(securityEvents).record(account.getId(), "login_failure");
  }

  @Test void successfulSignInRecordsTheAuthenticatedAccount() throws Exception {
    User account = new User("person@example.test", "Person", "encoded-password");
    when(users.findByEmailIgnoreCase("person@example.test")).thenReturn(Optional.of(account));
    when(encoder.matches("correctly-long-password", "encoded-password")).thenReturn(true);
    when(jwt.create(account.getId(), account.getEmail())).thenReturn("token");

    mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
        .content("{\"email\":\"person@example.test\",\"password\":\"correctly-long-password\"}"))
        .andExpect(status().isOk());

    verify(securityEvents).record(account.getId(), "login_success");
  }

  @Test void profileUpdateOnlyChangesTheAuthenticatedUsersDisplayName() throws Exception {
    User account = new User("person@example.test", "Person", "encoded-password");
    when(users.findById(account.getId())).thenReturn(Optional.of(account));
    when(users.save(account)).thenReturn(account);
    var authenticated = org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication(
        new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
            account.getId(), null, org.springframework.security.core.authority.AuthorityUtils.NO_AUTHORITIES));

    mvc.perform(patch("/api/auth/me").with(authenticated).contentType(MediaType.APPLICATION_JSON)
        .content("{\"name\":\" Updated Person \"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(account.getId().toString()))
        .andExpect(jsonPath("$.email").value("person@example.test"))
        .andExpect(jsonPath("$.name").value("Updated Person"))
        .andExpect(jsonPath("$.passwordHash").doesNotExist())
        .andExpect(jsonPath("$.privateKey").doesNotExist())
        .andExpect(jsonPath("$.token").doesNotExist());
    verify(users).save(account);
    org.junit.jupiter.api.Assertions.assertEquals("Updated Person", account.getDisplayName());
  }

  @Test void profileUpdateRequiresAuthentication() throws Exception {
    mvc.perform(patch("/api/auth/me").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Changed\"}"))
        .andExpect(status().isUnauthorized());
    verifyNoInteractions(users);
  }

  @Test void logoutRevokesThePresentedAccessToken() throws Exception {
    String token = "valid-access-token";
    UUID tokenId = UUID.randomUUID();
    Instant expiresAt = Instant.now().plusSeconds(600);
    when(jwt.userId(token)).thenReturn(UUID.randomUUID());
    when(jwt.tokenId(token)).thenReturn(tokenId);
    when(jwt.expiresAt(token)).thenReturn(expiresAt);

    mvc.perform(post("/api/auth/logout").header("Authorization", "Bearer " + token))
        .andExpect(status().isNoContent());

    verify(revocations).revoke(tokenId, expiresAt);
  }
}
