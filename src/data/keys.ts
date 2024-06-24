// File description:

export const sveltexHtmlAttributes: Record<string, string> = {
    // Verbatim Environment Options
    preamble: 'preamble',
    documentClass: 'documentClass',
    'documentClass.name': 'documentClass.name',
    'documentClass.options': 'documentClass.options',
    attributeForwardingAllowlist: 'attributeForwardingAllowlist',
    attributeForwardingBlocklist: 'attributeForwardingBlocklist',

    // CompilationOptions
    engine: 'overrides.compilation.engine',
    intermediateFiletype: 'overrides.compilation.intermediateFiletype',
    saferLua: 'overrides.compilation.saferLua',
    shellEscape: 'overrides.compilation.shellEscape',

    // OptimizationOptions
    currentColor: 'overrides.optimization.currentColor',

    // ConversionOptions
    converter: 'overrides.conversion.converter',

    'dvisvgm.bbox': 'overrides.conversion.dvisvgm.svg.bbox',
    'dvisvgm.bitmapFormat': 'overrides.conversion.dvisvgm.svg.bitmapFormat',
    'dvisvgm.cache': 'overrides.conversion.dvisvgm.processing.cache',
    'dvisvgm.clipJoin': 'overrides.conversion.dvisvgm.svg.clipJoin',
    'dvisvgm.color': 'overrides.conversion.dvisvgm.console.color',
    'dvisvgm.comments': 'overrides.conversion.dvisvgm.svg.comments',
    'dvisvgm.currentColor': 'overrides.conversion.dvisvgm.svg.currentColor',
    'dvisvgm.customArgs': 'overrides.conversion.dvisvgm.customArgs',
    'dvisvgm.exactBbox': 'overrides.conversion.dvisvgm.processing.exactBbox',
    'dvisvgm.fontFormat': 'overrides.conversion.dvisvgm.svg.fontFormat',
    'dvisvgm.gradOverlap': 'overrides.conversion.dvisvgm.svg.gradOverlap',
    'dvisvgm.gradSegments': 'overrides.conversion.dvisvgm.svg.gradSegments',
    'dvisvgm.gradSimplify': 'overrides.conversion.dvisvgm.svg.gradSimplify',
    'dvisvgm.keep': 'overrides.conversion.dvisvgm.processing.keep',
    'dvisvgm.linkmark': 'overrides.conversion.dvisvgm.svg.linkmark',
    'dvisvgm.mag': 'overrides.conversion.dvisvgm.processing.mag',
    'dvisvgm.message': 'overrides.conversion.dvisvgm.console.message',
    'dvisvgm.noMktexmf': 'overrides.conversion.dvisvgm.processing.noMktexmf',
    'dvisvgm.noSpecials': 'overrides.conversion.dvisvgm.processing.noSpecials',
    'dvisvgm.noStyles': 'overrides.conversion.dvisvgm.svg.noStyles',
    'dvisvgm.optimize': 'overrides.conversion.dvisvgm.svg.optimize',
    'dvisvgm.orientation': 'overrides.conversion.dvisvgm.svg.orientation',
    'dvisvgm.paperSize': 'overrides.conversion.dvisvgm.svg.paperSize',
    'dvisvgm.precision': 'overrides.conversion.dvisvgm.svg.precision',
    'dvisvgm.progress': 'overrides.conversion.dvisvgm.console.progress',
    'dvisvgm.relative': 'overrides.conversion.dvisvgm.svg.relative',
    'dvisvgm.rotate': 'overrides.conversion.dvisvgm.svgTransformations.rotate',
    'dvisvgm.scale': 'overrides.conversion.dvisvgm.svgTransformations.scale',
    'dvisvgm.traceAll': 'overrides.conversion.dvisvgm.processing.traceAll',
    'dvisvgm.transform':
        'overrides.conversion.dvisvgm.svgTransformations.transform',
    'dvisvgm.translate':
        'overrides.conversion.dvisvgm.svgTransformations.translate',
    'dvisvgm.verbosity': 'overrides.conversion.dvisvgm.console.verbosity',
    'dvisvgm.zip': 'overrides.conversion.dvisvgm.svg.zip',
    'dvisvgm.zoom': 'overrides.conversion.dvisvgm.svgTransformations.zoom',

    'poppler.antialias': 'overrides.conversion.poppler.antialias',
    'poppler.cropHeight': 'overrides.conversion.poppler.cropHeight',
    'poppler.cropSize': 'overrides.conversion.poppler.cropSize',
    'poppler.cropWidth': 'overrides.conversion.poppler.cropWidth',
    'poppler.cropXAxis': 'overrides.conversion.poppler.cropXAxis',
    'poppler.cropYAxis': 'overrides.conversion.poppler.cropYAxis',
    'poppler.fillPage': 'overrides.conversion.poppler.fillPage',
    'poppler.noCenter': 'overrides.conversion.poppler.noCenter',
    'poppler.noCrop': 'overrides.conversion.poppler.noCrop',
    'poppler.noShrink': 'overrides.conversion.poppler.noShrink',
    'poppler.originalPageSizes':
        'overrides.conversion.poppler.originalPageSizes',
    'poppler.paperHeight': 'overrides.conversion.poppler.paperHeight',
    'poppler.paperSize': 'overrides.conversion.poppler.paperSize',
    'poppler.paperWidth': 'overrides.conversion.poppler.paperWidth',
    'poppler.printVersionInfo': 'overrides.conversion.poppler.printVersionInfo',
    'poppler.quiet': 'overrides.conversion.poppler.quiet',
    'poppler.resolutionXAxis': 'overrides.conversion.poppler.resolutionXAxis',
    'poppler.resolutionXYAxis': 'overrides.conversion.poppler.resolutionXYAxis',
    'poppler.resolutionYAxis': 'overrides.conversion.poppler.resolutionYAxis',
} as const;
