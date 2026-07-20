import { ReportFilters } from "@/lib/product-health";
import { ExportJobStatus } from "../export-jobs";

export type ExportJob = {
  id          : number;
  status      : ExportJobStatus;
  filters     : ReportFilters;
  fileName    : string | null;
  rowCount    : number | null;
  errorMessage: string | null;
  createdAt   : string;
  updatedAt   : string;
  completedAt : string | null;
};