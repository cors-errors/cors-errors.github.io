setTimeout(() => {
  const get = id => document.getElementById(id)

  const requestArea = get('request')
  const responseArea = get('response')
  const requestOutputEl = get('request-out')
  const responseOutputEl = get('response-out')
  const withCredentialsCheckbox = get('with-credentials')
  const number1El = get('number-1')
  const number2El = get('number-2')
  const number3El = get('number-3')
  const requestErrorsEl = get('request-errors')
  const responseErrorsEl = get('response-errors')
  const requestMarkerEl = get('request-marker')
  const responseMarkerEl = get('response-marker')
  const reportEl = get('report')

  if (window.sessionStorage) {
    const store = window.sessionStorage
    requestArea.value = store.getItem('header-checker-request') || ''
    responseArea.value = store.getItem('header-checker-response') || ''
    withCredentialsCheckbox.checked = store.getItem('header-checker-credentials') === 'true'
  }

  parse()

  for (const event of ['input', 'change']) {
    requestArea.addEventListener(event, parse)
    responseArea.addEventListener(event, parse)
    withCredentialsCheckbox.addEventListener(event, parse)
  }

  function parse () {
    // TODO: Websockets and CORS???
    // TODO: Timing-Allow-Origin
    // TODO: Range header
    // TODO: Content-Security-Policy
    // TODO: Cross-Origin-Resource-Policy
    // TODO: Do XMLHttpRequestUpload and ReadableStream trigger a preflight?

    // TODO: Move all of these constants so that they aren't visible directly to analyzer functions
    const allowedMethods = ['GET', 'HEAD', 'POST']

    const corsPreflightHeaders = [
      'Access-Control-Request-Headers',
      'Access-Control-Request-Method'
    ]

    const corsResponseHeaders = [
      'Access-Control-Allow-Credentials',
      'Access-Control-Allow-Headers',
      'Access-Control-Allow-Methods',
      'Access-Control-Allow-Origin',
      'Access-Control-Expose-Headers',
      'Access-Control-Max-Age'
    ]

    // TODO: Check the relevant specs to ensure these are correct
    const httpRequestLineRe = /(\w+) (\S+) HTTP\/[\d.]+/
    const httpResponseLineRe = /HTTP\/[\d.]+ (\d\d\d) .*/

    const allowedContentTypes = ['application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain']

    const output = []

    const splitHeaderLines = function (source) {
      source.lines = source.text.split(/[\r\n]+/).map(line => line.trim()).filter(line => !!line)
    }

    const parseHeadersList = function (type) {
      return function (source) {
        const errors = []
        const headers = source.headersList = []

        for (const line of source.lines) {
          const index = line.indexOf(':')

          if (index === -1) {
            errors.push(`Could not parse ${type} header '${line}'.`)
          } else {
            headers.push({
              name: line.slice(0, index).trim(),
              value: line.slice(index + 1).trim()
            })
          }
        }

        return errors
      }
    }

    const parseHeadersMap = function (source) {
      const headersMap = source.headers = Object.create(null)
      const headerValues = source.headerValues = Object.create(null)

      for (const header of source.headersList) {
        const name = header.name.toLowerCase()

        headerValues[name] = headerValues[name] || []
        headerValues[name].push(header.value)
      }

      for (const header in headerValues) {
        // This is how repeated headers are interpreted, except for Set-Cookie
        headersMap[header] = headerValues[header].join(', ')
      }
    }

    const requestParsers = [
      splitHeaderLines,

      function (request) {
        const { lines } = request

        if (httpResponseLineRe.test(lines[0])) {
          return `The first line of the request is '${lines[0]}', which appears to be a response not a request.`
        }

        if (!httpRequestLineRe.test(lines[0])) {
          return `Unable to determine the request method. The first line of the request should be of the form 'METHOD url HTTP/x.y'.`
        }

        // Mutation
        const httpLine = lines.shift()

        request.httpLine = httpLine
        request.method = httpLine.split(' ')[0]

        for (const line of lines) {
          if (line === httpLine) {
            return `The request line '${line}' appears twice. Perhaps you pasted the headers multiple times?`
          } else if (httpRequestLineRe.test(line)) {
            return `There are multiple HTTP request lines: '${httpLine}' and '${line}'. Perhaps you pasted the headers multiple times?`
          }
        }
      },

      parseHeadersList('request'),
      parseHeadersMap,

      function (request) {
        const headerValues = request.headerValues
        const errors = []

        for (const header in headerValues) {
          const values = headerValues[header]

          if (values.length > 1) {
            errors.push(`The request header '${headerCase(header)}' appears ${times(values)} on the request, with values ${joinQuoted(values)}.`)
          }
        }

        return errors
      },

      function (request) {
        const host = request.getValue('Host')

        if (!host) {
          return `The request header 'Host' is missing from the request.`
        }

        const [hostHost, hostPort] = host.split(':')

        request.hostHost = hostHost
        request.hostPort = +hostPort || null // TODO: Is there any way to figure out whether this is http or https?
      },

      function (request) {
        const origin = request.getValue('Origin')

        // We don't handle a missing Origin header here as that wouldn't be a parsing problem. It is handled later
        if (!origin) {
          return
        }

        if (origin === 'null') {
          request.originHost = 'null'
          return
        }

        const match = origin.match(/^(https?):\/\/([^:]+)(?::(\d+))?$/)

        if (!match) {
          return `The request header 'Origin' could not be parsed: '${origin}'.`
        }

        let [, scheme, originHost, originPort] = match

        if (!originPort) {
          if (scheme === 'http') {
            originPort = 80
          } else {
            originPort = 443
          }
        }

        request.originHost = originHost
        request.originPort = +originPort || null
      },

      function (request) {
        request.acRequestMethod = request.headers['access-control-request-method']
        request.acRequestHeaders = request.headers['access-control-request-headers']

        request.customHeaders = splitCommas((request.acRequestHeaders || '').toLowerCase())
      },

      function (request) {
        request.preflight = !!(request.method === 'OPTIONS' && request.acRequestMethod)
      },

      function (request) {
        if (request.preflight) {
          return
        }

        const errors = []

        for (const header of corsPreflightHeaders) {
          // TODO: Should only have one place to do the case conversion
          if (header.toLowerCase() in request.headers) {
            errors.push(`The header '${header}' is present on the request even though it isn't a preflight OPTIONS request.`)
          }
        }

        return errors
      },

      // TODO: A similar check that origin exists is not part of parsing... is this really different?
      // TODO: Bailing on the analysis is overkill, we can log an error and proceed assuming our assertion is wrong
      function (request) {
        if (!request.preflight) {
          return
        }

        const errors = []
        const nonPreflightHeaders = ['Authorization', 'Cookie', 'Content-Type']

        for (const header of nonPreflightHeaders) {
          // TODO: Should only have one place to do the case conversion
          if (header.toLowerCase() in request.headers) {
            errors.push(`The header '${header}' should not be present on a preflight OPTIONS request.`)
          }
        }

        return errors
      }
    ]

    const responseParsers = [
      splitHeaderLines,

      function (response) {
        const { lines } = response

        if (httpRequestLineRe.test(lines[0])) {
          return `The first line of the response is '${lines[0]}', which appears to be a request not a response.`
        }

        if (!httpResponseLineRe.test(lines[0])) {
          return `Unable to determine the response status code. The first line of the response should be of the form 'HTTP/x.y code message'.`
        }

        // Mutation
        const httpLine = lines.shift()

        response.httpLine = httpLine

        // TODO: Check HTTP2 spec
        response.statusCode = +httpLine.split(' ')[1]

        for (const line of lines) {
          if (line === httpLine) {
            return `The response line '${line}' appears twice. Perhaps you pasted the headers multiple times?`
          } else if (httpResponseLineRe.test(line)) {
            return `There are multiple HTTP response lines: '${httpLine}' and '${line}'. Perhaps you pasted the headers multiple times?`
          }
        }
      },

      parseHeadersList('response'),
      parseHeadersMap,

      function (response) {
        response.acAllowCredentials = response.headers['access-control-allow-credentials']
      }
    ]

    const requestAnalyzers = [
      {
        preflight ({ acRequestHeaders, acRequestMethod, info, warn }) {
          info(`This appears to be a preflight OPTIONS request.`)

          const allowedMethod = allowedMethods.includes(acRequestMethod)

          if (allowedMethod) {
            if (acRequestHeaders) {
              info(`A preflight OPTIONS request is required because the original request has custom headers.`)
            } else {
              warn(`It is unclear why a preflight OPTIONS request is required.`)
            }
          } else {
            if (acRequestHeaders) {
              info(`A preflight OPTIONS request is required because the original request uses ${acRequestMethod} and because it has custom headers.`)
            } else {
              info(`A preflight OPTIONS request is required because the original request uses ${acRequestMethod}.`)
            }
          }
        },

        main ({ info, method, warn }) {
          if (method === 'OPTIONS') {
            // This makes an assumption about how the preflight flag is set
            warn(
              `This an OPTIONS request but it does not include the request header 'Access-Control-Request-Method'.`,
              `This is unusual as a preflight OPTIONS request would include that header.`,
              `The analysis that follows will assume that this is not a preflight request and you are intentionally performing an OPTIONS request, though that is unlikely to be what you really want.`
            )
          } else {
            info(`This is a ${method} request.`)
          }
        }
      }, {
        header: 'Host',

        both ({ error, getHeaderMessage, hostHost, hostPort, info, message, originHost, originPort, warn }) {
          const originMessage = getHeaderMessage('Origin')

          info(message)
          info(originMessage)

          // TODO: Further investigate the colon-prefixed HTTP/2 pseudo headers that are sent on some requests
          if (originHost === 'null'){
            warn(
              `The special value 'null' is used when the real origin cannot be included on the request.`,
              `It is not necessarily indicative of a problem but it may be related to any problems you are having.`,
              `For more information consult the FAQ.`
            )
          } else if (originHost !== hostHost) {
            info(`As '${hostHost}' and '${originHost}' are not the same a CORS request is required.`)
          } else if (hostPort) {
            if (hostPort === originPort) {
              // TODO: Investigate Origin further: MDN suggests that it is added to non-CORS requests if they aren't GET or HEAD
              info(`As the 'Host' and 'Origin' match it shouldn't be necessary to use CORS for this request. If the request is using CORS it may be that one request is using http and the other is using https.`)
            } else {
              info(`As the ports ${hostPort} and ${originPort} are not the same a CORS request will be required.`)
            }
          } else {
            const msg = `The 'Host' doesn't explicitly specify the port so it will be either 80 or 443 depending on whether the request is using http or https.`

            if ([80, 443].includes(originPort)) {
              info(msg + ` The 'Origin' port is ${originPort} so we're going to guess that the 'Host' port is ${'80443'.replace(originPort, '')}.`)
            } else {
              info(msg + ` As the 'Origin' port is ${originPort} a CORS request will be required.`)
            }
          }
        }
      }, {
        header: 'Access-Control-Request-Method',

        preflight ({ info, message, missing, value, warn }) {
          info(message)

          if (allowedMethods.includes(value)) {
            info(`${joinWords(allowedMethods)} requests do not necessarily need a preflight request, so something else must be triggering the preflight request.`)
          } else if (value === 'OPTIONS') {
            warn(`This is unusual as it suggests that you are attempting to perform a manual OPTIONS request. If that's your intent then that's fine but most likely it indicates that you are trying to perform a preflight OPTIONS request yourself, which is wrong.`)
          } else {
            info(`All ${value} requests require a preflight OPTIONS request.`)
          }
        }
      }, {
        header: 'Access-Control-Request-Headers',

        preflight ({ customHeaders, info, message, missing, acRequestMethod, warn }) {
          info(message)

          if (missing) {
            info(`This indicates that no custom headers need to be checked with the server.`)
          } else {
            const plural = customHeaders.length > 1

            info(`Setting ${plural ? 'custom values for these headers' : 'a custom value for this header'} will trigger a preflight OPTIONS request.`)

            // An almost identical check is performed for non-preflight requests
            if (['GET', 'HEAD'].includes(acRequestMethod)) {
              if (customHeaders.includes('content-type')) {
                warn(`It is unusual for a ${acRequestMethod} request to specify a 'Content-Type' header, though this won't necessarily cause a CORS request to fail.`)
              }
            }
          }
        }
      }, {
        header: 'Content-Type',

        main ({ info, message, method, missing, value, warn }) {
          if (!missing) {
            info(message)

            const contentType = value.replace(/;.*$/, '').trim().toLowerCase()

            if (allowedContentTypes.includes(contentType)) {
              info(`This will not trigger a preflight request.`)
            } else {
              info(`This will have required a preflight OPTIONS request, which presumably succeeded prior to this request being sent.`)
            }

            // An almost identical check is performed for preflight requests
            if (['GET', 'HEAD'].includes(method)) {
              warn(`It is unusual for a ${method} request to specify a _header_ header, though this won't necessarily cause a CORS request to fail.`)
            }
          }
        }
      }, {
        header: 'Authorization',

        main ({ info, message, missing }) {
          if (!missing) {
            info(message)
          }
        }
      }, {
        both ({ isMissing, warn }) {
          const unexpectedHeaders = corsResponseHeaders
            .filter(header => !isMissing(header))

          if (unexpectedHeaders.length) {
            const plural = unexpectedHeaders.length > 1

            warn(`The header${plural ? 's' : ''} ${joinQuoted(unexpectedHeaders)} ${plural ? 'were' : 'was'} present on the request. This is wrong. While this won't necessarily prevent the request from succeeding, ${plural ? 'those headers are' : 'that header is'} supposed to be included on the response, not the request.`)
          }
        },

        preflight ({ customHeaders, warn }) {
          const unexpectedHeaders = corsResponseHeaders
            .filter(header => customHeaders.includes(header.toLowerCase()))

          if (unexpectedHeaders.length) {
            const plural = unexpectedHeaders.length > 1

            warn(`The value${plural ? 's' : ''} ${joinQuoted(unexpectedHeaders)} ${plural ? 'were' : 'was'} present in 'Access-Control-Request-Headers'. This is wrong. While this won't necessarily prevent the request from succeeding, ${plural ? 'those headers are' : 'that header is'} supposed to be included on the response, not the request.`)
          }
        }
      }, {
        both ({ getValue, headers, warn }) {
          const acHeaders = corsResponseHeaders.concat(corsPreflightHeaders).map(header => header.toLowerCase())

          for (const header in headers) {
            if (header.startsWith('access-control-') && !acHeaders.includes(header)) {
              warn(`The request header '${headerCase(header)}' is unknown. It has the value '${getValue(header)}'.`)
            }
          }
        }
      }, {
        header: 'Sec-Fetch-Mode',

        both ({ info, message, missing, value, warn }) {
          if (!missing) {
            info(message)

            if (value === 'cors') {
              info('This is normal for a CORS request.')
            } else {
              warn(`This is unusual as _header_ is usually set to 'cors' for a CORS request. This may be indicative of a problem or it may just mean that this is not a CORS request.`)
            }
          }
        }
      }, {
        header: 'Sec-Fetch-Site',

        both ({ info, message, missing, value, warn }) {
          if (!missing) {
            info(message)

            if (value === 'cross-site') {
              info('This is normal for a CORS request.')
            } else {
              warn(`This is unusual as _header_ is usually set to 'cross-site' for a CORS request. This may be indicative of a problem or it may just mean that this is not a CORS request.`)
            }
          }
        }
      }
    ]

    const responseAnalyzers = [
      {
        preflight ({ error, statusCode, success }) {
          if (200 <= statusCode && statusCode < 300) {
            success(`The status code for the response is ${statusCode}.`)
          } else {
            error(`A preflight OPTIONS request must have a response status code between 200 and 299. The status code for this response is ${statusCode} so CORS will fail.`)
          }
        },

        main ({ info, statusCode }) {
          // TODO: e.g. redirects or Not-Modified are interesting cases... others?
          info(`The status code for the response is ${statusCode}.`)
        }
      }, {
        both ({ error, headerValues, warn }) {
          const headers = [
            'Access-Control-Allow-Credentials',
            'Access-Control-Allow-Origin',
            'Access-Control-Max-Age'
          ]

          for (const header of headers) {
            const values = headerValues[header.toLowerCase()]

            if (values && values.length > 1) {
              warn(`The response header '${headerCase(header)}' appears ${times(values)}, with values ${joinQuoted(values)}. This will be treated as equivalent to a single header with the value '${values.join(', ')}'.`)
            }
          }
        }
      }, {
        header: 'Access-Control-Allow-Origin',

        both ({ error, info, message, missing, preflight, request, success, value, withCredentials }) {
          info(message)

          if (missing) {
            if (preflight) {
              error('This preflight request will fail and the main request will not occur.')
            }
            else {
              error('The response will not be accessible within JavaScript code and the status code will be 0.')
            }

            return
          }

          const origin = request.getValue('Origin')

          if (value === '*') {
            if (withCredentials) {
              error(`This is not allowed for requests that use 'withCredentials'.`)
            } else {
              // TODO: Check that all the 'prohibited withCredentials' messages are grouped into a summary warning.
              //       The summary message should probably indicate:
              //       1. Do we think the request will succeed.
              //       2. If there are cookies, will they be set.
              //       3. If withCredentials is false, will it succeed if withCredentials is true.
              info(`This prohibits the use of 'withCredentials' but if you don't need to use 'withCredentials' this shouldn't be a problem.`)
            }
          } else if (value === origin) {
            // The check above is case sensitive
            success(`This matches the 'Origin' header on the request, which is correct.`)
          } else {
            error(`This does not match the 'Origin' header on the request, which is set to '${origin}'. The request will fail.`)

            if (value.includes('*')) {
              error(`The response header _header_ does not support wildcards. Only the exact value '*' is treated as special.`)
            }

            if (value.includes(',')) {
              error(
                `The response header _header_ does not support comma-separated lists. Only a single origin can be specified.`,
                `This may be caused by specifying the _header_ header multiple times on the server.`
              )
            }
          }
        }
      }, {
        header: 'Access-Control-Allow-Methods',

        preflight ({ error, info, message, missing, request, success, value, warn, withCredentials }) {
          const { acRequestMethod } = request
          const isAlwaysAllowed = allowedMethods.includes(acRequestMethod)

          info(message)
          info(`The 'Access-Control-Request-Method' request header was set to '${acRequestMethod}'.`)

          if (isAlwaysAllowed) {
            success(`${joinWords(allowedMethods)} requests are always allowed even if they are not included in _header_.`)
          }

          if (missing) {
            if (!isAlwaysAllowed) {
              error(`The value '${acRequestMethod}' must be included in the _header_ header for the preflight request to succeed.`)
            }

            return
          }

          const parsedMethods = splitCommas(value)
          const isExplicitlyAllowed = parsedMethods.includes(acRequestMethod)
          const re = /[^a-zA-Z0-9!#$%&'*+\-.^_`|~]/
          let invalidToken = false

          for (const method of parsedMethods) {
            const match = method.match(re)

            if (match) {
              if (!invalidToken) {
                invalidToken = true

                error(`The preflight will probably fail in Firefox because the _header_ response header contains an invalid token.`)
              }

              const ch = match[0]
              const unicode = ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')

              error(`The value '${method}' contains the disallowed character '${ch}', U+${unicode}.`)
            }
          }

          if (isExplicitlyAllowed) {
            success(`'${acRequestMethod}' is explicitly allowed by the _header_ response header.`)
          }

          // * seems to be supported by Safari and Edge but Edge 44 does not treat * as a wildcard in a list
          if (parsedMethods.includes('*')) {
            if (withCredentials) {
              warn(`The value '*' will not be treated as a wildcard when using 'withCredentials'.`)

              if (!isAlwaysAllowed && !isExplicitlyAllowed) {
                error(`The preflight OPTIONS request will fail.`)
              }
            } else if (value === '*') {
              info(`The value '*' will be treated as a wildcard so long as 'withCredentials' is not being used.`)
            } else {
              warn(`Edge does not support using the value '*' in a list, it must be included on its own.`)

              if (!isAlwaysAllowed && !isExplicitlyAllowed) {
                error (
                  `The preflight OPTIONS request will fail in Edge.`,
                  `In other browsers the '*' will be treated as a wildcard so long as 'withCredentials' is not being used.`
                )
              }
            }

            return
          }

          if (!isAlwaysAllowed && !isExplicitlyAllowed) {
            error(
              `_header_ does not include '${acRequestMethod}'.`,
              `The preflight OPTIONS request will fail.`
            )
          }
        },

        main ({ message, missing, warn }) {
          if (!missing) {
            warn(message, `This header is only required for a preflight OPTIONS request and is not required here.`)
          }
        }
      }, {
        header: 'Access-Control-Allow-Headers',

        preflight ({ error, info, message, missing, request, success, value, warn, withCredentials }) {
          const { acRequestHeaders, customHeaders } = request

          info(message)

          if (missing) {
            if (acRequestHeaders) {
              error(`The preflight OPTIONS request will fail as the request header 'Access-Control-Request-Headers' is set to '${acRequestHeaders}'.`)
            } else {
              success(`That should not be a problem as the request header 'Access-Control-Request-Headers' is also missing.`)
            }

            return
          }

          const noneRequired = request.isMissing('Access-Control-Request-Headers')

          if (noneRequired) {
            success(`As 'Access-Control-Request-Headers' is missing from the preflight request the value of _header_ shouldn't matter.`)
          }

          const parsedHeaders = splitCommas(value.toLowerCase())
          const rejectedHeaders = customHeaders.filter(header => !parsedHeaders.includes(header))
          let rejectedMessage = null

          if (rejectedHeaders.length) {
            const plural = rejectedHeaders.length > 1

            rejectedMessage = `The header${plural ? 's' : ''} ${joinQuoted(rejectedHeaders)} ${plural ? 'are' : 'is'} listed in 'Access-Control-Request-Headers' but ${plural ? 'are' : 'is'} not included in _header_.`
          }

          const re = /[^a-zA-Z0-9!#$%&'*+\-.^_`|~]/
          let invalidToken = false

          for (const header of parsedHeaders) {
            const match = header.match(re)

            if (match) {
              if (!invalidToken) {
                invalidToken = true

                error(`The preflight will probably fail in Firefox because the _header_ response header contains an invalid token.`)
              }

              const ch = match[0]
              const unicode = ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')

              error(`The value '${header}' contains the disallowed character '${ch}', U+${unicode}.`)
            }
          }

          // * is supported in Safari & Edge 44 but Edge 44 does not support * in a list
          // TODO: The spec makes a special case for Authorization but it isn't clear what that means in practice
          if (parsedHeaders.includes('*')) {
            if (withCredentials) {
              warn(`The value '*' will not be treated as a wildcard when using 'withCredentials'.`)

              if (rejectedMessage) {
                error (
                  `The preflight OPTIONS request will fail.`,
                  rejectedMessage
                )
              }
            } else if (value === '*') {
              info(`The value '*' will be treated as a wildcard so long as 'withCredentials' is not being used.`)
            } else {
              warn(`Edge does not support using the value '*' in a list, it must be included on its own.`)

              if (rejectedMessage) {
                error (
                  `The preflight OPTIONS request will fail in Edge.`,
                  rejectedMessage,
                  `In other browsers the '*' will be treated as a wildcard so long as 'withCredentials' is not being used.`
                )
              }
            }
          } else if (rejectedMessage) {
            error(
              rejectedMessage,
              `The preflight OPTIONS request will fail.`
            )
          } else if (!noneRequired) {
            success(`_header_ includes all the values required for the preflight OPTIONS request to succeed.`)
          }

          // TODO: What other headers don't make sense? Authorization perhaps?
          if (parsedHeaders.includes('cookie')) {
            warn(
              `The 'Cookie' header is not controlled by 'Access-Control-Allow-Headers'.`,
              `If you want to send cookies on the request you must enable 'withCredentials'.`
            )
          }
        },

        main ({ message, missing, warn }) {
          if (!missing) {
            warn(message, `This header is only required for a preflight OPTIONS request and is not required here.`)
          }
        }
      }, {
        header: 'Access-Control-Expose-Headers',

        preflight ({ message, missing, warn }) {
          if (!missing) {
            warn(message, `However, it won't have any effect on an OPTIONS preflight request and should be included on the response to the main request instead.`)
          }
        },

        main ({ acAllowCredentials, info, isMissing, message, value, warn, withCredentials }) {
          info(message)

          const parsedHeaders = splitCommas(value)

          if (parsedHeaders.length === 0) {
            info(`Only the CORS-safelisted response headers will be accessible from within JavaScript code.`)

            return
          }

          const cookieHeaders = ['Set-Cookie', 'Set-Cookie2']

          const includesStar = parsedHeaders.includes('*')

          if (includesStar && !withCredentials) {
            if (value === '*') {
              info(`All response headers should be available.`)
            } else {
              info(`The list of values includes '*' so all response headers should be available.`)
            }

            // TODO: Edge 44 doesn't support * but later versions might
            warn(`However, Safari and Edge do not support the use of '*' with _header_.`)

            if (acAllowCredentials === 'true') {
              warn(`The value '*' is only treated as a wildcard for requests that aren't using withCredentials.`)
            }

            const blockedHeaders = cookieHeaders.filter(header => !isMissing(header))

            if (blockedHeaders.length) {
              info(`The header${blockedHeaders.length > 1 ? 's' : ''} ${joinWords(blockedHeaders.map(header => "'" + header + "'"))} ${blockedHeaders.length > 1 ? 'are' : 'is'} never accessible from JavaScript, even when not using CORS.`)
            }
          } else {
            const missingHeaders = parsedHeaders.filter(header => isMissing(header))
            const plural = parsedHeaders.length > 1

            info(`${plural ? 'These' : 'This'} response header${plural ? 's' : ''} will be accessible from JavaScript code in addition to the usual CORS-safelisted response headers.`)

            if (includesStar) {
              warn(`When using withCredentials the value '*' is treated as a literal header name and not as a wildcard.`)
            }

            if (missingHeaders.length) {
              const plural = missingHeaders.length > 1

              info(`The header${plural ? 's' : ''} ${joinQuoted(missingHeaders)} ${plural ? 'are' : 'is'} not actually present in the response.`)
            }

            const blockedHeaders = cookieHeaders.filter(header => parsedHeaders.some(hd => hd.toLowerCase() === header.toLowerCase()))

            if (blockedHeaders.length) {
              const plural = blockedHeaders.length > 1

              // TODO: Better messages needed for this scenario
              warn(
                `The header${plural ? 's' : ''} ${joinQuoted(blockedHeaders)} ${plural ? 'are' : 'is'} included in _header_ but won't be accessible from JavaScript.`,
                `This restriction applies even when not using CORS.`
              )
            }
          }

          const re = /[^a-zA-Z0-9!#$%&'*+\-.^_`|~]/
          let invalidToken = false

          for (const header of parsedHeaders) {
            const match = header.match(re)

            if (match) {
              if (!invalidToken) {
                invalidToken = true

                warn(`No extra headers will be exposed in Firefox because _header_ contains an invalid token.`)
              }

              const ch = match[0]
              const unicode = ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')

              warn(`The value '${header}' contains the disallowed character '${ch}', U+${unicode}.`)
            }
          }
        }
      }, {
        header: 'Access-Control-Allow-Credentials',

        both ({ error, getValue, info, message, success, value, warn, withCredentials }) {
          info(message)

          if (value === 'true') {
            if (withCredentials) {
              success(`This is required for requests using 'withCredentials'.`)
            } else {
              const wildcardHeaders = [
                'Access-Control-Allow-Origin',
                'Access-Control-Allow-Methods',
                'Access-Control-Allow-Headers',
                'Access-Control-Expose-Headers'
              ].filter(header => splitCommas(getValue(header)).includes('*'))

              if (wildcardHeaders.length) {
                const plural = wildcardHeaders.length > 1

                warn(
                  `This implies that 'withCredentials' is being used.`,
                  `The response header${plural ? 's' : ''} ${joinQuoted(wildcardHeaders)} ${plural ? 'are' : 'is'} using a '*' wildcard, which won't work if credentials are being used.`
                )
              } else {
                info(
                  `This allows the client to perform requests with credentials such as Cookies.`,
                  `The client must enable this before making the request.`
                )
              }
            }
          } else if (withCredentials) {
            error(
              `This is wrong.`,
              `This header must be set to 'true' for requests that use 'withCredentials'.`
            )
          } else if (value) {
            warn(`This is not a valid value for this header and may cause the request to fail.`)
          } else {
            info(
              `If you are attempting to perform a request using 'withCredentials' then the request will fail.`,
              `Otherwise this shouldn't be a problem.`
            )
          }
        }
      }, {
        preflight ({ getValue, warn }) {
          const wildcardHeaders = [
            'Access-Control-Allow-Methods',
            'Access-Control-Allow-Headers'
          ].filter(header => splitCommas(getValue(header)).includes('*'))

          if (wildcardHeaders.length) {
            warn(
              `Older browsers may not support the use of '*' for ${joinQuoted(wildcardHeaders)}.`,
              `Internet Explorer 11 did not include support for '*'.`,
              `Safari introduced support in version 13 but many older devices are not able to upgrade to that version.`,
              `You should test against your target browsers to confirm whether this is a problem for you.`
            )
          }
        }
      }, {
        header: 'Access-Control-Max-Age',

        preflight ({ info, message, missing, value, warn }) {
          info(message)

          if (missing) {
            info(`This is not necessarily a problem but you may be able to reduce the number of preflight OPTIONS requests by setting this header.`)

            return
          }

          if (/^-?\d+$/.test(value)) {
            if (value.startsWith('-')) {
              // TODO: verify this, only -1 is mentioned on MDN
              info(`A negative value should prevent the preflight OPTIONS request from being cached.`)
            } else {
              info(`This is the caching time for the preflight OPTIONS request in seconds.`)

              if (+value > 600) {
                info('Most browsers cap this value so a large max-age may not be fully respected.')
              }
            }
          } else {
            // TODO: Verify this is only a warning and not an error
            warn(
              `This does not appear to be a valid value.`,
              `It should be an integer value indicating the time in seconds.`
            )
          }
        },

        main ({ message, missing, warn }) {
          if (!missing) {
            warn(message, `However, it will only have an effect on a preflight OPTIONS request and should not be included in the response to the main request.`)
          }
        }
      }, {
        main ({ acAllowCredentials, getValue, headerValues, info, request: { hostHost, originHost }, success, warn, withCredentials }) {
          // TODO: Check for set-cookie headers
          //       1. withCredentials must be true for the cookie to be set but the response does not need to include
          //          allow-credentials (though the response won't be accessible). Edge 44 matches other browsers in
          //          this regard. Safari requires that the cookies are 'same domain', usually requiring a Domain.
          //       2. Subsequent requests with withCredentials will include the cookie
          //       3. Need to check what happens if no origin header is included in the response, or a cookie is set on the preflight
          const cookies = headerValues['set-cookie'] || []

          if (cookies.length || withCredentials || acAllowCredentials === 'true') {
            const plural = cookies.length !== 1

            if (!cookies.length) {
              info('The response does not include any cookies.')
              return
            }

            info(`The response attempts to set ${cookies.length} cookie${plural ? 's' : ''} using the 'Set-Cookie' header.`)

            const subsequent = `Subsequent requests must also use 'withCredentials' for the cookies to be included.`

            if (withCredentials) {
              info(
                `The request uses 'withCredentials', allowing cookies to be set.`,
                subsequent
              )
            } else {
              info(
                `Cookies will only be set if the request is using 'withCredentials'.`,
                subsequent
              )

              // Whether the cookie is set is not conditional on allow-credentials but an inconsistency does suggest a problem
              if (acAllowCredentials !== 'true') {
                warn()
              }
            }

            const parsedCookies = cookies.map(cookie => {
              const errors = []

              const sections = cookie.split(';').map(section => {
                const equalsIndex = section.indexOf('=')
                let name = null
                let value = null

                if (equalsIndex === -1) {
                  name = section.trim()
                } else {
                  name = section.slice(0, equalsIndex).trim()
                  value = section.slice(equalsIndex + 1).trim()
                }

                return { name, value }
              })

              // TODO: validate name, some characters may cause the cookie to be rejected
              const { name, value } = sections.shift()

              const directives = Object.create(null)

              for (const { name, value } of sections) {
                const key = name.toLowerCase()

                if (key in directives) {
                  errors.push(`The directive '${name}' appears multiple times.`)
                }

                directives[key] = value
              }

              // TODO: validate all known directives, especially expiry times
              const sameSite = directives.samesite
              const domain = directives.domain

              let sameDomain = false
              let domainPattern = domain

              // IP address
              if (/^(\.\d\d?\d?){4}$/.test('.' + hostHost)) {
                if (domainPattern && domainPattern !== hostHost) {
                  errors.push(`The 'Domain' directive value '${domainPattern}' cannot be used with IP addresses.`)
                }

                domainPattern = hostHost
              } else if (!domainPattern) {
                domainPattern = hostHost
              } else if (!domainPattern.startsWith('.')) {
                domainPattern = '.' + domainPattern
              }

              // TODO: also need to check the path
              const domainMatch = function (pattern, domain) {
                pattern = pattern.toLowerCase()
                domain = domain.toLowerCase()

                if (pattern === domain || pattern === '.' + domain) {
                  return true
                }

                return pattern.startsWith('.') && domain.endsWith(pattern)
              }

              // TODO: Obviously this is woefully inadequate...
              const tlds = ['com', 'uk', 'de', 'ru', 'me', 'org', 'net', 'info', 'co', 'co.uk', 'io', 'br', 'com.br'].map(x => '.' + x)

              if (tlds.includes(domainPattern.toLowerCase())) {
                errors.push(`The 'Domain' value '${domainPattern}' is a TLD, so it isn't valid.`)
              } else {
                // TODO: Not exactly reliable but...
                if (domainPattern.length < 7) {
                  errors.push(`If the 'Domain' value '${domainPattern}' is a TLD it will be rejected.`)
                }

                if (domainMatch(domainPattern, hostHost)) {
                  sameDomain = domainMatch(domainPattern, originHost)
                } else {
                  errors.push(`The 'Domain' is set to '${domain}', which doesn't match '${hostHost}'.`)
                }
              }

              return {
                domain,
                domainPattern,
                errors,
                name,
                sameDomain,
                sameSite,
                secure: 'secure' in directives,
                value
              }
            })

            for (const cookie of parsedCookies) {
              info('')
              info(`Analysis of cookie '${cookie.name}':`)

              if (cookie.value == null) {
                info(`\u2022 It does not set a value and will likely be ignored.`)
              } else {
                info(`\u2022 It has a value of '${cookie.value}'.`)
              }

              for (const error of cookie.errors) {
                warn(`\u2022 ${error}`)
              }

              if (cookie.secure) {
                info(`\u2022 The 'Secure' directive is set, so https must be used.`)
              }

              if (cookie.domain) {
                info(`\u2022 The cookie domain is set to '${cookie.domainPattern}'.`)
              } else {
                info(`\u2022 The cookie domain is not set. It will default to '${cookie.domainPattern}'.`)
              }

              const sameDomain = cookie.sameDomain

              if (originHost === 'null') {
                info(`\u2022 As the Origin header is 'null' it isn't possible for this tool to determine the page domain.`)
                info(`\u2022 As we don't know the page domain we are going to assume this is a cross-domain cookie.`)
              } else {
                info(`\u2022 The page domain is '${originHost}'.`)

                if (sameDomain) {
                  info(`\u2022 This is a same-domain cookie: the cookie domain matches the page domain.`)
                } else {
                  info(`\u2022 This is a cross-domain cookie: the cookie domain does not match the page domain.`)
                }
              }

              if (!sameDomain) {
                warn(`\u2022 Safari does not allow cross-domain cookies to be set using CORS requests.`)
              }

              if (cookie.sameSite) {
                info(`\u2022 'SameSite' is set to '${cookie.sameSite}'.`)
              } else {
                info(`\u2022 'SameSite' is not set.`)
              }

              let chromeWarning = false

              if (!sameDomain) {
                if (cookie.sameSite) {
                  if (cookie.sameSite.toLowerCase() === 'none') {
                    if (!cookie.secure) {
                      warn(`\u2022 Newer browsers (Chrome 80+) need 'Secure' for cookies with 'SameSite=None'.`)

                      chromeWarning = true
                    }
                  } else {
                    warn(`\u2022 Cross-domain cookies need 'SameSite=None'.`)
                  }
                } else {
                  const extra = cookie.secure ? '' : ` and 'Secure'`

                  warn(`\u2022 Newer browsers (Chrome 80+) need cross-domain cookies to set 'SameSite=None'${extra}.`)

                  chromeWarning = true
                }
              }

              if (chromeWarning) {
                warn(`\u2022 Newer versions of Chrome will ignore this cookie.`)
              }
            }

            info('')

            if (parsedCookies.some(cookie => !!cookie.domain)) {
              info(
                `This tool cannot reliably check all TLDs and public suffixes.`,
                `A cookie may be rejected if you attempt to set its 'Domain' to a TLD or public suffix.`,
                ``
              )
            }
          }
        }
      }, {
        header: 'Vary',

        both ({ info, message }) {
          // See: https://github.com/expressjs/cors/blob/master/lib/index.js
          // TODO: Establish which request methods are relevant to this
          // TODO: Does any of this apply to preflights
          info(
            message,
            `If this header is not set correctly it can cause caching problems.`
          )
        }
      }, {
        header: 'WWW-Authenticate',

        preflight ({ message, missing, value, warn }) {
          if (!missing) {
            warn(
              message,
              `This header shouldn't be included in a preflight response though it may not be causing any actual harm.`
            )
          }
        },

        main ({ acAllowCredentials, info, message, missing, statusCode, value, warn, withCredentials }) {
          if (missing) {
            return
          }

          info(message)

          if (statusCode !== 401) {
            warn(
              `However, the response status code is ${statusCode}.`,
              `This needs to be 401 for _header_ to have any effect.`
            )

            return
          }

          // TODO: Safari does not prompt or include the header as far as I can tell... try with subdomains
          // TODO: Chrome, Firefox and Edge 44 all seem to prompt fine
          if (withCredentials && acAllowCredentials) {
            info(`The user will be prompted for credentials if the browser supports the requested authentication type.`)
          } else {
            info(`If the request is using 'withCredentials' the browser will prompt the user for credentials, assuming it supports the requested authentication type.`)

            if (!acAllowCredentials) {
              warn()
            }
          }
        }
      }, {
        both ({ headersList, warn }) {
          const spellingCounts = {}

          for (const header of corsResponseHeaders) {
            spellingCounts[header] = generateLetterCount(header)
          }

          for (const {name: header} of headersList) {
            const counts = generateLetterCount(header)

            for (const corsHeader in spellingCounts) {
              let difference = 0
              const corsCounts = spellingCounts[corsHeader]

              for (const letter in corsCounts) {
                difference += Math.abs(corsCounts[letter] - (counts[letter] || 0))
              }

              for (const letter in counts) {
                if (!corsCounts[letter]) {
                  difference += counts[letter]
                }
              }

              if (difference <= 5 && !corsResponseHeaders.some(corsHeader => corsHeader.toLowerCase() === header.toLowerCase())) {
                warn(`Spell-checker: Should the header '${header}' be '${corsHeader}'?`)
              }
            }
          }

          function generateLetterCount (header) {
            const count = Object.create(null)

            for (const letter of header.toLowerCase().replace(/-/g, '').split('')) {
              count[letter] = (count[letter] || 0) + 1
            }

            return count
          }
        }
      }, {
        // TODO: Copied from requestAnalyzers
        both ({ getValue, headers, warn }) {
          const acHeaders = corsResponseHeaders.concat(corsPreflightHeaders).map(header => header.toLowerCase())

          for (const header in headers) {
            if (header.startsWith('access-control-') && !acHeaders.includes(header)) {
              warn(`The response header '${headerCase(header)}' is unknown. It has the value '${getValue(header)}'.`)
            }
          }
        }
      }, {
        both ({ isMissing, warn }) {
          const unexpectedHeaders = corsPreflightHeaders.filter(header => !isMissing(header))

          if (unexpectedHeaders.length) {
            const plural = unexpectedHeaders.length > 1

            warn(
              `The header${plural ? 's' : ''} ${joinQuoted(unexpectedHeaders)} ${plural ? 'were' : 'was'} present on the response.`,
              `This is wrong.`,
              `While this won't necessarily prevent the request from succeeding, ${plural ? 'those headers are' : 'that header is'} not supposed to be included on the response.`
            )
          }
        }
      }
    ]

    const createParsedWrapper = function (type, text) {
      const wrapper = {
        text,

        getHeaderMessage (header) {
          if (wrapper.isMissing(header)) {
            return `There is no '${header}' ${type} header on this request.`
          } else {
            return `The ${type} header '${header}' is set to '${wrapper.getValue(header)}'.`
          }
        },

        getValue (header) {
          let value = null

          if (header) {
            value = wrapper.headers[header.toLowerCase()]
          }

          return value || ''
        },

        isMissing (header) {
          return !header || !(header.toLowerCase() in wrapper.headers)
        },

        get message () {
          return this.getHeaderMessage(this.header)
        },

        get missing () {
          return this.isMissing(this.header)
        },

        get value () {
          return this.getValue(this.header)
        }
      }

      return wrapper
    }

    const parsed = {
      request: createParsedWrapper('request', requestArea.value.trim()),
      response: createParsedWrapper('response', responseArea.value.trim())
    }

    // Don't persist until we're sure the parser hasn't crashed
    const persistText = function () {
      if (window.sessionStorage) {
        const store = window.sessionStorage
        store.setItem('header-checker-request', requestArea.value)
        store.setItem('header-checker-response', responseArea.value)
        store.setItem('header-checker-credentials', String(withCredentialsCheckbox.checked))
      }
    }

    // TODO: Temp, move elsewhere
    requestOutputEl.innerText = ''
    responseOutputEl.innerText = ''

    requestErrorsEl.innerText = ''
    requestErrorsEl.style.display = 'none'

    responseErrorsEl.innerText = ''
    responseErrorsEl.style.display = 'none'

    number1El.className = 'number-circle'
    number2El.className = 'number-circle'
    number3El.className = 'number-circle'

    requestMarkerEl.className = 'marker'
    responseMarkerEl.className = 'marker'

    reportEl.style.display = 'none'

    let requestParsed = true
    let responseParsed = true

    if (parsed.request.text) {
      for (const parser of requestParsers) {
        let errs = parser(parsed.request)

        if (errs && errs.length) {
          if (!Array.isArray(errs)) {
            errs = [errs]
          }

          requestErrorsEl.innerText = [
            'There was a problem parsing the headers:',
            '',
            ...errs,
            '',
            'Please ensure that you have copied the correct headers from the browser.'
          ].join('\n')

          requestErrorsEl.style.display = 'block'

          number1El.className += ' number-circle-error'

          requestParsed = false

          break
        }
      }

      if (requestParsed) {
        // TODO: Where should these live?
        if (!parsed.request.getValue('Origin')) {
          requestErrorsEl.innerText = [
            `The request header 'Origin' is missing.`,
            `The browser will automatically add this header to all CORS requests.`,
            `This does not appear to be a CORS request.`
          ].join('\n')

          requestErrorsEl.style.display = 'block'

          number1El.className += ' number-circle-error'

          requestParsed = false
        }
      }
    } else {
      requestParsed = false
      number1El.className += ' number-circle-current'
    }

    if (parsed.response.text) {
      for (const parser of responseParsers) {
        let errs = parser(parsed.response)

        if (errs && errs.length) {
          if (!Array.isArray(errs)) {
            errs = [errs]
          }

          responseErrorsEl.innerText = [
            'There was a problem parsing the headers:',
            '',
            ...errs,
            '',
            'Please ensure that you have copied the correct headers from the browser.'
          ].join('\n')

          responseErrorsEl.style.display = 'block'

          number2El.className += ' number-circle-error'

          responseParsed = false

          break
        }
      }
    } else {
      if (requestParsed) {
        number2El.className += ' number-circle-current'
      }

      responseParsed = false
    }

    let markerClass = 'tick'

    if (!parsed.request.text) {
      markerClass = 'arrow'
    } else if (!requestParsed) {
      markerClass = 'cross'
    }

    requestMarkerEl.className += ' ' + markerClass

    markerClass = markerClass === 'tick' ? 'arrow' : ''

    if (parsed.response.text) {
      markerClass = responseParsed ? 'tick' : 'cross'
    }

    responseMarkerEl.className += ' ' + markerClass

    if (!requestParsed || !responseParsed) {
      persistText()
      return
    }

    reportEl.style.display = 'block'

    parsed.request.withCredentials = withCredentialsCheckbox.checked

    // TODO: Move the output to be after the 'This is a GET request' logging
    const cookie = parsed.request.getValue('Cookie')

    if (cookie) {
      let msg = `The 'Cookie' request header is set to '${cookie}'. This header is only included if 'withCredentials' is true.`

      if (!parsed.request.withCredentials) {
        msg += ` The remainder of this analysis will assume that 'withCredentials' is true.`
      }

      output.push({
        level: 'info',
        text: msg
      })

      parsed.request.withCredentials = true
    }

    const preflight = parsed.request.preflight

    for (const options of requestAnalyzers) {
      const config = Object.create(parsed.request)
      const stepHeader = config.header = options.header

      let level = 0

      const logging = []

      const createLogger = logLevel => (...msg) => {
        level = Math.max(level, logLevel)

        for (const message of msg) {
          logging.push(
            String(message)
              .replace(/_header_/g, `'${stepHeader}'`)
              .replace(/_value_/g, `'${config.value}'`)
          )
        }
      }

      config.info = createLogger(0)
      config.success = createLogger(1)
      config.warn = createLogger(2)
      config.error = createLogger(3)

      if (preflight && options.preflight) {
        options.preflight(config)
      }

      if (!preflight && options.main) {
        options.main(config)
      }

      if (options.both) {
        options.both(config)
      }

      if (logging.length) {
        output.push({
          text: logging.join('\n'),
          level: ['info', 'success', 'warning', 'error'][level]
        })
      }
    }

    for (const section of output) {
      const el = document.createElement('div')
      el.className = `report-section report-section-${section.level}`
      el.innerText = section.text

      requestOutputEl.appendChild(el)
    }

    output.length = 0

    // TODO: Almost identical to requestAnalyzers
    for (const options of responseAnalyzers) {
      const config = Object.create(parsed.response)

      config.request = parsed.request
      config.preflight = parsed.request.preflight
      config.withCredentials = parsed.request.withCredentials

      const stepHeader = config.header = options.header

      let level = 0

      const logging = []

      const createLogger = logLevel => (...msg) => {
        level = Math.max(level, logLevel)

        for (const message of msg) {
          logging.push(
            String(message)
              .replace(/_header_/g, `'${stepHeader}'`)
              .replace(/_value_/g, `'${config.value}'`)
          )
        }
      }

      config.info = createLogger(0)
      config.success = createLogger(1)
      config.warn = createLogger(2)
      config.error = createLogger(3)

      if (preflight && options.preflight) {
        options.preflight(config)
      }

      if (!preflight && options.main) {
        options.main(config)
      }

      if (options.both) {
        options.both(config)
      }

      if (logging.length) {
        output.push({
          text: logging.join('\n'),
          level: ['info', 'success', 'warning', 'error'][level]
        })
      }
    }

    for (const section of output) {
      const el = document.createElement('div')
      el.className = `report-section report-section-${section.level}`
      el.innerText = section.text

      responseOutputEl.appendChild(el)
    }

    persistText()
  }

  function joinWords (words) {
    if (words.length === 1) {
      return words[0]
    }

    return words.slice(0, -1).join(', ') + ' and ' + words[words.length - 1]
  }

  function quote (words) {
    return [].concat(words).map(word => `'${word}'`)
  }

  function joinQuoted (words) {
    return joinWords(quote(words))
  }

  function headerCase (header) {
    return header.replace(/([^-])([^-]*)/g, (_, first, rest) => first.toUpperCase() + rest.toLowerCase())
  }

  function times (count) {
    count = count || 0

    if (Array.isArray(count)) {
      count = count.length
    }

    if (count === 1) {
      return 'once'
    }

    if (count === 2) {
      return 'twice'
    }

    return `${count} times`
  }

  function splitCommas (str) {
    return (str || '').split(',').map(method => method.trim()).filter(method => !!method)
  }
}, 1)
