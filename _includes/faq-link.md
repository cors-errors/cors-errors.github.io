[{% for doc in site.faq %}{% if doc.path contains include.faq %}{{
 doc.question
}}{% endif %}{% endfor %}](/faq#{{ include.faq }})