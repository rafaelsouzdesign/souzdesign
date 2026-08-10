/* Formulário de demanda criativa — lógica de etapas, campos dinâmicos por tipo
   de demanda e envio para o Google Apps Script (que grava numa planilha do
   Google Sheets, organizada por mês). Vanilla JS, sem dependências, pensado
   para ser embutido em qualquer página. */

(function () {
  "use strict";

  function slugify(str) {
    return String(str)
      .toLowerCase()
      .normalize("NFD")
      .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  // ---- Redes sociais: campos de cada "criativo" (repetível) -------------
  const REDES_SOCIAIS_FIELDS = [
    { id: "redeSocial", label: "Qual(is) rede(s) social(is)?", type: "checkbox", required: true,
      options: ["Instagram", "LinkedIn", "TikTok", "WhatsApp"] },
    { id: "formato", label: "Qual(is) formato(s)?", type: "checkbox", required: true,
      options: ["Feed (1350x1080p)", "Story (1920x1080p)", "Carrossel", "Reels/Vídeo"] },
    { id: "objetivo", label: "Qual o objetivo do post?", type: "radio", required: true,
      options: ["Informar", "Vender", "Promover", "Engajar", "Comemorar", "Parabenizar", "Outro"] },
    { id: "tituloPrincipal", label: "Título principal", type: "text", required: true },
    { id: "copy", label: "Qual o texto (copy) definido?", type: "textarea", required: true },
  ];

  const MAX_CREATIVES = 30;

  // ---- Campanhas: campos gerais + detalhamento por peça envolvida -------
  const PECAS_OPTIONS = ["Post redes sociais", "Impresso", "Material para site", "Wallpaper", "E-mail marketing", "Outro"];

  const PECA_DETAIL_FIELDS = {
    "Post redes sociais": [
      { id: "redeSocial", label: "Qual(is) rede(s) social(is)?", type: "checkbox", required: true,
        options: ["Instagram", "LinkedIn", "TikTok", "WhatsApp"] },
      { id: "formato", label: "Qual(is) formato(s)?", type: "checkbox", required: true,
        options: ["Feed (1350x1080p)", "Story (1920x1080p)", "Carrossel", "Reels/Vídeo"] },
      { id: "detalhes", label: "Detalhes desta peça", type: "textarea", required: false },
    ],
    "Impresso": [
      { id: "dimensaoImpresso", label: "Dimensão do impresso", type: "text", required: true },
      { id: "detalhes", label: "Detalhes desta peça", type: "textarea", required: false },
    ],
    "Material para site": [
      { id: "detalhes", label: "Detalhes desta peça", type: "textarea", required: false },
    ],
    "Wallpaper": [
      { id: "detalhes", label: "Detalhes desta peça", type: "textarea", required: false },
    ],
    "E-mail marketing": [
      { id: "detalhes", label: "Detalhes desta peça", type: "textarea", required: false },
    ],
    "Outro": [
      { id: "detalhes", label: "Detalhes desta peça", type: "textarea", required: true },
    ],
  };

  function campaignSchema() {
    return {
      title: "Detalhes da campanha",
      fields: [
        { id: "nomeCampanha", label: "Nome da campanha", type: "text", required: true },
        { id: "headline", label: "Headline da campanha (chamada que será utilizada em toda a campanha)", type: "text", required: true },
        { id: "pecasEnvolvidas", label: "Peças envolvidas", type: "checkbox", required: true, options: PECAS_OPTIONS },
        { id: "canais", label: "Canais de veiculação", type: "checkbox", required: true,
          options: ["Instagram", "LinkedIn", "TikTok", "WhatsApp", "E-mail", "Site", "Impresso"] },
        { id: "dataInicio", label: "Data de início da veiculação", type: "date", required: true },
        { id: "dataFim", label: "Data de fim da veiculação", type: "date", required: false },
        { id: "briefingGeral", label: "Briefing geral da campanha", type: "textarea", required: true },
      ],
    };
  }

  const SCHEMAS = {
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
  let lastRenderedTipo = null;
  let creativeIndices = [1];
  let nextCreativeIndex = 2;

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

  function prefixFields(fields, prefix) {
    return fields.map((f) => Object.assign({}, f, { id: `${prefix}_${f.id}` }));
  }

  // ---- Redes sociais: múltiplos criativos --------------------------------

  function carrosselCardsHtml(prefix) {
    let html = `<div id="carrossel-cards-${prefix}" class="carrossel-cards" hidden><h3 class="field-label" style="margin-bottom:10px">Cards do carrossel</h3>`;
    for (let i = 1; i <= 6; i++) {
      html += `
        <div class="card-block">
          <h3>Card 0${i}</h3>
          <label class="field">
            <span class="field-label">Título</span>
            <input type="text" name="${prefix}_card${i}Titulo" />
          </label>
          <label class="field">
            <span class="field-label">Subtítulo</span>
            <textarea name="${prefix}_card${i}Subtitulo" rows="2"></textarea>
          </label>
        </div>`;
    }
    html += "</div>";
    return html;
  }

  function creativeBlockHtml(index) {
    const prefix = `criativo${index}`;
    const fields = prefixFields(REDES_SOCIAIS_FIELDS, prefix);
    let html = `<div class="creative-block" data-index="${index}">`;
    html += `<div class="creative-block-header"><h3>Criativo ${index}</h3><button type="button" class="btn-remove-creative" data-index="${index}">Remover</button></div>`;
    html += fields.map(fieldHtml).join("");
    html += carrosselCardsHtml(prefix);
    html += "</div>";
    return html;
  }

  function wireCreativeBlock(index) {
    const block = dynamicFieldsEl.querySelector(`.creative-block[data-index="${index}"]`);
    block.querySelector(".btn-remove-creative").addEventListener("click", () => removeCreativeBlock(index));
    const formatoBoxes = block.querySelectorAll(`input[name="criativo${index}_formato[]"]`);
    const cardsBlock = block.querySelector(`#carrossel-cards-criativo${index}`);
    const toggleCards = () => {
      const hasCarrossel = Array.from(formatoBoxes).some((cb) => cb.checked && cb.value === "Carrossel");
      cardsBlock.hidden = !hasCarrossel;
    };
    formatoBoxes.forEach((cb) => cb.addEventListener("change", toggleCards));
  }

  function updateCreativeControls() {
    const blocks = dynamicFieldsEl.querySelectorAll(".creative-block");
    blocks.forEach((block, i) => {
      block.querySelector(".creative-block-header h3").textContent = `Criativo ${i + 1}`;
      block.querySelector(".btn-remove-creative").hidden = blocks.length <= 1;
    });
    const addBtn = document.getElementById("btn-add-creative");
    if (addBtn) addBtn.hidden = blocks.length >= MAX_CREATIVES;
  }

  function addCreativeBlock() {
    if (creativeIndices.length >= MAX_CREATIVES) return;
    const index = nextCreativeIndex++;
    creativeIndices.push(index);
    const container = document.getElementById("creatives-container");
    container.insertAdjacentHTML("beforeend", creativeBlockHtml(index));
    wireCreativeBlock(index);
    updateCreativeControls();
  }

  function removeCreativeBlock(index) {
    const block = dynamicFieldsEl.querySelector(`.creative-block[data-index="${index}"]`);
    if (block) block.remove();
    creativeIndices = creativeIndices.filter((i) => i !== index);
    updateCreativeControls();
  }

  function renderCreativesUI() {
    dynamicTitleEl.textContent = "Detalhes do post para redes sociais";
    creativeIndices = [1];
    nextCreativeIndex = 2;
    let html = '<div id="creatives-container">' + creativeBlockHtml(1) + "</div>";
    html += '<button type="button" id="btn-add-creative" class="btn-add-creative">+ Adicionar outro criativo/carrossel</button>';
    dynamicFieldsEl.innerHTML = html;
    wireCreativeBlock(1);
    document.getElementById("btn-add-creative").addEventListener("click", addCreativeBlock);
    updateCreativeControls();
  }

  // ---- Campanhas: detalhamento por peça envolvida ------------------------

  function pecasDetalheContainerHtml() {
    let html = '<div id="pecas-detalhe-container">';
    PECAS_OPTIONS.forEach((peca) => {
      const slug = slugify(peca);
      const fieldsMeta = prefixFields(PECA_DETAIL_FIELDS[peca] || [], `pecaDetalhe_${slug}`).map((f) =>
        Object.assign({}, f, { required: false })
      );
      html += `<div class="peca-detalhe-block card-block" data-peca-slug="${slug}" hidden>`;
      html += `<h3>Detalhes — ${peca}</h3>`;
      html += fieldsMeta.map(fieldHtml).join("");
      html += "</div>";
    });
    html += "</div>";
    return html;
  }

  function wirePecasDetalheToggle() {
    const boxes = dynamicFieldsEl.querySelectorAll('input[name="pecasEnvolvidas[]"]');
    const sync = () => {
      boxes.forEach((cb) => {
        const slug = slugify(cb.value);
        const block = dynamicFieldsEl.querySelector(`.peca-detalhe-block[data-peca-slug="${slug}"]`);
        if (block) block.hidden = !cb.checked;
      });
    };
    boxes.forEach((cb) => cb.addEventListener("change", sync));
    sync();
  }

  function renderDynamicFields(tipo) {
    if (tipo === "redes_sociais") {
      renderCreativesUI();
      return;
    }
    const schema = SCHEMAS[tipo];
    if (!schema) {
      dynamicFieldsEl.innerHTML = "";
      return;
    }
    dynamicTitleEl.textContent = schema.title;
    let html = schema.fields.map(fieldHtml).join("");
    const isCampanha = tipo === "campanha_sazonal" || tipo === "campanha_vendas";
    if (isCampanha) {
      html += pecasDetalheContainerHtml();
    }
    dynamicFieldsEl.innerHTML = html;
    if (isCampanha) {
      wirePecasDetalheToggle();
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
      const tipoValue = tipo ? tipo.value : null;
      if (tipoValue !== lastRenderedTipo) {
        renderDynamicFields(tipoValue);
        lastRenderedTipo = tipoValue;
      }
    }
    if (step === 5) {
      renderReview();
    }
    syncChoiceCardStyles();
  }

  // Reforço visual além do :has() em CSS — alguns temas/plugins de WordPress
  // carregam navegadores ou motores de renderização mais antigos no editor.
  function syncChoiceCardStyles() {
    form.querySelectorAll(".choice-card").forEach((card) => {
      const input = card.querySelector("input");
      card.classList.toggle("is-checked", !!(input && input.checked));
    });
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

    if (step === 3) {
      const tipo = form.querySelector('input[name="tipoDemanda"]:checked');
      if (tipo && tipo.value === "redes_sociais") {
        const blocks = el.querySelectorAll(".creative-block");
        for (const block of blocks) {
          const index = block.dataset.index;
          const label = block.querySelector(".creative-block-header h3").textContent;
          for (const groupId of ["redeSocial", "formato"]) {
            const checked = block.querySelectorAll(`input[name="criativo${index}_${groupId}[]"]:checked`);
            if (checked.length === 0) {
              const groupLabel = groupId === "redeSocial" ? "rede social" : "formato";
              showError(`Selecione ao menos um(a) ${groupLabel} no ${label}`);
              return false;
            }
          }
        }
      } else if (tipo) {
        const schema = SCHEMAS[tipo.value];
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
        if (tipo.value === "campanha_sazonal" || tipo.value === "campanha_vendas") {
          const checkedPecas = el.querySelectorAll('input[name="pecasEnvolvidas[]"]:checked');
          for (const cb of checkedPecas) {
            const peca = cb.value;
            const slug = slugify(peca);
            const fieldsMeta = PECA_DETAIL_FIELDS[peca] || [];
            const block = el.querySelector(`.peca-detalhe-block[data-peca-slug="${slug}"]`);
            for (const f of fieldsMeta) {
              if (!f.required) continue;
              const name = `pecaDetalhe_${slug}_${f.id}`;
              if (f.type === "checkbox") {
                const checked2 = block.querySelectorAll(`input[name="${name}[]"]:checked`);
                if (checked2.length === 0) {
                  showError(`Selecione ao menos uma opção em "${f.label}" (Detalhes — ${peca})`);
                  return false;
                }
              } else {
                const input2 = block.querySelector(`[name="${name}"]`);
                if (!input2 || !input2.value.trim()) {
                  showError(`Preencha "${f.label}" em Detalhes — ${peca}`);
                  return false;
                }
              }
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
    const tipo = data.tipoDemanda;
    let itensCount = 1;
    if (tipo === "redes_sociais") {
      itensCount = dynamicFieldsEl.querySelectorAll(".creative-block").length;
    } else if (tipo === "campanha_sazonal" || tipo === "campanha_vendas") {
      itensCount = 1 + (data.pecasEnvolvidas ? data.pecasEnvolvidas.length : 0);
    }
    const rows = [
      ["Nome", data.nome],
      ["Empresa", data.empresa],
      ["E-mail", data.email],
      ["Tipo de demanda", TIPO_LABELS[data.tipoDemanda] || data.tipoDemanda],
      ["Itens nesta solicitação", String(itensCount)],
      ["Prazo desejado", data.prazoDesejado],
      ["Prioridade", data.prioridade],
      ["Aprovador", data.aprovador || "—"],
      ["Arquivos anexados", selectedFiles.length ? `${selectedFiles.length} arquivo(s)` : "Nenhum"],
    ];
    const dl = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v || "—"}</dd>`).join("");
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
    if (!schema) return [];
    return schema.fields.map((field) => {
      let value;
      if (field.type === "checkbox") {
        const arr = data[field.id] || [];
        value = arr.length ? arr.join(", ") : "—";
      } else {
        value = (data[field.id] || "").toString().trim() || "—";
      }
      return { label: field.label, value };
    });
  }

  function buildCriativos(data) {
    const indices = new Set();
    Object.keys(data).forEach((k) => {
      const m = k.match(/^criativo(\d+)_/);
      if (m) indices.add(Number(m[1]));
    });
    const sorted = Array.from(indices).sort((a, b) => a - b);
    return sorted.map((idx) => {
      const prefix = `criativo${idx}`;
      const campos = REDES_SOCIAIS_FIELDS.map((f) => {
        const key = `${prefix}_${f.id}`;
        let value;
        if (f.type === "checkbox") {
          const arr = data[key] || [];
          value = arr.length ? arr.join(", ") : "—";
        } else {
          value = (data[key] || "").toString().trim() || "—";
        }
        return { label: f.label, value };
      });
      for (let i = 1; i <= 6; i++) {
        const titulo = data[`${prefix}_card${i}Titulo`];
        const subtitulo = data[`${prefix}_card${i}Subtitulo`];
        if (titulo || subtitulo) {
          campos.push({ label: `Card 0${i}`, value: `Título: ${titulo || "—"} | Subtítulo: ${subtitulo || "—"}` });
        }
      }
      return { camposEspecificos: campos };
    });
  }

  function buildCampanha(tipo, data) {
    const schema = SCHEMAS[tipo];
    const camposEspecificos = schema.fields.map((f) => {
      let value;
      if (f.type === "checkbox") {
        const arr = data[f.id] || [];
        value = arr.length ? arr.join(", ") : "—";
      } else {
        value = (data[f.id] || "").toString().trim() || "—";
      }
      return { label: f.label, value };
    });
    const pecasSelecionadas = data.pecasEnvolvidas || [];
    const pecas = pecasSelecionadas.map((peca) => {
      const slug = slugify(peca);
      const fieldsMeta = PECA_DETAIL_FIELDS[peca] || [];
      const campos = fieldsMeta.map((f) => {
        const key = `pecaDetalhe_${slug}_${f.id}`;
        let value;
        if (f.type === "checkbox") {
          const arr = data[key] || [];
          value = arr.length ? arr.join(", ") : "—";
        } else {
          value = (data[key] || "").toString().trim() || "—";
        }
        return { label: f.label, value };
      });
      return { peca, camposEspecificos: campos };
    });
    return { camposEspecificos, pecas };
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
    const payload = {
      nome: data.nome,
      empresa: data.empresa,
      email: data.email,
      tipoDemanda: data.tipoDemanda,
      tipoDemandaLabel: TIPO_LABELS[data.tipoDemanda] || data.tipoDemanda,
      prazoDesejado: data.prazoDesejado,
      prioridade: data.prioridade,
      aprovador: data.aprovador || "",
      links,
      observacoes: data.observacoes || "",
      arquivos,
    };

    if (data.tipoDemanda === "redes_sociais") {
      payload.criativos = buildCriativos(data);
    } else if (data.tipoDemanda === "campanha_sazonal" || data.tipoDemanda === "campanha_vendas") {
      const campanha = buildCampanha(data.tipoDemanda, data);
      payload.camposEspecificos = campanha.camposEspecificos;
      payload.pecas = campanha.pecas;
    } else {
      payload.camposEspecificos = buildCamposEspecificos(data.tipoDemanda, data);
    }

    return payload;
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
    syncChoiceCardStyles();
  });

  document.getElementById("btn-new").addEventListener("click", () => {
    window.location.reload();
  });

  goToStep(1);
})();
