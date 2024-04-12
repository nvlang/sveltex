// import type { LiteDocument } from './mathjax/adaptors/lite/Document.js';
// import type { LiteNode } from './mathjax/adaptors/lite/Element.js';
// import type { LiteText } from './mathjax/adaptors/lite/Text.js';
// import type { DOMAdaptor } from './mathjax/core/DOMAdaptor.js';
// import type { MathDocument } from './mathjax/core/MathDocument.js';

// export { LiteDocument, LiteNode, LiteText, DOMAdaptor, MathDocument };

// declare module 'mathjax' {
//     /**
//      * Implements a lightweight Document replacement
//      */
//     class LiteDocument {
//         /**
//          * The document's <html> element
//          */
//         root: LiteElement;
//         /**
//          * The document's <head> element
//          */
//         head: LiteElement;
//         /**
//          * The document's <body> element
//          */
//         body: LiteElement;
//         /**
//          * the DOCTYPE comment
//          */
//         type: string;
//         /**
//          * The kind is always #document
//          */
//         get kind(): string;
//         constructor();
//     }

//     class LiteText {
//         /**
//          * The text stored in the node
//          */
//         value: string;
//         /**
//          * The parent holding this text
//          */
//         parent: LiteElement;
//         /**
//          * The kind of node is #text
//          */
//         get kind(): string;
//         /**
//          * @param text - The text for the node
//          */
//         constructor(text?: string);
//     }

//     /**
//      * Generic list of options
//      */
//     type OptionList = Record<string, unknown>;
//     /**
//      * Type for attribute lists
//      */
//     type LiteAttributeList = OptionList;
//     /**
//      * Type for generic nodes in LiteAdaptor
//      */
//     type LiteNode = LiteElement | LiteText;
//     /************************************************************/
//     /**
//      * Implements a lightweight HTML element replacement
//      */
//     class LiteElement {
//         /**
//          * The type of element (tag name)
//          */
//         kind: string;
//         /**
//          * The element's attribute list
//          */
//         attributes: LiteAttributeList;
//         /**
//          * The element's children
//          */
//         children: LiteNode[];
//         /**
//          * The element's parent
//          */
//         parent: LiteElement;
//         /**
//          * The styles for the element
//          */
//         styles: Styles;
//         /**
//          * @param kind - The type of node to create
//          * @param attributes - The list of attributes to set
//          * (if any)
//          * @param children - The children for the node (if any)
//          */
//         constructor(
//             kind: string,
//             attributes?: LiteAttributeList,
//             children?: LiteNode[],
//         );
//     }

//     type StyleList = Record<string, string>;
//     /**
//      * Data for how to map a combined style (like border) to its children
//      */
//     interface Connection {
//         children: string[];
//         split: (name: string) => void;
//         combine: (name: string) => void;
//     }
//     /**
//      * A collection of connections
//      */
//     type Connections = Record<string, Connection>;

//     /**
//      * Implements the Styles object (lite version of CssStyleDeclaration)
//      */
//     class Styles {
//         /**
//          * Patterns for style values and comments
//          */
//         static pattern: Record<string, RegExp>;
//         /**
//          * The mapping of parents to children, and how to split and combine them
//          */
//         static connect: Connections;
//         /**
//          * The list of styles defined for this declaration
//          */
//         protected styles: StyleList;
//         /**
//          * @param cssText - The initial definition for the style
//          */
//         constructor(cssText?: string);
//         /**
//          * @returns The CSS string for the styles currently defined
//          */
//         get cssText(): string;
//         /**
//          * @param name - The name of the style to set
//          * @param value - The value to set it to
//          */
//         set(name: string, value: string | number | boolean): void;
//         /**
//          * @param name - The name of the style to get
//          * @returns The value of the style (or empty string if not defined)
//          */
//         get(name: string): string;
//         /**
//          * @param name - The name of the style to set (without causing parent
//          * updates)
//          * @param value - The value to set it to
//          */
//         protected setStyle(name: string, value: string): void;
//         /**
//          * @param name - The name of the style whose parent is to be combined
//          */
//         protected combineChildren(name: string): void;
//         /**
//          * @param name - The name of the style whose parent style is to be found
//          * @returns The name of the parent, or '' if none
//          */
//         protected parentName(name: string): string;
//         /**
//          * @param name - The name of the parent style
//          * @param child - The suffix to be added to the parent
//          * @returns The combined name
//          */
//         protected childName(name: string, child: string): string;
//         /**
//          * @param name - The name of a style to normalize
//          * @returns The name converted from CamelCase to lowercase with dashes
//          */
//         protected normalizeName(name: string): string;
//         /**
//          * @param cssText - A style text string to be parsed into separate
//          * styles (by using this.set(), we get all the * sub-styles created as
//          * well as the merged * style shorthands)
//          */
//         protected parse(cssText?: string): void;
//     }

