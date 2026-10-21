-- Flyway's role owns schema objects. Grant only runtime data access after each successful migration.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO cryptoconnect_app;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE flyway_schema_history FROM cryptoconnect_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cryptoconnect_app;
