package com.cryptoconnect.chat;

import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {
  private final DashboardService dashboard;

  public DashboardController(DashboardService dashboard) {
    this.dashboard = dashboard;
  }

  @GetMapping("/stats")
  public DashboardDtos.Stats stats(Authentication authentication) {
    return dashboard.stats((java.util.UUID) authentication.getPrincipal());
  }

  @GetMapping("/activity")
  public List<DashboardDtos.ActivityPoint> activity(
      @RequestParam(defaultValue = "7") int days,
      Authentication authentication) {
    if (days < 1 || days > 30) {
      throw new org.springframework.web.server.ResponseStatusException(
          org.springframework.http.HttpStatus.BAD_REQUEST, "Days must be between 1 and 30");
    }
    return dashboard.activity((java.util.UUID) authentication.getPrincipal(), days);
  }
}
