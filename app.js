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

  // Navegación local de las tarjetas administrativas. No consulta ni modifica datos.
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
  adminModuleCards.forEach((card) => {
    card.addEventListener('click', () => {
      const info = adminModuleInfo[card.dataset.adminModule];
      if (!info || !adminModuleView) return;
      document.querySelector('#admin-module-kicker').textContent = info.kicker;
      document.querySelector('#admin-module-title').textContent = info.title;
      document.querySelector('#admin-module-description').textContent = info.description;
      adminDashboard.querySelector('.admin-card-grid').hidden = true;
      adminModuleView.hidden = false;
    });
  });
  if (adminBackButton && adminModuleView && adminDashboard) {
    adminBackButton.addEventListener('click', () => {
      adminModuleView.hidden = true;
      adminDashboard.querySelector('.admin-card-grid').hidden = false;
    });
  }

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