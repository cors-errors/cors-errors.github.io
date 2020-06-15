---
question: What is an opaque response?
related:
  - e9b8
---

If you're using the `fetch` API then you might have come across this message in Chrome:

<blockquote class="error">
  If an opaque response serves your needs, set the request's mode to 'no-cors' to fetch the resource with CORS disabled.
</blockquote>

It's shown at the end of some CORS error messages.

The first thing to appreciate is that disabling CORS does ***not*** mean disabling the *same-origin policy*. It is
important to be clear about the difference between the two.

An *opaque* response is an HTTP response where you can't access any of the details in your JavaScript code. It is opaque
in the sense that you can't look into it. That includes the status code, the headers and the body content. You may
notice that it's very similar to what happens when a response fails the CORS checks.

To make a `fetch` request with an opaque response set the `mode` to `'no-cors'`:

```js
fetch(url, {
  mode: 'no-cors'
}).then(response => {
  console.log(response.type) // logs the string 'opaque'
})
```

Some notes:

* The `mode` is only relevant for a cross-origin request, it doesn't matter for same-origin requests.
* Any CORS response headers will be ignored. Even if they are included you won't be able to read the response.
* A `GET` request won't include the `Origin` request header. It will still be included for `POST` requests, just like it
  would for same-origin requests.
* Only simple requests that do not require a preflight are allowed.
* There is no equivalent if you're using `XMLHttpRequest`.

A request made using `mode: 'no-cors'` won't undergo CORS checks in the browser, so the usual CORS error messages won't
be shown. But other than suppressing the error messages, what use is it?

In practice the use cases are pretty limited, so if you're seeing the error message mentioned earlier it is unlikely to
be the solution you want.

One use case is for requests where you handle success and failure exactly the same way. You try to tell the server to do
something but whether or not it succeeds doesn't have any impact on the UI.

Another use case is caching. The requests can be used to pre-populate caches for things like stylesheets where you don't
need to access the response details in JavaScript code.
