import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
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
beforeEach(() => {
  mocks.getBlob.mockReset().mockResolvedValue(new Blob(['fake'], { type: 'image/png' }));
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:local-test'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
});
afterEach(() => cleanup());
test('detalhe Site organiza pedido, contato, recebimento e instalação', () => {
  render(<WarrantySiteDetails claim={{ ...mocks.claim } as any} />);
  expect(screen.getByRole('heading', { name: 'Recebida pelo Site' })).toBeTruthy();
  expect(screen.getByText('#0007')).toBeTruthy();
  expect(screen.getByText('teste@example.com')).toBeTruthy();
  expect(screen.getByText('02/01/2020')).toBeTruthy();
  expect(mocks.getBlob).not.toHaveBeenCalled();
});
test('não adiciona seção Site em uma garantia manual', () => {
  const { container } = render(
    <WarrantySiteDetails claim={{ ...mocks.claim, origin: '' } as any} />
  );
  expect(container.innerHTML).toBe('');
  expect(mocks.getBlob).not.toHaveBeenCalled();
});
test('anexo privado carrega e libera URL ao desmontar', async () => {
  const { unmount } = render(
    <WarrantySiteDetails claim={{ ...mocks.claim, siteAttachments: [file] } as any} />
  );
  expect(screen.getByRole('status').textContent).toContain('Carregando');
  const image = await screen.findByRole('img', { name: 'comprovacao.png' });
  expect(image.getAttribute('src')).toBe('blob:local-test');
  expect(mocks.getBlob).toHaveBeenCalledWith({ path: file.path }, 10 * 1024 * 1024);
  expect(screen.getByRole('link', { name: 'Baixar anexo' }).getAttribute('download')).toBe(
    'comprovacao.png'
  );
  unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-test');
});
test('erro de leitura permite tentar novamente', async () => {
  mocks.getBlob.mockRejectedValueOnce(new Error('Erro fictício de leitura'));
  render(<WarrantySiteDetails claim={{ ...mocks.claim, siteAttachments: [file] } as any} />);
  const retry = await screen.findByRole('button', { name: 'Tentar novamente' });
  fireEvent.click(retry);
  expect(await screen.findByRole('img', { name: 'comprovacao.png' })).toBeTruthy();
  expect(mocks.getBlob).toHaveBeenCalledTimes(2);
});
test('formato de imagem não exibido mantém download disponível', async () => {
  render(<WarrantySiteDetails claim={{ ...mocks.claim, siteAttachments: [file] } as any} />);
  fireEvent.error(await screen.findByRole('img', { name: 'comprovacao.png' }));
  expect(screen.getByText(/Prévia indisponível neste navegador/)).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Baixar anexo' })).toBeTruthy();
});
test('caminho fora da pasta esperada não é consultado', async () => {
  render(
    <WarrantySiteDetails
      claim={{ ...mocks.claim, siteAttachments: [{ ...file, path: '../arquivo' }] } as any}
    />
  );
  expect(await screen.findByRole('button', { name: 'Tentar novamente' })).toBeTruthy();
  expect(mocks.getBlob).not.toHaveBeenCalled();
});
test('painel existente mostra Solicitante Site e abre o detalhe correto', async () => {
  render(<WarrantiesPanel />);
  expect(screen.getByText('Solicitante: Site')).toBeTruthy();
  fireEvent.click(screen.getByText('Cliente Fictício React'));
  expect(await screen.findByRole('heading', { name: 'Detalhes da Garantia' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Recebida pelo Site' })).toBeTruthy();
  expect(screen.getByText('#0007')).toBeTruthy();
  expect(mocks.upload).not.toHaveBeenCalled();
});
