export type StarryNightThemeName = (typeof starryNightThemeNames)[number];
export type HighlightJsThemeName = (typeof highlightJsThemeNames)[number];
export type StarryNightLanguage = keyof typeof starryNightLanguages;
export type StarryNightScope =
    (typeof starryNightLanguages)[StarryNightLanguage];
export type HighlightJsLanguage = (typeof highlightJsLanguages)[number];

/**
 * `starry-night` themes.
 */
export const starryNightThemeNames = [
    'default',
    'colorblind',
    'dimmed',
    'high-contrast',
    'tritanopia',
] as const;

/**
 * `highlight.js` themes. Excludes themes that rely on more than just CSS (e.g.,
 * themes that import a PNG/JPEG file).
 */
export const highlightJsThemeNames = [
    'a11y-dark',
    'a11y-light',
    'agate',
    'an-old-hope',
    'androidstudio',
    'arduino-light',
    'arta',
    'ascetic',
    'atom-one-dark',
    'atom-one-dark-reasonable',
    'atom-one-light',
    'base16/3024',
    'base16/apathy',
    'base16/apprentice',
    'base16/ashes',
    'base16/atelier-cave',
    'base16/atelier-cave-light',
    'base16/atelier-dune',
    'base16/atelier-dune-light',
    'base16/atelier-estuary',
    'base16/atelier-estuary-light',
    'base16/atelier-forest',
    'base16/atelier-forest-light',
    'base16/atelier-heath',
    'base16/atelier-heath-light',
    'base16/atelier-lakeside',
    'base16/atelier-lakeside-light',
    'base16/atelier-plateau',
    'base16/atelier-plateau-light',
    'base16/atelier-savanna',
    'base16/atelier-savanna-light',
    'base16/atelier-seaside',
    'base16/atelier-seaside-light',
    'base16/atelier-sulphurpool',
    'base16/atelier-sulphurpool-light',
    'base16/atlas',
    'base16/bespin',
    'base16/black-metal',
    'base16/black-metal-bathory',
    'base16/black-metal-burzum',
    'base16/black-metal-dark-funeral',
    'base16/black-metal-gorgoroth',
    'base16/black-metal-immortal',
    'base16/black-metal-khold',
    'base16/black-metal-marduk',
    'base16/black-metal-mayhem',
    'base16/black-metal-nile',
    'base16/black-metal-venom',
    'base16/brewer',
    'base16/bright',
    'base16/brogrammer',
    'base16/brush-trees',
    'base16/brush-trees-dark',
    'base16/chalk',
    'base16/circus',
    'base16/classic-dark',
    'base16/classic-light',
    'base16/codeschool',
    'base16/colors',
    'base16/cupcake',
    'base16/cupertino',
    'base16/danqing',
    'base16/darcula',
    'base16/dark-violet',
    'base16/darkmoss',
    'base16/darktooth',
    'base16/decaf',
    'base16/default-dark',
    'base16/default-light',
    'base16/dirtysea',
    'base16/dracula',
    'base16/edge-dark',
    'base16/edge-light',
    'base16/eighties',
    'base16/embers',
    'base16/equilibrium-dark',
    'base16/equilibrium-gray-dark',
    'base16/equilibrium-gray-light',
    'base16/equilibrium-light',
    'base16/espresso',
    'base16/eva',
    'base16/eva-dim',
    'base16/flat',
    'base16/framer',
    'base16/fruit-soda',
    'base16/gigavolt',
    'base16/github',
    'base16/google-dark',
    'base16/google-light',
    'base16/grayscale-dark',
    'base16/grayscale-light',
    'base16/green-screen',
    'base16/gruvbox-dark-hard',
    'base16/gruvbox-dark-medium',
    'base16/gruvbox-dark-pale',
    'base16/gruvbox-dark-soft',
    'base16/gruvbox-light-hard',
    'base16/gruvbox-light-medium',
    'base16/gruvbox-light-soft',
    'base16/hardcore',
    'base16/harmonic16-dark',
    'base16/harmonic16-light',
    'base16/heetch-dark',
    'base16/heetch-light',
    'base16/helios',
    'base16/hopscotch',
    'base16/horizon-dark',
    'base16/horizon-light',
    'base16/humanoid-dark',
    'base16/humanoid-light',
    'base16/ia-dark',
    'base16/ia-light',
    'base16/icy-dark',
    'base16/ir-black',
    'base16/isotope',
    'base16/kimber',
    'base16/london-tube',
    'base16/macintosh',
    'base16/marrakesh',
    'base16/materia',
    'base16/material',
    'base16/material-darker',
    'base16/material-lighter',
    'base16/material-palenight',
    'base16/material-vivid',
    'base16/mellow-purple',
    'base16/mexico-light',
    'base16/mocha',
    'base16/monokai',
    'base16/nebula',
    'base16/nord',
    'base16/nova',
    'base16/ocean',
    'base16/oceanicnext',
    'base16/one-light',
    'base16/onedark',
    'base16/outrun-dark',
    'base16/papercolor-dark',
    'base16/papercolor-light',
    'base16/paraiso',
    'base16/pasque',
    'base16/phd',
    'base16/pico',
    'base16/pop',
    'base16/porple',
    'base16/qualia',
    'base16/railscasts',
    'base16/rebecca',
    'base16/ros-pine',
    'base16/ros-pine-dawn',
    'base16/ros-pine-moon',
    'base16/sagelight',
    'base16/sandcastle',
    'base16/seti-ui',
    'base16/shapeshifter',
    'base16/silk-dark',
    'base16/silk-light',
    'base16/snazzy',
    'base16/solar-flare',
    'base16/solar-flare-light',
    'base16/solarized-dark',
    'base16/solarized-light',
    'base16/spacemacs',
    'base16/summercamp',
    'base16/summerfruit-dark',
    'base16/summerfruit-light',
    'base16/synth-midnight-terminal-dark',
    'base16/synth-midnight-terminal-light',
    'base16/tango',
    'base16/tender',
    'base16/tomorrow',
    'base16/tomorrow-night',
    'base16/twilight',
    'base16/unikitty-dark',
    'base16/unikitty-light',
    'base16/vulcan',
    'base16/windows-10',
    'base16/windows-10-light',
    'base16/windows-95',
    'base16/windows-95-light',
    'base16/windows-high-contrast',
    'base16/windows-high-contrast-light',
    'base16/windows-nt',
    'base16/windows-nt-light',
    'base16/woodland',
    'base16/xcode-dusk',
    'base16/zenburn',
    'codepen-embed',
    'color-brewer',
    'dark',
    'default',
    'devibeans',
    'docco',
    'far',
    'felipec',
    'foundation',
    'github',
    'github-dark',
    'github-dark-dimmed',
    'gml',
    'googlecode',
    'gradient-dark',
    'gradient-light',
    'grayscale',
    'hybrid',
    'idea',
    'intellij-light',
    'ir-black',
    'isbl-editor-dark',
    'isbl-editor-light',
    'kimbie-dark',
    'kimbie-light',
    'lightfair',
    'lioshi',
    'magula',
    'mono-blue',
    'monokai',
    'monokai-sublime',
    'night-owl',
    'nnfx-dark',
    'nnfx-light',
    'nord',
    'obsidian',
    'panda-syntax-dark',
    'panda-syntax-light',
    'paraiso-dark',
    'paraiso-light',
    'purebasic',
    'qtcreator-dark',
    'qtcreator-light',
    'rainbow',
    'routeros',
    'school-book',
    'shades-of-purple',
    'srcery',
    'stackoverflow-dark',
    'stackoverflow-light',
    'sunburst',
    'tokyo-night-dark',
    'tokyo-night-light',
    'tomorrow-night-blue',
    'tomorrow-night-bright',
    'vs',
    'vs2015',
    'xcode',
    'xt256',
] as const;

