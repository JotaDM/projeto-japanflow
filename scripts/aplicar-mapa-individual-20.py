"""Patch pontual do mapa: preserva outros ajustes feitos no projeto 1.9."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]

def patch(path, old, new, *, optional=False):
    file = ROOT / path
    text = file.read_text(encoding='utf-8')
    if new in text:
        print(f'OK: {path} (ja aplicado)')
        return
    if old not in text:
        if optional:
            print(f'AVISO: {path}: trecho opcional nao encontrado')
            return
        raise RuntimeError(f'PARADO: estrutura inesperada em {path}. Nada foi alterado nesse arquivo.')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')
    print(f'OK: {path}')

# Verifique trechos essenciais ANTES de modificar qualquer coisa.
checks = {
    'src/App.tsx': ["const DepartmentalPage = lazy(() => import('@/pages/DepartmentalPage'));", '<Route path="/departmental" element={<DepartmentalPage />} />'],
    'src/pages/DepartmentalPage.tsx': ['<MotoboyLiveMap open={mapOpen} onOpenChange={setMapOpen} getName={getName} />'],
    'src/components/MotoboyLiveMap.tsx': ['export function MotoboyLiveMap('],
}
for name, fragments in checks.items():
    data = (ROOT / name).read_text(encoding='utf-8')
    if not all(fragment in data for fragment in fragments):
        # Reaplicacao: aceitar quando a pagina ja esta registrada.
        if name == 'src/App.tsx' and "import('@/pages/MotoboyTrackingPage')" in data:
            continue
        if name == 'src/pages/DepartmentalPage.tsx' and 'to="/departmental/motoboys/mapa"' in data:
            continue
        if name == 'src/components/MotoboyLiveMap.tsx' and 'export function MotoboyLiveMap(' not in data:
            continue
        raise RuntimeError(f'PARADO: {name} difere da versao esperada. Nenhum arquivo foi alterado.')

patch('src/App.tsx',
      "const DepartmentalPage = lazy(() => import('@/pages/DepartmentalPage'));",
      "const DepartmentalPage = lazy(() => import('@/pages/DepartmentalPage'));\nconst MotoboyTrackingPage = lazy(() => import('@/pages/MotoboyTrackingPage'));")
patch('src/App.tsx',
      '<Route path="/departmental" element={<DepartmentalPage />} />',
      '<Route path="/departmental" element={<DepartmentalPage />} />\n                <Route path="/departmental/motoboys/mapa" element={<MotoboyTrackingPage />} />')
patch('src/components/AppLayout.tsx',
      "  '/departmental': 'Departamental',",
      "  '/departmental': 'Departamental',\n  '/departmental/motoboys/mapa': 'Mapa de motoboys',")
patch('src/pages/DepartmentalPage.tsx',
      "import { MotoboyLocationSharing, MotoboyLiveMap } from '@/components/MotoboyLiveMap';",
      "import { MotoboyLocationSharing } from '@/components/MotoboyLiveMap';\nimport { Link } from 'react-router-dom';")
patch('src/pages/DepartmentalPage.tsx', '  const [mapOpen, setMapOpen] = useState(false);\n', '', optional=True)
patch('src/pages/DepartmentalPage.tsx',
      '''                <Button size="sm" variant="outline" onClick={() => setMapOpen(true)}>
                  <Navigation className="mr-1 h-3.5 w-3.5" /> Mapa de motoboys
                </Button>''',
      '''                {(isAdmin || currentUser?.id === 'emp-1') && (
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/departmental/motoboys/mapa">
                      <Navigation className="mr-1 h-3.5 w-3.5" /> Mapa de motoboys
                    </Link>
                  </Button>
                )}''')
patch('src/pages/DepartmentalPage.tsx',
      '            <MotoboyLiveMap open={mapOpen} onOpenChange={setMapOpen} getName={getName} />\n', '')
# Remocao da UI antiga: parte antes da declaracao export permanece inalterada.
f = ROOT / 'src/components/MotoboyLiveMap.tsx'
s = f.read_text(encoding='utf-8')
anchor = 'export function MotoboyLiveMap('
if anchor in s:
    s = s[:s.index(anchor)]
    s = s.replace("import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';\n", '')
    s = s.replace("import { MapPin, Navigation, ShieldCheck } from 'lucide-react';", "import { Navigation } from 'lucide-react';")
    s = s.replace('type Location = { rideId: string; userId: string; lat: number; lng: number; accuracy: number; updatedAt: number };\n\n', '')
    f.write_text(s, encoding='utf-8')
    print('OK: src/components/MotoboyLiveMap.tsx (somente popup removido; rastreamento mantido)')
print('Patch aplicado. Rode prettier, typecheck, lint e build antes de commitar.')
