---
title: Markdown Implementation
---

<script lang="ts" setup>
import { PhXCircle, PhCheckCircle, PhCircle, PhDotsThreeCircle } from '@phosphor-icons/vue';
</script>

# Markdown Implementation

## Issues with HTML in CommonMark

Let's look at the following example. On the left is some markdown, and on the
right is the CommonMark AST returned by the CommonMark [reference
parser][div22something]:

<div class="flex flex-col gap-4 sm:flex-row">
<div class="w-full">

```markdown
<div>

*something*

</div>
```

</div>
<div class="w-full">

```xml
<html_block>&lt;div&gt;</html_block> // [!code focus]
<paragraph>
    <emph>
        <text>something</text>
    </emph>
</paragraph>
<html_block>&lt;/div&gt;</html_block> // [!code focus]
```

</div>
</div>

Note, in particular, the `html_block` elements in the AST. CommonMark doesn't
understand the provided markdown as one HTML element with some markdown inside,
but rather as two separate HTML "blocks" with markdown in between. This can be a
problem for us because CommonMark doesn't transform HTML blocks, and because it
specifies that, for an HTML block to end, it must be followed by a blank line.
For example:

<div class="flex flex-col gap-4 sm:flex-row">
<div class="w-full">

```markdown
<div>
*something*

</div>
```

</div>
<div class="w-full">

```xml
<html_block>&lt;div&gt;
*something*</html_block>
<html_block>&lt;/div&gt;</html_block>
```

</div>
</div>

Here, CommonMark interpreted the markdown as two HTML blocks,
`<div>*something*</div>` and `</div>`, and will return both of them without any
transformation.

Generally speaking, we have the following rules of thumb:

-   If a line starts with one of a [specific set of HTML tags][html-blocks] (eg.
    `div`, `p`, `h1`, `ul`, `li`, etc.), _or_ if a line contains nothing but an
    HTML tag (and optionally some whitespace), then everything between that line
    and the first blank line after it is considered a single HTML block.
    Examples: [case 1], [case 2].
-   If a line contains an HTML tag, but doesn't start with it (disregarding
    whitespace), then said HTML tag will be treated as an inline HTML element.
    This behavior will not be an issue for us.

**NB**: The above are oversimplifications. See the [CommonMark spec][html-blocks]
for the full details.

### Special elements

The following table shows the results of rendering the string
`` `<div>${'\n'.repeat(x)}*(${x},${y})*${'\n'.repeat(y)}</div>` ``, for $x,y\in\{0,1,2\}$:

|  [`<div>...*(before,after)*...</div>`][divAll]  ||||
| Before | After |                     Result                      |                                             Expected                                             |
|:------:|:-----:|:-----------------------------------------------:|:------------------------------------------------------------------------------------------------:|
|   0    |   0   |          [`<div>*(0,0)*</div>`][div00]          |   <PhCircle color="var(--hig-brown)" class="opacity-90 inline" :size="20" weight="duotone" />    |
|   0    |   1   |         [`<div>*(0,1)*\n</div>`][div01]         |   <PhCircle color="var(--hig-brown)" class="opacity-90 inline" :size="20" weight="duotone" />    |
|   0    |   2   |         [`<div>*(0,2)*\n</div>`][div02]         |   <PhCircle color="var(--hig-brown)" class="opacity-90 inline" :size="20" weight="duotone" />    |
|   1    |   0   |         [`<div>\n*(1,0)*</div>`][div10]         |   <PhCircle color="var(--hig-brown)" class="opacity-90 inline" :size="20" weight="duotone" />    |
|   1    |   1   |        [`<div>\n*(1,1)*\n</div>`][div11]        |   <PhCircle color="var(--hig-brown)" class="opacity-90 inline" :size="20" weight="duotone" />    |
|   1    |   2   |        [`<div>\n*(1,2)*\n</div>`][div12]        |   <PhCircle color="var(--hig-brown)" class="opacity-90 inline" :size="20" weight="duotone" />    |
|   ≥2   |   0   |  [`<div>\n<p><em>(2,0)</em></div></p>`][div20]  |    <PhXCircle color="var(--hig-red)" class="opacity-90 inline" :size="20" weight="duotone" />    |
|   ≥2   |   1   | [`<div>\n<p><em>(2,1)</em></p>\n</div>`][div21] | <PhCheckCircle color="var(--hig-green)" class="opacity-90 inline" :size="20" weight="duotone" /> |
|   ≥2   |  ≥2   | [`<div>\n<p><em>(2,2)</em></p>\n</div>`][div22] | <PhCheckCircle color="var(--hig-green)" class="opacity-90 inline" :size="20" weight="duotone" /> |


