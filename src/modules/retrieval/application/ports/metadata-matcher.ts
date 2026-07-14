import { MetadataMatch, QueryAst } from "../types.js";

export interface MetadataMatcher {
  match(query: QueryAst): Promise<MetadataMatch[]>;
}
