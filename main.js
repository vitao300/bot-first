require('dotenv').config();
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: false, ignoreHTTPSErrors: true });
  const page = await browser.newPage();
  const date = new Date();
  const dia = date.toLocaleDateString('pt-BR', { day: '2-digit' });
  const issue = await gitLabVitao(page);
  //console.log(issue);
  //const issue = await contratosTreina(page);
  await FirstDecision(page, dia, issue);

  await browser.close();
})();

function getRandomMinutes() {
  return Math.floor(Math.random() * 9) + 1; // Gera um número aleatório entre 1 e 9
}

function evitarHorarioBritanico(minutosAleatorios) {
  // Se o valor aleatório for 5, substituímos por 6 para evitar horário exato (ex: 8:00, 12:00, etc.)
  return minutosAleatorios === 5 ? 6 : minutosAleatorios;
}

function horarioEntrada(minutosAleatorios) {
  const minutosCorrigidos = evitarHorarioBritanico(minutosAleatorios);
  return calcularHorario(8, 55, minutosCorrigidos);
}

function horarioAlmoco(minutosAleatorios, inicioAlmoco = false) {
  const minutosCorrigidos = evitarHorarioBritanico(minutosAleatorios);
  const inicio = calcularHorario(12, 5, minutosCorrigidos);
  const fim = new Date(inicio.getTime() + 60 * 60000); // Sempre 1h depois
  return inicioAlmoco ? inicio : fim;
}

function horarioSaida(minutosAleatorios) {
  const minutosCorrigidos = evitarHorarioBritanico(minutosAleatorios);
  return calcularHorario(17, 55, minutosCorrigidos);
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

async function gitLabVitao(page) {
  await page.goto('https://gitlab.com/vitao300');
  await page.waitForSelector('.ref-name');

  const textoExtraido = await page.evaluate(() => {
    const linkElement = document.querySelector('.ref-name');
    return linkElement ? linkElement.textContent.trim() : null; // Agora há um RETURN explícito
  });

  //console.log(textoExtraido);
  return "Desenvolvimento da issue: " + textoExtraido; // Se quiser usar esse valor depois
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

  const minutosAleatorios = evitarHorarioBritanico(getRandomMinutes()); // Gera minutos aleatórios e evita horário britânico

  await preencherFormulario(page, dia, issue, true, minutosAleatorios);
  await preencherFormulario(page, dia, issue, false, minutosAleatorios);
}

async function preencherFormulario(page, dia, issue, inicioAlmoco, minutosAleatorios) {
  await page.goto('https://app.firstdecision.com.br/pmdecision/Lancamento/Create');

  const horaInicio = inicioAlmoco ? horarioEntrada(minutosAleatorios) : horarioAlmoco(minutosAleatorios, false);
  const horaTermino = inicioAlmoco ? horarioAlmoco(minutosAleatorios, true) : horarioSaida(minutosAleatorios);
  const horaInicioFormatada = formatarHorario(horaInicio);
  const horaTerminoFormatada = formatarHorario(horaTermino);

  await page.type('input#Dia', dia);

  // Preenche os campos de hora diretamente modificando o valor do elemento
  await page.evaluate((horaInicioFormatada, horaTerminoFormatada) => {
    document.querySelector('input#HoraInicio').value = horaInicioFormatada;
    document.querySelector('input#HoraTermino').value = horaTerminoFormatada;
  }, horaInicioFormatada, horaTerminoFormatada);

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