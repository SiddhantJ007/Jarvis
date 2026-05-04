declare module "better-sqlite3" {
  interface RunResult {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  interface Statement<BindParameters = any> {
    run(...parameters: BindParameters[]): RunResult;
    all(...parameters: BindParameters[]): any[];
    get(...parameters: BindParameters[]): any;
  }

  interface PrepareOptions {
    safeIntegers?: boolean;
  }

  class Database {
    constructor(filename: string, options?: { readonly?: boolean; fileMustExist?: boolean });
    prepare<BindParameters = any>(source: string, options?: PrepareOptions): Statement<BindParameters>;
    exec(source: string): this;
    pragma(source: string): any;
    close(): void;
  }

  export = Database;
}
