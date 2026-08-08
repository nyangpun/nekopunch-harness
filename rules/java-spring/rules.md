# Java / Spring Boot Rules

Applies when `build.gradle*` or `pom.xml` declares `spring-boot` (see
`skills/agent-sort`).

- Controllers stay thin; business logic lives in services.
- Use constructor injection, not field injection.
- DB access through Spring Data JPA repositories; raw JDBC only when JPA
  can't express the query.
- DTOs at the controller boundary; never leak JPA entities directly.

<!-- extend as conventions solidify -->
