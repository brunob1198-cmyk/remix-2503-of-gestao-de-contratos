import { Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface SgsstBreadcrumbProps {
  moduloLabel: string;
  moduloPath: string;
  itemTitle?: string | null;
}

export function SgsstBreadcrumb({ moduloLabel, moduloPath, itemTitle }: SgsstBreadcrumbProps) {
  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList className="text-xs">
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/medicoes/sgsst/dashboard">SGSST PRO</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        <BreadcrumbSeparator />

        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/medicoes/sgsst/pgr">Segurança</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        <BreadcrumbSeparator />

        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to={moduloPath}>{moduloLabel}</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {itemTitle && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="font-semibold text-slate-800 dark:text-slate-200 max-w-[300px] sm:max-w-[450px] truncate">
                {itemTitle}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
