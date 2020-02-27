---
question: Why can't I see my cookies in the developer tools?
---

This is a common misunderstanding.

The developer tools will only show cookies for the current page. Cookies for cross-origin AJAX requests are *usually*
not regarded as being part of the current page, so they aren't shown.

Depending on the specifics of your scenario you may see the cookies in the developer tools or you may not. For example,
if you're running two servers on `localhost` with different ports then they will share a cookie domain, so the cookies
should show up.

Just because the cookies aren't shown in the developer tools doesn't mean that they don't exist.

To see the cross-origin cookies in the developer tools you'll need to open another tab with a URL that has the same
domain as the cookie. It doesn't matter exactly which URL you choose but you should be careful to pick a URL that won't
change the cookies itself. You'll also need to open a separate copy of the developer tools for the new tab. You should
then be able to see what cookies are set for that origin.

Alternatively, most browsers provide some mechanism for viewing all cookies. It's usually hiding somewhere in the
privacy settings. At the time of writing the following URIs will get you to the right place:

* **Chrome:** `chrome://settings/siteData`
* **Firefox:** `about:preferences#privacy`

Of course, the other reason why you may not be able to see the cookies in the developer tools is because no cookies are
being set. See {% include faq-link.md faq="cdc8" %} for more information.

---

Related:

* {% include faq-link.md faq="cdc8" %}
