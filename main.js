require('dotenv').config();
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  const date = new Date();
  const dia = date.toLocaleDateString('pt-BR', { day: '2-digit' });

  const issue = await contratosTreina(page);
  await FirstDecision(page, dia, issue);

  await browser.close();
})();

function getRandomMinutes() {
  return Math.floor(Math.random() * 9) + 1;
}

function horarioEntrada(minutosAleatorios) {
  return calcularHorario(8, 55, minutosAleatorios);
}

function horarioAlmoco(minutosAleatorios, inicioAlmoco = false) {
  const inicio = calcularHorario(12, 5, minutosAleatorios);
  return inicioAlmoco ? inicio : new Date(inicio.getTime() + 60 * 60000);
}

function horarioSaida(minutosAleatorios) {
  return calcularHorario(17, 55, minutosAleatorios);
}

function calcularHorario(horas, minutos, minutosAleatorios) {
  const horario = new Date();
  horario.setHours(horas);
  horario.setMinutes(minutos + minutosAleatorios);
  return horario;
}

function formatarHorario(horario) {
  return horario.toTimeString().slice(0, 5);
}

async function contratosTreina(page) {
  await page.goto('https://treina.contratos.comprasnet.gov.br/login');
  await page.waitForSelector('.main-footer');

  return await page.evaluate(() => {
    const divElement = document.querySelector('.pull-right.hidden-xs');
    if (!divElement) return null;
    const textoCompleto = divElement.textContent.trim();
    const inicio = textoCompleto.indexOf('v. ') + 3;
    const fim = textoCompleto.indexOf('(');
    return textoCompleto.substring(inicio, fim).trim();
  });
}

async function FirstDecision(page, dia, issue) {
  await page.goto('https://app.firstdecision.com.br/pmdecision/Login?ReturnURL=https://app.firstdecision.com.br:443/PMDecision');

  await page.type('input#Login', process.env.LOGIN);
  await page.type('input#Senha', process.env.SENHA);

  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
  ]);

  await preencherFormulario(page, dia, issue, true);
  await preencherFormulario(page, dia, issue, false);
}

async function preencherFormulario(page, dia, issue, inicioAlmoco) {
  await page.goto('https://app.firstdecision.com.br/pmdecision/Lancamento/Create');

  const minutosAleatorios = getRandomMinutes();
  const horaInicio = inicioAlmoco ? horarioEntrada(minutosAleatorios) : horarioAlmoco(minutosAleatorios, false);
  const horaTermino = inicioAlmoco ? horarioAlmoco(minutosAleatorios, true) : horarioSaida(minutosAleatorios);

  await page.type('input#Dia', dia);
  await page.type('input#HoraInicio', formatarHorario(horaInicio));
  await page.type('input#HoraTermino', formatarHorario(horaTermino));

  await page.evaluate(() => {
    document.querySelectorAll('#TipoAtividadeId, #ClienteId').forEach(el => el.remove());

    const criarInput = (id, valor) => {
      const input = document.createElement('input');
      input.type = 'text';
      input.id = id;
      input.name = id;
      input.value = valor;
      document.querySelector('.form-group').appendChild(input);
    };

    criarInput('TipoAtividadeId', '2117');
    criarInput('ClienteId', '2074');
  });

  await page.type('textarea#Detalhamento', issue);

  await page.evaluate(() => {
    const submitButton = document.querySelector('.fd-form-buttons button[type="submit"]');
    if (submitButton) setTimeout(() => submitButton.click(), 1000);
  });

  await page.waitForNavigation();
}
