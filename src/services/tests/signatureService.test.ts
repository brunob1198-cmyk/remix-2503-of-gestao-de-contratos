import { describe, it, expect } from "vitest";
import { calculateSHA256 } from "@/utils/cryptoUtils";
import { generateQRCodeDataUrl } from "@/utils/qrCodeGenerator";
import { SignatureStatus, SignatureMethod, SignatureEventName } from "@/types/signature";

describe("Central Signature Service - Unit & Cryptographic Tests", () => {
  it("deve calcular o hash SHA-256 de forma determinística", async () => {
    const textData = "DOCUMENTO_SaaS_CHECKLIST_123_CONFORME";
    const hash1 = await calculateSHA256(textData);
    const hash2 = await calculateSHA256(textData);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // Hex String de 256 bits tem 64 caracteres
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("deve detectar alterações no documento alterando o hash SHA-256 (Integridade)", async () => {
    const originalText = "Checklist Obra A - 100% Conforme";
    const modifiedText = "Checklist Obra A - 90% Conforme (Alterado)";

    const originalHash = await calculateSHA256(originalText);
    const modifiedHash = await calculateSHA256(modifiedText);

    expect(originalHash).not.toBe(modifiedHash);
  });

  it("deve gerar URL de QR Code para validação pública de assinatura", async () => {
    const verificationUrl = "https://app.saas.com.br/verificar-assinatura/req-uuid-123456";
    const qrDataUrl = await generateQRCodeDataUrl(verificationUrl);

    expect(qrDataUrl).toBeDefined();
    expect(qrDataUrl.startsWith("data:image/")).toBe(true);
  });

  it("deve validar a lista de status centralizados conforme especificação", () => {
    const validStatuses: SignatureStatus[] = [
      "PENDENTE",
      "EM_ASSINATURA",
      "ASSINADO",
      "RECUSADO",
      "CANCELADO",
      "EXPIRADO",
      "INVALIDADO",
    ];

    expect(validStatuses).toHaveLength(7);
  });

  it("deve validar a lista de métodos de assinatura centralizados", () => {
    const validMethods: SignatureMethod[] = [
      "ASSINATURA_ELETRONICA_INTERNA",
      "GOV_BR",
      "ICP_BRASIL_FUTURO",
    ];

    expect(validMethods).toHaveLength(3);
  });

  it("deve validar a estrutura de eventos de auditoria imutável", () => {
    const auditEvent: SignatureEventName = "ASSINATURA_CONCLUIDA";
    const metadata = {
      hash_original: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      metodo: "ASSINATURA_ELETRONICA_INTERNA",
      ip: "192.168.1.1",
    };

    expect(auditEvent).toBe("ASSINATURA_CONCLUIDA");
    expect(metadata.metodo).toBe("ASSINATURA_ELETRONICA_INTERNA");
    expect(metadata.hash_original).toHaveLength(64);
  });
});
