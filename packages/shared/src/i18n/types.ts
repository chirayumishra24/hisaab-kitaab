export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;

/** All dot-separated leaf keys of a nested dictionary, e.g. "money.toReceive". */
export type LeafKeys<T> = T extends string
  ? never
  : { [K in keyof T & string]: T[K] extends string ? K : Join<K, LeafKeys<T[K]>> }[keyof T & string];
