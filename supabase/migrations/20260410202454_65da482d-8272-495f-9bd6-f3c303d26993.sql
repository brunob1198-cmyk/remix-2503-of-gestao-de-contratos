UPDATE lancamentos_medicao 
SET quantidade_aprovada = quantidade 
WHERE status IN ('aprovado', 'finalizado') 
  AND quantidade_aprovada IS NOT NULL 
  AND quantidade_aprovada != quantidade 
  AND quantidade_aprovada > 0;