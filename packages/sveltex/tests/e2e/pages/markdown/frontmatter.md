---
title: Frontmatter
description: Frontmatter description
author: Jane Doe
date: 2020-01-01
tags: [frontmatter, test]
imports:
  '$lib/Example.svelte': 'Example'
---

# {metadata.title}

_By {metadata.author}, last updated on {metadata.date}._

> {metadata.description}

<Example>
_Italic_, **bold**, `code`.
</Example>
