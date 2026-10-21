package com.cryptoconnect.security;

import jakarta.servlet.*; import jakarta.servlet.http.*; import org.springframework.security.authentication.UsernamePasswordAuthenticationToken; import org.springframework.security.core.authority.AuthorityUtils; import org.springframework.security.core.context.SecurityContextHolder; import org.springframework.stereotype.Component; import org.springframework.web.filter.OncePerRequestFilter; import java.io.IOException;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
  private final JwtService jwt;
  private final TokenRevocationService revocations;
  public JwtAuthenticationFilter(JwtService jwt, TokenRevocationService revocations){this.jwt=jwt;this.revocations=revocations;}
  @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain) throws ServletException,IOException {
    String header=request.getHeader("Authorization");
    if(header != null) {
      if (!header.startsWith("Bearer ") || header.length() <= 7) { unauthorized(response); return; }
      try { String token=header.substring(7); var id=jwt.userId(token); if(revocations.isRevoked(jwt.tokenId(token))){unauthorized(response);return;} var auth=new UsernamePasswordAuthenticationToken(id,null,AuthorityUtils.NO_AUTHORITIES); SecurityContextHolder.getContext().setAuthentication(auth); }
      catch (RuntimeException invalidToken) { unauthorized(response); return; }
    }
    try { chain.doFilter(request,response); } finally { SecurityContextHolder.clearContext(); }
  }
  private void unauthorized(HttpServletResponse response) throws IOException { response.setStatus(HttpServletResponse.SC_UNAUTHORIZED); response.setContentType("application/json"); response.getWriter().write("{\"error\":\"Invalid or expired token\"}"); }
}
