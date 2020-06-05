---
message: The value of the 'Access-Control-Allow-Credentials' header in the response is '' which must be 'true' when the
         request's credentials mode is 'include'.
---

If the request is made using `XMLHttpRequest`, as opposed to `fetch`, then there'll be an extra line at the end of this
error:

<blockquote class="error">
  The credentials mode of requests initiated by the XMLHttpRequest is controlled by the withCredentials attribute.
</blockquote>

For requests that use `withCredentials` the server response must include the header `Access-Control-Allow-Credentials`
set to the value `true`.

If the message reports a value of `''` then that usually means the header is missing altogether rather than being
returned with an explicit empty value.

If the error message indicates that the current value is `'true, true'` then that suggests that the header is being
returned twice.

See also {% include faq-link.html faq="fcd5" %}.
