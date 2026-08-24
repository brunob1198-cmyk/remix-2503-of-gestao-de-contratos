# Prompt para o Lovable — registrar as 16 migrations do SGSST

Cole o texto abaixo no chat do Lovable.

---

Aprovo a **Opção A**: registrar como aplicadas apenas as 16 versões do SGSST em
`supabase_migrations.schema_migrations`, com `INSERT ... ON CONFLICT DO NOTHING`,
sem executar nenhum DDL e sem `db push`.

Não faça a Opção B (baseline completo das 232). A deriva de timestamp que você
identificou é sistemática e continuaria acontecendo, então o baseline seria uma
trégua temporária — e ainda cobraria o risco de marcar como aplicada alguma
migration que nunca rodou, o que é silencioso e permanente.

Contexto: as 16 migrations já estão aplicadas no banco. Eu as rodei pelo SQL
Editor em 19/08/2026, e verifiquei o resultado: as 48 tabelas SGSST existem, as
funções `sgsst_dashboard_metrics` e `sgsst_dashboard_alertas` respondem, e a trava
de tenant delas recusa empresa de outro tenant com o erro 42501. Falta só o
registro no histórico.

As 16 versões:

```
20260813183000  20260813190000  20260813193000  20260813200000
20260813203000  20260813210000  20260813213000  20260813220000
20260813230000  20260813240000  20260814000000  20260814010000
20260814020000  20260814030000  20260814050000  20260819000000
```

**Não rode `supabase db push`.** Com 232 arquivos sem registro, um push tentaria
reexecutar quase todo o histórico, incluindo migrations que apagam dados de
produção:

- `20260428202831` — `DELETE FROM flash_normalizacao` e `DELETE FROM flash_transactions_raw`
- `20260512203334` — `ALTER TABLE projeto_impostos DROP COLUMN perc_total_impostos`
- `20260512013947` — `DROP TABLE IF EXISTS mkp_parametros CASCADE`
- `20260514134015` — `DROP TABLE IF EXISTS timeline_eventos`

**Escopo desta tarefa:** apenas o `INSERT` no schema de controle. Faça `git pull`
da `main` antes de começar — ela avançou e agora contém as correções do SGSST.
Não altere código em `src/**` nem nenhum arquivo existente em
`supabase/migrations/**`. Em particular, `20260818195027` recebeu `IF NOT EXISTS`
nos quatro `CREATE TABLE` de propósito: as mesmas tabelas são criadas por
`20260814010000`, de timestamp anterior, e sem isso um replay do histórico a
partir do zero falharia ali.

Se durante a execução aparecer qualquer coisa fora desse escopo, me reporte em vez
de corrigir por conta própria.
