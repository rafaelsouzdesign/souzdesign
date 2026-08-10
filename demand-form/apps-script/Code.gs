/**
 * Backend do formulário de demanda criativa.
 * Recebe o POST do formulário (JSON), grava linha(s) na planilha do mês
 * corrente, sobe os arquivos anexados para uma pasta no Drive, envia um
 * e-mail de confirmação com o protocolo e o resumo completo da solicitação
 * para o solicitante, e uma cópia completa para o time de design.
 *
 * Como instalar:
 * 1. Crie uma planilha no Google Sheets. Extensões > Apps Script.
 * 2. Cole este arquivo substituindo o Code.gs padrão.
 * 3. Ajuste CONFIG.DRIVE_FOLDER_ID abaixo.
 * 4. Implantar > Nova implantação > tipo "App da Web".
 *    - Executar como: Eu
 *    - Quem pode acessar: Qualquer pessoa
 * 5. Copie a URL do Web App gerada para demand-form/config.js (SCRIPT_URL).
 */

const CONFIG = {
  // ID da pasta do Google Drive onde os anexos serão salvos (crie uma pasta e pegue o ID pela URL).
  DRIVE_FOLDER_ID: "https://docs.google.com/spreadsheets/d/1wjqQbF6Y6ccCYjEEfzSXfSNvWN-5VqKXa87Uq9ntdKQ/edit?usp=sharing",
  PROTOCOL_PREFIX: "SC",
  // E-mail(s) que recebem uma cópia completa de toda demanda recebida (separados por vírgula).
  NOTIFY_TEAM_EMAILS: "rafael@souzdesign.com.br",
};

const HEADERS = [
  "Protocolo",
  "Item",
  "Data/Hora",
  "Nome",
  "Empresa",
  "E-mail",
  "Tipo de Demanda",
  "Prioridade",
  "Prazo Desejado",
  "Aprovador",
  "Status",
  "Detalhes do Item",
  "Links de Referência",
  "Arquivos (Drive)",
  "Observações",
];

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    validatePayload(payload);

    const sheet = getMonthlySheet();
    const protocolo = generateProtocol(sheet);
    const arquivosUrls = uploadFiles(payload.arquivos || [], protocolo);
    const itens = buildItens(payload);

    itens.forEach((item) => {
      sheet.appendRow([
        protocolo,
        item.itemLabel,
        new Date(),
        payload.nome || "",
        payload.empresa || "",
        payload.email || "",
        payload.tipoDemandaLabel || payload.tipoDemanda || "",
        payload.prioridade || "",
        payload.prazoDesejado || "",
        payload.aprovador || "",
        "Recebido",
        item.resumoText,
        (payload.links || []).join(", "),
        arquivosUrls.join(", "),
        payload.observacoes || "",
      ]);
    });

    const resumo = buildResumoCompleto(payload, itens, arquivosUrls, protocolo);

    if (payload.email) {
      sendConfirmationEmail(payload, protocolo, resumo);
    }
    sendTeamNotification(payload, protocolo, resumo);

    return jsonResponse({ ok: true, protocolo: protocolo });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function doGet() {
  return jsonResponse({ ok: true, message: "Endpoint ativo. Use POST para enviar uma demanda." });
}

function validatePayload(payload) {
  const required = ["nome", "empresa", "email", "tipoDemanda", "prazoDesejado", "prioridade"];
  for (const field of required) {
    if (!payload[field]) {
      throw new Error(`Campo obrigatório ausente: ${field}`);
    }
  }
}

// ---- Planilha mensal ------------------------------------------------------

function getMonthlySheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = Session.getScriptTimeZone() || "America/Sao_Paulo";
  const tabName = "Demandas " + Utilities.formatDate(new Date(), tz, "yyyy-MM");
  let sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function generateProtocol(sheet) {
  const tz = Session.getScriptTimeZone() || "America/Sao_Paulo";
  const ym = Utilities.formatDate(new Date(), tz, "yyyy-MM");
  const seq = Math.max(sheet.getLastRow(), 1); // linha 1 é o header
  const padded = String(seq).padStart(4, "0");
  return `${CONFIG.PROTOCOL_PREFIX}-${ym}-${padded}`;
}

