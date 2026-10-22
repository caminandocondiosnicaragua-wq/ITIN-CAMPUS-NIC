(() => {
  const API_URL = 'https://script.google.com/macros/s/AKfycbxauXEu0OSdzjVBL6Z4GzxR6Jd_-OQwCsnLL6g-h-ERhr8qszpUZc4scZWlMm6veWPsow/exec';
  const sections = [...document.querySelectorAll('[data-section]')];
  const navLinks = [...document.querySelectorAll('[data-page]')];
  const menu = document.getElementById('main-nav');
  const menuToggle = document.getElementById('menu-toggle');
  const form = document.getElementById('application-form');
  const steps = [...document.querySelectorAll('[data-step]')];
  const stepItems = [...document.querySelectorAll('[data-step-item]')];
  const backButton = document.getElementById('back-button');
  const nextButton = document.getElementById('next-button');
  const submitButton = document.getElementById('submit-button');
  const progressFill = document.getElementById('progress-fill');
  const progressCount = document.getElementById('progress-count');
  const alertBox = document.getElementById('form-alert');
  const programSelect = document.getElementById('program-select');
  const consentContainer = document.getElementById('consent-container');
  const questionBox = document.getElementById('interview-questions');
  let currentStep = 0;
  let loadedProgram = '';
  let questionLoadToken = 0;
  let pendingDraftFields = {};

  document.getElementById('current-year').textContent = new Date().getFullYear();

  // Controles accesibles para ajustar el tamaño de letra en toda la página.
  const fontDecrease = document.getElementById('font-decrease');
  const fontReset = document.getElementById('font-reset');
  const fontIncrease = document.getElementById('font-increase');
  let fontScale = 1.12;
  function applyFontScale() {
    document.documentElement.style.setProperty('--font-scale', String(fontScale));
    try { localStorage.setItem('itin-font-scale', String(fontScale)); } catch (_) {}
    if (fontDecrease) fontDecrease.setAttribute('aria-pressed', String(fontScale <= 0.9));
    if (fontReset) fontReset.setAttribute('aria-pressed', String(Math.abs(fontScale - 1.12) < 0.01));
    if (fontIncrease) fontIncrease.setAttribute('aria-pressed', String(fontScale >= 1.5));
  }
  try {
    const savedFontScale = Number(localStorage.getItem('itin-font-scale'));
    if (savedFontScale >= 0.9 && savedFontScale <= 1.5) fontScale = savedFontScale;
  } catch (_) {}
  if (fontDecrease) fontDecrease.addEventListener('click', () => { fontScale = Math.max(0.9, Math.round((fontScale - 0.1) * 100) / 100); applyFontScale(); });
  if (fontReset) fontReset.addEventListener('click', () => { fontScale = 1.12; applyFontScale(); });
  if (fontIncrease) fontIncrease.addEventListener('click', () => { fontScale = Math.min(1.5, Math.round((fontScale + 0.1) * 100) / 100); applyFontScale(); });
  applyFontScale();



  function showPage(page) {
    const validPage = sections.some(section => section.dataset.section === page) ? page : 'inicio';
    sections.forEach(section => {
      const active = section.dataset.section === validPage;
      section.hidden = !active;
      section.classList.toggle('is-visible', active);
    });
    navLinks.forEach(link => link.classList.toggle('active', link.dataset.page === validPage));
    menu.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
    if (validPage === 'solicitud') updateStep();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function readHash() {
    showPage((location.hash || '#inicio').slice(1));
  }
  window.addEventListener('hashchange', readHash);
  navLinks.forEach(link => link.addEventListener('click', () => {
    if (link.dataset.page === 'solicitud') updateStep();
  }));
  document.querySelectorAll('[data-program]').forEach(link => link.addEventListener('click', () => {
    programSelect.value = link.dataset.program;
    updateInterviewForProgram();
  }));
  menuToggle.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(open));
  });

  function isMasters() {
    return /maestr[ií]a/i.test(programSelect.value);
  }
  function activeStepIndexes() {
    return isMasters() ? [0, 1, 2] : [0, 1, 2, 3];
  }

  function updateStep() {
    const active = activeStepIndexes();
    if (!active.includes(currentStep)) currentStep = active[active.length - 1];
    steps.forEach((step, index) => {
      const shown = index === currentStep && active.includes(index);
      step.hidden = !shown;
      step.classList.toggle('is-current', shown);
    });
    stepItems.forEach((item, index) => {
      const eligible = active.includes(index);
      item.hidden = !eligible;
      item.classList.toggle('current', index === currentStep);
      item.classList.toggle('done', eligible && active.indexOf(index) < active.indexOf(currentStep));
    });
    const position = active.indexOf(currentStep);
    progressFill.style.width = ((position + 1) / active.length * 100) + '%';
    progressCount.textContent = 'Etapa ' + (position + 1) + ' de ' + active.length;
    backButton.hidden = position === 0;
    backButton.disabled = position === 0;
    nextButton.hidden = position === active.length - 1;
    submitButton.hidden = position !== active.length - 1;
    consentContainer.hidden = position !== active.length - 1;
    alertBox.hidden = true;
    updateGuide();
    if (currentStep === 3 && !isMasters()) updateInterviewForProgram();
  }

  function validateCurrentStep() {
    const fields = [...steps[currentStep].querySelectorAll('input, select, textarea')].filter(field => field.type !== 'checkbox' && field.type !== 'file');
    for (const field of fields) {
      if (!field.checkValidity()) {
        field.reportValidity();
        field.focus();
        return false;
      }
    }
    return true;
  }

  nextButton.addEventListener('click', () => {
    if (!validateCurrentStep()) return;
    const active = activeStepIndexes();
    currentStep = active[active.indexOf(currentStep) + 1];
    updateStep();
    document.querySelector('.form-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  backButton.addEventListener('click', () => {
    const active = activeStepIndexes();
    currentStep = active[Math.max(0, active.indexOf(currentStep) - 1)];
    updateStep();
    document.querySelector('.form-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  function renderQuestionMessage(message) {
    questionBox.replaceChildren();
    const box = document.createElement('div');
    box.className = 'loading-card';
    const dot = document.createElement('span');
    dot.className = 'loading-dot';
    const p = document.createElement('p');
    p.textContent = message;
    box.append(dot, p);
    questionBox.append(box);
  }

  function renderQuestions(questions, program) {
    questionBox.replaceChildren();
    if (!questions.length) {
      renderQuestionMessage('No se encontraron preguntas publicadas para ' + program + '. El instituto debe revisar el banco de preguntas.');
      return;
    }
    // El banco de Notion puede devolver las preguntas en otro orden.
    // Ordenamos por el número que ya forma parte del enunciado (1., 2., 3.),
    // sin agregar una segunda numeración visual.
    const orderedQuestions = [...questions].sort((a, b) => {
      const textA = String(a.pregunta || a.titulo || '');
      const textB = String(b.pregunta || b.titulo || '');
      const numberA = textA.match(/^\s*(\d+)\s*[.)-]/);
      const numberB = textB.match(/^\s*(\d+)\s*[.)-]/);
      if (numberA && numberB) return Number(numberA[1]) - Number(numberB[1]);
      if (numberA) return -1;
      if (numberB) return 1;
      return 0;
    });
    orderedQuestions.forEach((question, index) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'interview-question';
      const label = document.createElement('label');
      label.htmlFor = 'respuesta-' + index;
      label.textContent = question.pregunta || question.titulo || ('Pregunta ' + (index + 1));
      const answer = document.createElement('textarea');
      answer.id = 'respuesta-' + index;
      answer.name = 'Respuesta_' + question.id;
      answer.dataset.questionId = question.id;
      answer.required = true;
      answer.rows = 2;
      answer.placeholder = 'Escribe tu respuesta con tus propias palabras…';
      wrapper.append(label, answer);
      questionBox.append(wrapper);
      const savedAnswer = pendingDraftFields[answer.name];
      if (typeof savedAnswer === 'string') answer.value = savedAnswer;
    });
    questionBox.querySelectorAll('textarea[data-question-id]').forEach(field => {
      field.addEventListener('input', saveDraft);
      field.addEventListener('change', saveDraft);
    });
  }

  async function updateInterviewForProgram() {
    const program = programSelect.value;
    const token = ++questionLoadToken;
    if (!program) {
      loadedProgram = '';
      renderQuestionMessage('Primero selecciona el programa en Datos personales.');
      return;
    }
    if (isMasters()) {
      loadedProgram = program;
      renderQuestionMessage('Al completar los documentos podrás confirmar tu solicitud.');
      return;
    }
    if (loadedProgram === program && questionBox.querySelector('.interview-question')) return;
    loadedProgram = program;
    renderQuestionMessage('Consultando las preguntas correspondientes a ' + program + '…');
    try {
      // Public Apps Script endpoint; text/plain avoids a CORS preflight for this JSON payload.
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ accion: 'preguntas', programa: program }),
        redirect: 'follow'
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const result = await response.json();
      if (token !== questionLoadToken) return;
      if (!result.ok || !Array.isArray(result.datos)) throw new Error(result.error || 'Respuesta inesperada de la API');
      const wanted = program.toLowerCase();
      const questions = result.datos.filter(item => String(item.programa || '').toLowerCase().includes(wanted));
      renderQuestions(questions, program);
    } catch (error) {
      if (token !== questionLoadToken) return;
      renderQuestionMessage('No fue posible cargar las preguntas desde la API en este navegador. Antes de continuar, hay que revisar el acceso público y la compatibilidad CORS del Web App. No se han inventado preguntas.');
      console.error('Error cargando preguntas de entrevista:', error);
    }
  }
  programSelect.addEventListener('change', () => {
    loadedProgram = '';
    updateInterviewForProgram();
    if (currentStep === 3 && isMasters()) {
      currentStep = 2;
      updateStep();
    }
  });

  // Adjuntos: permite reemplazar o quitar el archivo de cada campo.
  const MAX_FILE_BYTES = 4 * 1024 * 1024;
  const MAX_TOTAL_FILE_BYTES = 8 * 1024 * 1024;
  const ALLOWED_FILE_TYPES = ['image/png', 'image/jpeg', 'application/pdf'];

  function refreshUploadCard(input) {
    const card = input.closest('.upload-card');
    const small = card && card.querySelector('small');
    const removeButton = card && card.querySelector('.remove-upload-button');
    const file = input.files && input.files[0];
    if (small) {
      small.textContent = file
        ? file.name + ' · ' + Math.max(1, Math.round(file.size / 1024)) + ' KB'
        : (input.dataset.defaultHelp || 'Ningún archivo seleccionado.');
    }
    if (removeButton) {
      removeButton.hidden = !file;
      removeButton.disabled = !file;
    }
  }

  form.querySelectorAll('.document-input').forEach(input => {
    const card = input.closest('.upload-card');
    const small = card && card.querySelector('small');
    if (small) input.dataset.defaultHelp = small.textContent.trim();

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'remove-upload-button';
    removeButton.textContent = 'Quitar archivo';
    removeButton.setAttribute('aria-label', 'Quitar archivo de ' + input.name);
    removeButton.hidden = true;
    removeButton.disabled = true;
    removeButton.addEventListener('click', () => {
      input.value = '';
      input.setCustomValidity('');
      refreshUploadCard(input);
      saveDraft();
    });
    const content = card && card.querySelector('span:nth-child(2)');
    if (content) content.append(removeButton);

    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      input.setCustomValidity('');
      if (!file) {
        refreshUploadCard(input);
        saveDraft();
        return;
      }
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        input.setCustomValidity('Selecciona una imagen PNG, JPG o JPEG, o un documento PDF.');
        input.reportValidity();
        input.value = '';
        refreshUploadCard(input);
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        input.setCustomValidity('Cada archivo debe pesar como máximo 4 MB.');
        input.reportValidity();
        input.value = '';
        refreshUploadCard(input);
        return;
      }
      refreshUploadCard(input);
      saveDraft();
    });
  });

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        const comma = dataUrl.indexOf(',');
        if (comma < 0) {
          reject(new Error('No se pudo preparar el archivo ' + file.name + '.'));
          return;
        }
        resolve(dataUrl.slice(comma + 1));
      };
      reader.onerror = () => reject(new Error('No se pudo leer el archivo ' + file.name + '.'));
      reader.readAsDataURL(file);
    });
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!validateCurrentStep()) return;
    const confirmation = form.querySelector('[name="Confirmacion"]:not([disabled])');
    if (confirmation && !confirmation.checked) {
      confirmation.reportValidity();
      return;
    }
    const selectedFiles = [...form.querySelectorAll('.document-input')]
      .filter(input => input.files && input.files.length);
    const totalFileBytes = selectedFiles.reduce((sum, input) => sum + input.files[0].size, 0);
    if (selectedFiles.some(input => input.files[0].size > MAX_FILE_BYTES)) {
      alertBox.textContent = 'Cada archivo debe pesar como máximo 4 MB. Quita o reemplaza el archivo que supera el límite.';
      alertBox.hidden = false;
      return;
    }
    if (totalFileBytes > MAX_TOTAL_FILE_BYTES) {
      alertBox.textContent = 'El total de los archivos no puede superar 8 MB por solicitud. Quita o reemplaza algún archivo.';
      alertBox.hidden = false;
      return;
    }
    const originalLabel = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.textContent = 'Enviando…';
    alertBox.hidden = true;
    alertBox.classList.remove('form-alert-success');
    try {
      const estudiante = {};
      [...form.elements].forEach(field => {
        if (!field.name || ['file','submit','button'].includes(field.type) || field.name === 'Confirmacion' || field.name.startsWith('Respuesta_')) return;
        estudiante[field.name] = field.value.trim();
      });
      // Las fechas se generan al enviar; no dependen de lo que escriba el estudiante.
      const fechaSistema = new Date();
      const fechaHoy = [fechaSistema.getFullYear(), String(fechaSistema.getMonth() + 1).padStart(2, '0'), String(fechaSistema.getDate()).padStart(2, '0')].join('-');
      estudiante.FechaEntrevista = fechaHoy;
      const fechaCargaDocumentos = selectedFiles.length ? fechaHoy : '';
      const respuestas = [...questionBox.querySelectorAll('textarea[data-question-id]')].map(field => ({
        preguntaId: field.dataset.questionId,
        respuesta: field.value.trim()
      }));
      // Convertir los adjuntos a Base64 para que Apps Script los reciba en solicitud.archivos.
      const archivos = {};
      for (const input of selectedFiles) {
        const file = input.files[0];
        archivos[input.name] = {
          nombre: file.name,
          tipo: file.type,
          base64: await fileToBase64(file)
        };
      }
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          accion: 'solicitud',
          programa: programSelect.value,
          estudiante,
          documentos: fechaCargaDocumentos ? { Fechadecarga: fechaCargaDocumentos } : {},
          fechaCargaDocumentos,
          archivos,
          respuestas
        }),
        redirect: 'follow'
      });
      const textResponse = await response.text();
      let result;
      try { result = JSON.parse(textResponse); } catch (_) { throw new Error('La API no devolvió JSON. Comprueba la implementación de Apps Script.'); }
      if (!response.ok || !result.ok || result.estado === 'INCOMPLETA') throw new Error(result.error || result.mensaje || 'El servidor no confirmó el guardado completo.');
      await clearDraftAfterConfirmedSave();
      form.reset();
      pendingDraftFields = {};
      form.querySelectorAll('.document-input').forEach(refreshUploadCard);
      currentStep = 0;
      loadedProgram = '';
      updateStep();
      alertBox.textContent = 'Tu solicitud ha sido enviada. Esto no confirma admisión ni matrícula. Nos comunicaremos contigo por el correo electrónico o WhatsApp que proporcionaste para informarte sobre los siguientes pasos.';
      alertBox.classList.add('form-alert-success');
      alertBox.hidden = false;
    } catch (error) {
      alertBox.classList.remove('form-alert-success');
      alertBox.textContent = 'No se pudo completar el envío. ' + (error.message || 'Error de conexión') + '. Tu avance permanece guardado en este dispositivo.';
      alertBox.hidden = false;
      console.error('Error enviando solicitud ITIN:', error);
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = originalLabel;
    }
  });

  // Guía contextual interactiva debajo del panel de progreso.
  const guideTitle = document.getElementById('guide-title');
  const guideHeading = document.getElementById('guide-heading');
  const guideMessage = document.getElementById('guide-message');
  const guideTip = document.getElementById('guide-tip');
  const cacheStatus = document.getElementById('cache-status');
  const guideContent = [
    {title:'Datos personales',heading:'Empecemos por ti',message:'Escribe tus datos tal como aparecen en tus documentos y utiliza un correo y teléfono donde podamos contactarte.',tip:'Consejo: revisa la fecha de nacimiento, el número de cédula y el programa antes de continuar.'},
    {title:'Información de la iglesia',heading:'Cuéntanos de tu comunidad',message:'Indica la iglesia donde congregas y los datos ministeriales solicitados. Si algún campo no corresponde a tu situación, no inventes información.',tip:'Consejo: verifica la escritura del nombre de la iglesia y del pastor.'},
    {title:'Documentos',heading:'Prepara imágenes claras',message:'Puedes seleccionar una imagen o un PDF. Comprueba que el texto se vea completo, con buena luz y sin reflejos. Si eliges el archivo equivocado, puedes quitarlo o reemplazarlo.',tip:'Formatos admitidos: PNG, JPG, JPEG y PDF. Cada archivo admite hasta 4 MB y el total hasta 8 MB. Puedes quitar o reemplazar archivos antes de enviar.'},
    {title:'Realizar entrevista',heading:'Responde con tus palabras',message:'Lee cada pregunta y responde con sinceridad y claridad. Las preguntas corresponden al programa seleccionado.',tip:'Consejo: puedes regresar a las etapas anteriores; tu avance se conserva en este dispositivo.'}
  ];
  function updateGuide() {
    const item = guideContent[currentStep] || guideContent[0];
    if (guideTitle) guideTitle.textContent = item.title;
    if (guideHeading) guideHeading.textContent = item.heading;
    if (guideMessage) guideMessage.textContent = item.message;
    if (guideTip) guideTip.textContent = item.tip;
  }


  // Avatar interactivo: arrastrar para moverlo y pulsar para ampliar/reducir.
  const assistantAvatar = document.querySelector('.guide-avatar');
  const assistantAvatarWrap = document.querySelector('.guide-avatar-wrap');
  if (assistantAvatar && assistantAvatarWrap) {
    let draggingAvatar = false;
    let avatarMoved = false;
    let pointerStartX = 0, pointerStartY = 0, avatarX = 0, avatarY = 0;
    assistantAvatar.style.cursor = 'grab';
    assistantAvatar.style.touchAction = 'none';
    assistantAvatar.setAttribute('tabindex', '0');
    assistantAvatar.setAttribute('role', 'button');
    assistantAvatar.setAttribute('aria-label', 'Arrastra para mover el asistente; pulsa para ampliar o reducir');
    assistantAvatar.title = 'Arrastra para moverme; pulsa para ampliar o reducir';
    assistantAvatar.addEventListener('pointerdown', event => {
      draggingAvatar = true;
      avatarMoved = false;
      pointerStartX = event.clientX - avatarX;
      pointerStartY = event.clientY - avatarY;
      assistantAvatar.setPointerCapture(event.pointerId);
      assistantAvatar.style.cursor = 'grabbing';
      event.preventDefault();
    });
    assistantAvatar.addEventListener('pointermove', event => {
      if (!draggingAvatar) return;
      const nextX = event.clientX - pointerStartX;
      const nextY = event.clientY - pointerStartY;
      if (Math.abs(nextX - avatarX) + Math.abs(nextY - avatarY) > 4) avatarMoved = true;
      avatarX = nextX;
      avatarY = nextY;
      applyAvatarTransform();
    });
    function applyAvatarTransform() {
      assistantAvatar.style.transform = 'translate(' + avatarX + 'px, ' + avatarY + 'px) scale(' + (assistantAvatar.classList.contains('is-enlarged') ? '1.22' : '1') + ')';
    }
    function stopAvatarDrag() {
      draggingAvatar = false;
      assistantAvatar.style.cursor = 'grab';
    }
    assistantAvatar.addEventListener('pointerup', stopAvatarDrag);
    assistantAvatar.addEventListener('pointercancel', stopAvatarDrag);
    assistantAvatar.addEventListener('click', () => {
      if (avatarMoved) { avatarMoved = false; return; }
      assistantAvatar.classList.toggle('is-enlarged');
      applyAvatarTransform();
    });
    assistantAvatar.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        assistantAvatar.classList.toggle('is-enlarged');
        applyAvatarTransform();
      }
    });
  }

  const DRAFT_DB = 'itin-campus-drafts-v1';
  const DRAFT_STORE = 'solicitud';
  const DRAFT_KEY = 'solicitud-actual';
  let draftDbPromise;
  function openDraftDb() {
    if (!('indexedDB' in window)) return Promise.reject(new Error('Este navegador no permite guardar el borrador.'));
    if (!draftDbPromise) draftDbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DRAFT_DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(DRAFT_STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return draftDbPromise;
  }
  async function draftTransaction(mode, action) {
    const db = await openDraftDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DRAFT_STORE, mode);
      const store = tx.objectStore(DRAFT_STORE);
      let result;
      try { result = action(store); } catch (error) { reject(error); return; }
      tx.oncomplete = () => resolve(result && result.result);
      tx.onerror = () => reject(tx.error || new Error('No se pudo guardar el borrador.'));
      tx.onabort = () => reject(tx.error || new Error('Se canceló el guardado local.'));
    });
  }
  function collectDraft() {
    const fields = {};
    [...form.elements].forEach(field => {
      if (!field.name || field.type === 'file' || field.type === 'submit' || field.type === 'button') return;
      if (field.type === 'checkbox' || field.type === 'radio') {
        if (field.name === 'Confirmacion') return;
        fields[field.name] = field.checked;
      } else fields[field.name] = field.value;
    });
    // Guardar también las respuestas que se generan dinámicamente desde la API.
    questionBox.querySelectorAll('textarea[data-question-id]').forEach(field => {
      if (field.name) fields[field.name] = field.value;
    });
    return {fields, currentStep, savedAt: new Date().toISOString()};
  }
  let saveDraftTimer;
  async function saveDraft() {
    if (!form) return;
    clearTimeout(saveDraftTimer);
    saveDraftTimer = setTimeout(async () => {
      try {
        const draft = collectDraft();
        // Store selected image blobs in IndexedDB too, so a refresh does not discard the chosen files.
        draft.files = [];
        for (const input of form.querySelectorAll('.document-input')) {
          const file = input.files && input.files[0];
          if (file) draft.files.push({name:input.name,fileName:file.name,type:file.type,lastModified:file.lastModified,blob:file});
        }
        await draftTransaction('readwrite', store => store.put(draft, DRAFT_KEY));
        if (cacheStatus) cacheStatus.textContent = 'Avance guardado en este dispositivo · ' + new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
      } catch (error) {
        if (cacheStatus) cacheStatus.textContent = 'No se pudo guardar automáticamente. Mantén esta pestaña abierta y vuelve a intentarlo.';
        console.warn('No se pudo guardar el borrador local:', error);
      }
    }, 350);
  }
  async function restoreDraft() {
    try {
      const draft = await draftTransaction('readonly', store => store.get(DRAFT_KEY));
      if (!draft) return;
      pendingDraftFields = draft.fields || {};
      Object.entries(draft.fields || {}).forEach(([name, value]) => {
        const fields = [...form.elements].filter(field => field.name === name);
        fields.forEach(field => {
          if (field.type === 'checkbox' || field.type === 'radio') field.checked = Boolean(value);
          else if (field.type !== 'file') field.value = value;
        });
      });
      for (const saved of (draft.files || [])) {
        const input = [...form.querySelectorAll('.document-input')].find(field => field.name === saved.name);
        if (input && saved.blob) {
          try {
            const restoredFile = new File([saved.blob], saved.fileName, {type:saved.type,lastModified:saved.lastModified});
            const transfer = new DataTransfer();
            transfer.items.add(restoredFile);
            input.files = transfer.files;
            const small = input.closest('.upload-card').querySelector('small');
            if (small) small.textContent = saved.fileName + ' · recuperado del borrador';
            refreshUploadCard(input);
          } catch (error) { console.warn('El navegador no permitió restaurar un archivo:', error); }
        }
      }
      currentStep = Number.isInteger(draft.currentStep) ? draft.currentStep : 0;
      loadedProgram = '';
      updateStep();
      updateInterviewForProgram();
      if (cacheStatus) cacheStatus.textContent = 'Recuperamos tu avance guardado el ' + new Date(draft.savedAt).toLocaleString();
    } catch (error) {
      if (cacheStatus) cacheStatus.textContent = 'El guardado local no está disponible en este navegador.';
      console.warn('No se pudo recuperar el borrador:', error);
    }
  }
  async function clearDraftAfterConfirmedSave() {
    await draftTransaction('readwrite', store => store.delete(DRAFT_KEY));
    if (cacheStatus) cacheStatus.textContent = 'Solicitud confirmada. El borrador local se eliminó de este dispositivo.';
  }
  form.addEventListener('input', saveDraft);
  form.addEventListener('change', saveDraft);
  questionBox.addEventListener('input', saveDraft);
  questionBox.addEventListener('change', saveDraft);
  window.addEventListener('beforeunload', () => { if (saveDraftTimer) clearTimeout(saveDraftTimer); });

  const assistantPanel = document.getElementById('assistant-panel');
  document.getElementById('assistant-launcher').addEventListener('click', () => {
    assistantPanel.hidden = !assistantPanel.hidden;
  });
  document.getElementById('assistant-close').addEventListener('click', () => {
    assistantPanel.hidden = true;
  });
  const replies = {
    programas: 'ITIN ofrece tres opciones de formación. El Bachillerato en Teología permite construir una base sólida en el estudio bíblico y los fundamentos de la teología cristiana. La Licenciatura profundiza en la reflexión teológica y fortalece las herramientas para la enseñanza y el servicio ministerial. La Maestría ofrece formación avanzada orientada al análisis, la enseñanza y el liderazgo cristiano. Para conocer los requisitos específicos y la documentación requerida, consulta directamente con el instituto.',
    solicitud: 'La solicitud se completa por etapas: datos personales, información de la iglesia, documentos y preguntas de entrevista cuando correspondan al programa. Puedes volver a las etapas anteriores antes de confirmar la solicitud. Revisa cuidadosamente tus respuestas y los archivos adjuntos; puedes quitar o reemplazar un archivo antes de enviar.',
    proceso: 'Enviar una solicitud no significa que la persona ya haya sido admitida ni matriculada. La información será revisada por el instituto y, después de esa revisión, la institución comunicará los siguientes pasos. La matrícula y los procesos académicos o financieros son etapas posteriores y no forman parte de esta solicitud pública.'
  };
  document.querySelectorAll('[data-help]').forEach(button => button.addEventListener('click', () => {
    document.getElementById('assistant-reply').textContent = replies[button.dataset.help];
  }));

  restoreDraft().finally(() => { readHash(); updateGuide(); updateInterviewForProgram(); });



  // Inicio de sesión administrativo con Google; la autorización la decide Apps Script.
  const adminLoginPanel = document.getElementById('admin-login-panel');
  const adminLoginStatus = document.getElementById('admin-login-status');
  const adminSessionEmail = document.getElementById('admin-session-email');
  const adminSignout = document.getElementById('admin-signout');
  let adminCredential = '';
  let adminLoginPending = false;
  const GOOGLE_CLIENT_ID = '900827008031-kfcnsnkalp84tebdua5h7v7ci10b8g4c.apps.googleusercontent.com';

  function setAdminStatus(message, state) {
    if (!adminLoginStatus) return;
    adminLoginStatus.textContent = message;
    adminLoginStatus.dataset.state = state || 'neutral';
  }

  function resetAdminSession(message) {
    adminCredential = '';
    if (adminLoginPanel) adminLoginPanel.hidden = false;
    if (adminDashboard) adminDashboard.hidden = true;
    if (adminSessionEmail) adminSessionEmail.textContent = '';
    if (adminModuleView) adminModuleView.hidden = true;
    const grid = adminDashboard && adminDashboard.querySelector('.admin-card-grid');
    if (grid) grid.hidden = false;
    setAdminStatus(message || 'Inicia sesión con Google para verificar tu autorización.', 'neutral');
  }

  async function verifyAdminCredential(credential) {
    if (adminLoginPending) return;
    adminLoginPending = true;
    setAdminStatus('Verificando tu cuenta con el servidor…', 'neutral');
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ accion: 'adminLogin', credential }),
        redirect: 'follow'
      });
      const raw = await response.text();
      let result;
      try { result = JSON.parse(raw); } catch (_) {
        throw new Error('El servidor no devolvió JSON válido. Revisa la implementación publicada de Apps Script.');
      }
      if (!response.ok || result.ok !== true || !result.email) {
        resetAdminSession(result.error || result.mensaje || 'El servidor no autorizó esta cuenta.');
        setAdminStatus(result.error || result.mensaje || 'El servidor no autorizó esta cuenta.', 'error');
        return;
      }
      adminCredential = credential;
      if (adminSessionEmail) adminSessionEmail.textContent = result.email;
      if (adminLoginPanel) adminLoginPanel.hidden = true;
      if (adminDashboard) adminDashboard.hidden = false;
      setAdminStatus('Identidad verificada por el servidor.', 'success');
    } catch (error) {
      resetAdminSession(error.message || 'No se pudo verificar la cuenta. Inténtalo de nuevo.');
      setAdminStatus(error.message || 'No se pudo verificar la cuenta. Inténtalo de nuevo.', 'error');
      console.error('Error verificando acceso administrativo ITIN:', error);
    } finally {
      adminLoginPending = false;
    }
  }

  function initializeAdminGoogleSignIn() {
    const button = document.getElementById('google-login-button');
    if (!button || !adminLoginStatus) return;
    if (!window.google || !window.google.accounts || !window.google.accounts.id) {
      setAdminStatus('No se pudo cargar el inicio de sesión de Google. Recarga la página e inténtalo de nuevo.', 'error');
      return;
    }
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response) => {
        if (!response || !response.credential) {
          setAdminStatus('Google no entregó una credencial válida.', 'error');
          return;
        }
        verifyAdminCredential(response.credential);
      },
      auto_select: false,
      cancel_on_tap_outside: true
    });
    button.replaceChildren();
    window.google.accounts.id.renderButton(button, {
      type: 'standard', theme: 'outline', size: 'large',
      text: 'signin_with', shape: 'rectangular', width: 280, locale: 'es'
    });
  }

  const googleIdentityScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
  if (!initializeAdminGoogleSignIn() && googleIdentityScript) {
    googleIdentityScript.addEventListener('load', initializeAdminGoogleSignIn, { once: true });
    googleIdentityScript.addEventListener('error', () => {
      setAdminStatus('No se pudo cargar Google. Comprueba la conexión e inténtalo de nuevo.', 'error');
    }, { once: true });
  }

  if (adminSignout) {
    adminSignout.addEventListener('click', () => {
      resetAdminSession('Sesión cerrada en esta página.');
      if (window.google && window.google.accounts && window.google.accounts.id) {
        window.google.accounts.id.disableAutoSelect();
      }
    });
  }

  // Módulo Solicitudes: consulta de estudiantes en modo de solo lectura.
  const adminModuleInfo = {
    solicitudes: { kicker: '01 / ADMISIONES', title: 'Solicitudes y consultas', description: 'Solicitudes de ingreso, documentos y consulta de estudiantes activos e historial.' },
    matriculas: { kicker: '02 / REGISTRO', title: 'Matrículas', description: 'Registro y consulta de matrículas por estudiante, programa y período.' },
    pagos: { kicker: '03 / FINANZAS', title: 'Gestión de pagos', description: 'Registro de pagos, recibos, cargos y saldos pendientes.' },
    academico: { kicker: '04 / CONFIGURACIÓN', title: 'Control académico', description: 'Administración de programas, asignaturas, profesores y precios.' }
  };
  const adminDashboard = document.querySelector('#admin-dashboard');
  const adminModuleView = document.querySelector('#admin-module-view');
  const adminModuleCards = document.querySelectorAll('[data-admin-module]');
  const adminBackButton = document.querySelector('#admin-back-dashboard');
  const adminSolicitudesTools = document.querySelector('#admin-solicitudes-tools');
  const adminModulePlaceholder = document.querySelector('#admin-module-placeholder');
  const adminStudentSearch = document.querySelector('#admin-student-search');
  const adminRefreshStudents = document.querySelector('#admin-refresh-students');
  const adminDataStatus = document.querySelector('#admin-data-status');
  const adminStudentsHead = document.querySelector('#admin-students-head');
  const adminStudentsBody = document.querySelector('#admin-students-body');
  let adminStudents = [];

  function setAdminDataStatus(message, error) {
    if (!adminDataStatus) return;
    adminDataStatus.textContent = message;
    adminDataStatus.dataset.state = error ? 'error' : 'neutral';
  }

  function readNotionProperty(value) {
    if (value == null) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return value.map(readNotionProperty).filter(Boolean).join(', ');
    if (typeof value === 'object') {
      if (value.title) return readNotionProperty(value.title);
      if (value.rich_text) return readNotionProperty(value.rich_text);
      if (value.name) return readNotionProperty(value.name);
      if (value.plain_text) return value.plain_text;
      if (value.number != null) return String(value.number);
      if (value.email) return value.email;
      if (value.phone_number) return value.phone_number;
      if (value.select) return readNotionProperty(value.select);
      if (value.status) return readNotionProperty(value.status);
      if (value.date) return readNotionProperty(value.date.start || value.date);
      if (value.start) return String(value.start);
      if (value.url) return value.url;
      if (value.formula) return readNotionProperty(value.formula);
      if (value.checkbox != null) return value.checkbox ? 'Sí' : 'No';
      if (value.type && value[value.type] != null) return readNotionProperty(value[value.type]);
      if (value.id && Object.keys(value).length <= 3) return '';
      return '';
    }
    return '';
  }

  function studentField(student, key) {
    const properties = student && (student.properties || student.propiedades || student);
    if (!properties || typeof properties !== 'object') return '';
    const aliases = {
      nombre: ['NombreCompleto', 'Nombre completo', 'Nombre', 'title'],
      cedula: ['Cedula', 'Cédula', 'CedulaDigital'],
      correo: ['Correo', 'Email', 'Correo electrónico'],
      celular: ['Celular', 'Teléfono', 'Telefono'],
      programa: ['Programa', 'Programa solicitado'],
      fecha: ['FechaEntrevista', 'Fecha de entrevista', 'Created', 'created_time'],
      estado: ['Estado', 'EstadoSolicitud', 'Estado de solicitud']
    };
    for (const name of aliases[key] || []) {
      if (properties[name] != null) {
        const value = readNotionProperty(properties[name]);
        if (value) return value;
      }
    }
    if (key === 'nombre' && student && student.title) return readNotionProperty(student.title);
    if (key === 'fecha' && student && student.created_time) return String(student.created_time).slice(0, 10);
    return '';
  }

  function renderAdminStudents() {
    if (!adminStudentsHead || !adminStudentsBody) return;
    const columns = [
      ['nombre', 'Estudiante'], ['cedula', 'Cédula'], ['correo', 'Correo'],
      ['celular', 'Teléfono'], ['programa', 'Programa'], ['fecha', 'Fecha'], ['estado', 'Estado']
    ];
    adminStudentsHead.replaceChildren();
    const headerRow = document.createElement('tr');
    columns.forEach(([, label]) => {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = label;
      headerRow.appendChild(th);
    });
    adminStudentsHead.appendChild(headerRow);
    const query = (adminStudentSearch && adminStudentSearch.value || '').trim().toLocaleLowerCase();
    const visible = adminStudents.filter(student => columns.some(([key]) =>
      studentField(student, key).toLocaleLowerCase().includes(query)
    ));
    adminStudentsBody.replaceChildren();
    if (!visible.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = columns.length;
      td.textContent = adminStudents.length ? 'No hay registros que coincidan con la búsqueda.' : 'No se encontraron solicitudes en los registros devueltos.';
      tr.appendChild(td);
      adminStudentsBody.appendChild(tr);
      return;
    }
    visible.forEach(student => {
      const tr = document.createElement('tr');
      tr.className = 'admin-student-row';
      tr.tabIndex = 0;
      tr.setAttribute('role', 'button');
      tr.setAttribute('aria-label', 'Abrir expediente de ' + (studentField(student, 'nombre') || 'estudiante'));
      tr.title = 'Abrir expediente del estudiante';
      columns.forEach(([key]) => {
        const td = document.createElement('td');
        td.textContent = studentField(student, key) || '—';
        tr.appendChild(td);
      });
      const open = () => openAdminStudentDetail(student);
      tr.addEventListener('click', open);
      tr.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
      });
      adminStudentsBody.appendChild(tr);
    });
    setAdminDataStatus('Registros recibidos: ' + adminStudents.length + '. Coincidencias: ' + visible.length + '.', false);
  }

  async function loadAdminStudents() {
    if (!adminCredential) {
      setAdminDataStatus('Tu sesión no tiene una credencial activa. Cierra sesión e inicia de nuevo.', true);
      return;
    }
    if (adminRefreshStudents) adminRefreshStudents.disabled = true;
    setAdminDataStatus('Consultando estudiantes autorizados…', false);
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ accion: 'adminConsulta', credential: adminCredential, tipo: 'estudiantes', limite: 100 }),
        redirect: 'follow'
      });
      const raw = await response.text();
      let result;
      try { result = JSON.parse(raw); } catch (_) { throw new Error('La API no devolvió JSON válido.'); }
      if (!response.ok || result.ok !== true) throw new Error(result.error || result.mensaje || 'El servidor rechazó la consulta.');
      const data = result.datos || result.data || result.registros || result.estudiantes || [];
      adminStudents = Array.isArray(data) ? data : (Array.isArray(data.registros) ? data.registros : []);
      renderAdminStudents();
      setAdminDataStatus('Consulta completada. Registros recibidos: ' + adminStudents.length + '.', false);
    } catch (error) {
      adminStudents = [];
      renderAdminStudents();
      setAdminDataStatus(error.message || 'No se pudieron consultar los estudiantes.', true);
      console.error('Error consultando estudiantes ITIN:', error);
    } finally {
      if (adminRefreshStudents) adminRefreshStudents.disabled = false;
    }
  }

  if (adminStudentSearch) adminStudentSearch.addEventListener('input', renderAdminStudents);
  if (adminRefreshStudents) adminRefreshStudents.addEventListener('click', loadAdminStudents);

  adminModuleCards.forEach((card) => {
    card.addEventListener('click', () => {
      const info = adminModuleInfo[card.dataset.adminModule];
      if (!info || !adminModuleView) return;
      document.querySelector('#admin-module-kicker').textContent = info.kicker;
      document.querySelector('#admin-module-title').textContent = info.title;
      document.querySelector('#admin-module-description').textContent = info.description;
      adminDashboard.querySelector('.admin-card-grid').hidden = true;
      adminModuleView.hidden = false;
      const isSolicitudes = card.dataset.adminModule === 'solicitudes';
      if (adminSolicitudesTools) adminSolicitudesTools.hidden = !isSolicitudes;
      if (adminModulePlaceholder) adminModulePlaceholder.hidden = isSolicitudes;
      if (isSolicitudes) loadAdminStudents();
    });
  });
  if (adminBackButton && adminModuleView && adminDashboard) {
    adminBackButton.addEventListener('click', () => {
      adminModuleView.hidden = true;
      adminDashboard.querySelector('.admin-card-grid').hidden = false;
    });
  }


  // Expediente individual imprimible. Todas las consultas son de solo lectura.
  const adminDetailOverlay = document.querySelector('#admin-student-detail');
  const adminDetailTitle = document.querySelector('#admin-detail-title');
  const adminDetailStatus = document.querySelector('#admin-detail-status');
  const adminDetailContent = document.querySelector('#admin-detail-content');
  const adminDetailPrint = document.querySelector('#admin-detail-print');
  let activeAdminStudent = null;
  let activeAdminDocuments = [];
  let activeAdminAnswers = [];
  let activeAdminQuestions = [];

  function getProperties(record) {
    return record && (record.properties || record.propiedades || record) || {};
  }

  function fieldValue(record, names) {
    const props = getProperties(record);
    for (const name of names) {
      if (props[name] != null) {
        const value = readNotionProperty(props[name]);
        if (value) return value;
      }
    }
    return '';
  }

  function plainNotionText(value) {
    if (value == null) return '';
    if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
    if (Array.isArray(value)) return value.map(plainNotionText).filter(Boolean).join('');
    if (typeof value !== 'object') return '';
    if (typeof value.plain_text === 'string') return value.plain_text.trim();
    if (typeof value.content === 'string') return value.content.trim();
    for (const key of ['title','rich_text','text','Pregunta','pregunta','value']) {
      if (value[key] != null) {
        const text = plainNotionText(value[key]);
        if (text) return text;
      }
    }
    if (value.type && value[value.type] != null) return plainNotionText(value[value.type]);
    return '';
  }

  function normalizedQuestionKey(value) {
    return String(value || '').trim().toLocaleLowerCase().replace(/\\s+/g, '');
  }

  function recordId(record) {
    return record && (record.id || record.ID || record.idNotion || record.page_id) || '';
  }

  function relationIds(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(item => typeof item === 'string' ? item : (item.id || item.page_id || '')).filter(Boolean);
    if (typeof value === 'string') return [value];
    if (typeof value === 'object') {
      const rel = value.relation || value;
      if (Array.isArray(rel)) return rel.map(item => item.id || item.page_id || '').filter(Boolean);
      if (rel.id || rel.page_id) return [rel.id || rel.page_id];
    }
    return [];
  }

  function relationLabels(value) {
    if (!value) return [];
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) return value.flatMap(relationLabels);
    if (typeof value === 'object') {
      const output = [];
      for (const key of ['title','name','plain_text','rich_text','title_text','display_value']) {
        if (value[key]) output.push(...relationLabels(value[key]));
      }
      for (const key of ['relation','results','items','value']) {
        if (value[key]) output.push(...relationLabels(value[key]));
      }
      return [...new Set(output)];
    }
    return [];
  }

  function inferProgramFromAnswers(answers, student) {
    const matching = answers.filter(answer => belongsToStudent(answer, student));
    for (const answer of matching) {
      const props = getProperties(answer);
      const value = props.IdPreg_entrevista || props.IdPregEntrevista;
      const labels = relationLabels(value).concat(fieldValue(answer, ['IdPreg_entrevista','IdPregEntrevista']));
      for (const label of labels) {
        const key = String(label).trim().toLowerCase();
        if (/^bach\d+/i.test(key) || /^bach/i.test(key)) return 'Bachillerato';
        if (/^lic\d+/i.test(key) || /^lic/i.test(key)) return 'Licenciatura';
        if (/^mae|^maa|^mast/i.test(key)) return 'Maestría';
      }
    }
    return '';
  }

  function belongsToStudent(record, student) {
    const id = recordId(student);
    if (!id) return false;
    const props = getProperties(record);
    return Object.entries(props).some(([key, value]) => {
      if (!/estudiante|alumno|nombrecompleto|ide/i.test(key)) return false;
      const ids = relationIds(value);
      return ids.includes(id) || (typeof value === 'string' && value === id);
    });
  }

  function detailDisplayValue(value) {
    const display = readNotionProperty(value);
    if (display) return display;
    if (value && typeof value === 'object' && value.files) {
      return value.files.map(file => file.name || file.external?.url || file.file?.url || '').filter(Boolean).join(', ');
    }
    return '';
  }

  const adminProfilePhotoFrame = document.querySelector('#admin-profile-photo-frame');
  const adminProfilePhotoInput = document.querySelector('#admin-profile-photo-input');
  const adminProfilePhotoStatus = document.querySelector('#admin-profile-photo-status');
  let selectedProfilePhotoUrl = '';
  let selectedProfilePhotoFile = null;

  function notionFiles(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.flatMap(item => notionFiles(item).length ? notionFiles(item) : (item && typeof item === 'object' && (item.file?.url || item.external?.url || item.url) ? [item] : []));
    if (typeof value === 'string') return /^https:\/\//i.test(value) ? [{ name: 'Documento adjunto', url: value }] : [];
    if (typeof value === 'object') {
      if (Array.isArray(value.files)) return value.files;
      if (value.type === 'files' && Array.isArray(value.files)) return value.files;
      if (value.file?.url || value.external?.url || value.url) return [value];
      // A veces la API devuelve la propiedad Notion completa: {type:"files", files:[...]}
      // y otras veces envuelve el contenido dentro de la clave del tipo.
      for (const key of ['value','data','content','file','files']) {
        if (value[key] && value[key] !== value) {
          const found = notionFiles(value[key]);
          if (found.length) return found;
        }
      }
    }
    return [];
  }

  function notionFileUrl(file) {
    return file && (file.file?.url || file.external?.url || file.url || '') || '';
  }

  function renderProfilePhoto(student, documents) {
    if (!adminProfilePhotoFrame) return;
    adminProfilePhotoFrame.replaceChildren();
    const studentProps = getProperties(student);
    let files = [];
    for (const key of ['Fotoperfil','FotoPerfil','Foto de perfil','Foto','Fotografía']) {
      files = notionFiles(studentProps[key]);
      if (files.length) break;
    }
    if (!files.length) {
      for (const doc of documents || []) {
        if (!belongsToStudent(doc, student)) continue;
        const props = getProperties(doc);
        for (const key of ['Fotoperfil','FotoPerfil','Foto de perfil','Foto','Fotografía']) {
          files = notionFiles(props[key]);
          if (files.length) break;
        }
        if (files.length) break;
      }
    }
    const candidate = files.find(file => notionFileUrl(file)) || null;
    const url = selectedProfilePhotoUrl || (candidate ? notionFileUrl(candidate) : '');
    if (url) {
      const img = document.createElement('img');
      img.className = 'admin-profile-photo';
      img.alt = 'Foto de perfil del estudiante';
      img.src = url;
      img.referrerPolicy = 'no-referrer';
      adminProfilePhotoFrame.appendChild(img);
      if (adminProfilePhotoStatus) adminProfilePhotoStatus.textContent = selectedProfilePhotoFile
        ? 'Vista previa local. Esta foto todavía no se ha guardado en Notion.'
        : 'Foto encontrada en el registro del estudiante o sus documentos.';
    } else {
      const empty = document.createElement('div');
      empty.className = 'admin-profile-photo-placeholder';
      const plus = document.createElement('span'); plus.textContent = '+';
      const title = document.createElement('strong'); title.textContent = 'Sin foto de perfil';
      const note = document.createElement('small'); note.textContent = 'Puedes seleccionar una imagen abajo';
      empty.append(plus,title,note);
      adminProfilePhotoFrame.appendChild(empty);
      if (adminProfilePhotoStatus) adminProfilePhotoStatus.textContent = 'No se encontró una foto guardada en los campos Fotoperfil/Fotoperfil de los datos consultados.';
    }
  }

  if (adminProfilePhotoInput) adminProfilePhotoInput.addEventListener('change', () => {
    const file = adminProfilePhotoInput.files && adminProfilePhotoInput.files[0];
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
      if (adminProfilePhotoStatus) adminProfilePhotoStatus.textContent = 'Formato no válido. Selecciona JPG, PNG o WEBP.';
      adminProfilePhotoInput.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      if (adminProfilePhotoStatus) adminProfilePhotoStatus.textContent = 'La imagen no debe superar 5 MB.';
      adminProfilePhotoInput.value = '';
      return;
    }
    selectedProfilePhotoFile = file;
    if (selectedProfilePhotoUrl) URL.revokeObjectURL(selectedProfilePhotoUrl);
    selectedProfilePhotoUrl = URL.createObjectURL(file);
    renderProfilePhoto(activeAdminStudent, activeAdminDocuments);
  });

  function makeDetailSection(title, rows, pageClass) {
    const section = document.createElement('section');
    section.className = 'admin-detail-page ' + (pageClass || '');
    const heading = document.createElement('h4');
    heading.textContent = title;
    section.appendChild(heading);
    const dl = document.createElement('dl');
    dl.className = 'admin-detail-fields';
    rows.forEach(([label, value]) => {
      const wrap = document.createElement('div');
      const dt = document.createElement('dt'); dt.textContent = label;
      const dd = document.createElement('dd'); dd.textContent = value || '—';
      wrap.append(dt, dd); dl.appendChild(wrap);
    });
    section.appendChild(dl);
    return section;
  }

  function makeDocumentSection(title, doc, names) {
    const section = document.createElement('section');
    section.className = 'admin-detail-page';
    const heading = document.createElement('h4');
    heading.textContent = title;
    section.appendChild(heading);
    if (!doc) {
      const p = document.createElement('p');
      p.textContent = 'No se encontró un registro de documento asociado en los datos consultados.';
      section.appendChild(p);
      return section;
    }

    const props = getProperties(doc);
    let found = false;
    names.forEach(name => {
      if (props[name] == null) return;
      found = true;
      const value = props[name];
      const files = value && value.files;
      const label = document.createElement('h5');
      label.className = 'admin-document-label';
      label.textContent = name === 'CedulaFrente' ? 'Cédula · frente' :
        name === 'CedulaReverso' ? 'Cédula · reverso' :
        name === 'Fotoperfil' ? 'Fotografía de perfil' :
        name === 'SubirDiploma' ? 'Diploma o constancia académica' : name;
      section.appendChild(label);

      if (Array.isArray(files) && files.length) {
        const gallery = document.createElement('div');
        gallery.className = 'admin-document-gallery';
        files.forEach(file => {
          const url = file && (file.file?.url || file.external?.url || file.url) || '';
          const fileName = file && file.name || 'Documento adjunto';
          const isImage = /\.(png|jpe?g|webp|gif)(?:$|[?#])/i.test(fileName) ||
            /^image\/(png|jpeg|webp|gif)$/i.test(file && file.type || '');
          if (url && /^https:\/\//i.test(url) && isImage) {
            const figure = document.createElement('figure');
            figure.className = 'admin-document-figure';
            const image = document.createElement('img');
            image.src = url;
            image.alt = label.textContent;
            image.loading = 'eager';
            image.addEventListener('error', () => {
              figure.classList.add('admin-document-image-error');
              image.remove();
              const errorText = document.createElement('p');
              errorText.textContent = 'No se pudo mostrar la imagen. Abre el archivo para comprobar el acceso.';
              figure.appendChild(errorText);
            }, { once: true });
            figure.appendChild(image);
            const caption = document.createElement('figcaption');
            caption.textContent = fileName;
            figure.appendChild(caption);
            gallery.appendChild(figure);
          } else if (url && /^https:\/\//i.test(url)) {
            const link = document.createElement('a');
            link.href = url;
            link.target = '_blank';
            link.rel = 'noopener';
            link.textContent = 'Abrir ' + fileName;
            link.className = 'admin-document-file-link';
            gallery.appendChild(link);
          } else {
            const unavailable = document.createElement('p');
            unavailable.textContent = fileName + ' (enlace no disponible)';
            gallery.appendChild(unavailable);
          }
        });
        section.appendChild(gallery);
      } else {
        const line = document.createElement('p');
        line.textContent = detailDisplayValue(value) || 'Sin archivo adjunto';
        section.appendChild(line);
      }
    });
    if (!found) {
      const p = document.createElement('p');
      p.textContent = 'El registro asociado no contiene los campos esperados: ' + names.join(', ') + '.';
      section.appendChild(p);
    }
    return section;
  }

  function showDetailStatus(message, error) {
    if (!adminDetailStatus) return;
    adminDetailStatus.textContent = message;
    adminDetailStatus.dataset.state = error ? 'error' : 'neutral';
  }

  async function adminConsulta(tipo) {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ accion: 'adminConsulta', credential: adminCredential, tipo, limite: 100 }),
      redirect: 'follow'
    });
    const raw = await response.text();
    let result;
    try { result = JSON.parse(raw); } catch (_) { throw new Error('La API no devolvió JSON válido al consultar ' + tipo + '.'); }
    if (!response.ok || result.ok !== true) throw new Error(result.error || result.mensaje || 'El servidor rechazó la consulta ' + tipo + '.');
    const data = result.datos || result.data || result.registros || result[tipo] || [];
    return Array.isArray(data) ? data : (Array.isArray(data.registros) ? data.registros : []);
  }

  function renderAdminStudentDetail(student) {
    if (!adminDetailContent) return;
    adminDetailContent.replaceChildren();
    const studentProps = getProperties(student);
    const studentFieldOrder = [
      'NombreCompleto','Nombre completo','Nombre','Cedula','Cédula','FechaNac','Fecha de nacimiento','Edad',
      'Correo','Celular','Departamento','Municipio','Dirección','Direccion','EstadoCivil','Estado civil',
      'Profesión','Profesion','Escolaridad','GradoAprobado','Cargo','Asociación','Asociacion',
      'NombrePastor','Iglesia','Programa','FechaEntrevista','Estado','Observaciones'
    ];
    const orderedNames = [];
    studentFieldOrder.forEach(name => {
      const actual = Object.keys(studentProps).find(key => key.toLocaleLowerCase() === name.toLocaleLowerCase());
      if (actual && !orderedNames.includes(actual)) orderedNames.push(actual);
    });
    Object.keys(studentProps).forEach(name => { if (!orderedNames.includes(name)) orderedNames.push(name); });
    const rows = orderedNames.map(name => [name, detailDisplayValue(studentProps[name])]).filter(([,value]) => value);
    const programName = fieldValue(student, ['Programa','Programa solicitado','ProgramaAcademico','Carrera']);
    if (programName) rows.unshift(['Programa solicitado', programName]);
    adminDetailContent.appendChild(makeDetailSection('Página 1 · Datos del estudiante e información de la iglesia', rows, 'print-student-page'));

    const matchingDocs = activeAdminDocuments.filter(doc => belongsToStudent(doc, student));
    const docRecord = matchingDocs.find(doc => {
      const p = getProperties(doc);
      return p.CedulaFrente != null || p.CedulaReverso != null || p.CedulaFrente?.files || p.CedulaReverso?.files;
    }) || matchingDocs[0] || null;
    adminDetailContent.appendChild(makeDocumentSection('Página 2 · Documentos de identidad', docRecord, ['CedulaFrente','CedulaReverso']));
    const diplomaRecord = matchingDocs.find(doc => {
      const p = getProperties(doc);
      return p.SubirDiploma != null || p.DiplomaDigital != null;
    }) || docRecord;
    adminDetailContent.appendChild(makeDocumentSection('Página 3 · Diploma o constancia académica', diplomaRecord, ['SubirDiploma','DiplomaDigital']));

    const answerPage = document.createElement('section');
    answerPage.className = 'admin-detail-page print-answers-page';
    const programForAnswers = fieldValue(student, ['Programa','Programa solicitado','ProgramaAcademico','Carrera']) ||
      activeAdminAnswers.map(answer => fieldValue(answer, ['Programa','Programa solicitado','ProgramaAcademico','Carrera'])).find(Boolean) || 'No indicado en los datos devueltos';
    const answerHeading = document.createElement('h4');
    answerHeading.textContent = 'Página 4 · Preguntas y respuestas de entrevista';
    answerPage.appendChild(answerHeading);
    const programLine = document.createElement('p');
    programLine.className = 'admin-answer-program';
    programLine.textContent = 'Programa: ' + programForAnswers;
    answerPage.appendChild(programLine);
    const questionIndex = new Map();
    activeAdminQuestions.forEach((question, index) => {
      const props = getProperties(question);
      const id = recordId(question);
      const identifier = fieldValue(question, ['IdPreg_entrevista','IdPregEntrevista','IdPregunta','Código','Codigo','Name','Nombre']) ||
        plainNotionText(question.title || question.Title);
      const title = fieldValue(question, ['Pregunta','PreguntaTexto','NombrePregunta','Enunciado','Question','TextoPregunta','TituloPregunta','title']) ||
        plainNotionText(props.Pregunta) || plainNotionText(props.pregunta) ||
        Object.entries(props).filter(([key]) => /^(pregunta|enunciado|question|textopregunta|titulopregunta)$/i.test(key))
          .map(([,value]) => plainNotionText(value)).find(Boolean) || '';
      const item = { title, props, index, identifier };
      if (id) questionIndex.set(normalizedQuestionKey(id), item);
      if (identifier) questionIndex.set(normalizedQuestionKey(identifier), item);
      const pageTitle = plainNotionText(question.title || question.Title);
      if (pageTitle) questionIndex.set(normalizedQuestionKey(pageTitle), item);
    });
    const matchingAnswers = activeAdminAnswers.filter(answer => belongsToStudent(answer, student));
    const answerItems = matchingAnswers.map((answer, index) => {
      const props = getProperties(answer);
      const questionValue = props.IdPreg_entrevista || props.IdPregEntrevista || props.PreguntaRelacionada || props.PreguntaID || props.Preguntas || props.Pregunta;
      const relationIdsList = [...relationIds(questionValue), ...relationLabels(questionValue)];
      const questionIdentifier = fieldValue(answer, ['IdPreg_entrevista','IdPregEntrevista']);
      if (questionIdentifier) relationIdsList.push(questionIdentifier);
      let relatedQuestion = null;
      for (const id of relationIdsList) {
        const key = normalizedQuestionKey(id);
        if (questionIndex.has(key)) { relatedQuestion = questionIndex.get(key); break; }
      }
      if (!relatedQuestion) {
        const matchingKey = [...questionIndex.keys()].find(key =>
          relationIdsList.some(value => normalizedQuestionKey(value) === key));
        if (matchingKey) relatedQuestion = questionIndex.get(matchingKey);
      }
      const directQuestion = fieldValue(answer, ['PreguntaTexto','NombrePregunta','Enunciado','Question','TextoPregunta','TituloPregunta']);
      const questionNumberValue = fieldValue(answer, ['Orden','OrdenPregunta','NumeroPregunta','NroPregunta','NumPregunta','Numero','Número']);
      const questionNumber = Number(questionNumberValue);
      const resolvedQuestion = directQuestion || (relatedQuestion && relatedQuestion.title) || '';
      const identifierForNumber = questionIdentifier || relationLabels(questionValue).join(' ') || (relatedQuestion && relatedQuestion.identifier) || '';
      const embeddedNumber = String(identifierForNumber).match(/(?:bach|lic|mae|mast)0*(\d+)/i);
      const numberFromQuestionText = String(resolvedQuestion).match(/^\s*(\d+)\s*[.)-]/);
      const resolvedNumber = numberFromQuestionText ? Number(numberFromQuestionText[1]) : (embeddedNumber ? Number(embeddedNumber[1]) : NaN);
      return {
        answer, props, index,
        question: resolvedQuestion || questionIdentifier || relationLabels(questionValue).join(', ') || '',
        questionNumber: Number.isFinite(resolvedNumber) && resolvedNumber > 0 ? resolvedNumber : (Number.isFinite(questionNumber) && questionNumber > 0 ? questionNumber : (relatedQuestion ? relatedQuestion.index + 1 : index + 1)),
        response: fieldValue(answer, ['Respuesta','RespuestaTexto','Contenido','RespuestaEstudiante','Answer','RespuestaAbierta']) ||
          Object.entries(props).filter(([key]) => /respuesta/i.test(key)).map(([,value]) => detailDisplayValue(value)).filter(Boolean).join(' · ')
      };
    });
    answerItems.sort((a,b) => a.questionNumber - b.questionNumber || a.index - b.index);
    if (!answerItems.length) {
      const p = document.createElement('p');
      p.textContent = 'No se encontraron respuestas relacionadas con este estudiante.';
      answerPage.appendChild(p);
    } else {
      answerItems.forEach((item, index) => {
        const block = document.createElement('div'); block.className = 'admin-answer-block';
        const q = document.createElement('p'); q.className = 'admin-answer-question';
        q.textContent = item.question || 'No se pudo resolver el texto de la pregunta relacionada.';
        const a = document.createElement('p'); a.className = 'admin-answer-text';
        a.textContent = item.response || 'Respuesta no disponible en los campos devueltos.';
        block.append(q,a); answerPage.appendChild(block);
      });
    }
    adminDetailContent.appendChild(answerPage);
  }

  async function openAdminStudentDetail(student) {
    if (!adminCredential) { setAdminDataStatus('Inicia sesión de nuevo para consultar expedientes.', true); return; }
    activeAdminStudent = student;
    activeAdminDocuments = [];
    activeAdminAnswers = [];
    if (adminDetailOverlay) adminDetailOverlay.hidden = false;
    if (adminDetailTitle) adminDetailTitle.textContent = 'Expediente · ' + (studentField(student, 'nombre') || 'Estudiante');
    if (adminDetailContent) adminDetailContent.replaceChildren();
    showDetailStatus('Cargando datos, documentos y respuestas…', false);
    try {
      const results = await Promise.all([adminConsulta('documentos'), adminConsulta('respuestas')]);
      activeAdminDocuments = results[0];
      activeAdminAnswers = results[1];
      activeAdminQuestions = [];
      // No dependemos de que ESTUDIANTE tenga Programa: la tabla no lo expone
      // de forma fiable. Cargamos las preguntas de los programas y resolvemos
      // cada respuesta mediante su relación IdPreg_entrevista (ID de Notion o Bach001/Lic0001).
      const requestedProgram = fieldValue(student, ['Programa','Programa solicitado','ProgramaAcademico','Carrera']) || inferProgramFromAnswers(activeAdminAnswers, student);
      const programCandidates = requestedProgram
        ? [requestedProgram, 'Bachillerato', 'Licenciatura', 'Maestría']
        : ['Bachillerato', 'Licenciatura', 'Maestría'];
      const uniquePrograms = [...new Set(programCandidates)];
      const questionResults = await Promise.all(uniquePrograms.map(async programa => {
        try {
          const qResponse = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ accion: 'preguntas', programa }),
            redirect: 'follow'
          });
          const qText = await qResponse.text();
          const qResult = JSON.parse(qText);
          if (!qResponse.ok || qResult.ok === false) return [];
          const qData = qResult.preguntas || qResult.datos || qResult.data || qResult.registros || [];
          return Array.isArray(qData) ? qData : (Array.isArray(qData.registros) ? qData.registros : []);
        } catch (questionError) {
          console.warn('No se pudieron cargar preguntas de ' + programa + ':', questionError);
          return [];
        }
      }));
      const questionsById = new Map();
      questionResults.flat().forEach(question => {
        const props = getProperties(question);
        const identifiers = [
          recordId(question),
          fieldValue(question, ['IdPreg_entrevista','IdPregEntrevista','IdPregunta','Código','Codigo'])
        ].filter(Boolean);
        identifiers.forEach(id => questionsById.set(String(id).trim().toLowerCase(), question));
      });
      activeAdminQuestions = [...questionsById.values()];
      renderAdminStudentDetail(student);
      renderProfilePhoto(student, activeAdminDocuments);
      showDetailStatus('Expediente preparado. Revisa los documentos y respuestas antes de imprimir.', false);
    } catch (error) {
      renderAdminStudentDetail(student);
      renderProfilePhoto(student, activeAdminDocuments);
      showDetailStatus(error.message || 'No se pudo completar la consulta del expediente.', true);
    }
  }

  const adminDetailDelete = document.querySelector('#admin-detail-delete');
  if (adminDetailDelete) adminDetailDelete.addEventListener('click', async () => {
    if (!activeAdminStudent) {
      showDetailStatus('No hay un estudiante seleccionado.', true);
      return;
    }
    const studentName = studentField(activeAdminStudent, 'nombre') || 'este estudiante';
    const confirmation = window.confirm(
      '¿Estás segura de que deseas eliminar la información de ' + studentName + '?\n\n' +
      'ADVERTENCIA: la eliminación será EN CASCADA. Se eliminará el registro del estudiante y los documentos y respuestas relacionados mediante su identificador.\n\n' +
      'Esta acción es para solicitudes de prueba o casos que no serán aprobados. No se puede deshacer.\n\n' +
      'Pulsa Aceptar únicamente si confirmas que corresponde eliminar este expediente.'
    );
    if (!confirmation) return;
    showDetailStatus('La eliminación todavía no está habilitada en el servidor. No se ha borrado ningún dato.', true);
  });

  const detailRefresh = document.querySelector('#admin-detail-refresh');
  const detailEnroll = document.querySelector('#admin-detail-enroll');
  const detailPayments = document.querySelector('#admin-detail-payments');
  if (detailRefresh) detailRefresh.addEventListener('click', () => {
    if (activeAdminStudent) openAdminStudentDetail(activeAdminStudent);
  });
  function openAdminModuleShortcut(moduleKey) {
    closeAdminStudentDetail();
    const card = document.querySelector('[data-admin-module="' + moduleKey + '"]');
    if (card) card.click();
  }
  if (detailEnroll) detailEnroll.addEventListener('click', () => openAdminModuleShortcut('matriculas'));
  if (detailPayments) detailPayments.addEventListener('click', () => openAdminModuleShortcut('pagos'));

  function closeAdminStudentDetail() {
    if (adminDetailOverlay) adminDetailOverlay.hidden = true;
  }
  const detailClose = document.querySelector('#admin-detail-close');
  const detailCloseBottom = document.querySelector('#admin-detail-close-bottom');
  if (detailClose) detailClose.addEventListener('click', closeAdminStudentDetail);
  if (detailCloseBottom) detailCloseBottom.addEventListener('click', closeAdminStudentDetail);
  if (adminDetailOverlay) adminDetailOverlay.addEventListener('click', event => {
    if (event.target === adminDetailOverlay) closeAdminStudentDetail();
  });
  if (adminDetailPrint) adminDetailPrint.addEventListener('click', () => {
    if (!activeAdminStudent || !adminDetailContent) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) { showDetailStatus('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para este sitio.', true); return; }
    const printStyles = `<style>
      @page{size:A4 portrait;margin:12mm}
      *{box-sizing:border-box}body{font:13px/1.45 Arial,sans-serif;color:#222;margin:0}
      .print-toolbar{position:sticky;top:0;background:#f3efe5;padding:10px;margin:0 0 8mm;border-bottom:1px solid #cfc4b0;z-index:5}
      .print-toolbar button,.rotate-image{font:600 14px Arial;padding:10px 16px;cursor:pointer}
      h1{font-size:22px;margin:0 0 5mm}h2{font-size:17px;margin:0 0 5mm}
      .print-page{page-break-after:always;break-after:page;min-height:270mm;position:relative}
      .print-page:last-child{page-break-after:auto;break-after:auto}
      .fields{width:100%;border-collapse:collapse}.fields td,.fields th{border:1px solid #bbb;padding:7px;text-align:left;vertical-align:top;overflow-wrap:anywhere;font-size:12.5px}
      .fields th{width:32%;background:#f1f1f1}.answer{margin:0 0 12px;break-inside:avoid;font-size:13px}
      .profile-print{float:right;width:38mm;height:46mm;object-fit:cover;margin:0 0 5mm 5mm;border:1px solid #bbb}
      .document-images{display:flex;flex-direction:column;gap:5mm;align-items:center}
      .id-document{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;width:100%;break-inside:avoid;border:0;padding:0;text-align:center;margin:0 0 3mm}
      .id-document img{display:block;width:125mm;height:72mm;max-width:100%;object-fit:contain;margin:0 auto 2mm;transform-origin:center center}
      .id-document img.rotated-90{transform:rotate(90deg)}
      .id-document img.rotated-180{transform:rotate(180deg)}
      .id-document img.rotated-270{transform:rotate(270deg)}
      .id-document figcaption{font-size:9px;color:#555;overflow-wrap:anywhere}
      .id-document h3{margin:0 0 3mm}
      .diploma-page{display:flex;flex-direction:column;min-height:270mm;page-break-before:always;break-before:page}
      .diploma-page img{width:100%;height:245mm;object-fit:contain;display:block}
      .missing-file{color:#666;font-style:italic}
      a{color:#222;overflow-wrap:anywhere}
      @media print{.print-toolbar,.rotate-image{display:none!important}.print-page{min-height:0}.diploma-page{height:270mm}.diploma-page img{height:245mm}.id-document{border:0!important;padding:0!important;width:100%!important;margin-bottom:3mm!important}.id-document img{width:125mm!important;height:72mm!important;max-width:100%!important;object-fit:contain!important}.id-document figcaption{display:none!important}}
    </style>`;
    const escapeHtml = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    const imageHtml = (files, className) => files.map((file, index) => {
      const url = notionFileUrl(file);
      if (!url || !/^https:\/\//i.test(url)) return '';
      const imageClass = className ? ' class="' + className + '"' : '';
      const rotationKey = 'itin-id-rotation-' + encodeURIComponent(studentField(activeAdminStudent, 'nombre') || 'estudiante') + '-' + encodeURIComponent(file.name || ('cedula-' + index));
      return '<figure class="id-document"><img' + imageClass + ' data-rotation-key="' + escapeHtml(rotationKey) + '" src="' + escapeHtml(url) + '" alt="' + escapeHtml(file.name || 'Documento del estudiante') + '">' +
        (className === 'id-card-image' ? '<button type="button" class="rotate-image" data-rotate-image>Girar imagen 90°</button>' : '') +
        '<figcaption>' + escapeHtml(file.name || 'Documento adjunto') + '</figcaption></figure>';
    }).join('');
    const studentPhoto = selectedProfilePhotoUrl || (adminProfilePhotoFrame && adminProfilePhotoFrame.querySelector('img') ? adminProfilePhotoFrame.querySelector('img').src : '');
    const matchingDocs = activeAdminDocuments.filter(doc => belongsToStudent(doc, activeAdminStudent));
    const docProps = Object.assign({}, ...matchingDocs.map(getProperties));
    const findFiles = names => {
      for (const name of names) {
        const files = notionFiles(docProps[name]);
        if (files.length) return files;
      }
      return [];
    };
    const frontFiles = findFiles(['CedulaFrente','CedulaFisica','Cedula']);
    const backFiles = findFiles(['CedulaReverso','CedulaDigitalReverso']);
    const diplomaFiles = findFiles(['SubirDiploma','DiplomaDigital']);
    const pages = [...adminDetailContent.querySelectorAll('.admin-detail-page')].map((section,index) => {
      let content = '';
      if (index === 0) {
        const rows = [...section.querySelectorAll('.admin-detail-fields > div')].map(row => '<tr><th>' + escapeHtml(row.querySelector('dt')?.textContent) + '</th><td>' + escapeHtml(row.querySelector('dd')?.textContent) + '</td></tr>').join('');
        content = (studentPhoto ? '<img class="profile-print" src="' + escapeHtml(studentPhoto) + '" alt="Fotografía del estudiante">' : '<div class="profile-print missing-file">Foto no disponible</div>') + '<table class="fields">' + rows + '</table>';
      } else if (index === 1) {
        content = '<div class="document-images">' +
          (frontFiles.length ? '<h3>1. Cédula · frente</h3>' + imageHtml(frontFiles,'id-card-image') : '<p class="missing-file">Imagen del frente de la cédula no disponible.</p>') +
          (backFiles.length ? '<h3>2. Cédula · reverso</h3>' + imageHtml(backFiles,'id-card-image') : '<p class="missing-file">Imagen del reverso de la cédula no disponible.</p>') + '</div>';
      } else if (index === 2) {
        content = diplomaFiles.length ? imageHtml(diplomaFiles,'') : '<p class="missing-file">No se adjuntó diploma o constancia académica.</p>';
      } else {
        content = [...section.querySelectorAll('.admin-answer-block')].map(block => '<div class="answer"><strong>' + escapeHtml(block.querySelector('.admin-answer-question')?.textContent) + '</strong><p>' + escapeHtml(block.querySelector('.admin-answer-text')?.textContent) + '</p></div>').join('') || '<p>' + escapeHtml(section.querySelector('p')?.textContent || '') + '</p>';
      }
      const special = index === 2 ? ' diploma-page' : '';
      return '<section class="print-page' + special + '"><h1>ITIN CAMPUS</h1><h2>' + escapeHtml(section.querySelector('h4')?.textContent || '') + '</h2>' + content + '</section>';
    }).join('');
    printWindow.document.open();
    printWindow.document.write('<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Expediente - ' + escapeHtml(studentField(activeAdminStudent, 'nombre')) + '</title>' + printStyles + '</head><body><div class="print-toolbar"><button type="button" onclick="window.print()">Imprimir / Guardar como PDF</button> <span>Formato A4 vertical. Puedes girar las imágenes de cédula; la orientación elegida se guarda en este navegador.</span></div>' + pages + '<script>' +
      'document.querySelectorAll("[data-rotation-key]").forEach(img=>{try{img.dataset.rotation=localStorage.getItem(img.dataset.rotationKey)||"0";}catch(e){img.dataset.rotation="0";}applyRotation(img);});' +
      'function applyRotation(img){img.classList.remove("rotated-90","rotated-180","rotated-270");const n=Number(img.dataset.rotation||0);if(n)img.classList.add("rotated-"+n);}' +
      'document.querySelectorAll("[data-rotate-image]").forEach(btn=>btn.addEventListener("click",()=>{const img=btn.parentElement.querySelector("img");img.dataset.rotation=String((Number(img.dataset.rotation||0)+90)%360);applyRotation(img);try{localStorage.setItem(img.dataset.rotationKey,img.dataset.rotation);}catch(e){};}));' +
      '</script></body></html>');
    printWindow.document.close();
  });

    // Logo institucional: reacción al movimiento del puntero y al enfoque.
  const emblemStage = document.querySelector('.itin-emblem-stage');
  if (emblemStage) {
    const heroLogo = emblemStage.querySelector('.itin-hero-logo');
    if (heroLogo) {
      emblemStage.addEventListener('pointermove', (event) => {
        if (event.pointerType === 'touch' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const bounds = emblemStage.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width - 0.5;
        const y = (event.clientY - bounds.top) / bounds.height - 0.5;
        heroLogo.style.marginLeft = (x * 8).toFixed(1) + 'px';
        heroLogo.style.marginTop = (y * 8).toFixed(1) + 'px';
      });
      emblemStage.addEventListener('pointerleave', () => {
        heroLogo.style.marginLeft = '';
        heroLogo.style.marginTop = '';
      });
      heroLogo.addEventListener('click', () => {
        heroLogo.classList.remove('itin-logo-pop');
        void heroLogo.offsetWidth;
        heroLogo.classList.add('itin-logo-pop');
      });
    }
  }

})();