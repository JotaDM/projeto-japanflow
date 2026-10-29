"""Adiciona seção de permissão de GPS ao perfil sem sobrescrever o arquivo inteiro."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
profile = ROOT / 'src/pages/ProfilePage.tsx'
component = ROOT / 'src/components/MotoboyLocationPermission.tsx'

if not profile.is_file() or not component.is_file():
    raise SystemExit('Arquivos ausentes. Extraia o ZIP na raiz do projeto e execute novamente.')

source = profile.read_text(encoding='utf-8')
import_line = "import { MotoboyLocationPermission } from '@/components/MotoboyLocationPermission';"
if import_line not in source:
    anchor = "import ThemeSwitcher from '@/components/ThemeSwitcher';"
    if source.count(anchor) != 1:
        raise SystemExit('Não localizei o ponto de importação do ProfilePage. Nenhum arquivo foi alterado.')
    source = source.replace(anchor, anchor + '\n' + import_line, 1)

widget = "{currentUser.sectors?.includes('motoboys') && <MotoboyLocationPermission />}"
if widget not in source:
    anchor = '      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(280px,.82fr)_minmax(0,1.18fr)]">\n        <div className="space-y-5">'
    if source.count(anchor) != 1:
        raise SystemExit('Não localizei a coluna do perfil com segurança. Nenhum arquivo foi alterado.')
    source = source.replace(anchor, anchor + '\n          ' + widget, 1)

profile.write_text(source, encoding='utf-8')
print('OK: Permissão de localização adicionada ao Meu Perfil dos motoboys.')
