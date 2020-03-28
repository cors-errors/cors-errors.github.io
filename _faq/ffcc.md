---
question: What are the security implications of CORS?
---

It's almost impossible to provide a comprehensive list but here are some of the common concerns.

#### *Can't someone send the request via cURL to bypass the preflight or spoof the `Origin` header?*

Yes, they can.

This kind of attack has always been possible, even with servers that don't use CORS. The defence against these attacks
is typically two-fold:

1. Authentication and authorization checks to ensure the user sending the request is allowed to make the request.
2. Validation and/or sanitization of all the data on the request to ensure it's in an acceptable form.

Relying on a UI or web browser to perform these checks isn't sufficient, they need to be on the server.

#### *So what's the point of CORS if it can easily be bypassed?*

CORS aims to stop someone making a request *while pretending to be someone else*.

Let's say you open a webpage in your browser. The page you open is malicious: someone has put some JavaScript code into
the page that is trying to cause trouble. It fires off some HTTP requests to other websites pretending to be you. There
are two main varieties of mischief that it may try to inflict:

1. Stealing data. e.g. It might send a request to your webmail and grab a copy of your emails.
2. Changing data. e.g. Deleting the contents of your database or transferring money from your bank account or buying
   something on your behalf from an eCommerce site.

The `Access-Control-Allow-Origin` response header is primarily concerned with the first problem, *stealing data*. At the
network level the data is still transferred but if the `Access-Control-Allow-Origin` header doesn't allow the current
origin then the malicious script can't read the response.

For the second problem CORS has preflight requests. The potentially harmful request won't even be attempted unless the
preflight allows it.

It is important to appreciate that a 'malicious site' may not have started out as malicious. You may have even created
it yourself. The problem is XSS vulnerabilities, which allow hackers to inject their own code into the site. When you
enable CORS to allow requests from other sites you aren't just trusting the sites' developers not to be malicious,
you're also trusting them not to have any XSS vulnerabilities that leave your server exposed.

#### *Hmmm. That raises more questions than it answers. For starters, how does this malicious site pretend to be me?*

There are several options here.

The most obvious answer is *cookies*. If you've logged into a site and it uses cookies to identify you then those
cookies will be included by the browser on all requests to that site. The malicious script doesn't need direct access to
the cookies, it just makes a request and the browser includes the cookie automatically.

This type of browser magic falls under the heading of *ambient authority*. The `withCredentials` flag is used to control
three types of ambient authority:

1. Cookies.
2. The `Authorization` header as part of HTTP authentication. This shouldn't be confused with using the `Authorization`
   header explicitly as a custom request header, which is not ambient authority. See
   {% include faq-link.md faq="d926" %} for more information.
3. TLS client certificates.

These forms of ambient authority could have been left out of CORS altogether and some initial implementations didn't
allow them. However, enough developers wanted cookie support that the current compromise was eventually included.

If you're using cookies and don't need to support cross-origin requests then you should consider setting the directive
`SameSite` to either `Strict` or `Lax`. Browsers are gradually switching to `Lax` by default, away from the historical
default of `None`, but you don't need to wait if you set it explicitly.

#### *So if it wasn't for cookies we wouldn't need any of this response header nonsense?*

There are other forms of ambient authority that are less easy to avoid and which pose very real problems to the design
of CORS.

For example, a site could use IP addresses or network layout to prevent unauthorized access.

A common scenario is a site hosted on an internal network that allows access to anyone on that network. The 'security'
here assumes that the site isn't accessible outside the local network. An external hacker can't send HTTP requests
directly to the server. However, if someone on the internal network opens the hacker's malicious site then it can start
sending requests to those internal sites from within the browser. The page running in the browser is being used as a
bridge between the internal network and the outside world.

Router configuration pages are a particularly common example. Chances are your home internet connection includes a
router with a webpage to configure your home network.

#### *For the 'stealing data' problem, why not just return an empty response instead?*

For a new server you could do precisely that. However, CORS had to be designed to work with servers that already existed
and had no knowledge of CORS. Those servers won't have the relevant response headers so the browser will prevent access
to the response.

The response in that scenario still makes it to the browser and would be accessible in the developer tools. That isn't a
problem as the developer tools are only accessible to the person using the device. CORS isn't trying to protect the data
from that person. Quite the opposite, that person is the potential victim of the data theft. CORS is trying to stop a
malicious script embedded in the page from accessing the response and passing it on to someone else.

#### *Not all requests use a preflight. Doesn't this leave the door wide open to the hackers in cases where they don't need access to the response?*

Yes, it does.

However...

It is a door that was already open before CORS was introduced. This particular vulnerability goes by the name *CSRF* (or
*XSRF*), which stands for *cross-site request forgery*.

