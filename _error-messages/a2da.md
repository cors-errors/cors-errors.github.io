---
message: "Response to preflight request doesn't pass access control check: Redirect is not allowed for a preflight
         request."
---

For a preflight `OPTIONS` request to succeed the response status code must be in the range `200` to `299`. Common
choices are `200` and `204`.

Several status codes in the range `300` to `399` can be used to attempt a redirect in conjunction with the `Location`
header. This is allowed for the main request but not for the preflight. Attempting a redirect on the preflight will
trigger the error above.

Even if you aren't intentionally using redirects there are two common ways that they can creep in:

1. Redirecting from `http` to `https`.
2. Redirecting to add or remove a trailing URL slash. e.g. A server may redirect `http://example.com/api/users` to
   `http://example.com/api/users/` or vice-versa.

While the server should not be attempting to redirect the preflight `OPTIONS` request it is usually trivial to fix in
the client by updating the URL to avoid the redirect altogether.

---

Related:

* {% include faq-link.md faq="c320" %}
