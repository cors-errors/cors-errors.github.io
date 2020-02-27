---
question: How can I include authorization headers on the preflight OPTIONS request?
---

You can't. The server must be configured to respond to the preflight `OPTIONS` request without any authentication
headers being present.

If you're using a filter or middleware layer on the server to block all unauthorized requests then you'll need to
provide an exception for the preflight `OPTIONS` requests.
