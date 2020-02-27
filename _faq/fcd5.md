---
question: What is withCredentials? How do I enable it?
---

`withCredentials` is a flag that can be set on `XMLHttpRequest` for cross-origin requests. It is usually used to enable
cookies. It is also required to enable browser-based HTTP authentication, though that can also be implemented manually.

Note that `withCredentials` is only required for specific forms of 'credentials'. Just because you're using some form of
authentication with credentials doesn't necessarily mean that you need to enable `withCredentials`.

If you're using `XMLHttpRequest` directly it would be set as follows:

```js
const httpRequest = new XMLHttpRequest();
httpRequest.withCredentials = true;
```

It can be set at any point prior to calling `httpRequest.send()`.

For making requests with `fetch` the equivalent of `withCredentials` is setting `credentials` to `'include'`:

```js
fetch(url, {
  credentials: 'include'
});
```

With **jQuery** the `withCredentials` flag can be set using:

```js
jQuery.ajax({
  // ...other settings...

  xhrFields: {
    withCredentials: true
  }
});
```

For **axios**:

```js
axios.post(url, body, {
  withCredentials: true
});
```

Note that `withCredentials` is *not* a header and should be included directly in the request options.

The use of `withCredentials` is not a factor in determining whether a preflight request is required. Even though
`withCredentials` can lead to the automatic inclusion of `Cookie` and `Authorization` headers on the request they are
not considered to be custom headers for the purposes of the preflight check.

When using `withCredentials` the server response must include the header `Access-Control-Allow-Credentials: true`,
otherwise the request will fail the CORS check. This header must also be included on the preflight response, if there is
one.

The use of `*` wildcards in CORS response headers is also prohibited when using `withCredentials`. So if you're using
`Access-Control-Allow-Origin: *` you're going to have to change that to return the specific origin for the request.

While Safari does support `withCredentials` it tends to have a stricter security policy than other browsers. If you need
to use `withCredentials` then you should test in Safari sooner rather than later to check whether what you're trying to
do is actually allowed. For example, to set cookies you will need both origins to share the same domain.

---

Related:

* {% include faq-link.md faq="cdc8" %}
* {% include faq-link.md faq="d926" %}
