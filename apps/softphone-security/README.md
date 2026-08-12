# Softphone security service

This private Cloudflare Worker is reachable only through the softphone Pages
service binding. It provides two fail-closed controls for `POST /api/session`:

- exact, Durable Object-backed consumption of each signed handoff nonce; and
- an exact limit of ten token-exchange attempts per client address per minute.

The Pages Function hashes the client address before calling this service. The
service receives neither the Telnyx API key nor the signed handoff. Production
and preview use separate Workers and Durable Object namespaces.

The security service must be deployed before the corresponding Pages build.
Both deployments are ordered by `.github/workflows/softphone-pages.yml`.