//     interface AttributeData {
//         name: string;
//         value: string;
//     }
//     /**
//      * The data for an elements page-based bounding box
//      */
//     interface PageBBox {
//         left: number;
//         right: number;
//         top: number;
//         bottom: number;
//     }

//     /**
//      *  The interface for the DOMAdaptor
//      *
//      * @typeParam N - The HTMLElement node class
//      * @typeParam T - The Text node class
//      * @typeParam D - The Document class
//      */
//     interface DOMAdaptor<N, T, D> {
//         /**
//          * Document in which the nodes are to be created
//          */
//         document: D;
//         /**
//          * @param text - The serialized document to be parsed
//          * @param format - The format (e.g., 'text/html' or 'text/xhtml')
//          * @returns The parsed document
//          */
//         parse(text: string, format?: string): D;
//         /**
//          * @param kind - The tag name of the HTML node to be created
//          * @param def - The properties to set for the created node
//          * @param children - The child nodes for the created HTML node
//          * @param ns - The namespace in which to create the node
//          * @returns The generated HTML tree
//          */
//         node(
//             kind: string,
//             def?: OptionList,
//             children?: (N | T)[],
//             ns?: string,
//         ): N;
//         /**
//          * @param text - The text from which to create an HTML text node
//          * @returns The generated text node with the given text
//          */
//         text(text: string): T;
//         /**
//          * @param doc - The document whose head is to be obtained
//          * @returns The document.head element
//          */
//         head(doc: D): N;
//         /**
//          * @param doc - The document whose body is to be obtained
//          * @returns The document.body element
//          */
//         body(doc: D): N;
//         /**
//          * @param doc - The document whose documentElement is to be obtained
//          * @returns The documentElement
//          */
//         root(doc: D): N;
//         /**
//          * @param doc - The document whose doctype is to be obtained
//          * @returns The DOCTYPE comment
//          */
//         doctype(doc: D): string;
//         /**
//          * @param node - The node to search for tags
//          * @param name - The name of the tag to search for
//          * @param ns - The namespace to search in (or null for no namespace)
//          * @returns The list of tags found
//          */
//         tags(node: N, name: string, ns?: string): N[];
//         /**
//          * Get a list of containers (to be searched for math).  These can be
//          *  specified by CSS selector, or as actual DOM elements or arrays of such.
//          *
//          * @param nodes - The array of items to make into a container list
//          * @param document - The document in which to search
//          * @returns The array of containers to search
//          */
//         getElements(nodes: (string | N | N[])[], document: D): N[];
//         /**
//          * Determine if a container node contains a given node somewhere in its DOM tree
//          *
//          * @param container - The container to search
//          * @param node - The node to look for
//          * @returns True if the node is in the container's DOM tree
//          */
//         contains(container: N, node: N | T): boolean;
//         /**
//          * @param node - The HTML node whose parent is to be obtained
//          * @returns The parent node of the given one
//          */
//         parent(node: N | T): N;
//         /**
//          * @param node - The HTML node to be appended to
//          * @param child - The node or text to be appended
//          * @returns The appended node
//          */
//         append(node: N, child: N | T): N | T;
//         /**
//          * @param nchild - The node or text to be inserted
//          * @param ochild - The node or text where the new child is to be added before it
//          */
//         insert(nchild: N | T, ochild: N | T): void;
//         /**
//          * @param child - The node or text to be removed from its parent
//          * @returns The removed node
//          */
//         remove(child: N | T): N | T;
//         /**
//          * @param nnode - The node to replace with
//          * @param onode - The child to be replaced
//          * @returns The removed node
//          */
//         replace(nnode: N | T, onode: N | T): N | T;
//         /**
//          * @param node - The HTML node to be cloned
//          * @returns The copied node
//          */
//         clone(node: N): N;
//         /**
//          * @param node - The HTML text node to be split
//          * @param n - The index of the character where the split will occur
//          */
//         split(node: T, n: number): T;
//         /**
//          * @param node - The HTML node whose sibling is to be obtained
//          * @returns The node following the given one (or null)
//          */
//         next(node: N | T): N | T;
//         /**
//          * @param node - The HTML node whose sibling is to be obtained
//          * @returns The node preceding the given one (or null)
//          */
//         previous(node: N | T): N | T;
//         /**
//          * @param node - The HTML node whose child is to be obtained
//          * @returns The first child of the given node (or null)
//          */
//         firstChild(node: N): N | T;
//         /**
//          * @param node - The HTML node whose child is to be obtained
//          * @returns The last child of the given node (or null)
//          */
//         lastChild(node: N): N | T;
//         /**
//          * @param node - The HTML node whose children are to be obtained
//          * @returns Array of children for the given node (not a live list)
//          */
//         childNodes(node: N): (N | T)[];
//         /**
//          * @param node - The HTML node whose child is to be obtained
//          * @param i - The index of the child to return
//          * @returns The i-th child node of the given node (or null)
//          */
//         childNode(node: N, i: number): N | T;
//         /**
//          * @param node - The HTML node whose tag or node name is to be obtained
//          * @returns The tag or node name of the given node
//          */
//         kind(node: N | T): string;
//         /**
//          * @param node - The HTML node whose value is to be obtained
//          * @returns The value of the given node
//          */
//         value(node: N | T): string;
//         /**
//          * @param node - The HTML node whose text content is to be obtained
//          * @returns The text content of the given node
//          */
//         textContent(node: N): string;
//         /**
//          * @param node - The HTML node whose inner HTML string is to be obtained
//          * @returns The serialized content of the node
//          */
//         innerHTML(node: N): string;
//         /**
//          * @param node - The HTML node whose outer HTML string is to be obtained
//          * @returns The serialized node and its content
//          */
//         outerHTML(node: N): string;
//         /**
//          * @param node - The HTML node whose serialized string is to be obtained
//          * @returns The serialized node and its content
//          */
//         serializeXML(node: N): string;
//         /**
//          * @param node - The HTML node whose attribute is to be set
//          * @param name - The name of the attribute to set
//          * @param value - The new value of the attribute
//          * @param ns - The namespace to use for the attribute
//          */
//         setAttribute(
//             node: N,
//             name: string,
//             value: string | number,
//             ns?: string,
//         ): void;
//         /**
//          * @param node - The HTML element whose attributes are to be set
//          * @param def - The attributes to set on that node
//          */
//         setAttributes(node: N, def: OptionList): void;
//         /**
//          * @param node - The HTML node whose attribute is to be obtained
//          * @param name - The name of the attribute to get
//          * @returns The value of the given attribute of the given node
//          */
//         getAttribute(node: N, name: string): string;
//         /**
//          * @param node - The HTML node whose attribute is to be removed
//          * @param name - The name of the attribute to remove
//          */
//         removeAttribute(node: N, name: string): void;
//         /**
//          * @param node - The HTML node whose attribute is to be tested
//          * @param name - The name of the attribute to test
//          * @returns True of the node has the given attribute defined
//          */
//         hasAttribute(node: N, name: string): boolean;
//         /**
//          * @param node - The HTML node whose attributes are to be returned
//          * @returns The list of attributes
//          */
//         allAttributes(node: N): AttributeData[];
//         /**
//          * @param node - The HTML node whose class is to be augmented
//          * @param name - The class to be added
//          */
//         addClass(node: N, name: string): void;
//         /**
//          * @param node - The HTML node whose class is to be changed
//          * @param name - The class to be removed
//          */
//         removeClass(node: N, name: string): void;
//         /**
//          * @param node - The HTML node whose class is to be tested
//          * @param name - The class to test
//          * @returns True if the node has the given class
//          */
//         hasClass(node: N, name: string): boolean;
//         /**
//          * @param node - The HTML node whose class list is needed
//          * @returns An array of the class names for this node
//          */
//         allClasses(node: N): string[];
//         /**
//          * @param node - The HTML node whose style is to be changed
//          * @param name - The style to be set
//          * @param value - The new value of the style
//          */
//         setStyle(node: N, name: string, value: string): void;
//         /**
//          * @param node - The HTML node whose style is to be obtained
//          * @param name - The style to be obtained
//          * @returns The value of the style
//          */
//         getStyle(node: N, name: string): string;
//         /**
//          * @param node - The HTML node whose styles are to be returned
//          * @returns The cssText for the styles
//          */
//         allStyles(node: N): string;
//         /**
//          * @param node - The stylesheet node where the rule will be added
//          * @param rules - The rule to add at the beginning of the stylesheet
//          */
//         insertRules(node: N, rules: string[]): void;
//         /**
//          * @param node - The HTML node whose font size is to be determined
//          * @returns The font size (in pixels) of the node
//          */
//         fontSize(node: N): number;
//         /**
//          * @param node - The HTML node whose font family is to be determined
//          * @returns The font family
//          */
//         fontFamily(node: N): string;
//         /**
//          * @param node - The HTML node whose dimensions are to be determined
//          * @param em - The number of pixels in an em
//          * @param local - True if local coordinates are to be used in SVG elements
//          * @returns The width and height (in ems) of the element
//          */
//         nodeSize(node: N, em?: number, local?: boolean): [number, number];
//         /**
//          * @param node - The HTML node whose BBox is to be determined
//          * @returns position on the page (in pixels)
//          */
//         nodeBBox(node: N): PageBBox;
//     }

