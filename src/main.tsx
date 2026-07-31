import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Elemento raiz da aplicação não encontrado.");
}

// Tradutores automáticos alteram nós de texto fora do controle do React e podem
// causar NotFoundError/removeChild durante refresh ou troca de telas. O sistema já
// é nativamente em português, portanto a árvore interativa não deve ser traduzida.
document.documentElement.setAttribute("translate", "no");
document.body.setAttribute("translate", "no");
document.body.classList.add("notranslate");
rootElement.setAttribute("translate", "no");
rootElement.classList.add("notranslate");

createRoot(rootElement).render(<App />);
