[{{ include.text }}](/error-messages#{{ include.message }} "{% for doc in site.error-messages %}{% if doc.path contains include.message %}{{
  doc.message
}}{% endif %}{% endfor %}")