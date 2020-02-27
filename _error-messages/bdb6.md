---
message: Redirect location '' contains a username and password, which is disallowed for cross-origin requests.
---

An old feature of URLs allows them to include a username and password near the beginning. e.g.:

```
http://admin:password123@example.com/
```

The use of this form of authentication is discouraged and support is somewhat limited.

If a server attempts to redirect a CORS request to a URL that contains this form of username and password then the
request will fail.

Typically the server will have returned a status code of `301`, `302`, `307` or `308` and the rejected URL will have
been specified in the `Location` response header.
