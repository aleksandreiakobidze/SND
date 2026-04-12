import { sqlIdent } from "@/lib/online-columns";

/**
 * Default column names for `RealViewAgent` (and same-shape reporting SQL).
 * Override any with env: MSSQL_RVA_COL_<KEY> (e.g. MSSQL_RVA_COL_IDREAL1=Id_Real1).
 */
export const RVA_DEFAULTS = {
  IDREAL1: "IdReal1",
  /** Line id (detail row) — unique per product line within a header */
  IDREAL2: "IdReal2",
  IDORG: "IdOrg",
  DATA: "Data",
  TANXA: "Tanxa",
  REG: "Reg",
  PRODS: "ProdS",
  REALT: "RealT",
  ORG: "Org",
  PROD: "Prod",
  /** Product line code (SKU / article id) — primary product key alongside Prod name */
  IDPROD: "IdProd",
  RAOD: "Raod",
  FASI: "Fasi",
  MANAG: "Manag",
  /** Supervisor name (IdSuper / Super in schema) */
  SUPER: "Super",
  CD: "CD",
  CITY: "City",
  GVARI: "Gvari",
  QSELI: "Qseli",
  ORGT: "OrgT",
  PRODT: "ProdT",
  PRODCODE: "ProdCode",
  LON: "Lon",
  LAT: "Lat",
  /** Total liters / volume on the line — use for "sales by liters", ლიტრები, მოცულობით */
  TEVADOBATOTAL: "TevadobaTotal",
  TEVADOBA: "Tevadoba",
  /** Line weight (gross total); sales map selection sums this as total weight */
  BRUTOTOTAL: "BrutoTotal",
  /** Driver (მძროლი) — smallint FK; aligns with SndApp_DriverTable.IdMdz */
  IDMDZ: "IdMdz",
  /** Driver name (nvarchar); filled from SndApp_DriverTable.Mdz on sales-map assign */
  MDZ: "Mdz",
  /**
   * Delivery / driver assignment flag: **0** = assigned, **1** = not assigned (unassigned).
   * Sales-map assign sets this to **0** together with IdMdz/Mdz.
   */
  MICODEBA: "Micodeba",
} as const;

export type RvaKey = keyof typeof RVA_DEFAULTS;

const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/** Physical column name for RealViewAgent (after env override). */
export function rvaCol(key: RvaKey): string {
  const envKey = `MSSQL_RVA_COL_${key}`;
  const raw = process.env[envKey]?.trim();
  if (raw && IDENT.test(raw)) return raw;
  return RVA_DEFAULTS[key];
}

/** Bracket-quoted identifier for SQL fragments. */
export function rvaSql(key: RvaKey): string {
  return sqlIdent(rvaCol(key));
}
