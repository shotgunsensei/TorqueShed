declare module "pg" {
  export interface QueryResult<T = any> {
    rows: T[];
    rowCount: number | null;
  }

  export interface PoolClient {
    query<T = any>(text: string, values?: unknown[]): Promise<QueryResult<T>>;
    release(): void;
  }

  export interface PoolConfig {
    connectionString?: string;
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
  }

  export class Pool {
    constructor(config?: PoolConfig);
    query<T = any>(text: string, values?: unknown[]): Promise<QueryResult<T>>;
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
  }

  const pg: {
    Pool: typeof Pool;
  };

  export default pg;
}