// ---- Itens da solicitação (1 por criativo, ou geral + 1 por peça de campanha) --

function formatCampos(list) {
  if (!list || !list.length) return "";
  return list.map((item) => `${item.label}: ${item.value}`).join("\n");
}

function buildItens(payload) {
  if (payload.criativos && payload.criativos.length) {
    const total = payload.criativos.length;
    return payload.criativos.map((c, i) => ({
      itemLabel: total > 1 ? `Criativo ${i + 1} de ${total}` : "Criativo único",
      resumoText: formatCampos(c.camposEspecificos),
    }));
  }

  const itens = [
    {
      itemLabel: payload.pecas && payload.pecas.length ? "Campanha (dados gerais)" : "Único item",
      resumoText: formatCampos(payload.camposEspecificos),
    },
  ];
  if (payload.pecas && payload.pecas.length) {
    payload.pecas.forEach((p) => {
      itens.push({ itemLabel: `Peça — ${p.peca}`, resumoText: formatCampos(p.camposEspecificos) });
    });
  }
  return itens;
}

function buildResumoCompleto(payload, itens, arquivosUrls, protocolo) {
  const linhas = [];
  linhas.push(`Protocolo: ${protocolo}`);
  linhas.push(`Solicitante: ${payload.nome} <${payload.email}>`);
  linhas.push(`Empresa: ${payload.empresa}`);
  linhas.push(`Tipo de demanda: ${payload.tipoDemandaLabel || payload.tipoDemanda}`);
  linhas.push(`Prioridade: ${payload.prioridade}`);
  linhas.push(`Prazo desejado: ${payload.prazoDesejado}`);
  linhas.push(`Aprovador: ${payload.aprovador || "—"}`);
  linhas.push("");

  itens.forEach((item) => {
    linhas.push(`— ${item.itemLabel} —`);
    linhas.push(item.resumoText || "(sem detalhes)");
    linhas.push("");
  });

  if (payload.links && payload.links.length) {
    linhas.push("Links de referência:");
    payload.links.forEach((l) => linhas.push(`- ${l}`));
    linhas.push("");
  }
  if (arquivosUrls && arquivosUrls.length) {
    linhas.push("Arquivos anexados:");
    arquivosUrls.forEach((u) => linhas.push(`- ${u}`));
    linhas.push("");
  }
  if (payload.observacoes) {
    linhas.push(`Observações: ${payload.observacoes}`);
  }
  return linhas.join("\n");
}

// ---- Arquivos ---------------------------------------------------------

function uploadFiles(arquivos, protocolo) {
  if (!arquivos.length || CONFIG.DRIVE_FOLDER_ID === "COLE_AQUI_O_ID_DA_PASTA_DO_DRIVE") {
    return [];
  }
  const rootFolder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  const subFolder = rootFolder.createFolder(protocolo);
  return arquivos.map((arquivo) => {
    const bytes = Utilities.base64Decode(arquivo.base64);
    const blob = Utilities.newBlob(bytes, arquivo.mimeType, arquivo.filename);
    const file = subFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  });
}

// ---- E-mails ------------------------------------------------------------

function sendConfirmationEmail(payload, protocolo, resumo) {
  const subject = `Demanda recebida — protocolo ${protocolo}`;
  const body = [
    `Olá, ${payload.nome}!`,
    "",
    "Sua solicitação foi recebida com sucesso. Guarde o protocolo abaixo para acompanhar o andamento.",
    "",
    resumo,
  ].join("\n");
  MailApp.sendEmail(payload.email, subject, body);
}

function sendTeamNotification(payload, protocolo, resumo) {
  if (!CONFIG.NOTIFY_TEAM_EMAILS) return;
  const subject = `Nova demanda: ${protocolo} — ${payload.tipoDemandaLabel || payload.tipoDemanda}`;
  MailApp.sendEmail(CONFIG.NOTIFY_TEAM_EMAILS, subject, resumo);
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
