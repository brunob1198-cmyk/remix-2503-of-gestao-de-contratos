import React from "react";
import ForecastTab from "@/components/relatorios/ForecastTab";

const ForecastPublic = () => {
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-[1600px] mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Forecast de Projetos</h1>
          <p className="text-muted-foreground">Visão geral de acompanhamento e previsões financeiras.</p>
        </div>
        <ForecastTab />
      </div>
    </div>
  );
};

export default ForecastPublic;