### Other elements

|  [`<foo>...*(before,after)*...</foo>`][fooAll]  ||||
| Before | After |                     Result                      |                                             Expected                                             |
|:------:|:-----:|:-----------------------------------------------:|:------------------------------------------------------------------------------------------------:|
|   0    |   0   |   [`<p><foo><em>(0,0)</em></foo></p>`][foo00]   | <PhCheckCircle color="var(--hig-green)" class="opacity-90 inline" :size="20" weight="duotone" /> |
|   0    |   1   |  [`<p><foo><em>(0,1)</em>\n</foo></p>`][foo01]  | <PhCheckCircle color="var(--hig-green)" class="opacity-90 inline" :size="20" weight="duotone" /> |
|   0    |   2   |  [`<p><foo><em>(0,2)</em></p>\n</foo>`][foo02]  |    <PhXCircle color="var(--hig-red)" class="opacity-90 inline" :size="20" weight="duotone" />    |
|   1    |   0   |         [`<foo>\n*(1,0)*</foo>`][foo10]         |   <PhCircle color="var(--hig-brown)" class="opacity-90 inline" :size="20" weight="duotone" />    |
|   1    |   1   |        [`<foo>\n*(1,1)*\n</foo>`][foo11]        |   <PhCircle color="var(--hig-brown)" class="opacity-90 inline" :size="20" weight="duotone" />    |
|   1    |   2   |        [`<foo>\n*(1,2)*\n</foo>`][foo12]        |   <PhCircle color="var(--hig-brown)" class="opacity-90 inline" :size="20" weight="duotone" />    |
|   ≥2   |   0   |  [`<foo>\n<p><em>(2,0)</em></foo></p>`][foo20]  |    <PhXCircle color="var(--hig-red)" class="opacity-90 inline" :size="20" weight="duotone" />    |
|   ≥2   |   1   | [`<foo>\n<p><em>(2,1)</em>\n</foo></p>`][foo21] |    <PhXCircle color="var(--hig-red)" class="opacity-90 inline" :size="20" weight="duotone" />    |
|   ≥2   |  ≥2   | [`<foo>\n<p><em>(2,2)</em></p>\n</foo>`][foo22] | <PhCheckCircle color="var(--hig-green)" class="opacity-90 inline" :size="20" weight="duotone" /> |

<!-- <foo>\n<p><em>(2,0)</em></foo></p> -->

## Remedy

We remedy the above issues in three steps:

1.  Escape the HTML tags of "[CommonMark type-6 HTML blocks][html-blocks]" by
    appending an UUIDv4 (without dashes) to the tag name. The same UUIDv4 is
    used for all these tags in a given document. This ensures that all HTML
    content is treated the same way by the CommonMark parser.
