# Derive Prospect identity at contact acceptance

PulpSense derives a stable opaque Prospect ID from the normalized accepted email using a versioned, environment-specific secret-keyed HMAC. The funnel server returns this ID only after durable contact acceptance and carries it through lifecycle events; this avoids adding a synchronous identity registry or depending on asynchronous Twenty processing, while accepting that cross-email identity merges require an explicit administrative operation and secret rotation requires a deliberate migration.
