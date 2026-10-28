'use strict';
const { createHash } = require('node:crypto');
const MAX_BYTES = 10 * 1024 * 1024;
class IntakeError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
const fail = (message) => {
  throw new IntakeError('invalid-argument', message);
};
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
function text(value, label, max, required = false) {
  if (value == null && !required) return '';
  if (
    typeof value !== 'string' ||
    value.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
  )
    fail(label + ' inválido.');
  const result = value.trim();
  if (required && !result) fail(label + ' obrigatório.');
  return result;
}
function mediaType(bytes) {
  if (bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return 'image/jpeg';
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return 'image/png';
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP')
    return 'image/webp';
  if (bytes.toString('ascii', 0, 5) === '%PDF-') return 'application/pdf';
  if (
    bytes.toString('ascii', 4, 8) === 'ftyp' &&
    /^(heic|heix|hevc|hevx)$/.test(bytes.toString('ascii', 8, 12))
  )
    return 'image/heic';
  if (bytes.toString('ascii', 4, 8) === 'ftyp' && bytes.toString('ascii', 8, 12) === 'qt  ')
    return 'video/quicktime';
  if (
    bytes.toString('ascii', 4, 8) === 'ftyp' &&
    /^(isom|iso2|mp41|mp42|avc1|M4V )$/.test(bytes.toString('ascii', 8, 12))
  )
    return 'video/mp4';
  if (
    bytes.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163])) &&
    bytes.subarray(0, 4096).includes(Buffer.from('webm'))
  )
    return 'video/webm';
  fail('Formato de anexo não suportado. Use JPEG, PNG, WebP, HEIC, PDF, MP4, MOV ou WebM.');
}
function normalize(input, now = Date.now()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Solicitação inválida.');
  const allowed = [
    'requestId',
    'name',
    'order',
    'channel',
    'contact',
    'product',
    'received',
    'installed',
    'vehicle',
    'problem',
    'notes',
    'files',
  ];
  if (Object.keys(input).some((k) => !allowed.includes(k))) fail('Campo não permitido.');
  const requestId = text(input.requestId, 'Identificador', 36, true).toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(requestId))
    fail('Identificador inválido.');
  const name = text(input.name, 'Nome', 120, true);
  const order = text(input.order, 'Pedido', 5);
  if (order && !/^#[0-9]{4}$/.test(order)) fail('Pedido deve ter # e quatro números.');
  const channel = text(input.channel, 'Canal', 8, true);
  const contact = text(input.contact, 'Contato', 180, true);
  if (!['WhatsApp', 'E-mail'].includes(channel)) fail('Selecione um canal.');
  if (channel === 'E-mail' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) fail('E-mail inválido.');
  if (
    channel === 'WhatsApp' &&
    (!/^[+()\d\s.-]+$/.test(contact) || !/^\d{10,15}$/.test(contact.replace(/\D/g, '')))
  )
    fail('WhatsApp inválido.');
  const product = text(input.product, 'Produto', 500, true);
  const received = text(input.received, 'Recebimento', 10, true);
  const date = new Date(received + 'T12:00:00Z');
  const today = new Date(now).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(received) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== received ||
    received > today
  )
    fail('Data de recebimento inválida.');
  const installed = text(input.installed, 'Instalação', 7, true);
  if (!['Sim', 'Não', 'Não sei'].includes(installed)) fail('Informe se a peça foi instalada.');
  const vehicle = text(input.vehicle, 'Veículo', 220);
  const problem = text(input.problem, 'Problema', 3000, true);
  if (problem.length < 10) fail('Descreva o problema com pelo menos dez caracteres.');
  const notes = text(input.notes, 'Observações', 1500);
  if (!Array.isArray(input.files) || input.files.length > 5) fail('Envie até cinco anexos.');
  let total = 0;
  const files = input.files.map((f, index) => {
    if (
      !f ||
      typeof f !== 'object' ||
      Object.keys(f).some((k) => !['name', 'type', 'base64'].includes(k))
    )
      fail('Anexo inválido.');
    const name = text(f.name, 'Nome do anexo', 180, true);
    if (/[\\/]/.test(name)) fail('Nome do anexo inválido.');
    if (
      typeof f.base64 !== 'string' ||
      !f.base64.length ||
      f.base64.length > Math.ceil(MAX_BYTES / 3) * 4 ||
      f.base64.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(f.base64)
    )
      fail('Anexo inválido.');
    const bytes = Buffer.from(f.base64, 'base64');
    total += bytes.length;
    if (!bytes.length || total > MAX_BYTES || bytes.toString('base64') !== f.base64)
      fail('Anexos excedem 10 MB ou são inválidos.');
    const type = mediaType(bytes);
    if (f.type !== type) fail('Tipo do anexo não corresponde ao conteúdo.');
    return { name, type, bytes, size: bytes.length, sha256: digest(bytes), index };
  });
  const fields = {
    name,
    order,
    channel,
    contact,
    product,
    received,
    installed,
    vehicle,
    problem,
    notes,
  };
  const fingerprint = digest(
    JSON.stringify({
      fields,
      files: files.map(({ name, type, size, sha256 }) => ({ name, type, size, sha256 })),
    })
  );
  return { requestId, fields, files, fingerprint };
}
function records(data, attachments, timestamp, now) {
  const f = data.fields;
  const protocol = 'JI-' + data.requestId.toUpperCase();
  const claim = {
    client_name: f.name,
    supplier_name: '',
    product_brand: '',
    item_name: f.product,
    item_code: '',
    defect_description: f.problem,
    sale_date: '',
    invoice_number: '',
    requested_by: 'site',
    status: 'pendente',
    origin: 'site',
    site_protocol: protocol,
    site_order: f.order,
    site_contact_channel: f.channel,
    site_contact: f.contact,
    site_received: f.received,
    site_installed: f.installed,
    site_vehicle: f.vehicle,
    site_notes: f.notes,
    site_attachments: attachments,
    product_images: [],
    labor_reimbursement_enabled: false,
    labor_reimbursement_file_url: null,
    bank_details: null,
    vehicle_document_url: null,
    identity_document_url: null,
    installation_mileage: null,
    current_mileage: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
  // Same assignee/sector/priority as the existing manual create flow.
  const task = {
    board_visible: true,
    title: '🛡️ Garantia: ' + f.name + ' - ' + f.product,
    description:
      'Solicitação recebida pelo Site\nProtocolo: ' +
      protocol +
      '\nPedido: ' +
      (f.order || 'Não informado'),
    status: 'todo',
    priority: 'high',
    assignee_id: 'emp-12',
    created_by: 'Site',
    source: 'site',
    warranty_id: 'site_' + data.requestId,
    deadline: new Date(now).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }),
    sector: 'garantias',
    status_history: [{ status: 'todo', enteredAt: new Date(now).toISOString() }],
    created_at: timestamp,
    updated_at: timestamp,
  };
  return { claim, task, protocol };
}
function createIntake({ reserve, saveFile, complete, now = Date.now, timestamp = () => now() }) {
  return async function intake(input) {
    const data = normalize(input, now());
    const receipt = await reserve(data);
    if (receipt.done) return { protocol: receipt.protocol, received: true };
    const attachments = [];
    for (const file of data.files) {
      const path =
        'attachments/warranties/site/' + data.requestId + '/' + data.fingerprint + '/' + file.index;
      await saveFile(path, file);
      attachments.push({
        path,
        name: file.name,
        type: file.type,
        size: file.size,
        sha256: file.sha256,
      });
    }
    const content = records(data, attachments, timestamp(), now());
    await complete(data, receipt.owner, content);
    return { protocol: content.protocol, received: true };
  };
}
module.exports = { IntakeError, normalize, records, createIntake, MAX_BYTES };