//     /**
//      * A function to call while rendering a document (usually calls a MathDocument method)
//      *
//      * @typeParam N - The HTMLElement node class
//      * @typeParam T - The Text node class
//      * @typeParam D - The Document class
//      */
//     type RenderDoc<N, T, D> = (document: MathDocument<N, T, D>) => boolean;
//     /**
//      * A function to call while rendering a MathItem (usually calls one of its methods)
//      *
//      * @typeParam N - The HTMLElement node class
//      * @typeParam T - The Text node class
//      * @typeParam D - The Document class
//      */
//     type RenderMath<N, T, D> = (
//         math: MathItem<N, T, D>,
//         document: MathDocument<N, T, D>,
//     ) => boolean;
//     /**
//      * The data for an action to perform during rendering or conversion
//      *
//      * @typeParam N - The HTMLElement node class
//      * @typeParam T - The Text node class
//      * @typeParam D - The Document class
//      */
//     interface RenderData<N, T, D> {
//         id: string;
//         renderDoc: RenderDoc<N, T, D>;
//         renderMath: RenderMath<N, T, D>;
//         convert: boolean;
//     }
//     /**
//      * The data used to define a render action in configurations and options objects
//      *   (the key is used as the id, the number in the data below is the priority, and
//      *    the remainind data is as described below; if no boolean is given, convert = true
//      *    by default)
//      *
//      * @typeParam N - The HTMLElement node class
//      * @typeParam T - The Text node class
//      * @typeParam D - The Document class
//      */
//     type RenderAction<N, T, D> =
//         | [number] // id (i.e., key) is method name to use
//         | [number, string] // string is method to call
//         | [number, string, string] // the strings are methods names for doc and math
//         | [number, RenderDoc<N, T, D>, RenderMath<N, T, D>] // explicit functions for doc and math
//         | [number, boolean] // same as first above, with boolean for convert
//         | [number, string, boolean] // same as second above, with boolean for convert
//         | [number, string, string, boolean] // same as third above, with boolean for convert
//         | [number, RenderDoc<N, T, D>, RenderMath<N, T, D>, boolean];
//     /**
//      * An object representing a collection of rendering actions (id's tied to priority-and-method data)
//      *
//      * @typeParam N - The HTMLElement node class
//      * @typeParam T - The Text node class
//      * @typeParam D - The Document class
//      */
//     type RenderActions<N, T, D> = Record<string, RenderAction<N, T, D>>;
//     /**
//      * Implements a prioritized list of render actions.  Extensions can add actions to the list
//      *   to make it easy to extend the normal typesetting and conversion operations.
//      *
//      * @typeParam N - The HTMLElement node class
//      * @typeParam T - The Text node class
//      * @typeParam D - The Document class
//      */
//     class RenderList<N, T, D> extends PrioritizedList<RenderData<N, T, D>> {
//         /**
//          * Creates a new RenderList from an initial list of rendering actions
//          *
//          * @param actions - The list of actions to take during render(), rerender(), and convert() calls
//          * @returns The newly created prioritied list
//          */
//         static create<N, T, D>(
//             actions: RenderActions<N, T, D>,
//         ): RenderList<N, T, D>;
//         /**
//          * Parses a RenderAction to produce the correspinding RenderData item
//          *  (e.g., turn method names into actual functions that call the method)
//          *
//          * @param id - The id of the action
//          * @param action - The RenderAction defining the action
//          * @returns The corresponding RenderData definition for the action and its priority
//          */
//         static action<N, T, D>(
//             id: string,
//             action: RenderAction<N, T, D>,
//         ): [RenderData<N, T, D>, number];
//         /**
//          * Produces the doc and math actions for the given method name(s)
//          *   (a blank name is a no-op)
//          *
//          * @param method1 - The method to use for the render() call
//          * @param method1 - The method to use for the rerender() and convert() calls
//          */
//         protected static methodActions(
//             method1: string,
//             method2?: string,
//         ): ((math: unknown, document: unknown) => boolean)[];
//         /**
//          * Perform the document-level rendering functions
//          *
//          * @param document - The MathDocument whose methods are to be called
//          * @param start - The state at which to start rendering (default is UNPROCESSED)
//          */
//         renderDoc(document: MathDocument<N, T, D>, start?: number): void;
//         /**
//          * Perform the MathItem-level rendering functions
//          *
//          * @param math - The MathItem whose methods are to be called
//          * @param document - The MathDocument to pass to the MathItem methods
//          * @param start - The state at which to start rendering (default is UNPROCESSED)
//          */
//         renderMath(
//             math: MathItem<N, T, D>,
//             document: MathDocument<N, T, D>,
//             start?: number,
//         ): void;
//         /**
//          * Perform the MathItem-level conversion functions
//          *
//          * @param math - The MathItem whose methods are to be called
//          * @param document - The MathDocument to pass to the MathItem methods
//          * @param end - The state at which to end rendering (default is LAST)
//          */
//         renderConvert(
//             math: MathItem<N, T, D>,
//             document: MathDocument<N, T, D>,
//             end?: number,
//         ): void;
//         /**
//          * Find an entry in the list with a given ID
//          *
//          * @param id - The id to search for
//          * @returns The data for the given id, if found, or null
//          */
//         findID(id: string): RenderData<N, T, D> | null;
//     }
//     /*****************************************************************/
//     /**
//      * The ways of specifying a container (a selector string, an actual node,
//      * or an array of those (e.g., the result of document.getElementsByTagName())
//      *
//      * @typeParam N - The HTMLElement node class
//      */
//     type ContainerList<N> = string | N | (string | N | N[])[];
//     /**
//      * The options allowed for the reset() method
//      */
//     interface ResetList {
//         all?: boolean;
//         processed?: boolean;
//         inputJax?: unknown[];
//         outputJax?: unknown[];
//     }
//     /**
//      * The default option list for the reset() method
//      */
//     const resetOptions: ResetList;
//     /**
//      * The option list for when all options are to be reset
//      */
//     const resetAllOptions: ResetList;
//     /*****************************************************************/
//     /**
//      *  The MathDocument interface
//      *
//      *  The MathDocument is created by MathJax.Document() and holds the
//      *  document, the math found in it, and so on.  The methods of the
//      *  MathDocument all return the MathDocument itself, so you can
//      *  chain the method calls.  E.g.,
//      *
//      *    const html = MathJax.Document('<html>...</html>');
//      *    html.findMath()
//      *        .compile()
//      *        .getMetrics()
//      *        .typeset()
//      *        .updateDocument();
//      *
//      *  The MathDocument is the main interface for page authors to
//      *  interact with MathJax.
//      *
//      * @typeParam N - The HTMLElement node class
//      * @typeParam T - The Text node class
//      * @typeParam D - The Document class
//      */
//     interface MathDocument<N, T, D> {
//         /**
//          * The document being processed (e.g., DOM document, or Markdown string)
//          */
//         document: D;
//         /**
//          * The kind of MathDocument (e.g., "HTML")
//          */
//         kind: string;
//         /**
//          * The options for the document
//          */
//         options: OptionList;
//         /**
//          * The list of MathItems found in this page
//          */
//         math: MathList<N, T, D>;
//         /**
//          * The list of actions to take during a render() or convert() call
//          */
//         renderActions: RenderList<N, T, D>;
//         /**
//          * This object tracks what operations have been performed, so that (when
//          *  asynchronous operations are used), the ones that have already been
//          *  completed won't be performed again.
//          */
//         processed: BitField;
//         /**
//          * An array of input jax to run on the document
//          */
//         inputJax: InputJax<N, T, D>[];
//         /**
//          * The output jax to use for the document
//          */
//         outputJax: OutputJax<N, T, D>;
//         /**
//          * The DOM adaptor to use for input and output
//          */
//         adaptor: DOMAdaptor<N, T, D>;
//         /**
//          * The MmlFactory to be used for input jax and error processing
//          */
//         mmlFactory: MmlFactory;
//         /**
//          * @param id - The id of the action to add
//          * @param action - The RenderAction to take
//          */
//         addRenderAction(id: string, ...action: unknown[]): void;
//         /**
//          * @param id - The id of the action to remove
//          */
//         removeRenderAction(id: string): void;
//         /**
//          * Perform the renderActions on the document
//          */
//         render(): MathDocument<N, T, D>;
//         /**
//          * Rerender the MathItems on the page
//          *
//          * @param start - The state to start rerendering at
//          * @returns The math document instance
//          */
//         rerender(start?: number): MathDocument<N, T, D>;
//         /**
//          * Convert a math string to the document's output format
//          *
//          * @param math - The math string to convert
//          * @param options - The options for the conversion (e.g., format, ex, em, etc.)
//          * @returns The MmlNode or N node for the converted content
//          */
//         convert(math: string, options?: OptionList): MmlNode | N;
//         /**
//          * Locates the math in the document and constructs the MathList
//          *  for the document.
//          *
//          * @param options - The options for locating the math
//          * @returns The math document instance
//          */
//         findMath(options?: OptionList): MathDocument<N, T, D>;
//         /**
//          * Calls the input jax to process the MathItems in the MathList
//          *
//          * @returns The math document instance
//          */
//         compile(): MathDocument<N, T, D>;
//         /**
//          * Gets the metric information for the MathItems
//          *
//          * @returns The math document instance
//          */
//         getMetrics(): MathDocument<N, T, D>;
//         /**
//          * Calls the output jax to process the compiled math in the MathList
//          *
//          * @returns The math document instance
//          */
//         typeset(): MathDocument<N, T, D>;
//         /**
//          * Updates the document to include the typeset math
//          *
//          * @returns The math document instance
//          */
//         updateDocument(): MathDocument<N, T, D>;
//         /**
//          * Removes the typeset math from the document
//          *
//          * @param restore - True if the original math should be put
//          *                            back into the document as well
//          * @returns The math document instance
//          */
//         removeFromDocument(restore?: boolean): MathDocument<N, T, D>;
//         /**
//          * Set the state of the document (allowing you to roll back
//          *  the state to a previous one, if needed).
//          *
//          * @param state - The new state of the document
//          * @param restore - True if the original math should be put
//          *                            back into the document during the rollback
//          * @returns The math document instance
//          */
//         state(state: number, restore?: boolean): MathDocument<N, T, D>;
//         /**
//          * Clear the processed values so that the document can be reprocessed
//          *
//          * @param options - The things to be reset
//          * @returns The math document instance
//          */
//         reset(options?: ResetList): MathDocument<N, T, D>;
//         /**
//          * Reset the processed values and clear the MathList (so that new math
//          * can be processed in the document).
//          *
//          * @returns The math document instance
//          */
//         clear(): MathDocument<N, T, D>;
//         /**
//          * Merges a MathList into the list for this document.
//          *
//          * @param list - The MathList to be merged into this document's list
//          * @returns The math document instance
//          */
//         concat(list: MathList<N, T, D>): MathDocument<N, T, D>;
//         /**
//          * Clear the typeset MathItems that are within the given container
//          *   from the document's MathList.  (E.g., when the content of the
//          *   container has been updated and you want to remove the
//          *   associated MathItems)
//          *
//          * @param elements - The container DOM elements whose math items are to be removed
//          * @returns The removed MathItems
//          */
//         clearMathItemsWithin(containers: ContainerList<N>): MathItem<N, T, D>[];
//         /**
//          * Get the typeset MathItems that are within a given container.
//          *
//          * @param elements - The container DOM elements whose math items are to be found
//          * @returns The list of MathItems within that container
//          */
//         getMathItemsWithin(elements: ContainerList<N>): MathItem<N, T, D>[];
//     }
// }
