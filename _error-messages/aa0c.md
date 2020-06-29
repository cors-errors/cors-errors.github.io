---
message: "Response to preflight request doesn't pass access control check: It does not have HTTP ok status."
---

For a preflight `OPTIONS` request to succeed the response status code must be in the range `200` to `299`. Common
choices are `200` and `204`.

Any other status code will cause the preflight check to fail. That includes attempts at authentication using a `401`
status code. If you have a server-side authorization layer you'll need to ensure it doesn't interfere with preflight
requests.

The best place to start with debugging this error is to check which status code is coming back. There may also be a
response body that provides further information.

The other thing to check is the request URL. Specifically check in the developer tools rather than in your code. Make
sure the URL really is what you intended. Depending on how the server is configured there are several different status
codes you might receive if the URL is wrong.

Attempts to redirect to a different URL will typically show a different error message. See
{% include error-link.html message="a2da" text="Redirect is not allowed for a preflight request" %}.
