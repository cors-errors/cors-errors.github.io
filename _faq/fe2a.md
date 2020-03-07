---
question: Why is my Origin 'null'?
---

Under some circumstances the request header `Origin` can be set to the special value `null`.

```
Origin: null
```

Note that this is the 4-character string `"null"`, not to be confused with the `null` keyword used by many programming
languages.

Within the browser the value of `location.origin` can also be the string `"null"`.

This special value is used whenever a proper origin value doesn't exist or can't be exposed for security reasons. The
request header may be `null` even if `location.origin` has a proper value.

Some examples:

* If the page is being loaded directly off the file-system using the `file:` scheme, without a web-server, it is still
  allowed to make HTTP requests but the `Origin` header will be `null`.
* Likewise, a page created using the `data:` scheme will have a `null` origin. e.g. `<iframe src="data:text/html,...">`.
  Here the `...` would be the URI-encoded contents of a web page to show in the `iframe`. The web page inside the
  `iframe` would have a `null` origin.
* An `iframe` using sandboxing, such as `<iframe src="..." sandbox="allow-scripts">`. Within the `iframe` the value of
  `location.origin` may be populated based on the `src` URL but any CORS requests will have a `null` origin.
* An HTTP redirect on a CORS request that changes the target origin. Even if the original request had a proper `Origin`
  header the redirected request will have `Origin: null`.

It is still possible for `null` to pass a CORS check, just like for any other `Origin` value:

```
Access-Control-Allow-Origin: null
```

It has been suggested that the specification should be changed to prevent `null` matching itself, so it is possible this
may stop working in future. As there are many different ways for `Origin` to be `null` it is quite difficult to target a
specific case on the server. The `Referer` header may still be available in some cases as a hint to what the `Origin`
would have been but that isn't reliable either. Generally it is recommended not to allow access from `null` origins
explicitly, though `Access-Control-Allow-Origin: *` can be used for genuinely open resources.

---

Related:

* {% include faq-link.md faq="b667" %}
* {% include faq-link.md faq="c320" %}
