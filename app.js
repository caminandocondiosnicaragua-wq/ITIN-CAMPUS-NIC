(() => {
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
  let currentStep = 0;

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
    const program = link.dataset.program;
    document.getElementById('program-select').value = program;
  }));
  menuToggle.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(open));
  });

  function updateStep() {
    steps.forEach((step, index) => {
      step.hidden = index !== currentStep;
      step.classList.toggle('is-current', index === currentStep);
    });
    stepItems.forEach((item, index) => {
      item.classList.toggle('current', index === currentStep);
      item.classList.toggle('done', index < currentStep);
    });
    progressFill.style.width = ((currentStep + 1) / steps.length * 100) + '%';
    progressCount.textContent = 'Etapa ' + (currentStep + 1) + ' de ' + steps.length;
    backButton.disabled = currentStep === 0;
    nextButton.hidden = currentStep === steps.length - 1;
    submitButton.hidden = currentStep !== steps.length - 1;
    alertBox.hidden = true;
  }

  function validateCurrentStep() {
    const fields = [...steps[currentStep].querySelectorAll('input, select, textarea')].filter(field => field.type !== 'checkbox');
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
    currentStep = Math.min(currentStep + 1, steps.length - 1);
    updateStep();
    document.querySelector('.form-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  backButton.addEventListener('click', () => {
    currentStep = Math.max(0, currentStep - 1);
    updateStep();
    document.querySelector('.form-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!validateCurrentStep()) return;
    const confirmation = form.querySelector('[name="Confirmacion"]');
    if (!confirmation.checked) {
      confirmation.reportValidity();
      return;
    }
    alertBox.textContent = 'La interfaz está preparada, pero el envío todavía no está conectado a la API. No se ha enviado ni guardado información personal. La integración se habilitará después de configurar la carga segura de documentos y validar los campos con Notion.';
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
    programas: 'ITIN presenta tres opciones de formación: Bachillerato en Teología, Licenciatura y Maestría. Consulta los requisitos oficiales con el instituto antes de enviar tu solicitud.',
    solicitud: 'Abre “Solicitud de inscripción” y avanza por las cuatro etapas: datos personales, información de la iglesia, documentos y entrevista. Puedes volver a las etapas anteriores antes de terminar.',
    proceso: 'Enviar una solicitud no equivale a una admisión ni a una matrícula. La institución revisará la información y comunicará los siguientes pasos.'
  };
  document.querySelectorAll('[data-help]').forEach(button => button.addEventListener('click', () => {
    document.getElementById('assistant-reply').textContent = replies[button.dataset.help];
  }));

  readHash();
})();