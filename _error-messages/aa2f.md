---
message: Request header field content-type is not allowed by Access-Control-Allow-Headers in preflight response.
---

While the example message above mentions `content-type` it could equally reference almost any request header.

When performing a preflight `OPTIONS` request the browser will automatically include a request header called
`Access-Control-Request-Headers`. Its value will be a comma-separated list of the names of any custom header fields that
have been set on the original request.

When the server responds to the preflight request it should include the response header `Access-Control-Allow-Headers`.
This should list the custom header fields that the server is willing to allow.

If any of the custom headers listed in `Access-Control-Request-Headers` are not included in
`Access-Control-Allow-Headers` then the preflight will fail, leading to the error shown above. The error will name the
first header that was missing, though there may be others.

A value of `*` can also be used as a wildcard in `Access-Control-Allow-Headers`. However, this is not allowed when using
`withCredentials` and will result in the same error message.

---

#### Related

* {% include faq-link.html faq="b7f6" %}
* {% include faq-link.html faq="b040" %}.
