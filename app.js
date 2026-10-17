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

  document.getElementById('current-year').textContent = new Date().getFullYear();

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
    backButton.disabled = position === 0;
    nextButton.hidden = position === active.length - 1;
    submitButton.hidden = position !== active.length - 1;
    consentContainer.hidden = position !== active.length - 1;
    alertBox.hidden = true;
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
    questions.forEach((question, index) => {
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
      answer.rows = 4;
      answer.placeholder = 'Escribe tu respuesta con tus propias palabras…';
      wrapper.append(label, answer);
      questionBox.append(wrapper);
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
      renderQuestionMessage('La Maestría no requiere entrevista en este proceso. Al finalizar Documentos podrás confirmar tu solicitud.');
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
        body: JSON.stringify({ accion: 'preguntas', solicitud: { programa: program } }),
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

  form.querySelectorAll('.document-input').forEach(input => {
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const allowed = ['image/png', 'image/jpeg'];
      if (!allowed.includes(file.type)) {
        input.setCustomValidity('Selecciona una imagen PNG, JPG o JPEG.');
        input.reportValidity();
        input.value = '';
        return;
      }
      input.setCustomValidity('');
      const small = input.closest('.upload-card').querySelector('small');
      small.textContent = file.name + ' · ' + Math.max(1, Math.round(file.size / 1024)) + ' KB';
    });
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!validateCurrentStep()) return;
    if (!form.querySelector('[name="Confirmacion"]').checked) {
      form.querySelector('[name="Confirmacion"]').reportValidity();
      return;
    }
    alertBox.textContent = 'La solicitud aún no se ha enviado ni guardado. Las preguntas pueden consultarse desde la API si el navegador permite la conexión, pero el envío completo y la carga segura de documentos todavía deben integrarse y probarse antes de recibir solicitudes reales.';
    alertBox.hidden = false;
    alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  const assistantPanel = document.getElementById('assistant-panel');
  document.getElementById('assistant-launcher').addEventListener('click', () => {
    assistantPanel.hidden = !assistantPanel.hidden;
  });
  document.getElementById('assistant-close').addEventListener('click', () => {
    assistantPanel.hidden = true;
  });
  const replies = {
    programas: 'ITIN ofrece tres opciones de formación. El Bachillerato en Teología permite construir una base sólida en el estudio bíblico y los fundamentos de la teología cristiana. La Licenciatura profundiza en la reflexión teológica y fortalece las herramientas para la enseñanza y el servicio ministerial. La Maestría ofrece formación avanzada orientada al análisis, la enseñanza y el liderazgo cristiano. Para conocer los requisitos específicos y la documentación requerida, consulta directamente con el instituto.',
    solicitud: 'La solicitud se completa por etapas. Primero se registran los datos personales y de contacto; después, la información de la iglesia y del ministerio; luego, los documentos solicitados; y, para Bachillerato y Licenciatura, las preguntas de entrevista que corresponden al programa. En Maestría no se presenta esta etapa de entrevista. Puedes volver a las etapas anteriores antes de confirmar la solicitud. Revisa cuidadosamente tus respuestas antes de continuar.',
    proceso: 'Enviar una solicitud no significa que la persona ya haya sido admitida ni matriculada. La información será revisada por el instituto y, después de esa revisión, la institución comunicará los siguientes pasos. La matrícula y los procesos académicos o financieros son etapas posteriores y no forman parte de esta solicitud pública.'
  };
  document.querySelectorAll('[data-help]').forEach(button => button.addEventListener('click', () => {
    document.getElementById('assistant-reply').textContent = replies[button.dataset.help];
  }));

  readHash();
  updateInterviewForProgram();
})();