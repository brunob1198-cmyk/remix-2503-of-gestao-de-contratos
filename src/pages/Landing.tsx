import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import "./landing.css";

/**
 * Landing page publica (rota "/").
 * Markup e tokens visuais isolados sob o escopo `.lp` para nao vazar no app autenticado.
 */
export default function Landing() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [evolucao, setEvolucao] = useState(0);
  const [barWidth, setBarWidth] = useState("0%");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = rootRef.current;
    if (!root) return;

    const targets = Array.from(root.querySelectorAll<HTMLElement>(".reveal:not(.is-visible)"));
    let observer: IntersectionObserver | undefined;

    if (reduce || !("IntersectionObserver" in window)) {
      targets.forEach((t) => t.classList.add("is-visible"));
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              observer?.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
      );
      targets.forEach((t) => observer?.observe(t));
    }

    return () => observer?.disconnect();
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setBarWidth("100%");
      setEvolucao(114);
      return;
    }

    const timer = window.setTimeout(() => setBarWidth("100%"), 260);
    let frame = 0;
    let start: number | null = null;
    const target = 114;

    const step = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min(1, (ts - start) / 900);
      const eased = 1 - Math.pow(1 - p, 3);
      setEvolucao(Math.round(target * eased));
      if (p < 1) frame = requestAnimationFrame(step);
    };
    const startTimer = window.setTimeout(() => {
      frame = requestAnimationFrame(step);
    }, 260);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(startTimer);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="lp" ref={rootRef}>
      <header className={cn("nav", scrolled && "is-scrolled", menuOpen && "is-open")}>
        <div className="wrap nav-row">
          <a href="#top" className="nav-brand">
            <img src="/papel-timbrado/logo-aivx.png" alt="AIVX" />
          </a>
          <nav className="nav-links">
            <a href="#produto">Produto</a>
            <a href="#modulos">Módulos</a>
            <a href="#sst">Segurança do Trabalho</a>
            <a href="#faq">Perguntas</a>
          </nav>
          <div className="nav-cta">
            <a className="btn btn-ghost" href="#faq">Ver módulos</a>
            <a className="btn btn-primary" href="mailto:aivx@aivxtech.com?subject=Quero%20conhecer%20o%20Gest%C3%A3o%20de%20Contratos%20Inteligente&body=Ol%C3%A1%2C%20equipe%20AIVX.%0D%0A%0D%0AGostaria%20de%20conhecer%20o%20sistema%20de%20gest%C3%A3o%20de%20contratos%2C%20obras%20e%20seguran%C3%A7a%20do%20trabalho.%0D%0A%0D%0AEmpresa%3A%20%0D%0AN%C2%BA%20de%20contratos%2Fobras%20ativos%3A%20%0D%0A">Falar com um especialista</a>
          </div>
          <button type="button" className="nav-toggle" aria-label="Abrir menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
        </div>
        <div className="wrap mobile-panel" onClick={() => setMenuOpen(false)}>
          <a href="#produto">Produto</a>
          <a href="#modulos">Módulos</a>
          <a href="#sst">Segurança do Trabalho</a>
          <a href="#faq">Perguntas</a>
          <a href="mailto:aivx@aivxtech.com">Falar com um especialista</a>
        </div>
      </header>

      <main id="top">

      <section className="hero">
        <div className="wrap hero-grid">
          <div className="reveal is-visible">
            <span className="eyebrow">FL.01 — GESTÃO DE CONTRATOS INTELIGENTE</span>
            <h1>Toda obra tem uma<br />versão dos fatos.<br /><em>A sua fica registrada.</em></h1>
            <p className="hero-sub">Contratos, medições, RDO e segurança do trabalho num único sistema — com foto geolocalizada, saldo de contrato em tempo real e ASO, PGR e PCMSO com vencimento monitorado.</p>
            <div className="hero-cta">
              <a className="btn btn-primary" href="mailto:aivx@aivxtech.com?subject=Quero%20conhecer%20o%20Gest%C3%A3o%20de%20Contratos%20Inteligente&body=Ol%C3%A1%2C%20equipe%20AIVX.%0D%0A%0D%0AGostaria%20de%20conhecer%20o%20sistema%20de%20gest%C3%A3o%20de%20contratos%2C%20obras%20e%20seguran%C3%A7a%20do%20trabalho.%0D%0A%0D%0AEmpresa%3A%20%0D%0AN%C2%BA%20de%20contratos%2Fobras%20ativos%3A%20%0D%0A">Falar com um especialista</a>
              <a className="btn btn-ghost" href="#modulos">Ver os módulos ↓</a>
            </div>
            <div className="hero-meta">
              <span><span className="dot"></span>Web e Android</span>
              <span><span className="dot"></span>Diário de Campo offline</span>
              <span><span className="dot"></span>Compras com alçada de aprovação</span>
            </div>
          </div>

          <div className="reveal is-visible">
            <div className="panel">
              <div className="panel-bar">
                <span className="chip"></span><span className="chip"></span><span className="chip"></span>
                <span style={{marginLeft: "6px"}}>rdo — 0042.26 · rodovia exemplo</span>
              </div>
              <div className="panel-body">
                <div className="panel-title-row">
                  <h4>Quadro Geral do Contrato</h4>
                  <span>0042.26</span>
                </div>
                <div className="stat-row">
                  <div className="stat-card"><div className="num">R$ 640k</div><div className="lbl">Valor contrato</div></div>
                  <div className="stat-card"><div className="num">R$ 732k</div><div className="lbl">Executado</div></div>
                  <div className="stat-card danger"><div className="num">-R$ 92k</div><div className="lbl">Saldo contrato</div></div>
                </div>
                <div>
                  <div style={{display: "flex", justifyContent: "space-between", fontSize: "11.5px", color: "var(--ink-faint)", fontFamily: "var(--font-mono)"}}>
                    <span>EVOLUÇÃO</span><span>{evolucao}%</span>
                  </div>
                  <div className="bar-track"><div className="bar-fill" style={{ width: barWidth }} /></div>
                </div>
                <div style={{display: "flex", flexDirection: "column", gap: "8px"}}>
                  <div className="list-row">
                    <div className="l-left">
                      <div className="geo-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0116 0z"/><circle cx="12" cy="10" r="3"/></svg></div>
                      <div><strong>RDO · KM 118 — Praça de Pedágio</strong><small>12 fotos geolocalizadas · hoje 14:32</small></div>
                    </div>
                    <span className="pill pill-safe">enviado</span>
                  </div>
                  <div className="list-row">
                    <div className="l-left">
                      <div className="geo-icon" style={{background: "var(--warn-tint)", color: "var(--warn)"}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 7v6l4 2"/></svg></div>
                      <div><strong>ASO — Encarregado de campo</strong><small>vence em 4 dias</small></div>
                    </div>
                    <span className="pill pill-warn">revisar</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      <section className="sector-strip">
        <div className="wrap sector-row">
          <span className="lead">FEITO PARA QUEM OPERA EM CAMPO</span>
          <div className="sector-tags">
            <span>Concessionárias de rodovias</span>
            <span>Telecom & ITS</span>
            <span>Energia</span>
            <span>Operação & manutenção</span>
            <span>Construção e engenharia</span>
          </div>
        </div>
      </section>


      <section className="section-pad" id="produto">
        <div className="wrap">
          <div className="head-block reveal">
            <span className="eyebrow">FL.02 — O PROBLEMA DE SEMPRE</span>
            <h2>RDO no papel, medição na planilha, ASO vencido sem ninguém saber.</h2>
            <p>O trabalho em campo já é difícil o bastante sem que a burocracia de contrato e a documentação de segurança dependam de planilha solta, WhatsApp e memória de quem estava lá.</p>
          </div>
          <div className="pain-grid reveal">
            <div className="pain-card">
              <span className="tag">SEM PROVA</span>
              <h3>Foto sem prova</h3>
              <p>Foto solta no WhatsApp não diz onde nem quando foi tirada. Na hora da medição, o fiscal glosa o que não reconhece como sendo daquela frente de serviço.</p>
            </div>
            <div className="pain-card">
              <span className="tag">SEM VISIBILIDADE</span>
              <h3>Saldo que estoura em silêncio</h3>
              <p>A planilha de contrato desatualiza sozinha. A produção passa do valor contratado e ninguém percebe até fechar o mês.</p>
            </div>
            <div className="pain-card">
              <span className="tag">SEM ALERTA</span>
              <h3>SST correndo atrás</h3>
              <p>PGR, PCMSO e ASO vencem sem aviso — e a autuação costuma chegar antes do lembrete.</p>
            </div>
            <div className="pain-card">
              <span className="tag">SEM SINAL</span>
              <h3>Campo sem 4G</h3>
              <p>A frente de serviço sem internet não pode esperar o carro voltar à base para registrar o dia.</p>
            </div>
          </div>
        </div>
      </section>


      <section className="section-pad rule" id="modulos" style={{background: "var(--bg-alt)"}}>
        <div className="wrap">
          <div className="head-block reveal">
            <span className="eyebrow">FL.03 — A PLATAFORMA</span>
            <h2>Duas frentes, um único sistema.</h2>
            <p>Contrato e obra de um lado. Saúde e segurança do trabalho do outro. Os dois puxando dos mesmos projetos, sites e colaboradores.</p>
          </div>

          <div className="pillar-grid reveal">
            <div className="pillar i-contracts">
              <div className="pillar-head">
                <h3>Contratos & Obra</h3>
                <div className="pillar-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg></div>
              </div>
              <p className="lede">Do cadastro do contrato ao faturamento — com o saldo sempre à vista.</p>
              <ul>
                <li><svg className="chk" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="20 6 9 17 4 12"/></svg>Contratos, projetos, sites e LPU (Lista de Preços Unitários)</li>
                <li><svg className="chk" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="20 6 9 17 4 12"/></svg>Lançamento e acompanhamento de medições</li>
                <li><svg className="chk" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="20 6 9 17 4 12"/></svg>RDO e Diário de Obra, com foto geolocalizada</li>
                <li><svg className="chk" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="20 6 9 17 4 12"/></svg>Faturamento e saldo de contrato em tempo real</li>
                <li><svg className="chk" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="20 6 9 17 4 12"/></svg>Planejamento de cronograma e alocação de recursos</li>
                <li><svg className="chk" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="20 6 9 17 4 12"/></svg>Supply Chain: requisição, cotação, fornecedores e pedido</li>
              </ul>
            </div>

            <div className="pillar i-sst" id="sst">
              <div className="pillar-head">
                <h3>Segurança do Trabalho</h3>
                <div className="pillar-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
              </div>
              <p className="lede">SGSST PRO: a documentação que a NR pede, por colaborador.</p>
              <ul>
                <li><svg className="chk" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="20 6 9 17 4 12"/></svg>PGR, PCMSO e ASO — riscos e saúde ocupacional</li>
                <li><svg className="chk" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="20 6 9 17 4 12"/></svg>APR, PT e EPI — permissão de trabalho e equipamentos</li>
                <li><svg className="chk" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="20 6 9 17 4 12"/></svg>Treinamentos, CAT, incidentes e não conformidades</li>
              </ul>
            </div>
          </div>

          <div className="mini-grid reveal">
            <div className="mini-card">
              <h4>Planejamento & Recursos</h4>
              <p>Cronograma da obra e alocação de equipe e equipamentos por contrato, cruzados com o que foi lançado em campo.</p>
            </div>
            <div className="mini-card">
              <h4>Supply Chain</h4>
              <p>Requisição, cotação, fornecedores e pedido de compra, com alçada de aprovação por faixa de valor e tipo.</p>
            </div>
            <div className="mini-card">
              <h4>Checklists</h4>
              <p>Modelos configuráveis pela sua equipe, início por leitura de QR Code e histórico completo de execuções.</p>
            </div>
            <div className="mini-card">
              <h4>Documentos</h4>
              <p>Repositório por contrato e por obra, com verificação de autenticidade de documentos assinados.</p>
            </div>
            <div className="mini-card">
              <h4>Gestão e Controle</h4>
              <p>Múltiplas empresas na mesma conta, perfis de acesso, log de auditoria e API para integrações.</p>
            </div>
          </div>
        </div>
      </section>


      <section className="section-pad">
        <div className="wrap">
          <div className="head-block reveal">
            <span className="eyebrow">FL.04 — COMO FUNCIONA</span>
            <h2>Do cadastro ao dashboard, em quatro passos.</h2>
          </div>
          <div className="steps reveal">
            <div className="step">
              <span className="idx">01</span>
              <h4>Cadastra o contrato</h4>
              <p>Projeto, cliente, sites e LPU — o escopo de preço é lançado uma vez e vale para toda a obra.</p>
            </div>
            <div className="step">
              <span className="idx">02</span>
              <h4>Campo lança o dia</h4>
              <p>RDO ou Diário de Campo, com foto, geolocalização e horário — mesmo sem sinal.</p>
            </div>
            <div className="step">
              <span className="idx">03</span>
              <h4>Sistema consolida</h4>
              <p>Produção, saldo de contrato e evolução aparecem no dashboard em tempo real.</p>
            </div>
            <div className="step">
              <span className="idx">04</span>
              <h4>SST não passa batido</h4>
              <p>Prazos de ASO, PGR e PCMSO monitorados, com checklist e EPI por colaborador.</p>
            </div>
          </div>
        </div>
      </section>


      <section className="section-pad">
        <div className="wrap offline-grid">
          <div className="reveal">
            <span className="eyebrow">FL.05 — CAMPO</span>
            <h2 style={{fontSize: "clamp(28px,3.2vw,38px)", marginTop: "14px", lineHeight: "1.1"}}>Funciona onde<br />o sinal não chega.</h2>
            <p style={{marginTop: "18px", color: "var(--ink-muted)", fontSize: "16px", maxWidth: "48ch", lineHeight: "1.65"}}>
              Aplicativo Android nativo. O Diário de Campo enfileira fotos e formulários no aparelho e sincroniza sozinho quando o sinal volta — a coordenada é lida no instante da foto, não no instante do envio, porque o trabalhador tira a foto no campo e manda horas depois, quilômetros adiante.
            </p>
            <div className="hero-cta" style={{marginTop: "26px"}}>
              <a className="btn btn-ghost" href="#faq">Como funciona offline ↓</a>
            </div>
          </div>
          <div className="reveal">
            <div className="offline-visual">
              <div className="sync-row"><span className="sync-dot on"></span>RDO — KM 118, foto 1/12<span className="time">enviado</span></div>
              <div className="sync-row"><span className="sync-dot on"></span>Diário de Campo — ocorrência<span className="time">enviado</span></div>
              <div className="sync-row"><span className="sync-dot pending"></span>Checklist — QR AA-104<span className="time">na fila · sem sinal</span></div>
              <div className="sync-row"><span className="sync-dot pending"></span>RDO — KM 118, foto 12/12<span className="time">na fila · sem sinal</span></div>
              <div className="sync-row"><span className="sync-dot on"></span>Efetivo do dia — 14 colaboradores<span className="time">enviado</span></div>
            </div>
          </div>
        </div>
      </section>


      <div className="wrap"><div className="stat-strip reveal">
        <div className="cell"><div className="big">20+</div><div className="cap">Módulos operacionais, do contrato ao canteiro</div></div>
        <div className="cell"><div className="big">4</div><div className="cap">Etapas de compra: requisição, cotação, pedido e alçada</div></div>
        <div className="cell"><div className="big">2</div><div className="cap">Formas de acesso: navegador e app Android</div></div>
        <div className="cell"><div className="big">1</div><div className="cap">Lugar só, do cronograma ao faturamento</div></div>
      </div></div>


      <section className="section-pad" style={{background: "var(--bg-alt)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)"}}>
        <div className="wrap">
          <div className="head-block reveal">
            <span className="eyebrow">FL.06 — GESTÃO E CONTROLE</span>
            <h2>Uma conta. Várias empresas, se for o caso.</h2>
          </div>
          <div className="gov-grid reveal">
            <div className="gov-card">
              <span className="n">01</span>
              <h4>Multiempresa</h4>
              <p>Várias empresas na mesma conta, cada uma com seu próprio escopo de dados.</p>
            </div>
            <div className="gov-card">
              <span className="n">02</span>
              <h4>Perfis de acesso</h4>
              <p>O administrador aprova cada usuário e define o que ele pode ver e alterar.</p>
            </div>
            <div className="gov-card">
              <span className="n">03</span>
              <h4>Log de auditoria</h4>
              <p>Toda alteração relevante fica registrada — quem, quando e o quê.</p>
            </div>
            <div className="gov-card">
              <span className="n">04</span>
              <h4>API para integrações</h4>
              <p>Webhooks e API para conectar com Power BI, ERP e outros sistemas de gestão — e documentos assinados com verificação de autenticidade.</p>
            </div>
          </div>
        </div>
      </section>


      <section className="section-pad" id="faq">
        <div className="wrap">
          <div className="head-block reveal">
            <span className="eyebrow">FL.07 — PERGUNTAS FREQUENTES</span>
            <h2>O que quem vai decidir costuma perguntar.</h2>
          </div>
          <div className="faq-list reveal">
            <details className="faq-item" open>
              <summary className="faq-q"><h4>Precisa de internet o tempo todo?</h4><span className="plus"></span></summary>
              <div className="faq-a">Não. O Diário de Campo funciona offline: fotos e formulários ficam na fila do aparelho e sincronizam sozinhos quando o sinal volta. O restante do sistema — dashboard, medições, relatórios — precisa de conexão.</div>
            </details>
            <details className="faq-item">
              <summary className="faq-q"><h4>Tem aplicativo de celular?</h4><span className="plus"></span></summary>
              <div className="faq-a">Sim, um aplicativo Android nativo com os módulos de campo — RDO, Diário de Campo, checklists e câmera com geolocalização.</div>
            </details>
            <details className="faq-item">
              <summary className="faq-q"><h4>Para que tipo de empresa é o sistema?</h4><span className="plus"></span></summary>
              <div className="faq-a">Construtoras, empresas de engenharia e prestadoras de serviço para concessionárias de rodovia, telecom, energia e operação & manutenção — qualquer operação que lança RDO, mede contrato e responde por segurança do trabalho em campo.</div>
            </details>
            <details className="faq-item">
              <summary className="faq-q"><h4>Como a equipe recebe acesso?</h4><span className="plus"></span></summary>
              <div className="faq-a">O administrador da empresa aprova cada usuário e define o perfil de acesso — o que cada pessoa pode ver e alterar.</div>
            </details>
            <details className="faq-item">
              <summary className="faq-q"><h4>Quanto custa?</h4><span className="plus"></span></summary>
              <div className="faq-a">Depende do número de contratos, sites e usuários da sua operação. Fale com a gente e montamos uma proposta para o seu caso.</div>
            </details>
          </div>
        </div>
      </section>


      <section className="section-pad" style={{paddingTop: "0"}}>
        <div className="wrap">
          <div className="final-cta reveal">
            <h2>Pare de brigar com planilha e caderno de obra.</h2>
            <div className="side">
              <a className="btn btn-primary" href="mailto:aivx@aivxtech.com?subject=Quero%20conhecer%20o%20Gest%C3%A3o%20de%20Contratos%20Inteligente&body=Ol%C3%A1%2C%20equipe%20AIVX.%0D%0A%0D%0AGostaria%20de%20conhecer%20o%20sistema%20de%20gest%C3%A3o%20de%20contratos%2C%20obras%20e%20seguran%C3%A7a%20do%20trabalho.%0D%0A%0D%0AEmpresa%3A%20%0D%0AN%C2%BA%20de%20contratos%2Fobras%20ativos%3A%20%0D%0A">Falar com um especialista</a>
              <p>aivx@aivxtech.com · resposta em até 1 dia útil</p>
            </div>
          </div>
        </div>
      </section>
      </main>


      <footer>
        <div className="wrap">
          <div className="foot-grid">
            <div className="foot-brand">
              <img src="/papel-timbrado/logo-aivx.png" alt="AIVX" />
              <p>Gestão de Contratos Inteligente — contratos, obras e segurança do trabalho num único sistema, do escritório ao canteiro.</p>
            </div>
            <div className="foot-col">
              <h5>Produto</h5>
              <ul>
                <li><a href="#modulos">Contratos & Obra</a></li>
                <li><a href="#sst">Segurança do Trabalho</a></li>
                <li><a href="#faq">Perguntas frequentes</a></li>
              </ul>
            </div>
            <div className="foot-col">
              <h5>Setores</h5>
              <ul>
                <li><a href="#top">Concessionárias de rodovias</a></li>
                <li><a href="#top">Telecom & ITS</a></li>
                <li><a href="#top">Energia e O&M</a></li>
              </ul>
            </div>
            <div className="foot-col">
              <h5>AIVX Tecnologia</h5>
              <p>
                CNPJ 58.106.347/0001-01<br />
                Rua C-152, nº 478 — Jardim América<br />
                Goiânia — GO<br />
                <a href="mailto:aivx@aivxtech.com">aivx@aivxtech.com</a>
              </p>
            </div>
          </div>
          <div className="foot-bottom">
            <span>© <span>{new Date().getFullYear()}</span> AIVX Tecnologia. Todos os direitos reservados.</span>
            <span>INTELIGÊNCIA QUE MOVE</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
