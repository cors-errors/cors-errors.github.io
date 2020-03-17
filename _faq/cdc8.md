---
question: Why aren't my cookies working with CORS?
---

There are several questions in one here:

1. How can cookies be set using the `Set-Cookie` response header using CORS?
2. {% include faq-link.md faq="fdb1" %}. This is so common it gets a separate question in the FAQ.
3. Can CORS cookies be accessed from JavaScript using `document.cookie`?
4. I've set the cookies but they aren't being included on subsequent CORS requests. Why?

There's a complication that warrants mentioning up front. Cookies are bound to a *domain* and *path*, not an *origin*.
So we've actually got two slightly different concepts of 'same site' to juggle. Fun times.

#### Setting a cookie with `Set-Cookie`

Even if you aren't using CORS a cookie can disappear because one of its directives is incorrectly set. As that isn't
relevant to CORS we aren't going to go into detail here but you should check that directives such as `Expires`,
`Max-Age`, `Domain`, `Secure`, etc. aren't set to inappropriate values.

Now let's consider the case where the domains/origins are totally different. We'll come back to the muddy waters in the
middle later.

If you're using `XMLHttpRequest` to make a CORS request then you'll need to set the `withCredentials` flag to `true`.
For `fetch` the equivalent setting is `credentials: 'include'`. For more information on that see
{% include faq-link.md faq="fcd5" %}.

Once you've set this flag you'll likely see a number of errors and warnings in your browser's console. What follows
below is mostly just an explanation of how to fix those errors.

<!-- TODO: you don't need Access-Control- response headers for Set-Cookie to work, just withCredentials -->

On the server, as well as returning the `Set-Cookie` and `Access-Control-Allow-Origin` headers, you'll also need to
return an extra CORS header to allow credentials:

```
Access-Control-Allow-Credentials: true
```

If the request requires a preflight then that must also include this header.

Using credentials disables the `*` wildcard for the other CORS response headers, so if you're using that you'll need to
replace it with explicit values. The most common problems are with `Access-Control-Allow-Origin`, which will need to
return the exact value of the `Origin` request header instead of `*`.

Then there's the `SameSite` directive of `Set-Cookie` to consider. For *cross-domain* requests it needs to be set to
`None` or the cookie will be ignored. Note that *cross-domain* isn't quite the same thing as *cross-origin*, we'll
elaborate on that distinction shortly. In most browsers `None` is the default value but as of Chrome 80 this is
changing:

[https://www.chromium.org/updates/same-site](https://www.chromium.org/updates/same-site)

From February 2020 Chrome will be transitioning the default value to `Lax`, so `SameSite=None` will need to be set
explicitly.

As part of the same transition, Chrome will also require that cookies using `SameSite=None` also use the `Secure`
directive, which requires `https`. So if you want to use *cross-domain* cookies you're going to need `https`.

Putting all those headers together we get something like this:

```
Access-Control-Allow-Origin: example.com
Access-Control-Allow-Credentials: true
Set-Cookie: my-cookie=value; SameSite=None; Secure
```

Even if you do all this the cookie still won't be set in Safari, which has tighter security restrictions than other
browsers. There is a workaround though...

<!-- TODO: header checker needs to take domain into account -->

At this point we need to go back to those muddy waters around origins and cookie domains.

Let's consider a website running at `http://localhost:8080` making AJAX requests to `http://localhost:3000`. The ports
don't match so they have different *origins*. We're in CORS territory.

However, a *cookie domain* is not the same thing as an *origin*. Cookies for both of these server will have a domain of
*localhost*. The port is ignored. So from a cookie-domain perspective they count as the same site.

Keep in mind that cookies were introduced to the web a long time ago. If they were introduced from scratch today they
would likely be designed very differently.

So continuing with our example website running at `http://localhost:8080`, it has the same *cookie domain* as
`http://localhost:3000`. They share a cookie jar. In JavaScript code the cookies will be accessible via
`document.cookie`, no matter which of the two servers set a particular cookie. The `SameSite` directive can be set to
`None`, `Lax` or `Strict` - it doesn't matter because from a cookie perspective they count as the same site. You'll
still need to use `Secure` if you want `SameSite=None` with newer browsers but if both of your servers share a domain
you probably don't want to be using `SameSite=None` anyway.

Using a shared cookie domain isn't limited to `localhost` but it is a little more complicated once subdomains get
involved. If you have a website running at `http://www.example.com` making AJAX requests to `http://api.example.com`
then they won't share cookies by default. However, a cookie can be shared by explicitly setting the `Domain` to
`example.com`:

```
Set-Cookie: my-cookie=value; Domain=example.com
```

Even Safari will allow cross-origin cookies to be set so long as they share a cookie domain.

If you've read all that and still can't figure out why your cookies aren't being set, try using our
[CORS header checker](/header-checker) to check that you're setting the response headers correctly. Also take a look at
{% include faq-link.md faq="fdb1" %}.

#### Accessing a cookie with `document.cookie`

A cookie set via a CORS request can be accessed in JavaScript via `document.cookie` but only if the cookie's *domain*
is a match for the current page. Whether a CORS request was used to set the cookie is not actually relevant.

#### Including a cookie on a CORS request

Let's assume that you've successfully managed to set a cookie for the correct domain. How do you include that on
subsequent CORS requests to that domain?

The process is quite similar to setting a cookie using CORS. The `withCredentials` flag must be set to `true` and the
server will need to return `Access-Control-Allow-Credentials: true`. As before, wildcards won't be supported for any
CORS response headers.

Cookies with a `SameSite` value of `Strict` or `Lax` will only be sent if the page domain matches the cookie domain. If
the domains don't match then `SameSite` must be `None`. This is consistent with setting a cookie using CORS so it will
only be a problem if the cookie was set by some other means.

While Safari has tighter restrictions for setting cookies, the rules for including cookies on subsequent requests are
much the same as for other browsers. So while a same-domain request may be required to set the cookie, it can then be
included on a cross-domain request from a different page.

---

Related:

* {% include faq-link.md faq="fdb1" %}
* {% include faq-link.md faq="fcd5" %}
* {% include faq-link.md faq="ffcc" %}
