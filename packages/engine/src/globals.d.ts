// structuredClone có sẵn ở Node 17+ và mọi trình duyệt hiện đại; engine không phụ thuộc @types/node.
declare function structuredClone<T>(value: T): T;
