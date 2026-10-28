import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  getBlob: vi.fn(),
  upload: vi.fn(),
  claim: {
    id: 'site-test',
    clientName: 'Cliente Fictício React',
    supplierName: '',
    productBrand: '',
    itemName: 'Peça fictícia React',
    itemCode: '',
    defectDescription: 'Problema fictício de teste',
    saleDate: '',
    invoiceNumber: '',
    status: 'pendente',
    requestedBy: 'site',
    laborReimbursementEnabled: false,
    laborReimbursementFileUrl: null,
    bankDetails: null,
    vehicleDocumentUrl: null,
    identityDocumentUrl: null,
    installationMileage: null,
    currentMileage: null,
    productImages: [],
    createdAt: '2026-10-27T12:00:00Z',
    updatedAt: '2026-10-27T12:00:00Z',
    origin: 'site',
    siteProtocol: 'JI-TESTE-REACT',
    siteOrder: '#0007',
    siteContactChannel: 'E-mail',
    siteContact: 'teste@example.com',
    siteReceived: '2020-01-02',
    siteInstalled: 'Não',
    siteVehicle: '',
    siteNotes: 'Observação fictícia',
    siteAttachments: [],
  },
}));
vi.mock('@/lib/firebase', () => ({ db: {}, storage: {}, auth: {} }));
vi.mock('firebase/storage', () => ({
  ref: (_storage: unknown, path: string) => ({ path }),
  getBlob: mocks.getBlob,
}));
vi.mock('@/contexts/AppContext', () => ({
  useApp: () => ({ currentUser: { id: 'test-employee', name: 'Funcionário Fictício' }, users: [] }),
}));
vi.mock('@/hooks/useWarranties', () => ({
  useWarranties: () => ({
    claims: [mocks.claim],
    updates: [],
    createClaim: vi.fn(),
    updateClaimStatus: vi.fn(),
    addUpdate: vi.fn(),
    fetchUpdates: vi.fn(),
  }),
}));
vi.mock('@/lib/uploadImage', () => ({ uploadImage: mocks.upload }));
import WarrantySiteDetails from '../WarrantySiteDetails';
import WarrantiesPanel from '../WarrantiesPanel';
const file = {
  path: 'attachments/warranties/site/00000000-0000-4000-8000-000000000029/' + 'a'.repeat(64) + '/0',
  name: 'comprovacao.png',
  type: 'image/png',
  size: 3,
  sha256: 'a'.repeat(64),
};
let root: Root | undefined;
async function mount(element: React.ReactNode) {
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(element);
  });
  return host;
}
function text(value: string): HTMLElement | undefined {
  return [...document.body.querySelectorAll<HTMLElement>('*')].find(
    (element) => element.childElementCount === 0 && element.textContent?.trim() === value
  );
}
const image = () => document.querySelector<HTMLImageElement>('img[alt="comprovacao.png"]');
const download = () => document.querySelector<HTMLAnchorElement>('a[download="comprovacao.png"]');

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mocks.getBlob.mockReset().mockResolvedValue(new Blob(['fake'], { type: 'image/png' }));
  mocks.upload.mockReset();
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:local-test'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
});
afterEach(async () => {
  if (root) {
    await act(async () => {
      root!.unmount();
    });
    root = undefined;
  }
  document.body.replaceChildren();
});
test('detalhe Site organiza pedido, contato, recebimento e instalação', async () => {
  await mount(<WarrantySiteDetails claim={{ ...mocks.claim } as any} />);
  expect(text('Recebida pelo Site')).toBeTruthy();
  expect(text('#0007')).toBeTruthy();
  expect(text('teste@example.com')).toBeTruthy();
  expect(text('02/01/2020')).toBeTruthy();
  expect(mocks.getBlob).not.toHaveBeenCalled();
});
test('não adiciona seção Site em uma garantia manual', async () => {
  const host = await mount(<WarrantySiteDetails claim={{ ...mocks.claim, origin: '' } as any} />);
  expect(host.childElementCount).toBe(0);
  expect(mocks.getBlob).not.toHaveBeenCalled();
});
test('anexo privado carrega e libera URL ao desmontar', async () => {
  let resolve!: (blob: Blob) => void;
  mocks.getBlob.mockImplementationOnce(
    () =>
      new Promise<Blob>((complete) => {
        resolve = complete;
      })
  );
  await mount(<WarrantySiteDetails claim={{ ...mocks.claim, siteAttachments: [file] } as any} />);
  expect(text('Carregando anexo…')).toBeTruthy();
  await act(async () => {
    resolve(new Blob(['fake'], { type: 'image/png' }));
  });
  expect(image()?.getAttribute('src')).toBe('blob:local-test');
  expect(mocks.getBlob).toHaveBeenCalledWith({ path: file.path }, 10 * 1024 * 1024);
  expect(download()?.textContent).toBe('Baixar anexo');
  await act(async () => {
    root!.unmount();
  });
  root = undefined;
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-test');
});
test('erro de leitura permite tentar novamente', async () => {
  mocks.getBlob.mockRejectedValueOnce(new Error('Erro fictício de leitura'));
  await mount(<WarrantySiteDetails claim={{ ...mocks.claim, siteAttachments: [file] } as any} />);
  const retry = text('Tentar novamente');
  expect(retry).toBeTruthy();
  await act(async () => {
    retry!.click();
  });
  expect(image()).toBeTruthy();
  expect(mocks.getBlob).toHaveBeenCalledTimes(2);
});
test('formato de imagem não exibido mantém download disponível', async () => {
  await mount(<WarrantySiteDetails claim={{ ...mocks.claim, siteAttachments: [file] } as any} />);
  await act(async () => {
    image()!.dispatchEvent(new Event('error', { bubbles: true }));
  });
  expect(text('Prévia indisponível neste navegador. Baixe o anexo para visualizar.')).toBeTruthy();
  expect(download()).toBeTruthy();
});
test('caminho fora da pasta esperada não é consultado', async () => {
  await mount(
    <WarrantySiteDetails
      claim={{ ...mocks.claim, siteAttachments: [{ ...file, path: '../arquivo' }] } as any}
    />
  );
  expect(text('Tentar novamente')).toBeTruthy();
  expect(mocks.getBlob).not.toHaveBeenCalled();
});

test('falha de permissão mantém anexo privado indisponível e não oferece download', async () => {
  mocks.getBlob.mockRejectedValueOnce(new Error('storage/unauthorized'));
  await mount(<WarrantySiteDetails claim={{ ...mocks.claim, siteAttachments: [file] } as any} />);
  expect(text('Tentar novamente')).toBeTruthy();
  expect(download()).toBeFalsy();
  expect(image()).toBeFalsy();
});
test('anexo privado não gera URL sem sucesso de leitura', async () => {
  mocks.getBlob.mockRejectedValueOnce(new Error('storage/object-not-found'));
  await mount(<WarrantySiteDetails claim={{ ...mocks.claim, siteAttachments: [file] } as any} />);
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  expect(download()).toBeFalsy();
});

test('painel existente mostra Solicitante Site e abre o detalhe correto', async () => {
  await mount(<WarrantiesPanel />);
  expect(text('Solicitante: Site')).toBeTruthy();
  const customer = text('Cliente Fictício React');
  expect(customer).toBeTruthy();
  await act(async () => {
    customer!.click();
  });
  expect(text('Detalhes da Garantia')).toBeTruthy();
  expect(text('Recebida pelo Site')).toBeTruthy();
  expect(text('#0007')).toBeTruthy();
  expect(mocks.upload).not.toHaveBeenCalled();
});
