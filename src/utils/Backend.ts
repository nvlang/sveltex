export class Handler<
    PossibleBackend extends string,
    ActualBackend extends PossibleBackend,
> {
    readonly backend: ActualBackend;

    backendIs<Q extends PossibleBackend | ActualBackend>(
        backend: Q,
    ): this is Handler<PossibleBackend, Q> {
        return this.backend === backend;
    }

    backendIsNot<Q extends PossibleBackend | ActualBackend>(
        backend: Q,
    ): this is Handler<PossibleBackend, Exclude<PossibleBackend, Q>> {
        return this.backend !== backend;
    }

    constructor(backend: ActualBackend) {
        this.backend = backend;
    }
}
