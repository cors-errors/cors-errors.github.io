---
message: The 'Access-Control-Allow-Origin' header has a value 'http://example.com' that is not equal to the supplied origin.
---

This error indicates that the server response did include the header `Access-Control-Allow-Origin` but it was set to the
wrong value. For a request to succeed `Access-Control-Allow-Origin` must either be `*` or an exact match for the
`Origin` request header.
