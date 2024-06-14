import { Extends, typeAssert } from '$deps.js';
import {
    EscapeOptions,
    ProcessableSnippetType,
    SnippetType,
} from '$types/utils/Escape.js';

typeAssert<Extends<ProcessableSnippetType, SnippetType>>();

// All properties should be optional
typeAssert<Extends<object, EscapeOptions>>();