export const starryNightLanguages = {
    '1c-enterprise': 'source.bsl',
    '2-dimensional-array': 'source.2da',
    '4d': 'source.4dm',
    abap: 'source.abap',
    'abap-cds': 'source.abapcds',
    abnf: 'source.abnf',
    'ags-script': 'source.c++',
    aidl: 'source.aidl',
    al: 'source.al',
    ampl: 'source.ampl',
    antlr: 'source.antlr',
    'api-blueprint': 'text.html.markdown.source.gfm.apib',
    apl: 'source.apl',
    asl: 'source.asl',
    'asn.1': 'source.asn',
    'asp.net': 'text.html.asp',
    ats: 'source.ats',
    actionscript: 'source.actionscript.3',
    ada: 'source.ada',
    'adblock-filter-list': 'text.adblock',
    'adobe-font-metrics': 'source.afm',
    agda: 'source.agda',
    alloy: 'source.alloy',
    'alpine-abuild': 'source.shell',
    'altium-designer': 'source.ini',
    angelscript: 'source.angelscript',
    'ant-build-system': 'text.xml.ant',
    antlers: 'text.html.statamic',
    apacheconf: 'source.apache-config',
    apex: 'source.apex',
    'apollo-guidance-computer': 'source.agc',
    applescript: 'source.applescript',
    arc: 'none',
    asciidoc: 'text.html.asciidoc',
    aspectj: 'source.aspectj',
    assembly: 'source.assembly',
    astro: 'source.astro',
    asymptote: 'source.c++',
    augeas: 'none',
    autohotkey: 'source.ahk',
    autoit: 'source.autoit',
    'avro-idl': 'source.avro',
    awk: 'source.awk',
    basic: 'source.basic',
    ballerina: 'source.ballerina',
    batchfile: 'source.batchfile',
    beef: 'source.cs',
    befunge: 'source.befunge',
    berry: 'source.berry',
    bibtex: 'text.bibtex',
    bicep: 'source.bicep',
    bikeshed: 'source.csswg',
    bison: 'source.yacc',
    bitbake: 'none',
    blade: 'text.html.php.blade',
    blitzbasic: 'source.blitzmax',
    blitzmax: 'source.blitzmax',
    bluespec: 'source.bsv',
    boo: 'source.boo',
    boogie: 'source.boogie',
    brainfuck: 'source.bf',
    brighterscript: 'source.brs',
    brightscript: 'source.brs',
    browserslist: 'text.browserslist',
    c: 'source.c',
    'c#': 'source.cs',
    'c++': 'source.c++',
    'c-objdump': 'objdump.x86asm',
    'c2hs-haskell': 'source.haskell',
    'cap-cds': 'source.cds',
    cil: 'source.cil',
    clips: 'source.clips',
    cmake: 'source.cmake',
    cobol: 'source.cobol',
    codeowners: 'text.codeowners',
    collada: 'text.xml',
    cson: 'source.coffee',
    css: 'source.css',
    csv: 'none',
    cue: 'source.cue',
    cweb: 'none',
    'cabal-config': 'source.cabal',
    cadence: 'source.cadence',
    cairo: 'source.cairo',
    cameligo: 'source.mligo',
    "cap'n-proto": 'source.capnp',
    cartocss: 'source.css.mss',
    ceylon: 'source.ceylon',
    chapel: 'source.chapel',
    charity: 'none',
    checksums: 'text.checksums',
    chuck: 'source.java',
    circom: 'source.circom',
    cirru: 'source.cirru',
    clarion: 'source.clarion',
    clarity: 'source.clar',
    'classic-asp': 'text.html.asp',
    clean: 'source.clean',
    click: 'source.click',
    clojure: 'source.clojure',
    'closure-templates': 'text.html.soy',
    'cloud-firestore-security-rules': 'source.firestore',
    'conll-u': 'text.conllu',
    codeql: 'source.ql',
    coffeescript: 'source.coffee',
    coldfusion: 'text.html.cfm',
    'coldfusion-cfc': 'source.cfscript',
    'common-lisp': 'source.lisp',
    'common-workflow-language': 'source.cwl',
    'component-pascal': 'source.pascal',
    cool: 'source.cool',
    coq: 'source.coq',
    'cpp-objdump': 'objdump.x86asm',
    creole: 'text.html.creole',
    crystal: 'source.crystal',
    csound: 'source.csound',
    'csound-document': 'source.csound-document',
    'csound-score': 'source.csound-score',
    cuda: 'source.cuda-c++',
    'cue-sheet': 'source.cuesheet',
    curry: 'source.curry',
    cycript: 'source.js',
    cypher: 'source.cypher',
    cython: 'source.cython',
    d: 'source.d',
    'd-objdump': 'objdump.x86asm',
    d2: 'source.d2',
    'digital-command-language': 'none',
    dm: 'source.dm',
    'dns-zone': 'text.zone_file',
    dtrace: 'source.c',
    dafny: 'text.dfy.dafny',
    'darcs-patch': 'none',
    dart: 'source.dart',
    dataweave: 'source.data-weave',
    'debian-package-control-file': 'source.deb-control',
    denizenscript: 'source.denizenscript',
    dhall: 'source.haskell',
    diff: 'source.diff',
    'directx-3d-file': 'none',
    dockerfile: 'source.dockerfile',
    dogescript: 'none',
    dotenv: 'source.dotenv',
    dylan: 'source.dylan',
    e: 'none',
    'e-mail': 'text.eml.basic',
    ebnf: 'source.ebnf',
    ecl: 'source.ecl',
    eclipse: 'source.prolog.eclipse',
    ejs: 'text.html.js',
    eq: 'source.cs',
    eagle: 'text.xml',
    earthly: 'source.earthfile',
    easybuild: 'source.python',
    'ecere-projects': 'source.json',
    ecmarkup: 'text.html.ecmarkup',
    editorconfig: 'source.editorconfig',
    'edje-data-collection': 'source.c++',
    eiffel: 'source.eiffel',
    elixir: 'source.elixir',
    elm: 'source.elm',
    elvish: 'source.elvish',
    'elvish-transcript': 'source.elvish-transcript',
    'emacs-lisp': 'source.emacs.lisp',
    emberscript: 'source.coffee',
    erlang: 'source.erlang',
    euphoria: 'source.euphoria',
    'f#': 'source.fsharp',
    'f*': 'source.fstar',
    'figlet-font': 'source.figfont',
    flux: 'none',
    factor: 'source.factor',
    fancy: 'source.fancy',
    fantom: 'source.fan',
    faust: 'source.faust',
    fennel: 'source.fnl',
    'filebench-wml': 'none',
    filterscript: 'none',
    fluent: 'source.ftl',
    formatted: 'none',
    forth: 'source.forth',
    fortran: 'source.fortran',
    'fortran-free-form': 'source.fortran.modern',
    freebasic: 'source.vbnet',
    freemarker: 'text.html.ftl',
    frege: 'source.haskell',
    futhark: 'source.futhark',
    'g-code': 'source.gcode',
    gaml: 'none',
    gams: 'none',
    gap: 'source.gap',
    'gcc-machine-description': 'source.lisp',
    gdb: 'source.gdb',
    gdscript: 'source.gdscript',
    gedcom: 'source.gedcom',
    glsl: 'source.glsl',
    gn: 'source.gn',
    gsc: 'source.gsc',
    'game-maker-language': 'source.c++',
    'gemfile.lock': 'source.gemfile-lock',
    gemini: 'source.gemini',
    genero: 'source.genero',
    'genero-forms': 'source.genero-forms',
    genie: 'none',
    genshi: 'text.xml.genshi',
    'gentoo-ebuild': 'source.shell',
    'gentoo-eclass': 'source.shell',
    'gerber-image': 'source.gerber',
    'gettext-catalog': 'source.po',
    gherkin: 'text.gherkin.feature',
    'git-attributes': 'source.gitattributes',
    'git-config': 'source.gitconfig',
    'git-revision-list': 'source.git-revlist',
    gleam: 'source.gleam',
    glyph: 'source.tcl',
    'glyph-bitmap-distribution-format': 'source.bdf',
    gnuplot: 'source.gnuplot',
    go: 'source.go',
    'go-checksums': 'go.sum',
    'go-module': 'go.mod',
    'go-workspace': 'go.mod',
    'godot-resource': 'source.gdresource',
    golo: 'source.golo',
    gosu: 'source.gosu.2',
    grace: 'source.grace',
    gradle: 'source.groovy.gradle',
    'grammatical-framework': 'source.gf',
    'graph-modeling-language': 'none',
    graphql: 'source.graphql',
    'graphviz-(dot)': 'source.dot',
    groovy: 'source.groovy',
    'groovy-server-pages': 'text.html.jsp',
    haproxy: 'source.haproxy-config',
    hcl: 'source.terraform',
    hlsl: 'source.hlsl',
    hocon: 'source.hocon',
    html: 'text.html.basic',
    'html+ecr': 'text.html.ecr',
    'html+eex': 'text.html.elixir',
    'html+erb': 'text.html.erb',
    'html+php': 'text.html.php',
    'html+razor': 'text.html.cshtml',
    http: 'source.httpspec',
    hxml: 'source.hxml',
    hack: 'source.hack',
    haml: 'text.haml',
    handlebars: 'text.html.handlebars',
    harbour: 'source.harbour',
    haskell: 'source.haskell',
    haxe: 'source.hx',
    hiveql: 'source.hql',
    holyc: 'source.hc',
    'hosts-file': 'source.hosts',
    hy: 'source.hy',
    hyphy: 'none',
    idl: 'source.idl',
    'igor-pro': 'source.igor',
    ini: 'source.ini',
    'irc-log': 'none',
    idris: 'source.idris',
    'ignore-list': 'source.gitignore',
    'imagej-macro': 'none',
    imba: 'source.imba',
    'inform-7': 'source.inform7',
    ink: 'source.ink',
    'inno-setup': 'source.inno',
    io: 'source.io',
    ioke: 'source.ioke',
    isabelle: 'source.isabelle.theory',
    'isabelle-root': 'source.isabelle.root',
    j: 'source.j',
    'jar-manifest': 'source.yaml',
    jcl: 'source.jcl',
    jflex: 'source.jflex',
    json: 'source.json',
    'json-with-comments': 'source.js',
    json5: 'source.js',
    jsonld: 'source.js',
    jsoniq: 'source.jsoniq',
    janet: 'source.janet',
    jasmin: 'source.jasmin',
    java: 'source.java',
    'java-properties': 'source.java-properties',
    'java-server-pages': 'text.html.jsp',
    javascript: 'source.js',
    'javascript+erb': 'source.js',
    'jest-snapshot': 'source.jest.snap',
    'jetbrains-mps': 'none',
    jinja: 'text.html.django',
    jison: 'source.jison',
    'jison-lex': 'source.jisonlex',
    jolie: 'source.jolie',
    jsonnet: 'source.jsonnet',
    julia: 'source.julia',
    'jupyter-notebook': 'source.json',
    just: 'source.just',
    krl: 'none',
    'kaitai-struct': 'source.yaml',
    kakounescript: 'source.kakscript',
    kerboscript: 'source.kerboscript',
    'kicad-layout': 'source.pcb.sexp',
    'kicad-legacy-layout': 'source.pcb.board',
    'kicad-schematic': 'source.pcb.schematic',
    kickstart: 'source.kickstart',
    kit: 'text.html.basic',
    kotlin: 'source.kotlin',
    kusto: 'source.kusto',
    lfe: 'source.lisp',
    llvm: 'source.llvm',
    lolcode: 'source.lolcode',
    lsl: 'source.lsl',
    'ltspice-symbol': 'source.ltspice.symbol',
    labview: 'text.xml',
    lark: 'source.lark',
    lasso: 'file.lasso',
    latte: 'text.html.smarty',
    lean: 'source.lean',
    less: 'source.css.less',
    lex: 'source.lex',
    ligolang: 'source.ligo',
    lilypond: 'source.lilypond',
    limbo: 'none',
    'linker-script': 'none',
    'linux-kernel-module': 'none',
    liquid: 'text.html.liquid',
    'literate-agda': 'none',
    'literate-coffeescript': 'source.litcoffee',
    'literate-haskell': 'text.tex.latex.haskell',
    livescript: 'source.livescript',
    logos: 'source.logos',
    logtalk: 'source.logtalk',
    lookml: 'source.yaml',
    loomscript: 'source.loomscript',
    lua: 'source.lua',
    m: 'none',
    m4: 'source.m4',
    m4sugar: 'source.m4',
    matlab: 'source.matlab',
    maxscript: 'source.maxscript',
    mdx: 'source.mdx',
    mlir: 'source.mlir',
    mql4: 'source.mql5',
    mql5: 'source.mql5',
    mtml: 'text.html.basic',
    muf: 'none',
    macaulay2: 'source.m2',
    makefile: 'source.makefile',
    mako: 'text.html.mako',
    markdown: 'text.md',
    marko: 'text.marko',
    mask: 'source.mask',
    mathematica: 'source.mathematica',
    'maven-pom': 'text.xml.pom',
    max: 'source.json',
    mercury: 'source.mercury',
    mermaid: 'source.mermaid',
    meson: 'source.meson',
    metal: 'source.c++',
    'microsoft-developer-studio-project': 'none',
    'microsoft-visual-studio-solution': 'source.solution',
    minid: 'none',
    miniyaml: 'source.miniyaml',
    mint: 'source.mint',
    mirah: 'source.ruby',
    modelica: 'source.modelica',
    'modula-2': 'source.modula2',
    'modula-3': 'source.modula-3',
    'module-management-system': 'none',
    monkey: 'source.monkey',
    'monkey-c': 'source.mc',
    moocode: 'none',
    moonscript: 'source.moonscript',
    motoko: 'source.mo',
    'motorola-68k-assembly': 'source.m68k',
    move: 'source.move',
    muse: 'text.muse',
    mustache: 'text.html.smarty',
    myghty: 'none',
    nasl: 'source.nasl',
    ncl: 'source.ncl',
    neon: 'source.neon',
    nl: 'none',
    'npm-config': 'source.ini.npmrc',
    nsis: 'source.nsis',
    nwscript: 'source.c.nwscript',
    nasal: 'source.nasal',
    nearley: 'source.ne',
    nemerle: 'source.nemerle',
    netlinx: 'source.netlinx',
    'netlinx+erb': 'source.netlinx.erb',
    netlogo: 'source.lisp',
    newlisp: 'source.lisp',
    nextflow: 'source.nextflow',
    nginx: 'source.nginx',
    nim: 'source.nim',
    ninja: 'source.ninja',
    nit: 'source.nit',
    nix: 'source.nix',
    nu: 'source.nu',
    numpy: 'none',
    nunjucks: 'text.html.nunjucks',
    nushell: 'source.nushell',
    'oasv2-json': 'source.json',
    'oasv2-yaml': 'source.yaml',
    'oasv3-json': 'source.json',
    'oasv3-yaml': 'source.yaml',
    ocaml: 'source.ocaml',
    objdump: 'objdump.x86asm',
    'object-data-instance-notation': 'source.odin-ehr',
    objectscript: 'source.objectscript',
    'objective-c': 'source.objc',
    'objective-c++': 'source.objc++',
    'objective-j': 'source.js.objj',
    odin: 'source.odin',
    omgrofl: 'none',
    opa: 'source.opa',
    opal: 'source.opal',
    'open-policy-agent': 'source.rego',
    'openapi-specification-v2': 'none',
    'openapi-specification-v3': 'none',
    opencl: 'source.c',
    'openedge-abl': 'source.abl',
    openqasm: 'source.qasm',
    'openrc-runscript': 'source.shell',
    openscad: 'source.scad',
    'openstep-property-list': 'source.plist',
    'opentype-feature-file': 'source.opentype',
    'option-list': 'source.opts',
    org: 'none',
    ox: 'source.ox',
    oxygene: 'none',
    oz: 'source.oz',
    p4: 'source.p4',
    pddl: 'source.pddl',
    'peg.js': 'source.pegjs',
    php: 'text.html.php',
    plsql: 'none',
    plpgsql: 'source.sql',
    'pov-ray-sdl': 'source.pov-ray sdl',
    pact: 'source.pact',
    pan: 'source.pan',
    papyrus: 'source.papyrus.skyrim',
    parrot: 'none',
    'parrot-assembly': 'none',
    'parrot-internal-representation': 'source.parrot.pir',
    pascal: 'source.pascal',
    pawn: 'source.pawn',
    pep8: 'source.pep8',
    perl: 'source.perl',
    pic: 'source.pic',
    pickle: 'none',
    picolisp: 'source.lisp',
    piglatin: 'source.pig_latin',
    pike: 'source.pike',
    plantuml: 'source.wsd',
    pod: 'none',
    'pod-6': 'source.raku',
    pogoscript: 'source.pogoscript',
    polar: 'source.polar',
    pony: 'source.pony',
    portugol: 'source.portugol',
    postcss: 'source.postcss',
    postscript: 'source.postscript',
    powerbuilder: 'none',
    powershell: 'source.powershell',
    prisma: 'source.prisma',
    processing: 'source.processing',
    procfile: 'source.procfile',
    proguard: 'none',
    prolog: 'source.prolog',
    promela: 'source.promela',
    'propeller-spin': 'source.spin',
    'protocol-buffer': 'source.proto',
    'protocol-buffer-text-format': 'source.textproto',
    'public-key': 'none',
    pug: 'text.jade',
    puppet: 'source.puppet',
    'pure-data': 'none',
    purebasic: 'none',
    purescript: 'source.purescript',
    pyret: 'source.arr',
    python: 'source.python',
    'python-console': 'text.python.console',
    'python-traceback': 'text.python.traceback',
    'q#': 'source.qsharp',
    qml: 'source.qml',
    qmake: 'source.qmake',
    'qt-script': 'source.js',
    quake: 'source.quake',
    r: 'source.r',
    raml: 'source.yaml',
    rbs: 'source.rbs',
    rdoc: 'text.rdoc',
    realbasic: 'source.vbnet',
    rexx: 'source.rexx',
    rmarkdown: 'text.md',
    rpc: 'source.c',
    rpgle: 'source.rpgle',
    'rpm-spec': 'source.rpm-spec',
    runoff: 'text.runoff',
    racket: 'source.racket',
    ragel: 'none',
    raku: 'source.raku',
    rascal: 'source.rascal',
    'raw-token-data': 'none',
    rescript: 'source.rescript',
    'readline-config': 'source.inputrc',
    reason: 'source.reason',
    reasonligo: 'source.religo',
    rebol: 'source.rebol',
    'record-jar': 'source.record-jar',
    red: 'source.red',
    redcode: 'none',
    'redirect-rules': 'source.redirects',
    'regular-expression': 'source.regexp',
    "ren'py": 'source.renpy',
    renderscript: 'none',
    'rich-text-format': 'text.rtf',
    ring: 'source.ring',
    riot: 'text.html.riot',
    robotframework: 'text.robot',
    roff: 'text.roff',
    'roff-manpage': 'text.roff',
    rouge: 'source.clojure',
    'routeros-script': 'none',
    ruby: 'source.ruby',
    rust: 'source.rust',
    sas: 'source.sas',
    scss: 'source.css.scss',
    'selinux-policy': 'source.sepolicy',
    smt: 'source.smt',
    sparql: 'source.sparql',
    sqf: 'source.sqf',
    sql: 'source.sql',
    sqlpl: 'source.sql',
    'srecode-template': 'source.lisp',
    'ssh-config': 'source.ssh-config',
    star: 'source.star',
    stl: 'source.stl',
    ston: 'source.smalltalk',
    svg: 'text.xml.svg',
    swig: 'source.c++',
    sage: 'source.python',
    saltstack: 'source.yaml.salt',
    sass: 'source.sass',
    scala: 'source.scala',
    scaml: 'source.scaml',
    scenic: 'source.scenic',
    scheme: 'source.scheme',
    scilab: 'source.scilab',
    self: 'none',
    shaderlab: 'source.shaderlab',
    shell: 'source.shell',
    'shellcheck-config': 'source.shellcheckrc',
    shellsession: 'text.shell-session',
    shen: 'source.shen',
    sieve: 'source.sieve',
    'simple-file-verification': 'source.sfv',
    singularity: 'source.singularity',
    slash: 'text.html.slash',
    slice: 'source.slice',
    slim: 'text.slim',
    smpl: 'source.smpl',
    smali: 'source.smali',
    smalltalk: 'source.smalltalk',
    smarty: 'text.html.smarty',
    smithy: 'source.smithy',
    snakemake: 'source.python',
    solidity: 'source.solidity',
    soong: 'source.bp',
    sourcepawn: 'source.sourcepawn',
    'spline-font-database': 'text.sfd',
    squirrel: 'source.nut',
    stan: 'source.stan',
    'standard-ml': 'source.ml',
    starlark: 'source.python',
    stata: 'source.stata',
    stringtemplate: 'source.string-template',
    stylus: 'source.stylus',
    'subrip-text': 'text.srt',
    sugarss: 'source.css.postcss.sugarss',
    supercollider: 'source.supercollider',
    svelte: 'source.svelte',
    sway: 'source.sway',
    swift: 'source.swift',
    systemverilog: 'source.systemverilog',
    'ti-program': 'none',
    'tl-verilog': 'source.tlverilog',
    tla: 'source.tla',
    toml: 'source.toml',
    tsql: 'source.tsql',
    tsv: 'source.generic-db',
    tsx: 'source.tsx',
    txl: 'source.txl',
    talon: 'source.talon',
    tcl: 'source.tcl',
    tcsh: 'source.shell',
    tex: 'text.tex.latex',
    tea: 'source.tea',
    terra: 'source.terra',
    texinfo: 'text.texinfo',
    text: 'none',
    'textmate-properties': 'source.tm-properties',
    textile: 'none',
    thrift: 'source.thrift',
    turing: 'source.turing',
    turtle: 'source.turtle',
    twig: 'text.html.twig',
    'type-language': 'source.tl',
    typescript: 'source.ts',
    'unified-parallel-c': 'source.c',
    'unity3d-asset': 'source.yaml',
    'unix-assembly': 'source.x86',
    uno: 'source.cs',
    unrealscript: 'source.java',
    urweb: 'source.ur',
    v: 'source.v',
    vba: 'source.vba',
    vbscript: 'source.vbnet',
    vcl: 'source.varnish.vcl',
    vhdl: 'source.vhdl',
    vala: 'source.vala',
    'valve-data-format': 'source.keyvalues',
    'velocity-template-language': 'source.velocity',
    verilog: 'source.verilog',
    'vim-help-file': 'text.vim-help',
    'vim-script': 'source.viml',
    'vim-snippet': 'source.vim-snippet',
    'visual-basic-.net': 'source.vbnet',
    'visual-basic-6.0': 'source.vbnet',
    volt: 'source.d',
    vue: 'text.html.vue',
    vyper: 'source.vyper',
    wdl: 'source.wdl',
    wgsl: 'source.wgsl',
    'wavefront-material': 'source.wavefront.mtl',
    'wavefront-object': 'source.wavefront.obj',
    'web-ontology-language': 'text.xml',
    webassembly: 'source.webassembly',
    'webassembly-interface-type': 'source.wit',
    webidl: 'source.webidl',
    webvtt: 'text.vtt',
    'wget-config': 'source.wgetrc',
    whiley: 'source.whiley',
    wikitext: 'text.html.mediawiki',
    'win32-message-file': 'source.win32-messages',
    'windows-registry-entries': 'source.reg',
    'witcher-script': 'source.witcherscript',
    wollok: 'source.wollok',
    'world-of-warcraft-addon-data': 'source.toc',
    wren: 'source.wren',
    'x-bitmap': 'source.c',
    'x-font-directory-index': 'source.fontdir',
    'x-pixmap': 'source.c',
    x10: 'source.x10',
    xc: 'source.xc',
    xcompose: 'config.xcompose',
    xml: 'text.xml',
    'xml-property-list': 'text.xml.plist',
    xpages: 'text.xml',
    xproc: 'text.xml',
    xquery: 'source.xq',
    xs: 'source.c',
    xslt: 'text.xml.xsl',
    xojo: 'source.xojo',
    xonsh: 'source.python',
    xtend: 'source.xtend',
    yaml: 'source.yaml',
    yang: 'source.yang',
    yara: 'source.yara',
    yasnippet: 'source.yasnippet',
    yacc: 'source.yacc',
    yul: 'source.yul',
    zap: 'source.zap',
    zil: 'source.zil',
    zeek: 'source.zeek',
    zenscript: 'source.zenscript',
    zephir: 'source.php.zephir',
    zig: 'source.zig',
    zimpl: 'none',
    'curl-config': 'source.curlrc',
    desktop: 'source.desktop',
    dircolors: 'source.dircolors',
    ec: 'source.c.ec',
    edn: 'source.clojure',
    fish: 'source.fish',
    hoon: 'source.hoon',
    jq: 'source.jq',
    kvlang: 'source.python.kivy',
    'mirc-script': 'source.msl',
    mcfunction: 'source.mcfunction',
    mupad: 'source.mupad',
    nanorc: 'source.nanorc',
    nesc: 'source.nesc',
    ooc: 'source.ooc',
    q: 'source.q',
    restructuredtext: 'text.restructuredtext',
    'robots.txt': 'text.robots-txt',
    sed: 'source.sed',
    wisp: 'source.clojure',
    xbase: 'source.harbour',
} as const;

