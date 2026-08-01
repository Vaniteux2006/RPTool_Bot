// RPTool/tools/utils/cache.ts
// ─── Caches genéricos ─────────────────────────────────────────────────────────
// ttlCache: cache assíncrono com expiração (padrão do censura/engine.ts).
// boundedMap/boundedSet: coleção com teto — evicta o mais antigo (padrão do webhook.ts).

export interface TtlCache<K, V> {
    /** Valor do cache, ou roda o loader (uma query por chave por janela de TTL). */
    get(key: K): Promise<V>;
    /** Descarta a entrada (chamar após mudar o dado na fonte). */
    invalidate(key: K): void;
    clear(): void;
}

export function ttlCache<K, V>(loader: (key: K) => Promise<V>, ttlMs: number): TtlCache<K, V> {
    const store = new Map<K, { value: V; expires: number }>();
    // Vôos em andamento — evita N loaders simultâneos para a mesma chave
    const inflight = new Map<K, Promise<V>>();

    return {
        async get(key: K): Promise<V> {
            const hit = store.get(key);
            if (hit && hit.expires > Date.now()) return hit.value;

            const flying = inflight.get(key);
            if (flying) return flying;

            const p = loader(key)
                .then(value => {
                    store.set(key, { value, expires: Date.now() + ttlMs });
                    return value;
                })
                .finally(() => inflight.delete(key));
            inflight.set(key, p);
            return p;
        },
        invalidate(key: K): void {
            store.delete(key);
        },
        clear(): void {
            store.clear();
        },
    };
}

/** Map com teto: ao inserir além de `cap`, remove a entrada mais antiga. */
export function boundedMap<K, V>(cap: number): Map<K, V> {
    const map = new Map<K, V>();
    const originalSet = map.set.bind(map);
    map.set = (key: K, value: V) => {
        originalSet(key, value);
        if (map.size > cap) map.delete(map.keys().next().value as K);
        return map;
    };
    return map;
}

/** Set com teto: ao inserir além de `cap`, remove a entrada mais antiga. */
export function boundedSet<T>(cap: number): Set<T> {
    const set = new Set<T>();
    const originalAdd = set.add.bind(set);
    set.add = (value: T) => {
        originalAdd(value);
        if (set.size > cap) set.delete(set.values().next().value as T);
        return set;
    };
    return set;
}
