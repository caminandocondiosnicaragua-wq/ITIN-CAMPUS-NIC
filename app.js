(() => {
  const API_URL = 'https://script.google.com/macros/s/AKfycbxauXEu0OSdzjVBL6Z4GzxR6Jd_-OQwCsnLL6g-h-ERhr8qszpUZc4scZWlMm6veWPsow/exec';
  const CONTACT_API_URL = 'https://script.google.com/macros/s/AKfycbxWln_ygIk8UWSVlzdSL8nerFyF2ppeM1OHcgn9X1dftgTpOaz6d1DaVJKWCvWBXCvycw/exec';
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



  const programPicker = document.getElementById('application-program-picker');
  const applicationLayout = document.getElementById('application-layout');

  function updateApplicationEntry() {
    if (!programPicker || !applicationLayout) return;
    const selected = Boolean(programSelect && programSelect.value);
    programPicker.hidden = selected;
    applicationLayout.hidden = !selected;
  }

  document.querySelectorAll('[data-choose-program]').forEach(button => {
    button.addEventListener('click', () => {
      programSelect.value = button.dataset.chooseProgram;
      updateInterviewForProgram();
      updateApplicationEntry();
      currentStep = 0;
      updateStep();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

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
    if (validPage === 'solicitud') { updateApplicationEntry(); if (programSelect.value) updateStep(); }
    if (validPage === 'contacto') resetContactNotice();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function readHash() {
    showPage((location.hash || '#inicio').slice(1));
  }
  window.addEventListener('hashchange', readHash);
  navLinks.forEach(link => link.addEventListener('click', () => {
    if (link.dataset.page === 'solicitud') {
      // Cada entrada desde el menú comienza en el selector de programas.
      // El formulario solo se muestra después de elegir una tarjeta.
      programSelect.value = '';
      updateInterviewForProgram();
      updateApplicationEntry();
    }
  }));
  document.querySelectorAll('[data-program]').forEach(link => link.addEventListener('click', () => {
    programSelect.value = link.dataset.program;
    updateInterviewForProgram();
  }));
  menuToggle.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(open));
  });

  const contactForm = document.getElementById('contact-form');
  const contactAlert = document.getElementById('contact-alert');
  const contactSubmit = document.getElementById('contact-submit');
  const contactAttachment = document.getElementById('contact-attachment');
  const CONTACT_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
  const CONTACT_ATTACHMENT_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  function resetContactNotice() {
    if (!contactAlert || contactAlert.dataset.persistent === 'true') return;
    contactAlert.hidden = true; contactAlert.textContent = ''; contactAlert.className = 'form-alert';
  }
  if (contactForm) contactForm.addEventListener('submit', async (event) => {
    event.preventDefault(); resetContactNotice();
    if (!contactForm.reportValidity()) return;
    const formData = new FormData(contactForm);
    const selectedFile = contactAttachment && contactAttachment.files ? contactAttachment.files[0] : null;
    const data = Object.fromEntries(formData.entries());
    delete data.archivo;
    for (const key of ['nombre','correo','asunto','consulta']) data[key] = String(data[key] || '').trim();
    data.correo = data.correo.toLowerCase();
    if (!data.nombre || !data.correo || !data.asunto || !data.consulta) return showContactNotice('Completa todos los campos antes de enviar.', false);
    if (data.nombre.length > 150 || data.correo.length > 254 || data.asunto.length > 180 || data.consulta.length > 5000) return showContactNotice('Uno de los campos supera el límite permitido.', false);
    if (selectedFile) {
      if (!CONTACT_ATTACHMENT_TYPES.includes(selectedFile.type)) {
        return showContactNotice('Formato no permitido. Adjunta un PDF, JPG, PNG o documento Word.', false);
      }
      if (selectedFile.size <= 0 || selectedFile.size > CONTACT_ATTACHMENT_MAX_BYTES) {
        return showContactNotice('El archivo debe pesar más de 0 bytes y como máximo 5 MB.', false);
      }
    }
    contactSubmit.disabled = true; contactSubmit.setAttribute('aria-busy','true'); contactSubmit.textContent = 'Enviando…';
    showContactNotice(selectedFile ? 'Estamos enviando tu consulta y el archivo adjunto. No cierres esta página.' : 'Estamos enviando tu consulta.', false);
    try {
      if (selectedFile) {
        data.archivo = {
          nombre: selectedFile.name,
          tipo: selectedFile.type,
          contenidoBase64: await fileToBase64(selectedFile)
        };
      }
      const response = await fetch(CONTACT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ accion: 'registrarConsulta', datos: data })
      });
      if (!response.ok) throw new Error('No fue posible conectar con el buzón. Intenta de nuevo.');
      const result = await response.json();
      if (!result || result.ok !== true) throw new Error(result && result.error ? result.error : 'No se pudo registrar la consulta.');
      contactForm.reset();
      showContactNotice('¡Consulta recibida! Tu número de ticket es ' + result.ticket + '. Guarda este número para futuras referencias.', true);
    } catch (error) {
      showContactNotice(error && error.message ? error.message : 'No se pudo enviar la consulta. Intenta nuevamente.', false);
    } finally {
      contactSubmit.disabled = false;
      contactSubmit.removeAttribute('aria-busy');
      contactSubmit.innerHTML = 'Enviar consulta <span aria-hidden="true">→</span>';
    }
  });
  function showContactNotice(message,success) {
    if(!contactAlert)return; contactAlert.hidden=false; contactAlert.dataset.persistent=success?'true':'false'; contactAlert.textContent=message;
    contactAlert.className='form-alert '+(success?'contact-alert-success':'contact-alert-message');
  }

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
      answer.maxLength = 171;
      answer.required = true;
      answer.rows = 2;
      answer.placeholder = 'Escribe tu respuesta con tus propias palabras… (máximo 171 caracteres)';
      const counter = document.createElement('small');
      counter.className = 'answer-character-count';
      counter.setAttribute('aria-live', 'polite');
      counter.textContent = '0/171 caracteres';
      answer.addEventListener('input', () => {
        if (answer.value.length > 171) answer.value = answer.value.slice(0, 171);
        counter.textContent = answer.value.length + '/171 caracteres';
        counter.classList.toggle('is-limit-reached', answer.value.length >= 171);
      });
      wrapper.append(label, answer, counter);
      questionBox.append(wrapper);
      const savedAnswer = pendingDraftFields[answer.name];
      if (typeof savedAnswer === 'string') answer.value = savedAnswer.slice(0, 171);
      answer.dispatchEvent(new Event('input'));
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
      // Carga la bandeja al validar la sesión para que el contador de la tarjeta
      // muestre los mensajes nuevos aunque el buzón permanezca cerrado.
      loadAdminMailbox();
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

  async function loadAdminStudents(forceRefresh) {
    if (!adminCredential) {
      setAdminDataStatus('Tu sesión no tiene una credencial activa. Cierra sesión e inicia de nuevo.', true);
      return;
    }
    if (!forceRefresh && adminStudents.length) {
      renderAdminStudents();
      setAdminDataStatus('Mostrando datos guardados en esta sesión. Usa Recargar solo cuando necesites consultar cambios externos.', false);
      return;
    }
    if (adminRefreshStudents) adminRefreshStudents.disabled = true;
    setAdminDataStatus('Consultando estudiantes autorizados…', false);
    try {
      const data = await adminConsulta('estudiantes', !!forceRefresh);
      adminStudents = data;
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
  if (adminRefreshStudents) adminRefreshStudents.addEventListener('click', () => loadAdminStudents(true));

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



  // Buzón de consultas independiente: utiliza su propio Apps Script y la credencial verificada de esta sesión.
  const adminMailbox = document.getElementById('admin-mailbox-module');
  const adminMailboxToggle = document.getElementById('admin-mailbox-toggle');
  const adminMailboxContent = document.getElementById('admin-mailbox-content');
  const adminMailboxClose = document.getElementById('admin-mailbox-close');
  const adminMailboxPrint = document.getElementById('admin-mailbox-print');
  const adminMailboxToggleCount = document.getElementById('admin-mailbox-toggle-unread-count');
  const adminMailboxStatus = document.getElementById('admin-mailbox-status');
  const adminMailboxList = document.getElementById('admin-mailbox-list');
  const adminMailboxRefresh = document.getElementById('admin-mailbox-refresh');
  const adminMailboxCount = document.getElementById('admin-mailbox-unread-count');
  const adminMailboxCountLabel = document.getElementById('admin-mailbox-unread-label');
  const adminMailboxTotal = document.getElementById('admin-mailbox-total');
  const adminMailboxEmptyDetail = document.getElementById('admin-mailbox-empty-detail');
  const adminMailboxDetail = document.getElementById('admin-mailbox-detail');
  const adminMailboxReplyForm = document.getElementById('admin-mailbox-reply-form');
  const adminMailboxReply = document.getElementById('admin-mailbox-reply');
  const adminMailboxSend = document.getElementById('admin-mailbox-send');
  let adminMailboxMessages = [];
  let adminMailboxSelectedId = '';
  let adminMailboxBusy = false;

  function setAdminMailboxStatus(message, isError) {
    if (!adminMailboxStatus) return;
    adminMailboxStatus.textContent = message;
    adminMailboxStatus.dataset.state = isError ? 'error' : 'neutral';
  }

  async function adminMailboxRequest(payload) {
    if (!adminCredential) throw new Error('Tu sesión administrativa ha terminado. Vuelve a iniciar sesión.');
    const response = await fetch(CONTACT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...payload, credential: adminCredential }),
      redirect: 'follow'
    });
    const raw = await response.text();
    let result;
    try { result = JSON.parse(raw); } catch (_) { throw new Error('El servicio del buzón no devolvió una respuesta válida.'); }
    if (!response.ok || result.ok !== true) throw new Error(result.error || result.mensaje || 'No se pudo completar la operación del buzón.');
    return result;
  }

  function mailboxDate(value) {
    if (!value) return 'Fecha no disponible';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('es-NI', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function renderAdminMailboxList() {
    if (!adminMailboxList) return;
    adminMailboxList.replaceChildren();
    if (!adminMailboxMessages.length) {
      const empty = document.createElement('p');
      empty.className = 'admin-mailbox-empty';
      empty.textContent = 'No hay consultas registradas.';
      adminMailboxList.appendChild(empty);
      return;
    }
    adminMailboxMessages.forEach((message) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'admin-mailbox-item' + (message.id === adminMailboxSelectedId ? ' is-selected' : '') + (message.estado === 'Nuevo' ? ' is-unread' : '');
      button.setAttribute('aria-pressed', String(message.id === adminMailboxSelectedId));
      const titleRow = document.createElement('span');
      titleRow.className = 'admin-mailbox-item-title-row';
      const title = document.createElement('strong');
      title.textContent = message.nombre || 'Consultante';
      titleRow.appendChild(title);
      const hasAttachments = Array.isArray(message.archivos) && message.archivos.length > 0;
      if (hasAttachments) {
        const attachmentMark = document.createElement('span');
        attachmentMark.className = 'admin-mailbox-attachment-indicator';
        attachmentMark.textContent = '📎';
        attachmentMark.setAttribute('role', 'img');
        attachmentMark.setAttribute('aria-label', 'Tiene archivos adjuntos');
        attachmentMark.title = message.archivos.length === 1 ? '1 archivo adjunto' : message.archivos.length + ' archivos adjuntos';
        titleRow.appendChild(attachmentMark);
      }
      const subject = document.createElement('span');
      subject.className = 'admin-mailbox-item-subject';
      subject.textContent = message.asunto || '(Sin asunto)';
      const meta = document.createElement('span');
      meta.className = 'admin-mailbox-item-meta';
      meta.textContent = (message.ticket || 'Sin ticket') + ' · ' + mailboxDate(message.fechaRecepcion);
      const state = document.createElement('span');
      state.className = 'admin-mailbox-item-state';
      state.textContent = message.estado || 'Sin estado';
      button.append(titleRow, subject, meta, state);
      button.addEventListener('click', () => openAdminMailboxMessage(message.id));
      adminMailboxList.appendChild(button);
    });
  }

  function updateAdminMailboxCount() {
    const unread = adminMailboxMessages.filter(message => message.estado === 'Nuevo').length;
    if (adminMailboxCount) adminMailboxCount.textContent = String(unread);
    if (adminMailboxToggleCount) adminMailboxToggleCount.textContent = String(unread);
    if (adminMailboxCountLabel) adminMailboxCountLabel.textContent = unread === 1 ? 'consulta nueva' : 'consultas nuevas';
    if (adminMailboxTotal) adminMailboxTotal.textContent = adminMailboxMessages.length + (adminMailboxMessages.length === 1 ? ' mensaje' : ' mensajes');
  }

  async function loadAdminMailbox(keepSelected) {
    if (!adminMailbox || !adminCredential || adminMailboxBusy) return;
    adminMailboxBusy = true;
    if (adminMailboxRefresh) adminMailboxRefresh.disabled = true;
    setAdminMailboxStatus('Actualizando consultas…', false);
    try {
      const result = await adminMailboxRequest({ accion: 'listarMensajes' });
      adminMailboxMessages = Array.isArray(result.mensajes) ? result.mensajes : [];
      adminMailboxMessages.sort((a,b) => String(b.fechaRecepcion || '').localeCompare(String(a.fechaRecepcion || '')));
      updateAdminMailboxCount();
      renderAdminMailboxList();
      setAdminMailboxStatus('Buzón actualizado correctamente.', false);
      if (keepSelected && adminMailboxSelectedId && adminMailboxMessages.some(m => m.id === adminMailboxSelectedId)) {
        await openAdminMailboxMessage(adminMailboxSelectedId, true);
      } else if (!adminMailboxMessages.length) {
        adminMailboxSelectedId = '';
        if (adminMailboxDetail) adminMailboxDetail.hidden = true;
        if (adminMailboxEmptyDetail) adminMailboxEmptyDetail.hidden = false;
      if (adminMailboxPrint) adminMailboxPrint.disabled = true;
      }
    } catch (error) {
      setAdminMailboxStatus(error.message || 'No se pudo cargar el buzón.', true);
    } finally {
      adminMailboxBusy = false;
      if (adminMailboxRefresh) adminMailboxRefresh.disabled = false;
    }
  }

  function printAdminMailboxMessage() {
    if (!adminMailboxSelectedId || !adminMailboxDetail || adminMailboxDetail.hidden) {
      setAdminMailboxStatus('Selecciona primero una consulta para imprimir.', true);
      return;
    }
    const textOf = (id) => {
      const el = document.getElementById(id);
      return el ? el.textContent.trim() : '';
    };
    const safe = (value) => String(value || '').replace(/[&<>"]/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
    }[ch]));
    const ticket = textOf('admin-mailbox-ticket');
    const subject = textOf('admin-mailbox-subject');
    const name = textOf('admin-mailbox-sender-name');
    const email = textOf('admin-mailbox-sender-email');
    const received = textOf('admin-mailbox-received');
    const query = textOf('admin-mailbox-query');
    const state = textOf('admin-mailbox-state');
    const reply = textOf('admin-mailbox-previous-reply-text');
    const replyDate = textOf('admin-mailbox-reply-date');
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setAdminMailboxStatus('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para este sitio e inténtalo de nuevo.', true);
      return;
    }
    printWindow.document.open();
    printWindow.document.write('<!doctype html><html lang="es"><head><meta charset="utf-8"><title>' + safe(ticket) + ' · ' + safe(subject) + '</title><style>body{font:14px/1.65 Arial,sans-serif;color:#222;margin:32px}h1{font:24px Georgia,serif;margin:0 0 8px;color:#333c2c}h2{font-size:18px;margin:22px 0 8px}small,.muted{color:#555}header{border-bottom:3px solid #39432e;padding-bottom:16px;margin-bottom:18px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 18px}.message{white-space:pre-wrap;overflow-wrap:anywhere;border:1px solid #ddd;padding:16px;border-radius:8px}.reply{margin-top:18px;padding:14px;background:#f4f3ed;border-left:4px solid #39432e;white-space:pre-wrap}footer{margin-top:28px;font-size:11px;color:#666}@media print{body{margin:15mm}button{display:none}}</style></head><body><header><h1>ITIN CAMPUS · Buzón de consultas</h1><div>' + safe(ticket) + ' · ' + safe(state) + '</div></header><h2>' + safe(subject) + '</h2><div class="meta"><div><b>Remitente:</b> ' + safe(name) + '</div><div><b>Correo:</b> ' + safe(email) + '</div><div><b>Recepción:</b> ' + safe(received) + '</div></div><h2>Consulta</h2><div class="message">' + safe(query) + '</div>' + (reply ? '<section class="reply"><b>Respuesta registrada</b><p>' + safe(reply) + '</p><small>' + safe(replyDate) + '</small></section>' : '') + '<footer>Documento generado desde el buzón administrativo de ITIN CAMPUS.</footer><script>window.addEventListener("load",function(){window.focus();window.print();});<\/script></body></html>');
    printWindow.document.close();
  }

  async function openAdminMailboxMessage(id, quiet) {
    if (!id || !adminCredential) return;
    setAdminMailboxStatus('Abriendo consulta…', false);
    try {
      const result = await adminMailboxRequest({ accion: 'abrirMensaje', id });
      const message = result.mensaje || {};
      adminMailboxSelectedId = id;
      const values = {
        'admin-mailbox-ticket': message.ticket || '',
        'admin-mailbox-subject': message.asunto || '(Sin asunto)',
        'admin-mailbox-sender-name': message.nombre || 'Consultante',
        'admin-mailbox-sender-email': message.correo || '',
        'admin-mailbox-received': 'Recibido: ' + mailboxDate(message.fechaRecepcion),
        'admin-mailbox-query': message.consulta || '(Consulta vacía)',
        'admin-mailbox-state': message.estado || 'En revisión',
        'admin-mailbox-previous-reply-text': message.respuesta || '',
        'admin-mailbox-reply-date': message.fechaRespuesta ? 'Respondido: ' + mailboxDate(message.fechaRespuesta) : ''
      };
      Object.entries(values).forEach(([idName,value]) => {
        const element = document.getElementById(idName);
        if (element) element.textContent = value;
      });
      const emailLink = document.getElementById('admin-mailbox-sender-email');
      if (emailLink) emailLink.href = message.correo ? 'mailto:' + message.correo : '#';
      const attachmentsPanel = document.getElementById('admin-mailbox-attachments');
      const attachmentsList = document.getElementById('admin-mailbox-attachments-list');
      if (attachmentsPanel && attachmentsList) {
        attachmentsList.replaceChildren();
        const attachments = Array.isArray(message.archivos) ? message.archivos : [];
        attachments.forEach((file) => {
          if (!file || typeof file.url !== 'string' || !/^https:\/\//i.test(file.url)) return;
          const link = document.createElement('button');
          link.type = 'button';
          link.textContent = '📎 ' + (file.nombre || 'Ver archivo adjunto');
          link.className = 'admin-mailbox-attachment-link';
          link.addEventListener('click', () => openAdminAttachmentPreview(file));
          attachmentsList.appendChild(link);
        });
        attachmentsPanel.hidden = attachmentsList.childElementCount === 0;
      }
      const previousReply = document.getElementById('admin-mailbox-previous-reply');
      if (previousReply) previousReply.hidden = !message.respuesta;
      if (adminMailboxReply) adminMailboxReply.value = '';
      if (adminMailboxDetail) adminMailboxDetail.hidden = false;
      if (adminMailboxEmptyDetail) adminMailboxEmptyDetail.hidden = true;
      if (adminMailboxPrint) adminMailboxPrint.disabled = false;
      renderAdminMailboxList();
      setAdminMailboxStatus('Consulta ' + (message.ticket || '') + ' abierta.', false);
      // Actualiza el estado "Nuevo" a "En revisión" en el contador y en la lista.
      const local = adminMailboxMessages.find(item => item.id === id);
      if (local && local.estado === 'Nuevo') local.estado = 'En revisión';
      updateAdminMailboxCount();
      renderAdminMailboxList();
    } catch (error) {
      setAdminMailboxStatus(error.message || 'No se pudo abrir la consulta.', true);
    }
  }

  const adminAttachmentViewer = document.getElementById('admin-attachment-viewer');
  const adminAttachmentStage = document.getElementById('admin-attachment-viewer-stage');
  const adminAttachmentTitle = document.getElementById('admin-attachment-viewer-title');
  const adminAttachmentNote = document.getElementById('admin-attachment-viewer-note');
  let activeAdminAttachment = null;

  function closeAdminAttachmentPreview() {
    if (!adminAttachmentViewer) return;
    adminAttachmentViewer.hidden = true;
    if (adminAttachmentStage) adminAttachmentStage.replaceChildren();
    activeAdminAttachment = null;
  }

  function openAdminAttachmentPreview(file) {
    if (!adminAttachmentViewer || !adminAttachmentStage || !file || !file.url) return;
    activeAdminAttachment = file;
    adminAttachmentStage.replaceChildren();
    const name = String(file.nombre || 'Archivo adjunto');
    const lower = name.toLowerCase();
    const isImage = /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(lower);
    const isPdf = /\.pdf$/i.test(lower);
    const isWord = /\.(doc|docx)$/i.test(lower);
    if (adminAttachmentTitle) adminAttachmentTitle.textContent = name;
    const downloadLink = document.getElementById('admin-attachment-viewer-download');
    if (downloadLink) {
      downloadLink.href = file.url;
      downloadLink.download = name;
      downloadLink.target = '_blank';
      downloadLink.rel = 'noopener noreferrer';
    }
    if (adminAttachmentNote) adminAttachmentNote.textContent = isWord
      ? 'Vista previa de Word. La impresión depende de que el visor de Office pueda abrir el archivo.'
      : 'Vista previa del archivo adjunto. Puedes imprimir sin descargarlo manualmente.';
    if (isImage) {
      const img = document.createElement('img');
      img.src = file.url;
      img.alt = name;
      img.className = 'admin-attachment-preview-image';
      img.addEventListener('error', () => {
        if (adminAttachmentNote) adminAttachmentNote.textContent = 'No se pudo mostrar la imagen aquí. Comprueba el acceso al archivo.';
      });
      adminAttachmentStage.appendChild(img);
    } else if (isPdf) {
      const frame = document.createElement('iframe');
      frame.src = file.url + '#toolbar=1&navpanes=0';
      frame.title = name;
      frame.className = 'admin-attachment-preview-frame';
      frame.setAttribute('allow', 'fullscreen');
      adminAttachmentStage.appendChild(frame);
    } else if (isWord) {
      const frame = document.createElement('iframe');
      frame.src = 'https://view.officeapps.live.com/op/embed.aspx?src=' + encodeURIComponent(file.url);
      frame.title = name;
      frame.className = 'admin-attachment-preview-frame';
      frame.setAttribute('allow', 'fullscreen');
      adminAttachmentStage.appendChild(frame);
    } else {
      const note = document.createElement('p');
      note.className = 'admin-attachment-preview-message';
      note.textContent = 'Este formato no tiene vista previa integrada. Puedes abrir el archivo en una pestaña nueva.';
      const open = document.createElement('a');
      open.href = file.url;
      open.target = '_blank';
      open.rel = 'noopener noreferrer';
      open.textContent = 'Abrir archivo';
      open.className = 'button button-quiet';
      adminAttachmentStage.append(note, open);
    }
    adminAttachmentViewer.hidden = false;
  }

  const adminMailboxDelete = document.getElementById('admin-mailbox-delete');
  if (adminMailboxDelete) adminMailboxDelete.addEventListener('click', async () => {
    if (!adminMailboxSelectedId) {
      setAdminMailboxStatus('Selecciona primero una consulta para eliminar.', true);
      return;
    }
    const selected = adminMailboxMessages.find(item => item.id === adminMailboxSelectedId);
    if (!selected) return;
    const name = String(selected.nombre || 'Consultante');
    const hasAttachments = Array.isArray(selected.archivos) && selected.archivos.length > 0;
    const warning = '¿Está seguro de que quiere eliminar el mensaje de: ' + name + '?' +
      (hasAttachments ? '\n\nEste mensaje tiene ' + selected.archivos.length + ' archivo(s) adjunto(s). Al eliminar el mensaje, dejarán de estar disponibles desde el buzón.' : '');
    if (!window.confirm(warning)) return;
    adminMailboxDelete.disabled = true;
    try {
      await adminMailboxRequest({ accion: 'eliminarMensaje', id: adminMailboxSelectedId });
      setAdminMailboxStatus('Mensaje eliminado.', false);
      adminMailboxSelectedId = '';
      if (adminMailboxDetail) adminMailboxDetail.hidden = true;
      if (adminMailboxEmptyDetail) adminMailboxEmptyDetail.hidden = false;
      if (adminMailboxPrint) adminMailboxPrint.disabled = true;
      await loadAdminMailbox(false);
    } catch (error) {
      setAdminMailboxStatus(error.message || 'No se pudo eliminar el mensaje. Verifica que Apps Script admita la acción eliminarMensaje.', true);
    } finally {
      adminMailboxDelete.disabled = false;
    }
  });

  const adminAttachmentClose = document.getElementById('admin-attachment-viewer-close');
  const adminAttachmentPrint = document.getElementById('admin-attachment-viewer-print');
  if (adminAttachmentClose) adminAttachmentClose.addEventListener('click', closeAdminAttachmentPreview);
  if (adminAttachmentViewer) adminAttachmentViewer.addEventListener('click', event => {
    if (event.target === adminAttachmentViewer) closeAdminAttachmentPreview();
  });
  if (adminAttachmentPrint) adminAttachmentPrint.addEventListener('click', () => {
    if (!activeAdminAttachment) return;
    const name = String(activeAdminAttachment.nombre || '').toLowerCase();
    if (/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name)) {
      const img = adminAttachmentStage && adminAttachmentStage.querySelector('img');
      if (!img || !img.complete) {
        if (adminAttachmentNote) adminAttachmentNote.textContent = 'Espera a que la imagen termine de cargar y vuelve a pulsar Imprimir.';
        return;
      }
      const win = window.open('', '_blank');
      if (!win) {
        if (adminAttachmentNote) adminAttachmentNote.textContent = 'Permite ventanas emergentes para imprimir esta imagen.';
        return;
      }
      win.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Imprimir imagen</title><style>@page{margin:10mm}body{margin:0;display:grid;place-items:center;min-height:100vh}img{max-width:100%;max-height:95vh;object-fit:contain}@media print{body{min-height:0}img{max-width:100%;max-height:95vh}}</style></head><body><img src="' + img.src.replace(/&/g,'&amp;').replace(/"/g,'&quot;') + '" alt=""></body></html>');
      win.document.close();
      win.addEventListener('load', () => { win.focus(); win.print(); });
    } else if (/\.pdf$/i.test(name)) {
      const frame = adminAttachmentStage && adminAttachmentStage.querySelector('iframe');
      try {
        if (frame && frame.contentWindow) {
          frame.contentWindow.focus();
          frame.contentWindow.print();
        } else if (adminAttachmentNote) {
          adminAttachmentNote.textContent = 'Usa el icono de imprimir de la barra del visor PDF.';
        }
      } catch (_) {
        if (adminAttachmentNote) adminAttachmentNote.textContent = 'Usa el icono de imprimir de la barra del visor PDF; el navegador controla la impresión del PDF.';
      }
    } else if (/\.(doc|docx)$/i.test(name)) {
      if (adminAttachmentNote) adminAttachmentNote.textContent = 'En Word, usa la opción Imprimir del visor de Office. El visor externo controla esa impresión.';
      const frame = adminAttachmentStage && adminAttachmentStage.querySelector('iframe');
      if (frame && frame.contentWindow) frame.contentWindow.focus();
    } else if (adminAttachmentNote) {
      adminAttachmentNote.textContent = 'Este formato no admite impresión directa desde la vista previa.';
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && adminAttachmentViewer && !adminAttachmentViewer.hidden) closeAdminAttachmentPreview();
  });

  function closeAdminMailbox() {
    if (!adminMailboxContent || adminMailboxContent.hidden) return;
    adminMailboxContent.hidden = true;
    adminMailboxContent.style.cssText = '';
    const mailboxWindow = adminMailboxContent.querySelector('.admin-mailbox-window');
    if (mailboxWindow) mailboxWindow.style.cssText = '';
    adminMailboxToggle && adminMailboxToggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('admin-mailbox-open');
    if (adminMailboxToggle) adminMailboxToggle.focus();
  }
  if (adminMailboxToggle && adminMailboxContent) {
    adminMailboxToggle.addEventListener('click', () => {
      adminMailboxContent.hidden = false;
      adminMailboxContent.style.cssText = 'position:fixed!important;inset:0!important;z-index:10000!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:24px!important;background:rgba(24,30,22,.72)!important;backdrop-filter:blur(5px);overflow:auto!important;';
      const mailboxWindow = adminMailboxContent.querySelector('.admin-mailbox-window');
      if (mailboxWindow) mailboxWindow.style.cssText = 'position:relative;width:min(1180px,100%)!important;max-height:90vh!important;overflow:auto!important;padding:26px!important;border:1px solid #d8c89f;border-radius:22px;background:linear-gradient(135deg,#fffdf6 0%,#f8f1df 100%);box-shadow:0 24px 90px rgba(0,0,0,.32);';
      adminMailboxToggle.setAttribute('aria-expanded', 'true');
      document.body.classList.add('admin-mailbox-open');
      if (!adminCredential) setAdminMailboxStatus('Inicia sesión como administrador para consultar el buzón.', true);
      else loadAdminMailbox();
      window.setTimeout(() => adminMailboxClose && adminMailboxClose.focus(), 0);
    });
  }
  if (adminMailboxClose) adminMailboxClose.addEventListener('click', closeAdminMailbox);
  if (adminMailboxContent) adminMailboxContent.addEventListener('click', (event) => {
    if (event.target === adminMailboxContent) closeAdminMailbox();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && adminMailboxContent && !adminMailboxContent.hidden) closeAdminMailbox();
  });
  if (adminMailboxRefresh) adminMailboxRefresh.addEventListener('click', () => loadAdminMailbox(true));
  // Actualiza la bandeja cada 15 minutos mientras la ventana del buzón está abierta.
  window.setInterval(() => {
    if (adminCredential && adminMailboxContent && !adminMailboxContent.hidden) {
      loadAdminMailbox(true);
    }
  }, 15 * 60 * 1000);
  if (adminMailboxPrint) adminMailboxPrint.addEventListener('click', printAdminMailboxMessage);
  if (adminMailboxReplyForm) adminMailboxReplyForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const texto = String(adminMailboxReply && adminMailboxReply.value || '').trim();
    if (!adminMailboxSelectedId) { setAdminMailboxStatus('Selecciona primero una consulta.', true); return; }
    if (!texto) { setAdminMailboxStatus('Escribe la respuesta antes de enviarla.', true); return; }
    if (texto.length > 5000) { setAdminMailboxStatus('La respuesta supera los 5.000 caracteres permitidos.', true); return; }
    if (adminMailboxSend) { adminMailboxSend.disabled = true; adminMailboxSend.textContent = 'Enviando…'; }
    try {
      const result = await adminMailboxRequest({ accion: 'responderMensaje', id: adminMailboxSelectedId, respuesta: texto });
      setAdminMailboxStatus(result.mensaje || 'Respuesta enviada correctamente.', false);
      const selectedId = adminMailboxSelectedId;
      await loadAdminMailbox(false);
      await openAdminMailboxMessage(selectedId, true);
      const success = document.createElement('p');
      success.className = 'admin-mailbox-send-success';
      success.textContent = 'El mensaje fue enviado a su correo.';
      const detail = document.getElementById('admin-mailbox-detail');
      const old = detail && detail.querySelector('.admin-mailbox-send-success');
      if (old) old.remove();
      if (detail) detail.prepend(success);
    } catch (error) {
      setAdminMailboxStatus(error.message || 'No se pudo enviar la respuesta.', true);
    } finally {
      if (adminMailboxSend) { adminMailboxSend.disabled = false; adminMailboxSend.textContent = 'Enviar respuesta ↗'; }
    }
  });


  // Puente mínimo para módulos administrativos externos; conserva la credencial dentro de esta sesión.
  window.ITINAdminRequest = async function(payload) {
    if (!adminCredential) throw new Error('Inicia sesión como administrador para continuar.');
    const response = await fetch(API_URL, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify({...payload, credential:adminCredential}), redirect:'follow' });
    const raw = await response.text();
    let result;
    try { result = JSON.parse(raw); } catch (_) { throw new Error('La API no devolvió JSON válido.'); }
    if (!response.ok || result.ok !== true) throw new Error(result.error || result.mensaje || 'La operación no se completó.');
    return result;
  };

  // Expediente individual imprimible. Todas las consultas son de solo lectura.
  const adminDetailOverlay = document.querySelector('#admin-student-detail');
  const adminDetailTitle = document.querySelector('#admin-detail-title');
  const adminDetailStatus = document.querySelector('#admin-detail-status');
  const adminDetailContent = document.querySelector('#admin-detail-content');
  const adminDetailPrint = document.querySelector('#admin-detail-print');
  let activeAdminStudent = null;
  let activeAdminDocuments = [];
  let adminDetailEditing = false;
  const pendingDocumentUploads = new Map();
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

  const adminDetailDialog = document.querySelector('.admin-detail-dialog');
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
    const relatedDoc = activeAdminDocuments.find(doc => belongsToStudent(doc, activeAdminStudent));
    if (!adminDetailEditing || !relatedDoc) {
      if (adminProfilePhotoStatus) adminProfilePhotoStatus.textContent = 'No se puede preparar la foto: activa Editar y verifica que exista el registro DOCUMENTOS relacionado.';
      return;
    }
    const photoKey = recordId(relatedDoc) + ':Fotoperfil';
    pendingDocumentUploads.set(photoKey, { file, remove:false });
    showDetailStatus('Foto seleccionada: ' + file.name + '. Pulsa el icono Guardar para enviarla a Notion.', false);
    renderProfilePhoto(activeAdminStudent, activeAdminDocuments);
  });

  function makeDetailSection(title, rows, pageClass, baseName) {
    const section = document.createElement('section');
    section.className = 'admin-detail-page ' + (pageClass || '');
    const heading = document.createElement('h4');
    heading.textContent = title;
    section.appendChild(heading);
    const dl = document.createElement('dl');
    dl.className = 'admin-detail-fields';
    rows.forEach(([label, value, rawProperty]) => {
      const wrap = document.createElement('div');
      wrap.dataset.property = label;
      wrap.dataset.base = baseName || 'ESTUDIANTE';
      const dt = document.createElement('dt'); dt.textContent = label;
      const dd = document.createElement('dd');
      const type = rawProperty && rawProperty.type;
      let normalized = value == null ? '' : String(value);
      if (type === 'checkbox') {
        const checkboxValue = rawProperty.checkbox === true || rawProperty.value === true;
        dd.dataset.value = String(checkboxValue);
        const indicator = document.createElement('span');
        indicator.className = 'admin-readonly-checkbox' + (checkboxValue ? ' is-checked' : '');
        indicator.textContent = checkboxValue ? '☑ Sí' : '☐ No';
        dd.appendChild(indicator);
      } else {
        dd.textContent = normalized || '—';
        dd.dataset.value = normalized;
      }
      if (rawProperty && type) dd.dataset.propertyType = type;
      if (rawProperty && ['select','status'].includes(type)) {
        const selected = rawProperty[type] || {};
        dd.dataset.selected = selected.name || '';
        dd.dataset.options = JSON.stringify((rawProperty._options || []).map(option => option.name));
      }
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

  // Caché en memoria durante la sesión administrativa. Solo se invalida tras guardar cambios.
  const adminReadCache = new Map();
  function invalidateAdminReadCache(...keys) {
    keys.forEach(key => adminReadCache.delete(key));
  }
  function cachedAdminRead(key, loader) {
    if (!adminReadCache.has(key)) {
      const pending = Promise.resolve().then(loader).catch(error => {
        adminReadCache.delete(key);
        throw error;
      });
      adminReadCache.set(key, pending);
    }
    return adminReadCache.get(key);
  }

  async function callAdminAction(payload) {
    if (!adminCredential) throw new Error('La sesión administrativa expiró. Inicia sesión de nuevo.');
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...payload, credential: adminCredential }),
      redirect: 'follow'
    });
    const raw = await response.text();
    let result;
    try { result = JSON.parse(raw); }
    catch (_) { throw new Error('La API no devolvió JSON válido al guardar.'); }
    if (!response.ok || result.ok !== true) {
      throw new Error(result.error || result.mensaje || 'La API rechazó la operación.');
    }
    return result;
  }

  async function adminConsulta(tipo, forceRefresh) {
    const loader = async () => {
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
    };
    if (forceRefresh) invalidateAdminReadCache(tipo);
    return cachedAdminRead(tipo, loader);
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
    const rows = orderedNames.filter(name => !/^(IdE|IdEstudiante)$/i.test(name)).map(name => [name, detailDisplayValue(studentProps[name]), studentProps[name]]);
    const programName = fieldValue(student, ['Programa','Programa solicitado','ProgramaAcademico','Carrera']);
    if (programName) rows.unshift(['Programa solicitado', programName]);
    adminDetailContent.appendChild(makeDetailSection('Página 1 · Datos del estudiante e información de la iglesia', rows, 'print-student-page'));

    const matchingDocs = activeAdminDocuments.filter(doc => belongsToStudent(doc, student));
    const docRecord = matchingDocs[0] || null;
    const fileFields = ['CedulaFrente','CedulaReverso','CartaPastoral','SubirDiploma'];
    const hiddenDocumentFields = /^(NombreCompleto|IdDocumento|IdD|IdD[0-9]*|IdEstudiante|IdE|IdRep_Entrevista|Fotoperfil|FotoPerfil|Foto de perfil)$/i;
    const autoDocumentFields = /^(FechaRevision|FechadeCarga|FechaCarga|FechaRevisionDocumento)$/i;

    if (docRecord) {
      const docProps = getProperties(docRecord);

      // Los campos administrativos solo se muestran cuando se activa Editar.
      if (adminDetailEditing) {
        const docRows = Object.keys(docProps)
          .filter(name => !hiddenDocumentFields.test(name) && !fileFields.includes(name))
          .map(name => {
            if (autoDocumentFields.test(name)) {
              const currentDate = new Date().toISOString().slice(0,10);
              const value = detailDisplayValue(docProps[name]) || currentDate;
              return [name, value, { type:'date', date:{ start:value }, _readonly:true }];
            }
            return [name, detailDisplayValue(docProps[name]), docProps[name]];
          });

        adminDetailContent.appendChild(
          makeDetailSection('Página 2 · Campos de DOCUMENTOS', docRows, 'print-documents-page', 'DOCUMENTOS')
        );
      }

      // En solo lectura, mostrar los archivos de DOCUMENTOS como imágenes,
      // tal como la galería original. Fotoperfil sigue en su marco propio.
      if (!adminDetailEditing) {
        const gallerySection = document.createElement('section');
        gallerySection.className = 'admin-detail-page print-documents-page';
        const galleryHeading = document.createElement('h4');
        galleryHeading.textContent = 'Página 2 · Documentos';
        gallerySection.appendChild(galleryHeading);
        let imageCount = 0;

        ['CedulaFrente','CedulaReverso','CartaPastoral','SubirDiploma'].forEach(field => {
          notionFiles(docProps[field]).forEach((file, index) => {
            const url = notionFileUrl(file);
            const fileName = file.name || (field + ' ' + (index + 1));
            if (!url || !/^https:\/\//i.test(url)) return;

            const isImage = /\.(png|jpe?g)(?:$|[?#])/i.test(fileName) ||
              /^image\/(png|jpeg)$/i.test(file.type || '');
            const label = document.createElement('h5');
            label.className = 'admin-document-label';
            label.textContent = field === 'CedulaFrente' ? 'Cédula · frente' :
              field === 'CedulaReverso' ? 'Cédula · reverso' :
              field === 'SubirDiploma' ? 'Diploma o constancia académica' : 'Carta pastoral';
            gallerySection.appendChild(label);

            if (isImage) {
              const figure = document.createElement('figure');
              figure.className = 'admin-document-figure';
              const image = document.createElement('img');
              image.src = url;
              image.alt = label.textContent;
              image.loading = 'eager';
              image.referrerPolicy = 'no-referrer';
              image.addEventListener('error', () => {
                figure.classList.add('admin-document-image-error');
                image.remove();
                const message = document.createElement('p');
                message.textContent = 'No se pudo mostrar esta imagen.';
                figure.appendChild(message);
              }, { once:true });
              figure.appendChild(image);
              gallerySection.appendChild(figure);
            } else if (/\.pdf(?:$|[?#])/i.test(fileName) || file.type === 'application/pdf') {
              const link = document.createElement('a');
              link.href = url;
              link.target = '_blank';
              link.rel = 'noopener noreferrer';
              link.textContent = 'Abrir PDF: ' + fileName;
              gallerySection.appendChild(link);
            }
            imageCount++;
          });
        });

        if (!imageCount) {
          const empty = document.createElement('p');
          empty.textContent = 'No hay archivos documentales adjuntos para mostrar.';
          gallerySection.appendChild(empty);
        }
        adminDetailContent.appendChild(gallerySection);
      } else {
        const uploadSection = document.createElement('section');
      uploadSection.className = 'admin-detail-page admin-document-upload-section';
      const uploadHeading = document.createElement('h4');
      uploadHeading.textContent = adminDetailEditing ? 'Archivos de DOCUMENTOS' : 'Documentos adjuntos';
      uploadSection.appendChild(uploadHeading);
      let visibleFiles = 0;

      fileFields.forEach(field => {
        const existingFiles = notionFiles(docProps[field]);
        const key = recordId(docRecord) + ':' + field;
        const pendingValue = pendingDocumentUploads.get(key);
        if (!adminDetailEditing && !existingFiles.length) return;
        if (adminDetailEditing || existingFiles.length) {
          const row = document.createElement('div');
          row.className = 'admin-document-upload-row';
          const label = document.createElement('strong');
          label.textContent = field === 'CedulaFrente' ? 'Cédula · frente' :
            field === 'CedulaReverso' ? 'Cédula · reverso' :
            field === 'SubirDiploma' ? 'Diploma o constancia académica' :
            field === 'CartaPastoral' ? 'Carta pastoral' : field;
          row.appendChild(label);

          if (existingFiles.length) {
            const filesList = document.createElement('div');
            filesList.className = 'admin-document-existing-files';
            existingFiles.forEach((file, index) => {
              const url = notionFileUrl(file);
              const fileName = file.name || ('Archivo ' + (index + 1));
              const isImage = /\.(png|jpe?g)(?:$|[?#])/i.test(fileName) ||
                /^image\/(png|jpeg)$/i.test(file.type || '');
              const link = document.createElement('a');
              link.textContent = fileName;
              if (url && /^https:\/\//i.test(url)) {
                link.href = url;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
              } else {
                link.href = '#';
                link.addEventListener('click', event => event.preventDefault());
              }

              if (url && /^https:\/\//i.test(url) && isImage) {
                const preview = document.createElement('img');
                preview.className = 'admin-document-preview-image';
                preview.src = url;
                preview.alt = fileName;
                preview.loading = 'lazy';
                preview.referrerPolicy = 'no-referrer';
                preview.addEventListener('error', () => preview.classList.add('is-unavailable'), { once:true });
                link.replaceChildren(preview, document.createTextNode(fileName));
                link.classList.add('admin-document-preview-link');
              }
              filesList.appendChild(link);

              if (adminDetailEditing) {
                const remove = document.createElement('button');
                remove.type = 'button';
                remove.className = 'button button-quiet admin-document-remove';
                remove.textContent = pendingValue && pendingValue.remove ? 'Se quitará al guardar · Deshacer' : 'Quitar';
                remove.addEventListener('click', () => {
                  const current = pendingDocumentUploads.get(key) || { file:null, remove:false };
                  current.remove = !current.remove;
                  pendingDocumentUploads.set(key, current);
                  remove.textContent = current.remove ? 'Se quitará al guardar · Deshacer' : 'Quitar';
                  remove.classList.toggle('is-danger', current.remove);
                  showDetailStatus(current.remove ? 'El archivo quedó marcado para quitarse al guardar.' : 'Se canceló la eliminación pendiente.', false);
                });
                filesList.appendChild(remove);
              }
            });
            row.appendChild(filesList);
            visibleFiles += existingFiles.length;
          } else if (!adminDetailEditing) {
            return;
          } else {
            const empty = document.createElement('p');
            empty.textContent = 'Sin archivo adjunto';
            row.appendChild(empty);
          }

          if (adminDetailEditing) {
            const picker = document.createElement('input');
            picker.type = 'file';
            picker.accept = '.jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf';
            picker.setAttribute('aria-label', label.textContent + ' · subir o reemplazar');
            picker.addEventListener('change', () => {
              const selected = picker.files && picker.files[0];
              if (!selected) return;
              if (selected.size > 4 * 1024 * 1024) {
                showDetailStatus('El archivo supera el límite de 4 MB.', true);
                picker.value = '';
                return;
              }
              const extension = selected.name.split('.').pop().toLowerCase();
              if (!['jpg','jpeg','png','pdf'].includes(extension) ||
                  !['image/jpeg','image/png','application/pdf'].includes(selected.type)) {
                showDetailStatus('Formato no permitido. Usa JPG, JPEG, PNG o PDF.', true);
                picker.value = '';
                return;
              }
              const current = pendingDocumentUploads.get(key) || { file:null, remove:false };
              current.file = selected;
              current.remove = false;
              pendingDocumentUploads.set(key, current);
              showDetailStatus('Archivo seleccionado: ' + selected.name + '. Pulsa Guardar cambios para enviarlo a Notion.', false);
            });
            row.appendChild(picker);
            const pending = document.createElement('small');
            pending.className = 'admin-document-pending';
            pending.dataset.pendingField = field;
            if (pendingValue && pendingValue.file) pending.textContent = 'Nuevo archivo: ' + pendingValue.file.name;
            row.appendChild(pending);
          }

          uploadSection.appendChild(row);
        }
      });

      if (!adminDetailEditing && visibleFiles === 0) {
        const empty = document.createElement('p');
        empty.textContent = 'No hay documentos adjuntos para mostrar.';
        uploadSection.appendChild(empty);
      }
      adminDetailContent.appendChild(uploadSection);
      }
    } else if (adminDetailEditing) {
      adminDetailContent.appendChild(
        makeDocumentSection('Página 2 · Documentos', null, ['CedulaFrente','CedulaReverso','CartaPastoral','SubirDiploma'])
      );
    } else {
      const section = document.createElement('section');
      section.className = 'admin-detail-page print-documents-page';
      const heading = document.createElement('h4');
      heading.textContent = 'Documentos adjuntos';
      section.appendChild(heading);
      const empty = document.createElement('p');
      empty.textContent = 'No hay documentos adjuntos para mostrar.';
      section.appendChild(empty);
      adminDetailContent.appendChild(section);
    }

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
    adminDetailEditing = false;
    if (adminDetailDialog) adminDetailDialog.classList.remove('is-editing');
    pendingDocumentUploads.clear();
    if (adminDetailEdit) adminDetailEdit.disabled = false;
    if (adminDetailOverlay) adminDetailOverlay.hidden = false;
    if (adminDetailTitle) adminDetailTitle.textContent = 'Expediente · ' + (studentField(student, 'nombre') || 'Estudiante');
    if (adminDetailContent) adminDetailContent.replaceChildren();
    showDetailStatus('Consultando datos guardados…', false);
    try {
      const [documents, answers] = await Promise.all([
        adminConsulta('documentos'),
        adminConsulta('respuestas')
      ]);
      activeAdminDocuments = documents;
      activeAdminAnswers = answers;
      const requestedProgram = fieldValue(student, ['Programa','Programa solicitado','ProgramaAcademico','Carrera']) || inferProgramFromAnswers(answers, student);
      const programCandidates = requestedProgram
        ? [requestedProgram, 'Bachillerato', 'Licenciatura', 'Maestría']
        : ['Bachillerato', 'Licenciatura', 'Maestría'];
      const uniquePrograms = [...new Set(programCandidates)];
      const questionLists = await Promise.all(uniquePrograms.map(programa => cachedAdminRead('preguntas:' + programa, async () => {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ accion: 'preguntas', programa }),
          redirect: 'follow'
        });
        const raw = await response.text();
        let result;
        try { result = JSON.parse(raw); } catch (_) { throw new Error('La API no devolvió JSON válido al consultar preguntas.'); }
        if (!response.ok || result.ok === false) throw new Error(result.error || result.mensaje || 'No se pudieron cargar las preguntas.');
        const data = result.preguntas || result.datos || result.data || result.registros || [];
        return Array.isArray(data) ? data : (Array.isArray(data.registros) ? data.registros : []);
      })));
      const questionsById = new Map();
      questionLists.flat().forEach(question => {
        const identifiers = [
          recordId(question),
          fieldValue(question, ['IdPreg_entrevista','IdPregEntrevista','IdPregunta','Código','Codigo'])
        ].filter(Boolean);
        identifiers.forEach(id => questionsById.set(String(id).trim().toLowerCase(), question));
      });
      activeAdminQuestions = [...questionsById.values()];
      renderAdminStudentDetail(student);
      renderProfilePhoto(student, activeAdminDocuments);
      showDetailStatus('Expediente listo. Los datos se conservan en caché durante esta sesión.', false);
    } catch (error) {
      showDetailStatus(error.message || 'No se pudo preparar el expediente.', true);
    }
  }


  const adminDetailEdit = document.querySelector('#admin-detail-edit');
  if (adminDetailEdit) adminDetailEdit.addEventListener('click', () => {
    if (!activeAdminStudent) return showDetailStatus('Selecciona primero un expediente.', true);
    const protectedField = name => /^(idE|idD|idDocumento|idEstudiante|idRep_Entrevista)$/i.test(name);
    const studentFields = new Set(Object.keys(getProperties(activeAdminStudent)));
    const relatedDocument = activeAdminDocuments.find(doc => belongsToStudent(doc, activeAdminStudent));
    const documentFields = new Set(relatedDocument ? Object.keys(getProperties(relatedDocument)) : []);
    const content = document.querySelector('#admin-detail-content');
    if (!content) return;
    const existing = content.querySelector('.admin-edit-actions');
    if (existing) return;
    adminDetailEditing = true;
    if (adminDetailDialog) adminDetailDialog.classList.add('is-editing');
    renderAdminStudentDetail(activeAdminStudent);
    let changed = 0;
    content.querySelectorAll('.admin-detail-fields > div').forEach(wrap => {
      const field = wrap.dataset.property;
      const base = wrap.dataset.base || 'ESTUDIANTE';
      const allowedFields = base === 'DOCUMENTOS' ? documentFields : studentFields;
      if (!allowedFields.has(field) || protectedField(field) || wrap.dataset.base === 'DOCUMENTOS' && /^(FechaRevision|FechadeCarga|FechaCarga|FechaRevisionDocumento)$/i.test(field)) return;
      const dd = wrap.querySelector('dd');
      if (!dd || dd.querySelector('input')) return;
      const type = dd.dataset.propertyType || '';
      const input = document.createElement(type === 'checkbox' ? 'input' : 'input');
      input.className = 'admin-inline-edit-input';
      input.dataset.field = field;
      input.dataset.propertyType = type;
      input.setAttribute('aria-label', field);
      if (type === 'checkbox') {
        input.type = 'checkbox';
        input.checked = dd.dataset.value === 'true';
      } else if (type === 'date' || /fecha/i.test(field)) {
        input.type = 'date';
        input.value = (dd.dataset.value || '').slice(0,10);
      } else {
        input.type = 'text';
        input.value = dd.dataset.value || '';
      }
      dd.replaceChildren(input);
      changed++;
    });
    if (!changed) return showDetailStatus('No se encontraron campos editables en este expediente.', true);
    const actions = document.createElement('div');
    actions.className = 'admin-edit-actions';
    const save = document.createElement('button');
    save.type = 'button'; save.className = 'button button-primary'; save.textContent = 'Guardar cambios';
    const cancel = document.createElement('button');
    cancel.type = 'button'; cancel.className = 'button button-quiet'; cancel.textContent = 'Cancelar edición';
    actions.append(save, cancel);
    content.prepend(actions);
    adminDetailEdit.disabled = false;
    const toolbarSave = document.querySelector('#admin-detail-save');
    const toolbarCancel = document.querySelector('#admin-detail-cancel');
    if (toolbarSave) toolbarSave.disabled = false;
    if (toolbarCancel) toolbarCancel.hidden = false;
    showDetailStatus('Modo de edición activo. Modifica los campos y guarda cuando termines.', false);
    cancel.addEventListener('click', async () => { adminDetailEditing=false; if (adminDetailDialog) adminDetailDialog.classList.remove('is-editing'); pendingDocumentUploads.clear(); selectedProfilePhotoFile=null; if(selectedProfilePhotoUrl){URL.revokeObjectURL(selectedProfilePhotoUrl);selectedProfilePhotoUrl='';} if(adminProfilePhotoInput) adminProfilePhotoInput.value=''; const toolbarSave=document.querySelector('#admin-detail-save'); const toolbarCancel=document.querySelector('#admin-detail-cancel'); if(toolbarSave) toolbarSave.disabled=true; if(toolbarCancel) toolbarCancel.hidden=true; adminDetailEdit.disabled = false; await openAdminStudentDetail(activeAdminStudent); adminDetailEdit.disabled = false; });
    save.addEventListener('click', async () => {
      const cambios = {};
      actions.parentElement.querySelectorAll('.admin-inline-edit-input').forEach(input => {
        const wrap = input.closest('[data-property]');
        const base = wrap && wrap.dataset.base || 'ESTUDIANTE';
        const field = input.dataset.field;
        const original = input.closest('dd').dataset.value || '';
        const type = input.dataset.propertyType || '';
        const value = type === 'checkbox' ? input.checked : input.value.trim();
        if (String(value) !== original) {
          if (!cambios[base]) cambios[base] = {};
          cambios[base][field] = value;
        }
      });
      const bases = Object.keys(cambios).filter(base => Object.keys(cambios[base]).length);
      const pendingCount = pendingDocumentUploads.size;
      if (!bases.length && !pendingCount) {
        showDetailStatus('No hay cambios ni archivos pendientes de guardar.', false);
        adminDetailEdit.disabled = false;
        return;
      }
      const total = bases.reduce((n,base) => n + Object.keys(cambios[base]).length, 0) + pendingCount;
      if (!window.confirm('Se guardarán ' + total + ' cambio(s), incluidos archivos seleccionados, en Notion. ¿Continuar?')) return;
      save.disabled = true; cancel.disabled = true;
      showDetailStatus('Guardando cambios en Notion…', false);
      try {
        let savedCount = 0;
        for (const base of bases) {
          const relatedDoc = activeAdminDocuments.find(doc => belongsToStudent(doc, activeAdminStudent));
          const id = base === 'ESTUDIANTE' ? recordId(activeAdminStudent) : (relatedDoc && recordId(relatedDoc));
          if (!id) throw new Error('No se encontró el registro relacionado de ' + base + '.');
          await callAdminAction({ accion:'adminActualizarRegistro', base, id, propiedades:cambios[base] });
          savedCount += Object.keys(cambios[base]).length;
        }
        for (const [key, pending] of pendingDocumentUploads.entries()) {
          const [docId, field] = key.split(':');
          if (pending.file) {
            await callAdminAction({accion:'adminReemplazarDocumento',id:docId,campo:field,archivo:{nombre:pending.file.name,tipo:pending.file.type,base64:await fileToBase64(pending.file)}});
            savedCount++;
          }
          if (pending.remove) {
            await callAdminAction({accion:'adminReemplazarDocumento',id:docId,campo:field,archivo:{eliminar:true}});
            savedCount++;
          }
        }
        pendingDocumentUploads.clear();
        selectedProfilePhotoFile=null;
        if(selectedProfilePhotoUrl){URL.revokeObjectURL(selectedProfilePhotoUrl);selectedProfilePhotoUrl='';}
        if(adminProfilePhotoInput) adminProfilePhotoInput.value='';
        adminDetailEditing = false;
        const toolbarSave=document.querySelector('#admin-detail-save');
        const toolbarCancel=document.querySelector('#admin-detail-cancel');
        if(toolbarSave) toolbarSave.disabled=true;
        if(toolbarCancel) toolbarCancel.hidden=true;
        if (adminDetailDialog) adminDetailDialog.classList.remove('is-editing');
        invalidateAdminReadCache('estudiantes','documentos');
        await loadAdminStudents(true);
        const refreshed = adminStudents.find(item => recordId(item) === recordId(activeAdminStudent)) || activeAdminStudent;
        adminDetailEdit.disabled = false;
        await openAdminStudentDetail(refreshed);
        showDetailStatus('Se guardaron correctamente ' + savedCount + ' cambio(s) en Notion.', false);
      } catch (error) {
        save.disabled = false; cancel.disabled = false; adminDetailEdit.disabled = false;
        showDetailStatus(error.message || 'No se pudieron guardar los cambios.', true);
      }
    });
  });

  const adminDetailSaveToolbar = document.querySelector('#admin-detail-save');
  if (adminDetailSaveToolbar) adminDetailSaveToolbar.addEventListener('click', () => {
    const inlineSave = adminDetailContent && adminDetailContent.querySelector('.admin-edit-actions .button-primary');
    if (inlineSave && adminDetailEditing) inlineSave.click();
    else showDetailStatus('Pulsa Editar antes de guardar cambios.', true);
  });

  const adminDetailCancelToolbar = document.querySelector('#admin-detail-cancel');
  if (adminDetailCancelToolbar) adminDetailCancelToolbar.addEventListener('click', () => {
    const inlineCancel = adminDetailContent && adminDetailContent.querySelector('.admin-edit-actions .button-quiet');
    if (inlineCancel && adminDetailEditing) inlineCancel.click();
    else showDetailStatus('El expediente no está en modo de edición.', false);
  });

  const adminDetailToggleStatus = document.querySelector('#admin-detail-toggle-status');
  if (adminDetailToggleStatus) adminDetailToggleStatus.addEventListener('click', async () => {
    if (!activeAdminStudent) return showDetailStatus('Selecciona primero un expediente.', true);
    const id = recordId(activeAdminStudent);
    const rawState = getProperties(activeAdminStudent).Estado;
    const current = rawState && typeof rawState === 'object' ? rawState.checkbox === true : rawState === true || String(rawState).toLowerCase() === 'sí' || String(rawState).toLowerCase() === 'true';
    const nextActive = !current;
    if (!window.confirm('¿Confirmas ' + (nextActive ? 'activar' : 'desactivar') + ' este registro?\n\nEl cambio se guardará en Notion.')) return;
    showDetailStatus('Actualizando estado…', false);
    try {
      const result = await callAdminAction({ accion: nextActive ? 'adminActivarRegistro' : 'adminDesactivarRegistro', base: 'ESTUDIANTE', id });
      showDetailStatus(result.mensaje || 'Estado actualizado.', false);
      invalidateAdminReadCache('estudiantes', 'documentos', 'respuestas');
      const studentId = recordId(activeAdminStudent);
      await loadAdminStudents();
      const refreshed = adminStudents.find(item => recordId(item) === studentId) || activeAdminStudent;
      await openAdminStudentDetail(refreshed);
    } catch (error) { showDetailStatus(error.message || 'No se pudo cambiar el estado.', true); }
  });

  const adminDetailReplaceDocument = document.querySelector('#admin-detail-replace-document');
  if (adminDetailReplaceDocument) adminDetailReplaceDocument.addEventListener('click', async () => {
    if (!activeAdminStudent) return showDetailStatus('Selecciona primero un expediente.', true);
    const relatedDocs = activeAdminDocuments.filter(doc => belongsToStudent(doc, activeAdminStudent));
    if (!relatedDocs.length) return showDetailStatus('No se encontró un registro DOCUMENTOS relacionado con este estudiante.', true);
    const fields = ['CedulaFrente','CedulaReverso','Fotoperfil','SubirDiploma','CartaPastoral'];
    const field = window.prompt('Nombre exacto del documento que vas a reemplazar:\n\n' + fields.join(', '), 'CedulaFrente');
    if (!field) return;
    if (!fields.includes(field.trim())) return showDetailStatus('Campo de documento no permitido.', true);
    const doc = relatedDocs.find(item => getProperties(item)[field.trim()] != null) || relatedDocs[0];
    const file = document.createElement('input'); file.type = 'file'; file.accept = 'image/jpeg,image/png,application/pdf';
    file.onchange = async () => {
      const selected = file.files && file.files[0]; if (!selected) return;
      if (selected.size > 4 * 1024 * 1024) return showDetailStatus('El archivo supera el límite de 4 MB.', true);
      if (!['image/jpeg','image/png','application/pdf'].includes(selected.type)) return showDetailStatus('Formato no permitido. Usa JPG, PNG o PDF.', true);
      if (!window.confirm('Se reemplazará el campo "' + field.trim() + '" del registro DOCUMENTOS seleccionado. ¿Continuar?')) return;
      showDetailStatus('Cargando y reemplazando documento…', false);
      try {
        const result = await callAdminAction({ accion: 'adminReemplazarDocumento', id: recordId(doc), campo: field.trim(), archivo: { nombre: selected.name, tipo: selected.type, base64: await fileToBase64(selected) } });
        showDetailStatus(result.mensaje || 'Documento reemplazado en Notion.', false);
        invalidateAdminReadCache('documentos');
        await openAdminStudentDetail(activeAdminStudent);
      } catch (error) { showDetailStatus(error.message || 'No se pudo reemplazar el documento.', true); }
    };
    file.click();
  });

  const adminDetailDelete = document.querySelector('#admin-detail-delete');
  if (adminDetailDelete) adminDetailDelete.addEventListener('click', async () => {
    if (!activeAdminStudent) return showDetailStatus('No hay un estudiante seleccionado.', true);
    const studentName = studentField(activeAdminStudent, 'nombre') || 'este estudiante';
    if (!window.confirm('ADVERTENCIA: vas a ARCHIVAR el registro de ' + studentName + '.\n\nEsto lo ocultará de los registros activos, pero NO lo elimina permanentemente ni archiva automáticamente los documentos y respuestas relacionados.\n\n¿Deseas continuar?')) return;
    const motivo = window.prompt('Escribe el motivo del archivo (mínimo 5 caracteres):');
    if (motivo === null || motivo.trim().length < 5) return showDetailStatus('Operación cancelada. Se requiere un motivo de al menos 5 caracteres.', true);
    showDetailStatus('Archivando registro…', false);
    try {
      const result = await callAdminAction({ accion: 'adminEliminarRegistro', base: 'ESTUDIANTE', id: recordId(activeAdminStudent), confirmar: true, motivo: motivo.trim() });
      showDetailStatus(result.mensaje || 'Registro archivado. No se borró permanentemente.', false);
      adminDetailDelete.disabled = true;
      invalidateAdminReadCache('estudiantes', 'documentos', 'respuestas');
      await loadAdminStudents();
    } catch (error) { showDetailStatus(error.message || 'No se pudo archivar el registro.', true); }
  });

  const detailRefresh = document.querySelector('#admin-detail-refresh');
  const detailEnroll = document.querySelector('#admin-detail-enroll');
  const detailPayments = document.querySelector('#admin-detail-payments');
  if (detailRefresh) detailRefresh.addEventListener('click', () => {
    if (activeAdminStudent) {
      // Este botón ya no recarga Notion: activa el modo de edición en línea.
      if (adminDetailEdit) adminDetailEdit.click();
    }
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
      .id-document img{display:block;width:125mm;height:72mm;max-width:100%;object-fit:contain;margin:0 auto 2mm;transform-origin:center center;background:#fff}
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