const highlightJsLanguages = [
    '1c',
    'abnf',
    'accesslog',
    'actionscript',
    'ada',
    'angelscript',
    'apache',
    'applescript',
    'arcade',
    'arduino',
    'armasm',
    'xml',
    'asciidoc',
    'aspectj',
    'autohotkey',
    'autoit',
    'avrasm',
    'awk',
    'axapta',
    'bash',
    'basic',
    'bnf',
    'brainfuck',
    'c',
    'cal',
    'capnproto',
    'ceylon',
    'clean',
    'clojure',
    'clojure-repl',
    'cmake',
    'coffeescript',
    'coq',
    'cos',
    'cpp',
    'crmsh',
    'crystal',
    'csharp',
    'csp',
    'css',
    'd',
    'markdown',
    'dart',
    'delphi',
    'diff',
    'django',
    'dns',
    'dockerfile',
    'dos',
    'dsconfig',
    'dts',
    'dust',
    'ebnf',
    'elixir',
    'elm',
    'ruby',
    'erb',
    'erlang-repl',
    'erlang',
    'excel',
    'fix',
    'flix',
    'fortran',
    'fsharp',
    'gams',
    'gauss',
    'gcode',
    'gherkin',
    'glsl',
    'gml',
    'go',
    'golo',
    'gradle',
    'graphql',
    'groovy',
    'haml',
    'handlebars',
    'haskell',
    'haxe',
    'hsp',
    'http',
    'hy',
    'inform7',
    'ini',
    'irpf90',
    'isbl',
    'java',
    'javascript',
    'jboss-cli',
    'json',
    'julia',
    'julia-repl',
    'kotlin',
    'lasso',
    'latex',
    'ldif',
    'leaf',
    'less',
    'lisp',
    'livecodeserver',
    'livescript',
    'llvm',
    'lsl',
    'lua',
    'makefile',
    'mathematica',
    'matlab',
    'maxima',
    'mel',
    'mercury',
    'mipsasm',
    'mizar',
    'perl',
    'mojolicious',
    'monkey',
    'moonscript',
    'n1ql',
    'nestedtext',
    'nginx',
    'nim',
    'nix',
    'node-repl',
    'nsis',
    'objectivec',
    'ocaml',
    'openscad',
    'oxygene',
    'parser3',
    'pf',
    'pgsql',
    'php',
    'php-template',
    'plaintext',
    'pony',
    'powershell',
    'processing',
    'profile',
    'prolog',
    'properties',
    'protobuf',
    'puppet',
    'purebasic',
    'python',
    'python-repl',
    'q',
    'qml',
    'r',
    'reasonml',
    'rib',
    'roboconf',
    'routeros',
    'rsl',
    'ruleslanguage',
    'rust',
    'sas',
    'scala',
    'scheme',
    'scilab',
    'scss',
    'shell',
    'smali',
    'smalltalk',
    'sml',
    'sqf',
    'sql',
    'stan',
    'stata',
    'step21',
    'stylus',
    'subunit',
    'swift',
    'taggerscript',
    'yaml',
    'tap',
    'tcl',
    'thrift',
    'tp',
    'twig',
    'typescript',
    'vala',
    'vbnet',
    'vbscript',
    'vbscript-html',
    'verilog',
    'vhdl',
    'vim',
    'wasm',
    'wren',
    'x86asm',
    'xl',
    'xquery',
    'zephir',
] as const;
