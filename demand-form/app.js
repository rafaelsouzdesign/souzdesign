/* Formulário de demanda criativa — lógica de etapas, campos dinâmicos por tipo
   de demanda e envio para o Google Apps Script (que grava numa planilha do
   Google Sheets). Vanilla JS, sem dependências, pensado para ser embutido em
   qualquer página. */

(function () {
  "use strict";

  function campaignSchema() {
    return {
      title: "Detalhes da campanha",
      fields: [
        { id: "nomeCampanha", label: "Nome da campanha", type: "text", required: true },
        { id: "pecasEnvolvidas", label: "Peças envolvidas", type: "checkbox", required: true,
          options: ["Post redes sociais", "Impresso", "Material para site", "Wallpaper", "E-mail marketing", "Outro"] },
        { id: "canais", label: "Canais de veiculação", type: "checkbox", required: true,
          options: ["Instagram", "LinkedIn", "TikTok", "WhatsApp", "E-mail", "Site", "Impresso"] },
        { id: "dataInicio", label: "Data de início da veiculação", type: "date", required: true },
        { id: "dataFim", label: "Data de fim da veiculação", type: "date", required: false },
        { id: "orcamentoMidia", label: "Orçamento de mídia (se houver)", type: "text", required: false },
        { id: "briefingGeral", label: "Briefing geral da campanha", type: "textarea", required: true },
      ],
    };
  }

  const SCHEMAS = {
    redes_sociais: {
      title: "Detalhes do post para redes sociais",
      fields: [
        { id: "redeSocial", label: "Qual(is) rede(s) social(is)?", type: "checkbox", required: true,
          options: ["Instagram", "LinkedIn", "TikTok", "WhatsApp"] },
        { id: "formato", label: "Qual(is) formato(s)?", type: "checkbox", required: true,
          options: ["Feed (1350x1080p)", "Story (1920x1080p)", "Carrossel", "Reels/Vídeo"] },
        { id: "objetivo", label: "Qual o objetivo do post?", type: "radio", required: true,
          options: ["Informar", "Vender", "Promover", "Engajar", "Comemorar", "Parabenizar", "Outro"] },
        { id: "tituloPrincipal", label: "Título principal", type: "text", required: true },
        { id: "copy", label: "Qual o texto (copy) definido?", type: "textarea", required: true },
      ],
    },
    impresso: {
      title: "Detalhes do material impresso",
      fields: [
        { id: "pecaImpressa", label: "Qual peça?", type: "select", required: true,
          options: ["Cartão de visita", "Banner", "Flyer/Panfleto", "Adesivo", "Folder", "Outro"] },
        { id: "tamanhoFinal", label: "Tamanho final (ex: 10x15cm)", type: "text", required: true },
        { id: "quantidade", label: "Quantidade", type: "number", required: true },
        { id: "acabamento", label: "Acabamento (laminação, verniz etc.)", type: "text", required: false },
        { id: "localImpressao", label: "Local de impressão", type: "select", required: false,
          options: ["Gráfica interna", "Gráfica terceirizada", "Não sei"] },
        { id: "textoConteudo", label: "Texto/conteúdo da peça", type: "textarea", required: true },
      ],
    },
    site: {
      title: "Detalhes do material para site",
      fields: [
        { id: "paginaSecao", label: "Página/seção do site", type: "text", required: true },
        { id: "dispositivo", label: "Dispositivo(s) alvo", type: "checkbox", required: true,
          options: ["Desktop", "Mobile"] },
        { id: "temDev", label: "Já existe um desenvolvedor envolvido nessa demanda?", type: "radio", required: true,
          options: ["Sim", "Não"] },
        { id: "descricaoMaterial", label: "Descreva o material necessário", type: "textarea", required: true },
      ],
    },
    wallpaper: {
      title: "Detalhes do wallpaper",
      fields: [
        { id: "dispositivoAlvo", label: "Dispositivo(s) alvo", type: "checkbox", required: true,
          options: ["Notebook", "Monitor externo", "Celular", "Tablet"] },
        { id: "resolucaoTela", label: "Resolução da tela (se souber)", type: "text", required: false },
        { id: "temaConceito", label: "Tema/conceito desejado", type: "textarea", required: true },
      ],
    },
    campanha_sazonal: campaignSchema(),
    campanha_vendas: campaignSchema(),
    outro: {
      title: "Descreva a demanda",
      fields: [
        { id: "descricaoLivre", label: "Descreva detalhadamente a demanda", type: "textarea", required: true },
      ],
    },
  };

  const TIPO_LABELS = {
    redes_sociais: "Post para redes sociais",
    impresso: "Impresso",
    site: "Material para site",
    wallpaper: "Wallpaper",
    campanha_sazonal: "Campanha sazonal",
    campanha_vendas: "Campanha de vendas",
    outro: "Outro",
  };

  const MAX_STEP = 5;
  let currentStep = 1;
  let selectedFiles = [];

  const form = document.getElementById("demand-form");
  const dynamicFieldsEl = document.getElementById("dynamic-fields");
  const dynamicTitleEl = document.getElementById("dynamic-step-title");
  const progressBar = document.getElementById("progress-bar");
  const btnBack = document.getElementById("btn-back");
  const btnNext = document.getElementById("btn-next");
  const btnSubmit = document.getElementById("btn-submit");
  const errorBanner = document.getElementById("error-banner");
  const successScreen = document.getElementById("success-screen");

  function showError(message) {
    errorBanner.textContent = message;
    errorBanner.hidden = false;
    errorBanner.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function clearError() {
    errorBanner.hidden = true;
    errorBanner.textContent = "";
  }

  function fieldHtml(field) {
    const reqMark = field.required ? '<span class="req">*</span>' : "";
    if (field.type === "text" || field.type === "date" || field.type === "number") {
      return `
        <label class="field">
          <span class="field-label">${field.label} ${reqMark}</span>
          <input type="${field.type}" name="${field.id}" ${field.required ? "required" : ""} />
        </label>`;
    }
    if (field.type === "textarea") {
      return `
        <label class="field">
          <span class="field-label">${field.label} ${reqMark}</span>
          <textarea name="${field.id}" rows="4" ${field.required ? "required" : ""}></textarea>
        </label>`;
    }
    if (field.type === "select") {
      const opts = field.options.map((o) => `<option value="${o}">${o}</option>`).join("");
      return `
        <label class="field">
          <span class="field-label">${field.label} ${reqMark}</span>
          <select name="${field.id}" ${field.required ? "required" : ""}>
            <option value="" disabled selected>Selecione</option>
            ${opts}
          </select>
        </label>`;
    }
    if (field.type === "radio") {
      const opts = field.options
        .map(
          (o) => `
        <label class="choice-card">
          <input type="radio" name="${field.id}" value="${o}" ${field.required ? "required" : ""} />
          <span>${o}</span>
        </label>`
        )
        .join("");
      return `
        <fieldset class="field">
          <legend class="field-label">${field.label} ${reqMark}</legend>
          <div class="choice-grid" data-name="${field.id}" data-type="radio">${opts}</div>
        </fieldset>`;
    }
    if (field.type === "checkbox") {
      const opts = field.options
        .map(
          (o) => `
        <label class="choice-card">
          <input type="checkbox" name="${field.id}[]" value="${o}" />
          <span>${o}</span>
        </label>`
        )
        .join("");
      return `
        <fieldset class="field">
          <legend class="field-label">${field.label} ${reqMark}</legend>
          <div class="choice-grid" data-name="${field.id}" data-type="checkbox">${opts}</div>
        </fieldset>`;
    }
    return "";
  }

  function carrosselCardsHtml() {
    let html = '<div id="carrossel-cards" hidden><h3 class="field-label" style="margin-bottom:10px">Cards do carrossel</h3>';
    for (let i = 1; i <= 6; i++) {
      html += `
        <div class="card-block">
          <h3>Card 0${i}</h3>
          <label class="field">
            <span class="field-label">Título</span>
            <input type="text" name="card${i}Titulo" />
          </label>
          <label class="field">
            <span class="field-label">Subtítulo</span>
            <textarea name="card${i}Subtitulo" rows="2"></textarea>
          </label>
        </div>`;
    }
    html += "</div>";
    return html;
  }

  function renderDynamicFields(tipo) {
    const schema = SCHEMAS[tipo];
    if (!schema) {
      dynamicFieldsEl.innerHTML = "";
      return;
    }
    dynamicTitleEl.textContent = schema.title;
    let html = schema.fields.map(fieldHtml).join("");
    if (tipo === "redes_sociais") {
      html += carrosselCardsHtml();
    }
    dynamicFieldsEl.innerHTML = html;

    if (tipo === "redes_sociais") {
      const formatoBoxes = dynamicFieldsEl.querySelectorAll('input[name="formato[]"]');
      const cardsBlock = document.getElementById("carrossel-cards");
      const toggleCards = () => {
        const hasCarrossel = Array.from(formatoBoxes).some((cb) => cb.checked && cb.value === "Carrossel");
        cardsBlock.hidden = !hasCarrossel;
      };
      formatoBoxes.forEach((cb) => cb.addEventListener("change", toggleCards));
    }
  }

  function goToStep(step) {
    document.querySelectorAll(".step").forEach((el) => {
      el.hidden = Number(el.dataset.step) !== step;
    });
    currentStep = step;
    progressBar.style.width = `${(step / MAX_STEP) * 100}%`;
    btnBack.hidden = step === 1;
    btnNext.hidden = step === MAX_STEP;
    btnSubmit.hidden = step !== MAX_STEP;
    clearError();
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (step === 3) {
      const tipo = form.querySelector('input[name="tipoDemanda"]:checked');
      renderDynamicFields(tipo ? tipo.value : null);
    }
    if (step === 5) {
      renderReview();
    }
  }

  function stepEl(step) {
    return document.querySelector(`.step[data-step="${step}"]`);
  }

  function validateStep(step) {
    const el = stepEl(step);
    const requiredInputs = el.querySelectorAll("input[required], textarea[required], select[required]");
    for (const input of requiredInputs) {
      if (input.type === "radio") {
        const group = el.querySelectorAll(`input[name="${input.name}"]`);
        const checked = Array.from(group).some((r) => r.checked);
        if (!checked) {
          showError(`Preencha o campo obrigatório: "${labelFor(input)}"`);
          return false;
        }
      } else if (!input.value || !input.value.trim()) {
        showError(`Preencha o campo obrigatório: "${labelFor(input)}"`);
        input.focus();
        return false;
      }
    }
    // grupos de checkbox marcados como obrigatórios via schema (etapa 3)
    if (step === 3) {
      const tipo = form.querySelector('input[name="tipoDemanda"]:checked');
      const schema = tipo && SCHEMAS[tipo.value];
      if (schema) {
        for (const field of schema.fields) {
          if (field.type === "checkbox" && field.required) {
            const checked = el.querySelectorAll(`input[name="${field.id}[]"]:checked`);
            if (checked.length === 0) {
              showError(`Selecione ao menos uma opção em "${field.label}"`);
              return false;
            }
          }
        }
      }
    }
    return true;
  }

  function labelFor(input) {
    const wrapper = input.closest(".field");
    const labelEl = wrapper && wrapper.querySelector(".field-label");
    return labelEl ? labelEl.textContent.replace("*", "").trim() : input.name;
  }

  function renderReview() {
    const data = collectAllData();
    const rows = [
      ["Nome", data.nome],
      ["Empresa", data.empresa],
      ["E-mail", data.email],
      ["Tipo de demanda", TIPO_LABELS[data.tipoDemanda] || data.tipoDemanda],
      ["Prazo desejado", data.prazoDesejado],
      ["Prioridade", data.prioridade],
      ["Aprovador", data.aprovador || "—"],
      ["Arquivos anexados", selectedFiles.length ? `${selectedFiles.length} arquivo(s)` : "Nenhum"],
    ];
    const dl = rows
      .map(([k, v]) => `<dt>${k}</dt><dd>${v || "—"}</dd>`)
      .join("");
    document.getElementById("review-summary").innerHTML = `<dl>${dl}</dl>`;
  }

  function collectAllData() {
    const formData = new FormData(form);
    const data = {};
    for (const [key, value] of formData.entries()) {
      if (key.endsWith("[]")) {
        const cleanKey = key.slice(0, -2);
        if (!data[cleanKey]) data[cleanKey] = [];
        data[cleanKey].push(value);
      } else {
        data[key] = value;
      }
    }
    return data;
  }

  function buildCamposEspecificos(tipo, data) {
    const schema = SCHEMAS[tipo];
    const out = {};
    if (!schema) return out;
    for (const field of schema.fields) {
      out[field.id] = data[field.id] || (field.type === "checkbox" ? [] : "");
    }
    if (tipo === "redes_sociais") {
      const cards = [];
      for (let i = 1; i <= 6; i++) {
        const titulo = data[`card${i}Titulo`];
        const subtitulo = data[`card${i}Subtitulo`];
        if (titulo || subtitulo) cards.push({ titulo: titulo || "", subtitulo: subtitulo || "" });
      }
      if (cards.length) out.cardsCarrossel = cards;
    }
    return out;
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function buildPayload() {
    const data = collectAllData();
    const links = [data.link1, data.link2, data.link3].filter(Boolean);
    const arquivos = await Promise.all(
      selectedFiles.map(async (file) => ({
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        base64: await fileToBase64(file),
      }))
    );
    return {
      nome: data.nome,
      empresa: data.empresa,
      email: data.email,
      tipoDemanda: data.tipoDemanda,
      tipoDemandaLabel: TIPO_LABELS[data.tipoDemanda] || data.tipoDemanda,
      camposEspecificos: buildCamposEspecificos(data.tipoDemanda, data),
      prazoDesejado: data.prazoDesejado,
      prioridade: data.prioridade,
      aprovador: data.aprovador || "",
      links,
      observacoes: data.observacoes || "",
      arquivos,
    };
  }

  function showSuccess(protocolo) {
    form.hidden = true;
    successScreen.hidden = false;
    document.getElementById("protocol-code").textContent = protocolo;
  }

  async function submitForm() {
    btnSubmit.disabled = true;
    btnSubmit.textContent = "Enviando...";
    clearError();
    try {
      const payload = await buildPayload();

      if (!FORM_CONFIG.SCRIPT_URL) {
        console.log("[demand-form] SCRIPT_URL não configurado — simulando envio.", payload);
        await new Promise((r) => setTimeout(r, 600));
        showSuccess("SC-DEV-0000");
        return;
      }

      const res = await fetch(FORM_CONFIG.SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.ok) {
        showSuccess(json.protocolo);
      } else {
        showError(json.error || "Não foi possível enviar sua solicitação. Tente novamente.");
      }
    } catch (err) {
      console.error(err);
      showError("Não foi possível enviar sua solicitação. Verifique sua conexão e tente novamente.");
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = "Enviar solicitação";
    }
  }

  // Navegação
  btnNext.addEventListener("click", () => {
    if (!validateStep(currentStep)) return;
    goToStep(Math.min(currentStep + 1, MAX_STEP));
  });

  btnBack.addEventListener("click", () => {
    goToStep(Math.max(currentStep - 1, 1));
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!validateStep(currentStep)) return;
    submitForm();
  });

  form.addEventListener("change", (e) => {
    if (e.target.name === "arquivos") {
      const maxBytes = (FORM_CONFIG.MAX_FILE_SIZE_MB || 8) * 1024 * 1024;
      const files = Array.from(e.target.files);
      const tooBig = files.filter((f) => f.size > maxBytes);
      if (tooBig.length) {
        showError(
          `${tooBig.map((f) => f.name).join(", ")} excede ${FORM_CONFIG.MAX_FILE_SIZE_MB}MB. Use um link de referência em vez de upload para esse arquivo.`
        );
        e.target.value = "";
        selectedFiles = [];
        return;
      }
      selectedFiles = files;
    }
  });

  document.getElementById("btn-new").addEventListener("click", () => {
    window.location.reload();
  });

  goToStep(1);
})();
