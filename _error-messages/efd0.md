---
message: "Response to preflight request doesn't pass access control check: The value of the
         'Access-Control-Allow-Origin' header in the response must not be the wildcard '*' when the request's
         credentials mode is 'include'."
---

If the request is made using `XMLHttpRequest`, as opposed to `fetch`, then there'll be an extra line at the end of this
error:

<blockquote class="error">
  The credentials mode of requests initiated by the XMLHttpRequest is controlled by the withCredentials attribute.
</blockquote>

This error specifically refers to the preflight `OPTIONS` request but is otherwise identical to
{% include error-link.md message="dab3" text="an earlier error message" %}.

If you are unclear what a preflight `OPTIONS` request is then see {% include faq-link.md faq="b7f6" %}.
