package com.cryptoconnect.web;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import com.cryptoconnect.events.SecurityEventService;
import com.cryptoconnect.security.JwtService;
import com.cryptoconnect.security.SecurityConfig;
import com.cryptoconnect.security.TokenRevocationService;
import com.cryptoconnect.user.UserRepository;
import org.springframework.data.mongodb.core.MongoTemplate;
import com.mongodb.client.MongoDatabase;
import org.bson.Document;

@WebMvcTest(HealthController.class)
@Import(SecurityConfig.class)
@TestPropertySource(properties = "app.cors-origin=http://localhost:5173")
class HealthControllerTest {
  @Autowired MockMvc mvc;
  @MockitoBean MongoTemplate mongo;
  @MockitoBean MongoDatabase database;
  @MockitoBean JwtService jwt;
  @MockitoBean TokenRevocationService revocations;
  @MockitoBean UserRepository users;
  @MockitoBean SecurityEventService securityEvents;

  @Test void livenessDoesNotRequireDatabase() throws Exception {
    mvc.perform(get("/health/live").accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk())
        .andExpect(content().json("{\"status\":\"UP\"}"));
  }

  @Test void readinessIsUpWhenDatabasePingSucceeds() throws Exception {
    when(mongo.getDb()).thenReturn(database);
    when(database.runCommand(org.mockito.ArgumentMatchers.any(Document.class))).thenReturn(new Document("ok", 1));

    mvc.perform(get("/health/ready").accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk())
        .andExpect(content().json("{\"status\":\"UP\"}"));
  }

  @Test void readinessIsUnavailableWhenDatabasePingFails() throws Exception {
    when(mongo.getDb()).thenReturn(database);
    when(database.runCommand(org.mockito.ArgumentMatchers.any(Document.class))).thenThrow(new RuntimeException("deliberately hidden"));

    mvc.perform(get("/health/ready").accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isServiceUnavailable())
        .andExpect(content().json("{\"status\":\"DOWN\"}"));
  }

  @Test void healthEndpointsDoNotExposeDatabaseDetails() throws Exception {
    when(mongo.getDb()).thenThrow(new RuntimeException("credential=hidden host=internal"));

    mvc.perform(get("/health/ready").accept(MediaType.APPLICATION_JSON))
        .andExpect(content().string("{\"status\":\"DOWN\"}"));
  }
}
