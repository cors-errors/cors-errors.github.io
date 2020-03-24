---
message: The 'Access-Control-Allow-Origin' header has a value 'http://example.com' that is not equal to the supplied origin.
---

This error indicates that the server response did include the header `Access-Control-Allow-Origin` but it was set to the
wrong value. For a request to succeed `Access-Control-Allow-Origin` must either be `*` or an exact match for the
`Origin` request header.

If you are making the request using the `fetch` API then you'll also see the following text at the end of the error
message:

<blockquote class="error">
  Have the server send the header with a valid value, or, if an opaque response serves your needs, set the request's
  mode to 'no-cors' to fetch the resource with CORS disabled.
</blockquote>

For more information about opaque responses see {% include faq-link.md faq="dfdb" %}. Using an opaque response will
suppress the error message but it won't allow you to access the response details.
