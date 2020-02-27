---
message: The value of the 'Access-Control-Allow-Origin' header in the response must not be the wildcard '*' when the
         request's credentials mode is 'include'.
---

If the request is made using `XMLHttpRequest`, as opposed to `fetch`, then there'll be an extra line at the end of this
error:

<blockquote class="error">
  The credentials mode of requests initiated by the XMLHttpRequest is controlled by the withCredentials attribute.
</blockquote>

This error indicates that the `Access-Control-Allow-Origin` response header was included and had the value `*`. Using a
`*` wildcard is not allowed for requests that use `withCredentials`. Instead `Access-Control-Allow-Origin` must be an
exact match for the `Origin` request header.

See also {% include faq-link.md faq="fcd5" %}.
