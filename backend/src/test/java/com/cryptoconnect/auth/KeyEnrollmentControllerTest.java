package com.cryptoconnect.auth;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cryptoconnect.security.JwtService;
import com.cryptoconnect.security.SecurityConfig;
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

@WebMvcTest(KeyEnrollmentController.class)
@Import(SecurityConfig.class)
@TestPropertySource(properties = "app.cors-origin=http://localhost:5173")
class KeyEnrollmentControllerTest {
  @Autowired MockMvc mvc;
  @MockitoBean KeyEnrollmentService enrollment;
  @MockitoBean JwtService jwt;
  @MockitoBean com.cryptoconnect.security.TokenRevocationService revocations;

  private final UUID userId = UUID.randomUUID();
  private final UUID challengeId = UUID.randomUUID();

  private org.springframework.test.web.servlet.request.RequestPostProcessor auth() {
    return authentication(new UsernamePasswordAuthenticationToken(
        userId, null, AuthorityUtils.NO_AUTHORITIES));
  }

  @Test
  void validatesChallengeIdAsAUuidAndCompletesEnrollment() throws Exception {
    when(enrollment.enrollKey(org.mockito.ArgumentMatchers.eq(userId), org.mockito.ArgumentMatchers.any()))
        .thenReturn(new KeyEnrollmentDtos.KeyInfo("fingerprint"));

    mvc.perform(post("/api/auth/me/key").with(auth()).contentType(MediaType.APPLICATION_JSON)
        .content("{\"challengeId\":\"" + challengeId
            + "\",\"algorithm\":\"EC/P-256\",\"publicKey\":\"AQ==\",\"signature\":\"AQ==\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.keyFingerprint").value("fingerprint"));

    verify(enrollment).enrollKey(org.mockito.ArgumentMatchers.eq(userId), org.mockito.ArgumentMatchers.any());
  }

  @Test
  void rejectsMissingChallengeIdAsBadRequestRatherThanInternalServerError() throws Exception {
    mvc.perform(post("/api/auth/me/key").with(auth()).contentType(MediaType.APPLICATION_JSON)
        .content("{\"algorithm\":\"EC/P-256\",\"publicKey\":\"AQ==\",\"signature\":\"AQ==\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error").value("Validation failed"));

    verifyNoInteractions(enrollment);
  }

  @Test
  void keyEnrollmentRequiresAuthentication() throws Exception {
    mvc.perform(post("/api/auth/me/key").contentType(MediaType.APPLICATION_JSON)
        .content("{\"challengeId\":\"" + challengeId
            + "\",\"algorithm\":\"EC/P-256\",\"publicKey\":\"AQ==\",\"signature\":\"AQ==\"}"))
        .andExpect(status().isUnauthorized());

    verifyNoInteractions(enrollment);
  }
}
