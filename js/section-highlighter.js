(function () {
  var last = null

  highlight()
  window.addEventListener('hashchange', highlight)

  function highlight () {
    var hash = location.hash
    var next = null

    if (hash.length === 5) {
      var section = document.getElementById(hash.slice(1))

      if (section && section.tagName === 'SECTION') {
        next = section
      }
    }

    if (last !== next) {
      if (last) {
        last.className = last.className.replace(/\s*highlight(-start)?/g, '')
      }

      if (next) {
        next.className += ' highlight highlight-start'

        setTimeout(function () {
          next.className = next.className.replace(/\s*highlight-start/g, '')
        }, 100)
      }

      last = next
    }
  }
})()