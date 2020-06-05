---
message: The value of the 'Access-Control-Allow-Origin' header in the response must not be the wildcard '*' when the
         request's credentials mode is 'include'.
---

If the request is made using `XMLHttpRequest`, as opposed to `fetch`, then there'll be an extra line at the end of this
error:

<blockquote class="error">
  The credentials mode of requests initiated by the XMLHttpRequest is controlled by the withCredentials attribute.
</blockquote>

This error indicates that the `Access-Control-Allow-Origin` response header had the value `*`. Using a `*` wildcard is
not allowed for requests that use `withCredentials`.

In many cases `withCredentials` isn't required and can simply be removed. If you aren't using cookies then you probably
don't need it. For more information see {% include faq-link.html faq="fcd5" %}.

If you do need `withCredentials` then you'll have to change the server so that it doesn't return `*` for
`Access-Control-Allow-Origin`. Instead the server should check that the `Origin` request header contains an allowed
origin before echoing that origin value back in `Access-Control-Allow-Origin`.

If you want to understand why this restriction on using `*` exists then see {% include faq-link.html faq="ffcc" %}. By
extension it's important that the server does not simply echo back all origins: only trusted origins should be allowed.

There are browser extensions that automatically set the `Access-Control-Allow-Origin` header to `*`, overriding any
value set by the server. These tools can trigger the error message above, even if the server is returning all of the
correct headers.