2.  Adjust the whitespace before and after the inner content of the HTML block
    in accordance with the following rule: Let $x\in\mathbb{N}_0$ be the
    number of newline characters (e.g., `'\n'`) between the end of the opening
    tag (`'>'`) and the first non-whitespace character of the inner content. Similarly,
    let $y\in\mathbb{N}_0$ be the number of newline characters between the last
    non-whitespace character of the inner content and the start of the closing
    tag (`'</'`). Now, we calculate the adjusted values $x_\text{adjusted}$ and
    $y_\text{adjusted}$ as follows:

    $$
    \begin{align}
        x_\text{adjusted} &=
            \begin{cases}
                2 & x_\text{original} \geq 2, \\
                2 & x_\text{original} = 1 \land \neg\,{\small\texttt{prefersInline}(\texttt{tag})}, \\
                0 & x_\text{original} = 1 \land {\small\texttt{prefersInline}(\texttt{tag})}, \\
                0 & x_\text{original} = 0,
            \end{cases} \\
        y_\text{adjusted} &= x_\text{adjusted},
    \end{align}
    $$

    where `prefersInline: (tag: string) => boolean` is configurable by the user
    via the `markdown.prefersInline` property of the SvelTeX configuration. (By
    default, `prefersInline` is the constant function `() => true`. This is
    because treating elements as inline elements in this sense is less invasive,
    since the markdown processor won't wrap the content in `<p>` tags.)
3.  Finally, after the markdown processor has processed the document:
    1.  For escaped HTML tags that are immediately preceded _and_ followed by a
        `<p>` and `</p>` tag, respectively, these `<p>` and `</p>` tags are
        removed. The motivation for this is preventing having something like
        `<p><p>...</p></p>` in the end, as well as the assumption and hope that
        this behavior mostly aligns with the output that a user might expect.
    2.  All occurrences of the UUIDv4 are replaced with the empty string,
        leaving only the original HTML tags.


With this remedy in place, the tables from before can be merged into the
following:


|  `<any>...*(before,after)*...</any>`  ||||
| Before | After |                                                                     Result                                                                     |                                             Expected                                             |
|:------:|:-----:|:----------------------------------------------------------------------------------------------------------------------------------------------:|:------------------------------------------------------------------------------------------------:|
|   0    |   0   |                                                          `<any><em>(0,0)</em></any>`                                                           | <PhCheckCircle color="var(--hig-green)" class="opacity-90 inline" :size="20" weight="duotone" /> |
|   0    |   1   |                                                          `<any><em>(0,1)</em></any>`                                                           | <PhCheckCircle color="var(--hig-green)" class="opacity-90 inline" :size="20" weight="duotone" /> |
|   0    |   2   |                                                          `<any><em>(0,2)</em></any>`                                                           | <PhCheckCircle color="var(--hig-green)" class="opacity-90 inline" :size="20" weight="duotone" /> |
|   1    |   0   | <div class="inline-flex flex-col "> <span> `<any><em>(1,0)</em></any>` or </span> <span> `<any>\n<p><em>(1,0)</em></p>\n</any>` </span> </div> | <PhCheckCircle color="var(--hig-gray)" class="opacity-90 inline" :size="20" weight="duotone" />  |
|   1    |   1   | <div class="inline-flex flex-col "> <span> `<any><em>(1,1)</em></any>` or </span> <span> `<any>\n<p><em>(1,1)</em></p>\n</any>` </span> </div> | <PhCheckCircle color="var(--hig-gray)" class="opacity-90 inline" :size="20" weight="duotone" />  |
|   1    |   2   | <div class="inline-flex flex-col "> <span> `<any><em>(1,2)</em></any>` or </span> <span> `<any>\n<p><em>(1,2)</em></p>\n</any>` </span> </div> | <PhCheckCircle color="var(--hig-gray)" class="opacity-90 inline" :size="20" weight="duotone" />  |
|   ≥2   |   0   |                                                     `<any>\n<p><em>(2,0)</em></p>\n</any>`                                                     | <PhCheckCircle color="var(--hig-green)" class="opacity-90 inline" :size="20" weight="duotone" /> |
|   ≥2   |   1   |                                                     `<any>\n<p><em>(2,1)</em></p>\n</any>`                                                     | <PhCheckCircle color="var(--hig-green)" class="opacity-90 inline" :size="20" weight="duotone" /> |
|   ≥2   |  ≥2   |                                                     `<any>\n<p><em>(2,2)</em></p>\n</any>`                                                     | <PhCheckCircle color="var(--hig-green)" class="opacity-90 inline" :size="20" weight="duotone" /> |



<!-- Dingus -->

[html-blocks]: https://spec.commonmark.org/0.31.2/#html-blocks

[case 1]: https://spec.commonmark.org/dingus/?text=%3Cdiv%3E**text**%0Athis%20is%20all%20just%20_one_%20HTML%20block%2C%0Aand%20none%20of%20it%20will%20be%20transformed%0Ain%20any%20way.%20For%20example%3A%20**not%20bold**.%0AHowever%2C%20if%20we%20add%20one%20blank%20line...%0A%0A...then%20everything%20after%20that%20is%20back%20to%20normal%3B%20for%20example%3A%20**bold**.#result
[case 2]: https://spec.commonmark.org/dingus/?text=%3Csome-tag%20possibly-with%3D%22attributes%22%3E%0Athis%20is%20all%20just%20_one_%20HTML%20block%2C%0Aand%20none%20of%20it%20will%20be%20transformed%0Ain%20any%20way.%20For%20example%3A%20**not%20bold**.%0AHowever%2C%20if%20we%20add%20one%20blank%20line...%0A%0A...then%20everything%20after%20that%20is%20back%20to%20normal%3B%20for%20example%3A%20**bold**.#result

[div22something]: https://spec.commonmark.org/dingus/?text=%3Cdiv%3E%0A%0A*something*%0A%0A%3C%2Fdiv%3E#result


[div00]: https://spec.commonmark.org/dingus/?text=%3Cdiv%3E*(0%2C0)*%3C%2Fdiv%3E#result
[div01]: https://spec.commonmark.org/dingus/?text=%3Cdiv%3E*(0%2C1)*%0A%3C%2Fdiv%3E#result
[div02]: https://spec.commonmark.org/dingus/?text=%3Cdiv%3E*(0%2C2)*%0A%0A%3C%2Fdiv%3E#result
[div10]: https://spec.commonmark.org/dingus/?text=%3Cdiv%3E*(1%2C0)*%3C%2Fdiv%3E#result
[div11]: https://spec.commonmark.org/dingus/?text=%3Cdiv%3E*(1%2C1)*%0A%3C%2Fdiv%3E#result
[div12]: https://spec.commonmark.org/dingus/?text=%3Cdiv%3E*(1%2C2)*%0A%0A%3C%2Fdiv%3E#result
[div20]: https://spec.commonmark.org/dingus/?text=%3Cdiv%3E%0A%0A*(2%2C0)*%3C%2Fdiv%3E#result
[div21]: https://spec.commonmark.org/dingus/?text=%3Cdiv%3E%0A%0A*(2%2C1)*%0A%3C%2Fdiv%3E#result
[div22]: https://spec.commonmark.org/dingus/?text=%3Cdiv%3E%0A%0A*(2%2C2)*%0A%0A%3C%2Fdiv%3E#result
[divAll]: https://spec.commonmark.org/dingus/?text=%3Cdiv%3E*(0%2C0)*%3C%2Fdiv%3E%0A%0A%3Cdiv%3E*(0%2C1)*%0A%3C%2Fdiv%3E%0A%0A%3Cdiv%3E*(0%2C2)*%0A%0A%3C%2Fdiv%3E%0A%0A%3Cdiv%3E%0A*(1%2C0)*%3C%2Fdiv%3E%0A%0A%3Cdiv%3E%0A*(1%2C1)*%0A%3C%2Fdiv%3E%0A%0A%3Cdiv%3E%0A*(1%2C2)*%0A%0A%3C%2Fdiv%3E%0A%0A%3Cdiv%3E%0A%0A*(2%2C0)*%3C%2Fdiv%3E%0A%0A%3Cdiv%3E%0A%0A*(2%2C1)*%0A%3C%2Fdiv%3E%0A%0A%3Cdiv%3E%0A%0A*(2%2C2)*%0A%0A%3C%2Fdiv%3E#result


[foo00]: https://spec.commonmark.org/dingus/?text=%3Cfoo%3E*(0%2C0)*%3C%2Ffoo%3E#result
[foo01]: https://spec.commonmark.org/dingus/?text=%3Cfoo%3E*(0%2C1)*%0A%3C%2Ffoo%3E#result
[foo02]: https://spec.commonmark.org/dingus/?text=%3Cfoo%3E*(0%2C2)*%0A%0A%3C%2Ffoo%3E#result
[foo10]: https://spec.commonmark.org/dingus/?text=%3Cfoo%3E%0A*(1%2C0)*%3C%2Ffoo%3E#result
[foo11]: https://spec.commonmark.org/dingus/?text=%3Cfoo%3E%0A*(1%2C1)*%0A%3C%2Ffoo%3E#result
[foo12]: https://spec.commonmark.org/dingus/?text=%3Cfoo%3E%0A*(1%2C2)*%0A%0A%3C%2Ffoo%3E#result
[foo20]: https://spec.commonmark.org/dingus/?text=%3Cfoo%3E%0A%0A*(2%2C0)*%3C%2Ffoo%3E#result
[foo21]: https://spec.commonmark.org/dingus/?text=%3Cfoo%3E%0A%0A*(2%2C1)*%0A%3C%2Ffoo%3E#result
[foo22]: https://spec.commonmark.org/dingus/?text=%3Cfoo%3E%0A%0A*(2%2C2)*%0A%0A%3C%2Ffoo%3E#result
[fooAll]: https://spec.commonmark.org/dingus/?text=%3Cfoo%3E*(0%2C0)*%3C%2Ffoo%3E%0A%0A%3Cfoo%3E*(0%2C1)*%0A%3C%2Ffoo%3E%0A%0A%3Cfoo%3E*(0%2C2)*%0A%0A%3C%2Ffoo%3E%0A%0A%3Cfoo%3E%0A*(1%2C0)*%3C%2Ffoo%3E%0A%0A%3Cfoo%3E%0A*(1%2C1)*%0A%3C%2Ffoo%3E%0A%0A%3Cfoo%3E%0A*(1%2C2)*%0A%0A%3C%2Ffoo%3E%0A%0A%3Cfoo%3E%0A%0A*(2%2C0)*%3C%2Ffoo%3E%0A%0A%3Cfoo%3E%0A%0A*(2%2C1)*%0A%3C%2Ffoo%3E%0A%0A%3Cfoo%3E%0A%0A*(2%2C2)*%0A%0A%3C%2Ffoo%3E#result


