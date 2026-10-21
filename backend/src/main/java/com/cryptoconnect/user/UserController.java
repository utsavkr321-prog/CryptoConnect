package com.cryptoconnect.user;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Authenticated, privacy-minimal directory. Email, keys, and account metadata are never exposed. */
@RestController @RequestMapping("/api/users") public class UserController {
  private final UserRepository users; public UserController(UserRepository users) { this.users = users; }
  @GetMapping public DirectoryPage list(@RequestParam(defaultValue = "") String query, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size, Authentication auth) {
    if (query.trim().length() == 1 || query.length() > 120) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Search query must be empty or between 2 and 120 characters");
    if (page < 0 || size < 1 || size > 50) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid pagination");
    UUID me = (UUID) auth.getPrincipal();
    List<User> rows = users.findDirectory(query.trim(), page, size).stream().filter(user -> !user.getId().equals(me)).toList();
    boolean hasMore = rows.size() > size;
    return new DirectoryPage(rows.stream().limit(size).map(user -> new DirectoryUser(user.getId(), user.getDisplayName(), user.getCreatedAt())).toList(), page, hasMore);
  }
  public record DirectoryUser(UUID id, String name, Instant registeredAt) {}
  public record DirectoryPage(List<DirectoryUser> users, int page, boolean hasMore) {}
}
