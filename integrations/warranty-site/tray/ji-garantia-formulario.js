(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x) =>
    typeof require !== 'undefined'
      ? require
      : typeof Proxy !== 'undefined'
        ? new Proxy(x, {
            get: (a, b) => (typeof require !== 'undefined' ? require : a)[b],
          })
        : x)(function (x) {
    if (typeof require !== 'undefined') return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __copyProps = (to, from, except, desc) => {
    if ((from && typeof from === 'object') || typeof from === 'function') {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, {
            get: () => from[key],
            enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable,
          });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (
    (target = mod != null ? __create(__getProtoOf(mod)) : {}),
    __copyProps(
      // If the importer is in node compatibility mode or this is not an ESM
      // file that has been converted to a CommonJS file using a Babel-
      // compatible transform (i.e. "__esModule" has not been set), then set
      // "default" to the CommonJS "module.exports" for node compatibility.
      isNodeMode || !mod || !mod.__esModule
        ? __defProp(target, 'default', { value: mod, enumerable: true })
        : target,
      mod
    )
  );

  // src/formulario.js
  (() => {
    'use strict';
    const root2 = document.querySelector('.ji-warranty-request');
    if (!root2) return;
    const $ = (id) => root2.querySelector('#ji-gw-' + id);
    const form = $('form'),
      review = $('review'),
      result = $('result'),
      steps = [...root2.querySelectorAll('.ji-gw-steps li')];
    const files = [];
    const originals = /* @__PURE__ */ new Map();
    let processing = false;
    let uploadQueue = Promise.resolve();
    const MB = 1024 * 1024;
    function transition(panel, step) {
      form.hidden = panel !== 'form';
      review.hidden = panel !== 'review';
      result.hidden = panel !== 'result';
      steps.forEach((li, i) => {
        if (i === step) li.setAttribute('aria-current', 'step');
        else li.removeAttribute('aria-current');
      });
    }
    function announce(message) {
      $('file-status').textContent = message;
    }
    function size(bytes) {
      return bytes < MB
        ? Math.max(1, Math.ceil(bytes / 1024)) + ' KB'
        : (bytes / MB).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' MB';
    }
    function updateFiles() {
      try {
        const transfer = new DataTransfer();
        files.forEach((file) => transfer.items.add(file));
        $('files').files = transfer.files;
      } catch (_) {
        $('files').value = '';
      }
      const list = $('file-list');
      list.replaceChildren();
      files.forEach((file, index) => {
        const item = document.createElement('li'),
          name = document.createElement('span'),
          button = document.createElement('button');
        name.textContent =
          file.name +
          ' · ' +
          size(file.size) +
          (originals.has(file) ? ' (original: ' + size(originals.get(file).size) + ')' : '');
        button.type = 'button';
        button.textContent = 'Remover';
        button.setAttribute('aria-label', 'Remover arquivo ' + file.name);
        button.addEventListener('click', () => {
          originals.delete(files[index]);
          files.splice(index, 1);
          updateFiles();
          announce('Arquivo removido. ' + files.length + ' arquivo(s) selecionado(s).');
          const next = list.querySelectorAll('button')[Math.min(index, files.length - 1)];
          (next || $('files')).focus();
        });
        const actions = document.createElement('div');
        actions.className = 'ji-gw-file-actions';
        if (originals.has(file)) {
          const restore = document.createElement('button');
          restore.type = 'button';
          restore.textContent = 'Usar original';
          restore.setAttribute('aria-label', 'Usar original de ' + file.name);
          restore.disabled = processing;
          restore.addEventListener('click', () => {
            const original = originals.get(file);
            if (files.reduce((sum, f) => sum + f.size, 0) - file.size + original.size > 10 * MB) {
              announce('O original ultrapassa o limite total. Combine o envio conosco.');
              return;
            }
            files[index] = original;
            originals.delete(file);
            updateFiles();
            announce('Arquivo original selecionado.');
            $('files').focus();
          });
          actions.append(restore);
        }
        button.disabled = processing;
        actions.append(button);
        item.append(name, actions);
        list.append(item);
      });
    }
    async function addFiles(incoming) {
      const errors = [];
      let added = 0;
      for (let file of incoming) {
        const extension = file.name.split('.').pop().toLowerCase(),
          video = ['mp4', 'mov', 'webm'].includes(extension),
          allowed = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'pdf', 'mp4', 'mov', 'webm'].includes(
            extension
          );
        if (!allowed) {
          errors.push(
            'Formato não aceito: ' + file.name + '. Use foto, PDF ou vídeo nos formatos indicados.'
          );
          continue;
        }
        if (file.size === 0) {
          errors.push(file.name + ' está vazio. Escolha outro arquivo.');
          continue;
        }
        if (file.size > 10 * MB) {
          errors.push(file.name + ' excede o limite de 10 MB.');
          continue;
        }
        if (
          files.some((f) => {
            const original2 = originals.get(f) || f;
            return (
              original2.name === file.name &&
              original2.size === file.size &&
              original2.lastModified === file.lastModified
            );
          })
        ) {
          errors.push(file.name + ' já foi adicionado.');
          continue;
        }
        if (files.length >= 5) {
          errors.push('Você pode incluir até 5 arquivos.');
          break;
        }
        const original = file;
        file = await optimizePhoto(file);
        if (files.reduce((sum, f) => sum + f.size, 0) + file.size > 10 * MB) {
          errors.push('O total dos arquivos deve ser de até 10 MB.');
          continue;
        }
        if (file !== original) originals.set(file, original);
        files.push(file);
        added++;
      }
      updateFiles();
      announce((added ? added + ' arquivo(s) adicionado(s). ' : '') + errors.join(' '));
    }
    async function optimizePhoto(file) {
      if (
        !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
        file.size < 300 * 1024 ||
        typeof createImageBitmap !== 'function'
      )
        return file;
      let bitmap, canvas;
      try {
        bitmap = await createImageBitmap(file);
        if (bitmap.width * bitmap.height > 24e6) return file;
        const ratio = Math.min(1, 2560 / Math.max(bitmap.width, bitmap.height));
        canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
        canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
        const context = canvas.getContext('2d');
        if (!context) return file;
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9));
        if (!blob || blob.type !== 'image/webp' || blob.size >= file.size * 0.92) return file;
        return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', {
          type: 'image/webp',
          lastModified: file.lastModified,
        });
      } catch (_) {
        return file;
      } finally {
        if (bitmap) bitmap.close();
        if (canvas) {
          canvas.width = 1;
          canvas.height = 1;
        }
      }
    }
    let pendingFileJobs = 0;
    function queueFiles(incoming) {
      pendingFileJobs++;
      processing = true;
      form.querySelector('[type=submit]').disabled = true;
      uploadQueue = uploadQueue.then(async () => {
        processing = true;
        $('files').setAttribute('aria-busy', 'true');
        form.querySelector('[type=submit]').disabled = true;
        updateFiles();
        announce('Preparando arquivos neste dispositivo…');
        try {
          await addFiles(incoming);
        } catch (_) {
          announce(
            'Não foi possível preparar os arquivos. Tente novamente ou continue sem anexos.'
          );
        } finally {
          pendingFileJobs--;
          processing = pendingFileJobs > 0;
          if (!processing) $('files').removeAttribute('aria-busy');
          form.querySelector('[type=submit]').disabled = processing;
          updateFiles();
        }
      });
    }
    $('files').addEventListener('change', (event) => queueFiles([...event.target.files]));
    const drop = $('drop');
    ['dragenter', 'dragover'].forEach((type) =>
      drop.addEventListener(type, (event) => {
        event.preventDefault();
        drop.classList.add('is-over');
      })
    );
    drop.addEventListener('dragleave', (event) => {
      if (!drop.contains(event.relatedTarget)) drop.classList.remove('is-over');
    });
    drop.addEventListener('drop', (event) => {
      event.preventDefault();
      drop.classList.remove('is-over');
      queueFiles([...event.dataTransfer.files]);
    });
    $('installed').addEventListener('change', () => {
      $('vehicle-field').hidden = $('installed').value !== 'Sim';
      $('installed').classList.toggle('is-placeholder', !$('installed').value);
    });
    const contactDrafts = { WhatsApp: '', 'E-mail': '' };
    let channel = '';
    $('channel').addEventListener('change', () => {
      if (channel) contactDrafts[channel] = $('contact').value;
      channel = $('channel').value;
      const email = channel === 'E-mail';
      $('channel').classList.toggle('is-placeholder', !channel);
      $('contact-label').replaceChildren(
        document.createTextNode(email ? 'Seu e-mail ' : 'Seu WhatsApp ')
      );
      const star = document.createElement('span');
      star.className = 'ji-gw-required-mark';
      star.textContent = '*';
      star.setAttribute('aria-hidden', 'true');
      $('contact-label').append(star);
      $('contact').disabled = !channel;
      $('contact').type = email ? 'email' : 'tel';
      $('contact').autocomplete = email ? 'email' : 'tel';
      $('contact').inputMode = email ? 'email' : 'tel';
      $('contact').placeholder = email ? 'Ex.: seuemail@exemplo.com' : 'Ex.: (12) 99999-0000';
      $('contact').value = contactDrafts[channel] || '';
      $('contact-error').textContent = '';
      $('contact').removeAttribute('aria-invalid');
      $('channel-error').textContent = '';
      $('channel').removeAttribute('aria-invalid');
    });
    $('contact').addEventListener('blur', () => {
      const el = $('contact');
      el.value = el.value.trim();
      if (channel !== 'WhatsApp') return;
      const raw = el.value,
        digits = raw.replace(/\D/g, '');
      if (!/^\+?[\d\s().-]+$/.test(raw)) return;
      if (digits.length === 10 || digits.length === 11)
        el.value = '(' + digits.slice(0, 2) + ') ' + digits.slice(2, -4) + '-' + digits.slice(-4);
      else if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13))
        el.value =
          '+55 (' + digits.slice(2, 4) + ') ' + digits.slice(4, -4) + '-' + digits.slice(-4);
    });
    const localToday = /* @__PURE__ */ new Date();
    const today = [
      localToday.getFullYear(),
      String(localToday.getMonth() + 1).padStart(2, '0'),
      String(localToday.getDate()).padStart(2, '0'),
    ].join('-');
    $('date').max = today;
    const dateError = document.createElement('small');
    dateError.id = 'ji-gw-date-error';
    dateError.className = 'ji-gw-error';
    $('date').after(dateError);
    $('date').setAttribute('aria-describedby', dateError.id);
    const installError = document.createElement('small');
    installError.id = 'ji-gw-installed-error';
    installError.className = 'ji-gw-error';
    $('installed').closest('.ji-gw-field').append(installError);
    let orderPasteInvalid = false;
    $('order').addEventListener('paste', (event) => {
      const value = event.clipboardData?.getData('text').trim().replace(/^#/, '');
      if (value === void 0) return;
      event.preventDefault();
      if (/^\d{1,4}$/.test(value)) {
        orderPasteInvalid = false;
        $('order').value = value;
        $('order-error').textContent = '';
        $('order').removeAttribute('aria-invalid');
      } else {
        orderPasteInvalid = true;
        $('order-error').textContent = 'Use quatro números, como #1234.';
        $('order').setAttribute('aria-invalid', 'true');
      }
    });
    $('order').addEventListener('input', () => {
      orderPasteInvalid = false;
      if (/\D/.test($('order').value)) {
        $('order').setAttribute('aria-invalid', 'true');
        $('order-error').textContent = 'Use apenas quatro números, como #1234.';
      } else {
        $('order').removeAttribute('aria-invalid');
        $('order-error').textContent = '';
      }
    });
    function validProduct(value) {
      if (!value) return false;
      if (/^(?:https?|ftp|file|javascript|data):/i.test(value)) {
        try {
          const url = new URL(value);
          return ['http:', 'https:'].includes(url.protocol) && url.hostname.includes('.');
        } catch (_) {
          return false;
        }
      }
      return true;
    }
    function validate() {
      const errors = [];
      const checks = [
        [
          'name',
          $('name').value.trim().length >= 2 && /\p{L}/u.test($('name').value),
          'Informe seu nome.',
        ],
        [
          'order',
          !orderPasteInvalid && (!$('order').value || /^\d{4}$/.test($('order').value)),
          'Informe os quatro números do pedido, como #1234, ou deixe em branco.',
        ],
        [
          'installed',
          ['Sim', 'Não', 'Não sei'].includes($('installed').value),
          'Informe se a peça foi instalada.',
        ],
        [
          'channel',
          ['WhatsApp', 'E-mail'].includes(channel),
          'Escolha WhatsApp ou e-mail para receber nosso retorno.',
        ],
        [
          'contact',
          !channel ||
            (channel === 'E-mail'
              ? $('contact').value.trim() !== '' && $('contact').validity.valid
              : /^\+?[\d\s().-]+$/.test($('contact').value.trim()) &&
                $('contact').value.replace(/\D/g, '').length >= 10 &&
                $('contact').value.replace(/\D/g, '').length <= 15),
          channel === 'E-mail' ? 'Confira o endereço de e-mail.' : 'Informe um WhatsApp com DDD.',
        ],
        [
          'product',
          validProduct($('product').value.trim()),
          'Informe o nome, marca, código ou um link válido do produto.',
        ],
        [
          'date',
          !!$('date').value && $('date').validity.valid && $('date').value <= today,
          'Informe quando recebeu a peça, com uma data válida até hoje.',
        ],
        [
          'problem',
          $('problem').value.trim().length >= 10,
          'Conte um pouco mais sobre o problema (pelo menos 10 caracteres).',
        ],
      ];
      for (const [id, valid, message] of checks) {
        $(id + '-error').textContent = valid ? '' : message;
        if (valid) $(id).removeAttribute('aria-invalid');
        else {
          $(id).setAttribute('aria-invalid', 'true');
          errors.push({ id, message });
        }
      }
      const summary = $('errors');
      summary.replaceChildren();
      summary.hidden = !errors.length;
      if (errors.length) {
        const heading = document.createElement('strong');
        heading.textContent = 'Confira os campos abaixo para continuar.';
        const list = document.createElement('ul');
        for (const error of errors) {
          const li = document.createElement('li'),
            a = document.createElement('a');
          a.href = '#ji-gw-' + error.id;
          a.textContent = error.message;
          a.addEventListener('click', (event) => {
            event.preventDefault();
            $(error.id).focus();
          });
          li.append(a);
          list.append(li);
        }
        summary.append(heading, list);
        summary.focus();
      }
      return !errors.length;
    }
    function addReview(label, value, full = false) {
      const entry = document.createElement('div'),
        dt = document.createElement('dt'),
        dd = document.createElement('dd');
      if (full) entry.className = 'ji-gw-full';
      dt.textContent = label;
      dd.textContent = value || 'Não informado';
      entry.append(dt, dd);
      $('review-data').append(entry);
    }
    function showReview() {
      $('review-data').replaceChildren();
      addReview('Nome', $('name').value.trim());
      addReview('Pedido', $('order').value ? '#' + $('order').value : 'Não informado');
      addReview('Retorno por ' + channel, $('contact').value.trim());
      addReview('Produto', $('product').value.trim());
      const date = $('date').value;
      addReview('Recebimento', date ? date.split('-').reverse().join('/') : 'Não informado');
      addReview('Peça instalada?', $('installed').value || 'Não informado');
      if ($('installed').value === 'Sim')
        addReview('Veículo e instalação', $('vehicle').value.trim(), true);
      addReview('Problema apresentado', $('problem').value.trim(), true);
      if ($('notes').value.trim()) addReview('Observações', $('notes').value.trim(), true);
      addReview(
        'Arquivos',
        files.length
          ? files.map((f) => f.name + ' (' + size(f.size) + ')').join('\n')
          : 'Sem anexos. Você pode continuar assim.',
        true
      );
      transition('review', 1);
      $('review-title').focus({ preventScroll: true });
      review.scrollIntoView({ block: 'start' });
    }
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (processing) {
        announce('Aguarde a preparação dos arquivos.');
        return;
      }
      if (validate()) showReview();
    });
    $('edit').addEventListener('click', () => {
      transition('form', 0);
      $('name').focus({ preventScroll: true });
      form.scrollIntoView({ block: 'start' });
    });
    let sending = false;
    const sendStatus = document.createElement('p');
    sendStatus.id = 'ji-gw-send-status';
    sendStatus.setAttribute('role', 'status');
    sendStatus.tabIndex = -1;
    review.append(sendStatus);
    $('send').addEventListener('click', async () => {
      if (sending) return;
      sending = true;
      $('send').disabled = true;
      $('edit').disabled = true;
      review.setAttribute('aria-busy', 'true');
      sendStatus.textContent = 'Enviando solicitação…';
      try {
        if (typeof root2.jiSendWarranty !== 'function') throw new Error('Receiver unavailable');
        const confirmation = await root2.jiSendWarranty(
          {
            name: $('name').value.trim(),
            order: $('order').value ? '#' + $('order').value : '',
            channel,
            contact: $('contact').value.trim(),
            product: $('product').value.trim(),
            received: $('date').value,
            installed: $('installed').value,
            vehicle: $('installed').value === 'Sim' ? $('vehicle').value.trim() : '',
            problem: $('problem').value.trim(),
            notes: $('notes').value.trim(),
          },
          files
        );
        if (confirmation?.received !== true || typeof confirmation.protocol !== 'string')
          throw new Error('Not confirmed');
        $('result-title').textContent = 'Solicitação recebida';
        result.querySelector('p').textContent =
          'Protocolo: ' +
          confirmation.protocol +
          '. Nossa equipe vai analisar as informações e entrar em contato pelo canal informado.';
        $('back').hidden = true;
        sendStatus.textContent = '';
        transition('result', 2);
        $('result-title').focus({ preventScroll: true });
        result.scrollIntoView({ block: 'start' });
      } catch (_) {
        sendStatus.textContent =
          'Não foi possível confirmar o recebimento. Aguarde alguns instantes e tente novamente sem alterar os dados. Se preferir, fale com nossa equipe pelos canais de atendimento.';
        sendStatus.focus();
      } finally {
        sending = false;
        $('send').disabled = false;
        $('edit').disabled = false;
        review.removeAttribute('aria-busy');
      }
    });
    $('back').addEventListener('click', () => {
      transition('review', 1);
      $('review-title').focus({ preventScroll: true });
      review.scrollIntoView({ block: 'start' });
    });
    root2.dataset.formReady = 'true';
  })();

  // src/transporte.mjs
  function createWarrantyTransport(callable) {
    if (typeof callable !== 'function') throw new TypeError('Transporte não configurado.');
    let pending = false;
    let requestId = '';
    let lastFingerprint = '';
    let lastResult = null;
    return async function send(fields, files = []) {
      if (pending) throw new Error('Aguarde o envio em andamento.');
      pending = true;
      try {
        const fileData = [];
        let total = 0;
        if (files.length > 5) throw new Error('Selecione até cinco anexos.');
        for (const file of files) {
          total += file.size;
          if (!file.size || total > 10 * 1024 * 1024)
            throw new Error('Os anexos devem somar até 10 MB.');
          const bytes = new Uint8Array(await file.arrayBuffer());
          let binary = '';
          for (let offset = 0; offset < bytes.length; offset += 32768)
            binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
          const types = {
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            png: 'image/png',
            webp: 'image/webp',
            heic: 'image/heic',
            pdf: 'application/pdf',
            mp4: 'video/mp4',
            mov: 'video/quicktime',
            webm: 'video/webm',
          };
          const type = file.type || types[file.name.split('.').pop().toLowerCase()] || '';
          fileData.push({ name: file.name, type, base64: btoa(binary) });
        }
        const body = JSON.stringify({ ...fields, files: fileData });
        const hash = Array.from(
          new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body))),
          (n) => n.toString(16).padStart(2, '0')
        ).join('');
        if (hash !== lastFingerprint) {
          requestId = crypto.randomUUID();
          lastFingerprint = hash;
          lastResult = null;
        }
        if (lastResult) return lastResult;
        const response = await callable({ ...fields, requestId, files: fileData });
        if (response?.data?.received !== true || typeof response.data.protocol !== 'string')
          throw new Error('Recebimento não confirmado. Tente novamente.');
        lastResult = response.data;
        return lastResult;
      } finally {
        pending = false;
      }
    };
  }

  // src/configurar-transporte.mjs
  var disabled = Object.freeze({ enabled: false });
  var config = globalThis.JI_WARRANTY_CONFIG || disabled;
  var root = document.querySelector('.ji-warranty-request');
  if (root) {
    let operation;
    root.jiSendWarranty = async (...args) => {
      if (!config.enabled || !config.firebasePublicConfig?.appId || !config.recaptchaSiteKey) {
        throw new Error(
          'Formulário ainda não ativado. Fale com a equipe pelos canais de atendimento.'
        );
      }
      if (!operation)
        operation = (async () => {
          const [appSDK, checkSDK, functionSDK] = await Promise.all([
            import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js'),
            import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app-check.js'),
            import('https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js'),
          ]);
          const app = appSDK.initializeApp(config.firebasePublicConfig, 'ji-warranty-public');
          checkSDK.initializeAppCheck(app, {
            provider: new checkSDK.ReCaptchaV3Provider(config.recaptchaSiteKey),
            isTokenAutoRefreshEnabled: true,
          });
          const callable = functionSDK.httpsCallable(
            functionSDK.getFunctions(app, 'southamerica-east1'),
            'receiveSiteWarranty',
            { limitedUseAppCheckTokens: true, timeout: 12e4 }
          );
          return createWarrantyTransport(callable);
        })().catch((error) => {
          operation = void 0;
          throw error;
        });
      return (await operation)(...args);
    };
  }
})();
