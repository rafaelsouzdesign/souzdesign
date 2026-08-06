/**
 * Backend do formulário de demanda criativa.
 * Recebe o POST do formulário (JSON), grava uma linha na planilha vinculada,
 * sobe os arquivos anexados para uma pasta no Drive e envia um e-mail de
 * confirmação com o número de protocolo.
 *
 * Como instalar:
 * 1. Crie uma planilha no Google Sheets. Extensões > Apps Script.
 * 2. Cole este arquivo substituindo o Code.gs padrão.
 * 3. Ajuste CONFIG.SHEET_NAME e CONFIG.DRIVE_FOLDER_ID abaixo.
 * 4. Implantar > Nova implantação > tipo "App da Web".
 *    - Executar como: Eu
 *    - Quem pode acessar: Qualquer pessoa
 * 5. Copie a URL do Web App gerada para demand-form/config.js (SCRIPT_URL).
 */

const CONFIG = {
  SHEET_NAME: "Demandas",
  // ID da pasta do Google Drive onde os anexos serão salvos (crie uma pasta e pegue o ID pela URL).
  DRIVE_FOLDER_ID: "COLE_AQUI_O_ID_DA_PASTA_DO_DRIVE",
  PROTOCOL_PREFIX: "SC",
  // E-mail(s) do time de design que devem ser avisados de novas demandas (separados por vírgula). Deixe vazio para não notificar.
  NOTIFY_TEAM_EMAILS: "",
};

const HEADERS = [
  "Protocolo",
  "Data/Hora",
  "Nome",
  "Empresa",
  "E-mail",
  "Tipo de Demanda",
  "Prioridade",
  "Prazo Desejado",
  "Aprovador",
  "Status",
  "Campos Específicos (JSON)",
  "Links de Referência",
  "Arquivos (Drive)",
  "Observações",
];

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    validatePayload(payload);

    const sheet = getSheet();
    const protocolo = generateProtocol(sheet);
    const arquivosUrls = uploadFiles(payload.arquivos || [], protocolo);

    sheet.appendRow([
      protocolo,
      new Date(),
      payload.nome || "",
      payload.empresa || "",
      payload.email || "",
      payload.tipoDemandaLabel || payload.tipoDemanda || "",
      payload.prioridade || "",
      payload.prazoDesejado || "",
      payload.aprovador || "",
      "Recebido",
      JSON.stringify(payload.camposEspecificos || {}, null, 0),
      (payload.links || []).join(", "),
      arquivosUrls.join(", "),
      payload.observacoes || "",
    ]);

    if (payload.email) {
      sendConfirmationEmail(payload, protocolo);
    }
    if (CONFIG.NOTIFY_TEAM_EMAILS) {
      notifyTeam(payload, protocolo);
    }

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

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function generateProtocol(sheet) {
  const year = new Date().getFullYear();
  const seq = Math.max(sheet.getLastRow(), 1); // linha 1 é o header
  const padded = String(seq).padStart(4, "0");
  return `${CONFIG.PROTOCOL_PREFIX}-${year}-${padded}`;
}

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

function sendConfirmationEmail(payload, protocolo) {
  const subject = `Demanda recebida — protocolo ${protocolo}`;
  const body = [
    `Olá, ${payload.nome}!`,
    "",
    `Sua solicitação foi recebida com sucesso. Protocolo: ${protocolo}`,
    `Tipo de demanda: ${payload.tipoDemandaLabel || payload.tipoDemanda}`,
    `Empresa: ${payload.empresa}`,
    `Prazo desejado: ${payload.prazoDesejado}`,
    `Prioridade: ${payload.prioridade}`,
    "",
    "Guarde este protocolo para acompanhar o andamento da sua demanda.",
  ].join("\n");
  MailApp.sendEmail(payload.email, subject, body);
}

function notifyTeam(payload, protocolo) {
  const recipients = CONFIG.NOTIFY_TEAM_EMAILS;
  const subject = `Nova demanda: ${protocolo} — ${payload.tipoDemandaLabel || payload.tipoDemanda}`;
  const body = [
    `Nova solicitação recebida.`,
    `Protocolo: ${protocolo}`,
    `Solicitante: ${payload.nome} (${payload.email})`,
    `Empresa: ${payload.empresa}`,
    `Tipo: ${payload.tipoDemandaLabel || payload.tipoDemanda}`,
    `Prioridade: ${payload.prioridade}`,
    `Prazo desejado: ${payload.prazoDesejado}`,
  ].join("\n");
  MailApp.sendEmail(recipients, subject, body);
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
