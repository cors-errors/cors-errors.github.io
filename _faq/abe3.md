---
question: Why am I getting a CORS error when I'm not even using CORS?
---

If your website has attempted to make an HTTP request to a different site then the browser will try to use CORS. You
don't have a choice, it happens automatically. If the target server doesn't have CORS enabled then the request will fail
and the browser will log a CORS error to the console.

Using the same domain with two different port numbers is not sufficient to avoid CORS. The port number is considered
to be part of the *origin* when the browser decides whether or not to use CORS.

---

Related:

* {% include faq-link.md faq="d1a6" %}
* {% include faq-link.md faq="b667" %}
* {% include faq-link.md faq="f173" %}
