package com.cryptoconnect.user;

import com.cryptoconnect.security.JwtService;
import com.cryptoconnect.security.SecurityConfig;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.mockito.Mockito.*;
import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;

/**
 * Verifies the authenticated paginated directory endpoint.
 * The directory exposes only id, name, and registeredAt — never email, password, or key material.
 */
@WebMvcTest(UserController.class)
@Import(SecurityConfig.class)
@TestPropertySource(properties = "app.cors-origin=http://localhost:5173")
class UserControllerTest {
  @MockitoBean com.cryptoconnect.security.TokenRevocationService revocations;
  @Autowired MockMvc mvc;
  @MockitoBean UserRepository users;
  @MockitoBean JwtService jwt;

  private final UUID currentUser = UUID.randomUUID();

  private org.springframework.test.web.servlet.request.RequestPostProcessor auth() {
    return authentication(new UsernamePasswordAuthenticationToken(currentUser, null, AuthorityUtils.NO_AUTHORITIES));
  }

  @Test void directoryReturnsMinimalPublicFields() throws Exception {
    User match = new User("match@example.test", "Matching User", "hash");
    match.setPublicKey("private-to-the-directory-response");
    match.setKeyFingerprint("fingerprint");
    when(users.findDirectory("al", 0, 20)).thenReturn(List.of(match));

    mvc.perform(get("/api/users").param("query", "al").with(auth()))
        .andExpect(status().isOk())
        // DirectoryPage envelope
        .andExpect(jsonPath("$.users", hasSize(1)))
        .andExpect(jsonPath("$.page").value(0))
        // email, hash, and key material must never appear in directory responses
        .andExpect(jsonPath("$.users[0].email").doesNotExist())
        .andExpect(jsonPath("$.users[0].passwordHash").doesNotExist())
        .andExpect(jsonPath("$.users[0].publicKey").doesNotExist())
        .andExpect(jsonPath("$.users[0].keyFingerprint").doesNotExist())
        // safe public fields
        .andExpect(jsonPath("$.users[0].name").value("Matching User"));
    verify(users).findDirectory("al", 0, 20);
  }

  @Test void trimsQueryBeforeForwardingToRepository() throws Exception {
    User match = new User("match@example.test", "Matching User", "hash");
    when(users.findDirectory("al", 0, 20)).thenReturn(List.of(match));

    mvc.perform(get("/api/users").param("query", "  al  ").with(auth()))
        .andExpect(status().isOk());
    // query must be trimmed before reaching the repository
    verify(users).findDirectory("al", 0, 20);
  }

  @Test void excludesTheAuthenticatedUserFromDirectoryResults() throws Exception {
    User self = new User("self@example.test", "Self User", "hash");
    org.springframework.test.util.ReflectionTestUtils.setField(self, "id", currentUser);
    User other = new User("other@example.test", "Other User", "hash");
    // repository returns size+1 to check hasMore; controller filters self, then limits to size
    when(users.findDirectory("us", 0, 20)).thenReturn(List.of(self, other));

    mvc.perform(get("/api/users").param("query", "us").with(auth()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.users", hasSize(1)))
        .andExpect(jsonPath("$.users[0].id").value(other.getId().toString()));
  }

  @Test void directorySearchRequiresAuthentication() throws Exception {
    mvc.perform(get("/api/users").param("query", "al"))
        .andExpect(status().isUnauthorized());
    verifyNoInteractions(users);
  }

  @Test void rejectsSingleCharacterQueries() throws Exception {
    mvc.perform(get("/api/users").param("query", "a").with(auth()))
        .andExpect(status().isBadRequest());
    verifyNoInteractions(users);
  }

  @Test void emptyQueryIsAllowedForBrowsing() throws Exception {
    when(users.findDirectory("", 0, 20)).thenReturn(List.of());

    mvc.perform(get("/api/users").param("query", "").with(auth()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.users", hasSize(0)));
    verify(users).findDirectory("", 0, 20);
  }

  @Test void paginationParametersAreForwardedToRepository() throws Exception {
    when(users.findDirectory("bob", 2, 10)).thenReturn(List.of());

    mvc.perform(get("/api/users").param("query", "bob").param("page", "2").param("size", "10").with(auth()))
        .andExpect(status().isOk());
    verify(users).findDirectory("bob", 2, 10);
  }

  @Test void invalidPaginationIsRejected() throws Exception {
    mvc.perform(get("/api/users").param("size", "0").with(auth()))
        .andExpect(status().isBadRequest());
    mvc.perform(get("/api/users").param("size", "51").with(auth()))
        .andExpect(status().isBadRequest());
    verifyNoInteractions(users);
  }
}
