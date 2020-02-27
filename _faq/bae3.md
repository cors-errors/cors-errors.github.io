---
question: Which CORS response headers go on the preflight response and which go on the main response?
---

These two headers should be included on both the preflight and the main response:

* `Access-Control-Allow-Origin`
* `Access-Control-Allow-Credentials`

The following headers should only be included on the preflight response:

* `Access-Control-Allow-Methods`
* `Access-Control-Allow-Headers`
* `Access-Control-Max-Age`

The `Access-Control-Expose-Headers` header should only be included on the main response, not the preflight.

Most of these response headers are optional, depending on the circumstances. The only header that is always required for
a CORS request to succeed is `Access-Control-Allow-Origin`. For a preflight request, at least one of
`Access-Control-Allow-Methods` or `Access-Control-Allow-Headers` will also be required.
