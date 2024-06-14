# `src/utils/micromark`

This directory contains a `micromark` extension that lets it skip any of a
specified array of HTML elements when parsing Markdown. This is used by SvelTeX
to skip verbatim environments when parsing Markdown content.

| Location | Description |
|:---|:---|
| [`skipFlow.ts`](skipFlow.ts) | Exports the `tokenizeSkipFlowFactory` function, which, given an array of tags, returns the tokenizer that forms the essence of the corresponding micromark extension. |
| [`syntax.ts`](syntax.ts) | Exports the `micromarkSkip` function, which receives an array of HTML tags to skip and returns a `micromark` extension that skips those tags. |