Historically a CSRF attack could be performed in various ways but the most interesting is probably an HTML `<form>`.
Such a form could be submitted via a `POST` request from the malicious site to pretty much anywhere. The same-origin
policy did not prevent form submissions, it just prevented the source page from accessing the response.

Roughly speaking, the requests that don't need a preflight are the same requests you could make using a `<form>`
instead.

While this is a security hole, it's a hole that has existed for a long time and techniques have been developed to
protect against it. CORS just tries not to make the hole any bigger.

#### *The `withCredentials` flag doesn't trigger a preflight. Wouldn't it be safer to always use a preflight check with cookies?*

It would. But, again, CORS isn't introducing any new security holes here. It's just retaining the holes that already
existed with HTML forms.

The gradual shift by browsers towards defaulting to `SameSite=Lax` should help to protect cookies from CSRF abuse going
forward.

#### *Why is a `*` value for `Access-Control-Allow-Origin` not allowed when using `withCredentials`?*

The reasoning goes something like this:

1. A `*` value exposes the content to any other webpage that wants it. This includes potentially malicious pages.
2. If the content is always the same, no matter who requests it, then exposing it to everyone isn't *necessarily* a
   problem.
3. However, if the request requires `withCredentials` to be set then the content isn't the same for everyone. Either
   access is restricted or the content varies by user. In this scenario the malicious page is now in a position to steal
   the version of the content that's accessible to the current user.

#### *But can't I just avoid the limitations on `*` by echoing back the `Origin` header in `Access-Control-Allow-Origin` instead?*

Unfortunately, yes you can. Some libraries will even do this for you.

This is just as bad as using `*`. The only reason CORS doesn't prevent it is because it can't. There's no way for the
browser to know that your server is indiscriminately echoing back the `Origin` header.

To be clear, there's nothing wrong with echoing back the `Origin` header for specific, trusted origins. That's precisely
how CORS is supposed to work. The problems arise when there aren't adequate restrictions on the origins that are
allowed.

If you're returning `Access-Control-Allow-Credentials: true` then you shouldn't be echoing back all origins in
`Access-Control-Allow-Origin`. Chances are you have a gaping security hole. Worse, as discussed earlier, hosting your
site behind a firewall on an internal network is unlikely to protect you.

#### *If I can't use `*`, is there a way to allow all subdomains, e.g. `*.example.com`?*

The CORS specification doesn't allow for this. Only the exact value `*` is special and it can't be used as a wildcard in
other values.

Configuring a server to echo back all origins for a particular domain can be quite tricky to get right. Consider the
following examples of origins:

```
http://example.com
https://www.example.com
http://evil-site-example.com
http://example.com.evil-site.com
```

We might want to support the first two origins, including `http`, `https` and all subdomains, but without matching the
other two. Those other two origins have `example.com` as a substring but they are totally unrelated domains that could
be under the control of anybody. Further, configuration based on regular expressions needs to be careful to escape the
`.` character to avoid it being treated as a wildcard.

You might think that no-one is going to bother attacking your site because it's small and not worth the effort.
Unfortunately these exploits can easily be found just by using scripts that trawl the web looking for vulnerable sites.
These hackers (usually script kiddies) aren't trying to attack your site specifically, they just set the script
running and wait for it to find a victim.

There's also a problem with the premise of this question. You probably shouldn't be trying to allow access to all
subdomains in the first place. If it isn't possible to list all the relevant subdomains explicitly then it probably
isn't safe to trust them all either. If any subdomain is running an application with an XSS vulnerability then it could
potentially be compromised.

#### *I read somewhere that `Access-Control-Allow-Origin: null` is potentially insecure. Why?*

If you aren't familiar with the special origin value `null` then see {% include faq-link.md faq="fe2a" %}.

Part of the problem is that some developers mistakenly believe that returning `null` is equivalent to omitting the
header altogether. A bit of basic testing may even seem to confirm that.

The reality is that returning `Access-Control-Allow-Origin: null` will allow any request with `Origin: null`.

Generally you can't set the `Origin` header in your client-side code, the browser will set it for you. However, it's
relatively easy to use iframes or HTTP redirects to coerce the browser into sending `Origin: null`. So if you allow
requests from `null` you're effectively allowing them from anywhere.

As we've already discussed, allowing requests from anywhere is fine under certain circumstances. However, in those
circumstances you can just use `Access-Control-Allow-Origin: *` instead.

#### *Where can I read more about the security implications of CORS?*

You might find these useful:

* {% include external-link.html href="https://w3c.github.io/webappsec-cors-for-developers/" %}
* {% include external-link.html href="https://portswigger.net/research/exploiting-cors-misconfigurations-for-bitcoins-and-bounties" %}

---

Related:

* {% include faq-link.md faq="fcd5" %}
* {% include faq-link.md faq="d926" %}
* {% include faq-link.md faq="fe2a" %}
